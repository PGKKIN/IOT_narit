from fastapi import FastAPI, Depends, HTTPException, Query, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
import io
import csv
import json
import os
import smtplib
import asyncio
import re
import sys
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import Header

import models, schemas
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Lab Monitoring System API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Sensor-Active"],
)

# ---- Configuration & Email Alerts Setup ----
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.json")
config = {
    "smtp_server": "smtp.gmail.com",
    "smtp_port": 465,
    "smtp_email": "copphotonicchip@gmail.com",
    "smtp_password": "YOUR_GMAIL_APP_PASSWORD_HERE",
    "recipient_emails": ["copphotonicchip@gmail.com"],
    "humidity_threshold_cleanroom": 60.0,
    "humidity_threshold_fablab": 65.0,
    "temp_threshold_high": 40.0,
    "temp_threshold_low": 10.0,
    "alert_cooldown_minutes": 30,
    "daily_summary_time": "08:30"
}

if os.path.exists(CONFIG_PATH):
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            loaded_config = json.load(f)
        
        # Migrate singular recipient_email if present
        if "recipient_emails" not in loaded_config:
            if "recipient_email" in loaded_config:
                loaded_config["recipient_emails"] = [loaded_config["recipient_email"]]
            else:
                loaded_config["recipient_emails"] = ["copphotonicchip@gmail.com"]
            
            # Save migrated config back to file
            try:
                temp_full = {}
                temp_full.update(config)
                temp_full.update(loaded_config)
                with open(CONFIG_PATH, "w", encoding="utf-8") as f:
                    json.dump(temp_full, f, indent=2)
            except Exception as e:
                print(f"Error saving migrated config.json: {e}")
        
        config.update(loaded_config)
        print("[Config] SMTP and alert configurations loaded successfully.")
    except Exception as e:
        print(f"Error loading config.json: {e}")

# Bind global threshold variables explicitly to persistent config
humidity_threshold_cleanroom = config.get("humidity_threshold_cleanroom", 60.0)
humidity_threshold_fablab = config.get("humidity_threshold_fablab", 65.0)
temp_threshold_high = config.get("temp_threshold_high", 40.0)
temp_threshold_low = config.get("temp_threshold_low", 10.0)
alert_cooldown_minutes = config.get("alert_cooldown_minutes", 30)
daily_summary_time = config.get("daily_summary_time", "08:30")
recipient_emails = config.get("recipient_emails", ["copphotonicchip@gmail.com"])
smtp_server = config.get("smtp_server", "smtp.gmail.com")
smtp_port = config.get("smtp_port", 465)
smtp_email = config.get("smtp_email", "copphotonicchip@gmail.com")

last_alert_sent = {
    "cleanroom": None,
    "fablab": None
}

# Downsampling control to avoid database growth (store every 30 seconds)
last_db_write = {
    "fablab": datetime.min,
    "cleanroom": datetime.min
}

latest_readings = {
    "fablab": None,
    "cleanroom": None
}

# Track the timestamp when a sensor first reported 0.0 to check for continuous failure (require 10 minutes)
zero_first_detected = {
    "dht_temp": None,
    "dht_hum": None,
    "ds1_temp": None,
    "ds2_temp": None,
    "ds3_temp": None
}

# Track if a failure alert has already been sent for each sensor
sensor_failed_state = {
    "dht_temp": False,
    "dht_hum": False,
    "ds1_temp": False,
    "ds2_temp": False,
    "ds3_temp": False
}


def send_email_sync(subject: str, body: str, attachments: list = None):
    if config["smtp_password"] in ("YOUR_GMAIL_APP_PASSWORD_HERE", "", None):
        print("[SMTP] Email skipped: Gmail App Password is not configured in config.json.")
        return
        
    try:
        recipients = config.get("recipient_emails", [])
        if not recipients:
            print("[SMTP] Email skipped: No recipients configured in config.json.")
            return

        msg = MIMEMultipart()
        msg['From'] = config["smtp_email"]
        msg['To'] = ", ".join(recipients)
        msg['Subject'] = Header(subject, 'utf-8')
        msg.attach(MIMEText(body, 'html', 'utf-8'))
        
        if attachments:
            from email.mime.image import MIMEImage
            for cid, img_bytes in attachments:
                mime_img = MIMEImage(img_bytes)
                mime_img.add_header('Content-ID', f'<{cid}>')
                mime_img.add_header('Content-Disposition', 'inline', filename=f'{cid}.png')
                msg.attach(mime_img)
        
        server = smtplib.SMTP_SSL(config["smtp_server"], config["smtp_port"])
        server.login(config["smtp_email"], config["smtp_password"])
        server.sendmail(config["smtp_email"], recipients, msg.as_string())
        server.close()
        print("[SMTP] Email successfully sent.")
    except Exception as e:
        # Encode or format exception message to be printed safely
        err_msg = str(e).encode('ascii', errors='replace').decode('ascii')
        print(f"[SMTP] Failed to send email alert: {err_msg}")

def load_limits_from_pdf():
    pdf_path = os.path.join(os.path.dirname(__file__), "..", "Thorlabs 202C.pdf")
    temp_min = 10.0
    temp_max = 40.0
    hum_max = 80.0
    
    if not os.path.exists(pdf_path):
        print(f"[PDF] Thorlabs 202C.pdf not found at {pdf_path}. Using fallback limits: 10-40C, <80% humidity.")
        return temp_min, temp_max, hum_max

    try:
        from pypdf import PdfReader
        reader = PdfReader(pdf_path)
        
        # Read page 41 (index 40) for operating temp
        if len(reader.pages) > 40:
            p41_text = reader.pages[40].extract_text()
            match = re.search(r"(\d+)\s*°C\s+to\s+(\d+)\s*°C", p41_text)
            if match:
                temp_min = float(match.group(1))
                temp_max = float(match.group(2))
            else:
                match_fallback = re.search(r"(\d+)\s*[°C\s]+to\s+(\d+)\s*[°C\s]+", p41_text)
                if match_fallback:
                    temp_min = float(match_fallback.group(1))
                    temp_max = float(match_fallback.group(2))

        # Read page 42 (index 41) for relative humidity
        if len(reader.pages) > 41:
            p42_text = reader.pages[41].extract_text()
            match = re.search(r"<\s*(\d+)\s*%", p42_text)
            if match:
                hum_max = float(match.group(1))
    except Exception as e:
        print(f"[PDF] Error parsing PDF for limits: {e}. Using fallback limits: 10-40C, <80% humidity.")
        
    return temp_min, temp_max, hum_max

def check_sensor_status(sensor_key: str, value: float, display_name: str, background_tasks: BackgroundTasks):
    global zero_first_detected, sensor_failed_state
    
    if value == 0.0:
        if zero_first_detected[sensor_key] is None:
            zero_first_detected[sensor_key] = datetime.now()
        
        # Trigger failure alert if 0.0 is read continuously for 10 minutes
        elapsed = datetime.now() - zero_first_detected[sensor_key]
        if elapsed >= timedelta(minutes=10) and not sensor_failed_state[sensor_key]:
            sensor_failed_state[sensor_key] = True
            
            # Save alert log to database
            from database import SessionLocal
            db = SessionLocal()
            try:
                log_item = models.AlertLog(
                    room="cleanroom",
                    sensor=display_name,
                    value=0.0,
                    limit_value=0.0,
                    message=f"Sensor Failure: {display_name} is disconnected or reading 0.0 (Failed for 10 mins)"
                )
                db.add(log_item)
                db.commit()
            except Exception as dbe:
                print(f"[Alert DB] Failed to save {display_name} sensor failure log: {dbe}")
            finally:
                db.close()
                
            # Send Email
            subject = f"⚠️ Hardware Alert: {display_name} Sensor Failure"
            body = f"""
            <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background-color: #ffebee; border-left: 5px solid #ef5350; padding: 15px; margin-bottom: 20px;">
                        <h2 style="color: #c62828; margin-top: 0; margin-bottom: 0;">⚠️ Hardware Failure Alert</h2>
                    </div>
                    <p>The system has detected that the <strong>{display_name}</strong> sensor has been reporting 0.0 (possibly disconnected or failed) for more than 10 minutes.</p>
                    <table style="border-collapse: collapse; width: 100%; font-size: 14px;">
                        <tr style="border-bottom: 1px solid #ddd;">
                            <td style="padding: 10px; font-weight: bold; width: 150px;">Sensor:</td>
                            <td style="padding: 10px;">{display_name}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #ddd;">
                            <td style="padding: 10px; font-weight: bold;">Status:</td>
                            <td style="padding: 10px; color: #dc2626; font-weight: bold;">Disconnected / Reading 0.0 (Failed for 10 mins)</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #ddd;">
                            <td style="padding: 10px; font-weight: bold;">Timestamp:</td>
                            <td style="padding: 10px;">{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</td>
                        </tr>
                    </table>
                    <p style="font-size: 12px; color: #888; margin-top: 20px;">Please check the physical hardware connections of the sensor.</p>
                </body>
            </html>
            """
            background_tasks.add_task(send_email_sync, subject, body)
    else:
        zero_first_detected[sensor_key] = None
        if sensor_failed_state[sensor_key]:
            sensor_failed_state[sensor_key] = False
            
            # Save alert log to database
            from database import SessionLocal
            db = SessionLocal()
            try:
                log_item = models.AlertLog(
                    room="cleanroom",
                    sensor=display_name,
                    value=value,
                    limit_value=0.0,
                    message=f"Sensor Recovered: {display_name} is back online (Value: {value})"
                )
                db.add(log_item)
                db.commit()
            except Exception as dbe:
                print(f"[Alert DB] Failed to save {display_name} sensor recovery log: {dbe}")
            finally:
                db.close()
                
            # Send Email
            subject = f"✅ Resolved: {display_name} Sensor Recovered"
            body = f"""
            <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background-color: #e8f5e9; border-left: 5px solid #4caf50; padding: 15px; margin-bottom: 20px;">
                        <h2 style="color: #2e7d32; margin-top: 0; margin-bottom: 0;">✅ Sensor Failure Resolved</h2>
                    </div>
                    <p>The <strong>{display_name}</strong> sensor has recovered and is now reporting valid values.</p>
                    <table style="border-collapse: collapse; width: 100%; font-size: 14px;">
                        <tr style="border-bottom: 1px solid #ddd;">
                            <td style="padding: 10px; font-weight: bold; width: 150px;">Sensor:</td>
                            <td style="padding: 10px;">{display_name}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #ddd;">
                            <td style="padding: 10px; font-weight: bold;">Current Value:</td>
                            <td style="padding: 10px; color: #16a34a; font-weight: bold;">{value}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #ddd;">
                            <td style="padding: 10px; font-weight: bold;">Timestamp:</td>
                            <td style="padding: 10px;">{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</td>
                        </tr>
                    </table>
                </body>
            </html>
            """
            background_tasks.add_task(send_email_sync, subject, body)

def check_cleanroom_alerts(db_item, background_tasks: BackgroundTasks):
    temp_min, temp_max, hum_max = load_limits_from_pdf()
    
    dht_temp = db_item.dht_temp
    dht_hum = db_item.dht_hum
    ds1_temp = db_item.ds1_temp
    ds2_temp = db_item.ds2_temp
    ds3_temp = db_item.ds3_temp
    
    # Check sensor online/offline states
    check_sensor_status("dht_temp", dht_temp, "DHT Ambient Temp", background_tasks)
    check_sensor_status("dht_hum", dht_hum, "DHT Humidity", background_tasks)
    check_sensor_status("ds1_temp", ds1_temp, "Air Inlet (DS1)", background_tasks)
    check_sensor_status("ds2_temp", ds2_temp, "Optical Table 1 (DS2)", background_tasks)
    check_sensor_status("ds3_temp", ds3_temp, "Optical Table 2 (DS3)", background_tasks)
    
    reasons = []
    breached_sensors = []
    
    # Only verify environment safety limits if the reading is not 0.0 (not errored)
    if dht_hum != 0.0 and dht_hum >= hum_max:
        reasons.append(f"DHT Humidity ({dht_hum}%) exceeded safety limit (<{hum_max}%)")
        breached_sensors.append(("DHT Humidity", dht_hum, hum_max, f"Humidity ({dht_hum}%) exceeded safety limit (<{hum_max}%)"))
    if dht_temp != 0.0 and not (temp_min <= dht_temp <= temp_max):
        reasons.append(f"DHT Ambient Temp ({dht_temp}°C) outside safety limit ({temp_min}-{temp_max}°C)")
        limit_val = temp_min if dht_temp < temp_min else temp_max
        breached_sensors.append(("DHT Ambient Temp", dht_temp, limit_val, f"Temperature ({dht_temp}°C) outside safety limit ({temp_min}-{temp_max}°C)"))
    if ds1_temp != 0.0 and not (temp_min <= ds1_temp <= temp_max):
        reasons.append(f"Air Inlet DS1 Temp ({ds1_temp}°C) outside safety limit ({temp_min}-{temp_max}°C)")
        limit_val = temp_min if ds1_temp < temp_min else temp_max
        breached_sensors.append(("Air Inlet (DS1)", ds1_temp, limit_val, f"Air Inlet Temp ({ds1_temp}°C) outside safety limit ({temp_min}-{temp_max}°C)"))
    if ds2_temp != 0.0 and not (temp_min <= ds2_temp <= temp_max):
        reasons.append(f"Optical Table 1 DS2 Temp ({ds2_temp}°C) outside safety limit ({temp_min}-{temp_max}°C)")
        limit_val = temp_min if ds2_temp < temp_min else temp_max
        breached_sensors.append(("Optical Table 1 (DS2)", ds2_temp, limit_val, f"Optical Table 1 Temp ({ds2_temp}°C) outside safety limit ({temp_min}-{temp_max}°C)"))
    if ds3_temp != 0.0 and not (temp_min <= ds3_temp <= temp_max):
        reasons.append(f"Optical Table 2 DS3 Temp ({ds3_temp}°C) outside safety limit ({temp_min}-{temp_max}°C)")
        limit_val = temp_min if ds3_temp < temp_min else temp_max
        breached_sensors.append(("Optical Table 2 (DS3)", ds3_temp, limit_val, f"Optical Table 2 Temp ({ds3_temp}°C) outside safety limit ({temp_min}-{temp_max}°C)"))
        
    if reasons:
        now = datetime.now()
        last_sent = last_alert_sent.get("cleanroom")
        cooldown = timedelta(minutes=config.get("alert_cooldown_minutes", 30))
        
        if last_sent is None or (now - last_sent) >= cooldown:
            last_alert_sent["cleanroom"] = now
            
            # Save alert log to database
            from database import SessionLocal
            db = SessionLocal()
            try:
                for sensor_name, val, limit, msg in breached_sensors:
                    log_item = models.AlertLog(
                        room="cleanroom",
                        sensor=sensor_name,
                        value=val,
                        limit_value=limit,
                        message=msg
                    )
                    db.add(log_item)
                db.commit()
            except Exception as dbe:
                print(f"[Alert DB] Failed to save cleanroom alert log: {dbe}")
            finally:
                db.close()
                
            subject = f"⚠️ Alert: Cleanroom Environment Out of Bounds"
            
            def cell_style(val, is_temp, name):
                if is_temp:
                    is_normal = temp_min <= val <= temp_max
                    limit_str = f"{temp_min}-{temp_max}°C"
                    val_str = f"{val}°C"
                else:
                    is_normal = val < hum_max
                    limit_str = f"<{hum_max}%"
                    val_str = f"{val}%"
                
                color = "#16a34a" if is_normal else "#dc2626"
                weight = "normal" if is_normal else "bold"
                status_lbl = "ปกติ (Normal)" if is_normal else "ไม่ปกติ (Abnormal)"
                return f"""
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px; border: 1px solid #ddd;">{name}</td>
                    <td style="padding: 10px; border: 1px solid #ddd; text-align: center; color: {color}; font-weight: {weight};">{val_str}</td>
                    <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">{limit_str}</td>
                    <td style="padding: 10px; border: 1px solid #ddd; text-align: center; color: {color}; font-weight: {weight};">{status_lbl}</td>
                </tr>
                """
                
            rows_html = (
                cell_style(dht_temp, True, "DHT Ambient Temp") +
                cell_style(dht_hum, False, "DHT Humidity") +
                cell_style(ds1_temp, True, "Air Inlet (DS1)") +
                cell_style(ds2_temp, True, "Optical Table 1 (DS2)") +
                cell_style(ds3_temp, True, "Optical Table 2 (DS3)")
            )
            
            body = f"""
            <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background-color: #ffebee; border-left: 5px solid #ef5350; padding: 15px; margin-bottom: 20px;">
                        <h2 style="color: #c62828; margin-top: 0; margin-bottom: 0;">⚠️ Cleanroom Environment Alert</h2>
                    </div>
                    <table style="border-collapse: collapse; width: 100%; margin-bottom: 20px; font-size: 14px;">
                        <thead>
                            <tr style="background-color: #f5f5f5; border-bottom: 2px solid #ddd;">
                                <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Sensor</th>
                                <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Current Value</th>
                                <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Safety Limit</th>
                                <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows_html}
                        </tbody>
                    </table>
                    <div style="margin-top: 20px; font-size: 13px; color: #555; background-color: #f9f9f9; padding: 10px; border-left: 3px solid #ef5350;">
                        <strong>Alert Trigger Reasons:</strong>
                        <ul style="margin: 5px 0 0 20px; padding: 0;">
                            {"".join([f"<li>{r}</li>" for r in reasons])}
                        </ul>
                    </div>
                    <p style="font-size: 12px; color: #888; margin-top: 20px; text-align: center;">This is an automated alert. System will suppress duplicates for the next {config.get("alert_cooldown_minutes", 30)} minutes.</p>
                </body>
            </html>
            """
            background_tasks.add_task(send_email_sync, subject, body)

def check_and_trigger_alerts(room: str, humidity: float, temp: float, background_tasks: BackgroundTasks):
    threshold = config.get(f"humidity_threshold_{room}", 99.0)
    if humidity > threshold:
        now = datetime.now()
        last_sent = last_alert_sent.get(room)
        cooldown = timedelta(minutes=config.get("alert_cooldown_minutes", 30))
        
        if last_sent is None or (now - last_sent) >= cooldown:
            last_alert_sent[room] = now
            
            # Save alert log to database
            from database import SessionLocal
            db = SessionLocal()
            try:
                log_item = models.AlertLog(
                    room=room,
                    sensor="Humidity",
                    value=humidity,
                    limit_value=threshold,
                    message=f"Humidity ({humidity}%) exceeded safety threshold ({threshold}%)"
                )
                db.add(log_item)
                db.commit()
            except Exception as dbe:
                print(f"[Alert DB] Failed to save {room} alert log: {dbe}")
            finally:
                db.close()
                
            subject = f"⚠️ Alert: High Humidity in {room.capitalize()} ({humidity}%)"
            body = f"""
            <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="background-color: #ffebee; border-left: 5px solid #ef5350; padding: 15px; margin-bottom: 20px;">
                        <h2 style="color: #c62828; margin-top: 0;">⚠️ High Humidity Alert - {room.capitalize()}</h2>
                        <p>The sensor has reported humidity levels exceeding the safety threshold.</p>
                    </div>
                    <table style="border-collapse: collapse; width: 100%; max-width: 400px; margin-bottom: 20px;">
                        <tr style="background-color: #f5f5f5;">
                            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Room:</td>
                            <td style="padding: 8px; border: 1px solid #ddd;">{room.capitalize()}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Humidity:</td>
                            <td style="padding: 8px; border: 1px solid #ddd; color: #c62828; font-weight: bold;">{humidity}%</td>
                        </tr>
                        <tr style="background-color: #f5f5f5;">
                            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Temperature:</td>
                            <td style="padding: 8px; border: 1px solid #ddd;">{temp}°C</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Threshold limit:</td>
                            <td style="padding: 8px; border: 1px solid #ddd;">{threshold}%</td>
                        </tr>
                        <tr style="background-color: #f5f5f5;">
                            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Timestamp:</td>
                            <td style="padding: 8px; border: 1px solid #ddd;">{now.strftime('%Y-%m-%d %H:%M:%S')}</td>
                        </tr>
                    </table>
                    <p style="font-size: 12px; color: #888;">This is an automated alert. System will suppress duplicates for the next {config.get("alert_cooldown_minutes", 30)} minutes.</p>
                </body>
            </html>
            """
            background_tasks.add_task(send_email_sync, subject, body)

def generate_summary_charts(db: Session, yesterday: datetime):
    import io
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import matplotlib.dates as mdates
    
    attachments = []
    
    # --- Cleanroom Chart ---
    cleanroom_data = db.query(models.CleanroomData).filter(
        models.CleanroomData.timestamp >= yesterday
    ).order_by(models.CleanroomData.timestamp.asc()).all()
    
    if cleanroom_data:
        times = [r.timestamp for r in cleanroom_data]
        dht_t = [r.dht_temp for r in cleanroom_data]
        dht_h = [r.dht_hum for r in cleanroom_data]
        ds1 = [r.ds1_temp for r in cleanroom_data]
        ds2 = [r.ds2_temp for r in cleanroom_data]
        ds3 = [r.ds3_temp for r in cleanroom_data]
        
        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(8, 7), sharex=True)
        
        # Plot Temperatures
        ax1.plot(times, dht_t, label="DHT Ambient", color="#3b82f6", linewidth=1.5)
        ax1.plot(times, ds1, label="Air Inlet (DS1)", color="#22d3ee", linewidth=1.5)
        ax1.plot(times, ds2, label="Optical Table 1 (DS2)", color="#06b6d4", linewidth=1.5)
        ax1.plot(times, ds3, label="Optical Table 2 (DS3)", color="#0891b2", linewidth=1.5)
        ax1.set_ylabel("Temperature (°C)")
        ax1.set_title("Cleanroom 24-Hour Temperature Trends")
        ax1.legend(loc="upper left")
        ax1.grid(True, linestyle="--", alpha=0.5)
        
        # Plot Humidity
        ax2.plot(times, dht_h, label="DHT Humidity", color="#10b981", linewidth=1.5)
        ax2.set_ylabel("Humidity (%)")
        ax2.set_title("Cleanroom 24-Hour Humidity Trends")
        ax2.legend(loc="upper left")
        ax2.grid(True, linestyle="--", alpha=0.5)
        
        # Format X-axis
        ax2.xaxis.set_major_formatter(mdates.DateFormatter('%H:%M'))
        ax2.xaxis.set_major_locator(mdates.HourLocator(interval=3))
        plt.xticks(rotation=45)
        
        fig.tight_layout()
        buf = io.BytesIO()
        plt.savefig(buf, format='png', bbox_inches='tight', dpi=150)
        buf.seek(0)
        attachments.append(("cleanroom_chart", buf.read()))
        plt.close(fig)
        
    # --- Fablab Chart ---
    fablab_data = db.query(models.FablabData).filter(
        models.FablabData.timestamp >= yesterday
    ).order_by(models.FablabData.timestamp.asc()).all()
    
    if fablab_data:
        times = [r.timestamp for r in fablab_data]
        temp = [r.temperature for r in fablab_data]
        hum = [r.humidity for r in fablab_data]
        eco2 = [r.eco2 for r in fablab_data]
        tvoc = [r.tvoc for r in fablab_data]
        
        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(8, 7), sharex=True)
        
        # Plot Temp & Hum
        ax1.plot(times, temp, label="Temperature (°C)", color="#3b82f6", linewidth=1.5)
        ax1_right = ax1.twinx()
        ax1_right.plot(times, hum, label="Humidity (%)", color="#10b981", linewidth=1.5)
        ax1.set_ylabel("Temperature (°C)", color="#3b82f6")
        ax1_right.set_ylabel("Humidity (%)", color="#10b981")
        ax1.set_title("FabLab 24-Hour Temperature & Humidity")
        
        # Combine legends
        lines, labels = ax1.get_legend_handles_labels()
        lines2, labels2 = ax1_right.get_legend_handles_labels()
        ax1.legend(lines + lines2, labels + labels2, loc="upper left")
        ax1.grid(True, linestyle="--", alpha=0.5)
        
        # Plot AQ (eCO2 & TVOC)
        ax2.plot(times, eco2, label="eCO2 (ppm)", color="#8b5cf6", linewidth=1.5)
        ax2_right = ax2.twinx()
        ax2_right.plot(times, tvoc, label="TVOC (ppb)", color="#f59e0b", linewidth=1.5)
        ax2.set_ylabel("eCO2 (ppm)", color="#8b5cf6")
        ax2_right.set_ylabel("TVOC (ppb)", color="#f59e0b")
        ax2.set_title("FabLab 24-Hour Air Quality (eCO2 & TVOC)")
        
        # Combine legends
        lines, labels = ax2.get_legend_handles_labels()
        lines2, labels2 = ax2_right.get_legend_handles_labels()
        ax2.legend(lines + lines2, labels + labels2, loc="upper left")
        ax2.grid(True, linestyle="--", alpha=0.5)
        
        # Format X-axis
        ax2.xaxis.set_major_formatter(mdates.DateFormatter('%H:%M'))
        ax2.xaxis.set_major_locator(mdates.HourLocator(interval=3))
        plt.xticks(rotation=45)
        
        fig.tight_layout()
        buf = io.BytesIO()
        plt.savefig(buf, format='png', bbox_inches='tight', dpi=150)
        buf.seek(0)
        attachments.append(("fablab_chart", buf.read()))
        plt.close(fig)
        
    return attachments

def send_daily_summary(db: Session):
    now = datetime.now()
    yesterday = now - timedelta(days=1)
    
    fablab_stats = db.query(
        func.avg(func.nullif(models.FablabData.temperature, 0.0)).label("avg_temp"),
        func.min(func.nullif(models.FablabData.temperature, 0.0)).label("min_temp"),
        func.max(func.nullif(models.FablabData.temperature, 0.0)).label("max_temp"),
        func.avg(func.nullif(models.FablabData.humidity, 0.0)).label("avg_hum"),
        func.min(func.nullif(models.FablabData.humidity, 0.0)).label("min_hum"),
        func.max(func.nullif(models.FablabData.humidity, 0.0)).label("max_hum"),
        func.avg(func.nullif(models.FablabData.eco2, 0.0)).label("avg_co2"),
        func.min(func.nullif(models.FablabData.eco2, 0.0)).label("min_co2"),
        func.max(func.nullif(models.FablabData.eco2, 0.0)).label("max_co2")
    ).filter(models.FablabData.timestamp >= yesterday).first()
    
    cleanroom_stats = db.query(
        func.avg(func.nullif(models.CleanroomData.dht_temp, 0.0)).label("avg_temp"),
        func.min(func.nullif(models.CleanroomData.dht_temp, 0.0)).label("min_temp"),
        func.max(func.nullif(models.CleanroomData.dht_temp, 0.0)).label("max_temp"),
        func.avg(func.nullif(models.CleanroomData.dht_hum, 0.0)).label("avg_hum"),
        func.min(func.nullif(models.CleanroomData.dht_hum, 0.0)).label("min_hum"),
        func.max(func.nullif(models.CleanroomData.dht_hum, 0.0)).label("max_hum"),
        func.avg(func.nullif(models.CleanroomData.ds1_temp, 0.0)).label("avg_ds1"),
        func.min(func.nullif(models.CleanroomData.ds1_temp, 0.0)).label("min_ds1"),
        func.max(func.nullif(models.CleanroomData.ds1_temp, 0.0)).label("max_ds1"),
        func.avg(func.nullif(models.CleanroomData.ds2_temp, 0.0)).label("avg_ds2"),
        func.min(func.nullif(models.CleanroomData.ds2_temp, 0.0)).label("min_ds2"),
        func.max(func.nullif(models.CleanroomData.ds2_temp, 0.0)).label("max_ds2"),
        func.avg(func.nullif(models.CleanroomData.ds3_temp, 0.0)).label("avg_ds3"),
        func.min(func.nullif(models.CleanroomData.ds3_temp, 0.0)).label("min_ds3"),
        func.max(func.nullif(models.CleanroomData.ds3_temp, 0.0)).label("max_ds3")
    ).filter(models.CleanroomData.timestamp >= yesterday).first()
    
    def fmt(val, digits=1):
        return round(val, digits) if val is not None else "--"
        
    temp_min_limit, temp_max_limit, hum_max_limit = load_limits_from_pdf()
    
    def get_status_html(min_val, max_val, avg_val, is_temp=True):
        if min_val is None or max_val is None or avg_val is None:
            return '<span style="color: #94a3b8;">--</span>'
        
        if is_temp:
            is_normal = temp_min_limit <= min_val and max_val <= temp_max_limit
        else:
            is_normal = max_val < hum_max_limit
            
        if is_normal:
            return '<span style="color: #16a34a; font-weight: bold;">ปกติ</span>'
        else:
            return '<span style="color: #dc2626; font-weight: bold;">ไม่ปกติ</span>'
        
    attachments = []
    try:
        attachments = generate_summary_charts(db, yesterday)
    except Exception as chart_err:
        print(f"[Daily Summary] Failed to generate summary charts: {chart_err}")

    cleanroom_img_html = ""
    fablab_img_html = ""
    for cid, _ in attachments:
        if cid == "cleanroom_chart":
            cleanroom_img_html = """
            <div style="margin-top: 25px; text-align: center; margin-bottom: 25px;">
                <h4 style="color: #0369a1; text-align: left; margin-bottom: 8px;">📈 Cleanroom 24-Hour Visual Trends</h4>
                <img src="cid:cleanroom_chart" alt="Cleanroom Trends" style="max-width: 100%; height: auto; border: 1px solid #e2e8f0; border-radius: 8px;" />
            </div>
            """
        elif cid == "fablab_chart":
            fablab_img_html = """
            <div style="margin-top: 25px; text-align: center; margin-bottom: 25px;">
                <h4 style="color: #0f766e; text-align: left; margin-bottom: 8px;">📈 Fablab 24-Hour Visual Trends</h4>
                <img src="cid:fablab_chart" alt="Fablab Trends" style="max-width: 100%; height: auto; border: 1px solid #e2e8f0; border-radius: 8px;" />
            </div>
            """

    subject = f"📊 Daily Lab Summary Report - {now.strftime('%d %b %Y')}"
    
    body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f4f6f9; border-bottom: 3px solid #3b82f6; padding: 20px; text-align: center; margin-bottom: 25px;">
                <h2 style="color: #1e293b; margin: 0;">📊 Daily Environment Summary</h2>
                <p style="color: #64748b; margin: 5px 0 0 0;">Report period: {yesterday.strftime('%Y-%m-%d %H:%M')} to {now.strftime('%Y-%m-%d %H:%M')}</p>
            </div>
            
            <div style="margin-bottom: 30px;">
                <h3 style="color: #0369a1; border-bottom: 2px solid #e0f2fe; padding-bottom: 5px;">🧼 Cleanroom Report</h3>
                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                    <thead>
                        <tr style="background-color: #f0f9ff; border-bottom: 2px solid #bae6fd;">
                            <th style="padding: 10px; font-weight: bold;">Sensor</th>
                            <th style="padding: 10px; font-weight: bold; text-align: center;">Min</th>
                            <th style="padding: 10px; font-weight: bold; text-align: center;">Max</th>
                            <th style="padding: 10px; font-weight: bold; text-align: center;">Average</th>
                            <th style="padding: 10px; font-weight: bold; text-align: center;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 10px;">DHT Ambient Temp</td>
                            <td style="padding: 10px; text-align: center;">{fmt(cleanroom_stats.min_temp)}°C</td>
                            <td style="padding: 10px; text-align: center;">{fmt(cleanroom_stats.max_temp)}°C</td>
                            <td style="padding: 10px; text-align: center; font-weight: bold;">{fmt(cleanroom_stats.avg_temp)}°C</td>
                            <td style="padding: 10px; text-align: center;">{get_status_html(cleanroom_stats.min_temp, cleanroom_stats.max_temp, cleanroom_stats.avg_temp, True)}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 10px;">DHT Humidity</td>
                            <td style="padding: 10px; text-align: center;">{fmt(cleanroom_stats.min_hum)}%</td>
                            <td style="padding: 10px; text-align: center;">{fmt(cleanroom_stats.max_hum)}%</td>
                            <td style="padding: 10px; text-align: center; font-weight: bold;">{fmt(cleanroom_stats.avg_hum)}%</td>
                            <td style="padding: 10px; text-align: center;">{get_status_html(cleanroom_stats.min_hum, cleanroom_stats.max_hum, cleanroom_stats.avg_hum, False)}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 10px;">Air Inlet (DS1)</td>
                            <td style="padding: 10px; text-align: center;">{fmt(cleanroom_stats.min_ds1)}°C</td>
                            <td style="padding: 10px; text-align: center;">{fmt(cleanroom_stats.max_ds1)}°C</td>
                            <td style="padding: 10px; text-align: center; font-weight: bold;">{fmt(cleanroom_stats.avg_ds1)}°C</td>
                            <td style="padding: 10px; text-align: center;">{get_status_html(cleanroom_stats.min_ds1, cleanroom_stats.max_ds1, cleanroom_stats.avg_ds1, True)}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 10px;">Optical Table 1 (DS2)</td>
                            <td style="padding: 10px; text-align: center;">{fmt(cleanroom_stats.min_ds2)}°C</td>
                            <td style="padding: 10px; text-align: center;">{fmt(cleanroom_stats.max_ds2)}°C</td>
                            <td style="padding: 10px; text-align: center; font-weight: bold;">{fmt(cleanroom_stats.avg_ds2)}°C</td>
                            <td style="padding: 10px; text-align: center;">{get_status_html(cleanroom_stats.min_ds2, cleanroom_stats.max_ds2, cleanroom_stats.avg_ds2, True)}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #bae6fd;">
                            <td style="padding: 10px;">Optical Table 2 (DS3)</td>
                            <td style="padding: 10px; text-align: center;">{fmt(cleanroom_stats.min_ds3)}°C</td>
                            <td style="padding: 10px; text-align: center;">{fmt(cleanroom_stats.max_ds3)}°C</td>
                            <td style="padding: 10px; text-align: center; font-weight: bold;">{fmt(cleanroom_stats.avg_ds3)}°C</td>
                            <td style="padding: 10px; text-align: center;">{get_status_html(cleanroom_stats.min_ds3, cleanroom_stats.max_ds3, cleanroom_stats.avg_ds3, True)}</td>
                        </tr>
                    </tbody>
                </table>
                <div style="font-size: 11px; color: #64748b; margin-top: 8px;">
                    * เกณฑ์ความปลอดภัยห้อง Cleanroom อ้างอิงตามคู่มืออุปกรณ์ Thorlabs 202C.pdf (อุณหภูมิ: {temp_min_limit}-{temp_max_limit}°C, ความชื้น: &lt; {hum_max_limit}%)
                </div>
                {cleanroom_img_html}
            </div>
            
            <div style="margin-bottom: 30px;">
                <h3 style="color: #0f766e; border-bottom: 2px solid #ccfbf1; padding-bottom: 5px;">🏭 Fablab Report</h3>
                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                    <thead>
                        <tr style="background-color: #f0fdfa; border-bottom: 2px solid #99f6e4;">
                            <th style="padding: 10px; font-weight: bold;">Sensor</th>
                            <th style="padding: 10px; font-weight: bold; text-align: center;">Min</th>
                            <th style="padding: 10px; font-weight: bold; text-align: center;">Max</th>
                            <th style="padding: 10px; font-weight: bold; text-align: center;">Average</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 10px;">Temperature</td>
                            <td style="padding: 10px; text-align: center;">{fmt(fablab_stats.min_temp)}°C</td>
                            <td style="padding: 10px; text-align: center;">{fmt(fablab_stats.max_temp)}°C</td>
                            <td style="padding: 10px; text-align: center; font-weight: bold;">{fmt(fablab_stats.avg_temp)}°C</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 10px;">Humidity</td>
                            <td style="padding: 10px; text-align: center;">{fmt(fablab_stats.min_hum)}%</td>
                            <td style="padding: 10px; text-align: center;">{fmt(fablab_stats.max_hum)}%</td>
                            <td style="padding: 10px; text-align: center; font-weight: bold;">{fmt(fablab_stats.avg_hum)}%</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #bae6fd;">
                            <td style="padding: 10px;">eCO2 (ppm)</td>
                            <td style="padding: 10px; text-align: center;">{fmt(fablab_stats.min_co2, 0)}</td>
                            <td style="padding: 10px; text-align: center;">{fmt(fablab_stats.max_co2, 0)}</td>
                            <td style="padding: 10px; text-align: center; font-weight: bold;">{fmt(fablab_stats.avg_co2, 0)}</td>
                        </tr>
                    </tbody>
                </table>
                {fablab_img_html}
            </div>
            
            <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 11px; color: #94a3b8; text-align: center;">
                This is an automated daily summary email from your Cleanroom Monitoring System.
            </div>
        </body>
    </html>
    """
    send_email_sync(subject, body, attachments=attachments)

async def daily_summary_scheduler():
    print("[Scheduler] Daily summary scheduler background task started.")
    while True:
        try:
            now = datetime.now()
            target_time_str = config.get("daily_summary_time", "08:00")
            target_hour, target_minute = map(int, target_time_str.split(":"))
            
            if now.hour == target_hour and now.minute == target_minute:
                print(f"[Scheduler] It is {target_time_str}. Preparing and sending daily summary report...")
                from database import SessionLocal
                db = SessionLocal()
                try:
                    send_daily_summary(db)
                except Exception as ex:
                    print(f"Error in daily summary email: {ex}")
                finally:
                    db.close()
                await asyncio.sleep(65)
            else:
                await asyncio.sleep(30)
        except Exception as e:
            print(f"Error in daily summary scheduler loop: {e}")
            await asyncio.sleep(60)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(daily_summary_scheduler())

@app.get("/data/alerts", response_model=list[schemas.AlertLogResponse])
def get_alert_logs(limit: int = 50, db: Session = Depends(get_db)):
    return db.query(models.AlertLog).order_by(models.AlertLog.timestamp.desc()).limit(limit).all()

@app.post("/data/alerts/clear")
def clear_alert_logs(db: Session = Depends(get_db)):
    db.query(models.AlertLog).delete()
    db.commit()
    return {"message": "Alert logs cleared successfully"}

@app.get("/config/emails")
def get_recipient_emails():
    return config.get("recipient_emails", [])

@app.post("/config/emails")
def add_recipient_email(req: schemas.EmailUpdateRequest):
    email = req.email.strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    if "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="Invalid email address")
        
    emails = config.get("recipient_emails", [])
    if email not in emails:
        emails.append(email)
        config["recipient_emails"] = emails
        try:
            with open(CONFIG_PATH, "w", encoding="utf-8") as f:
                json.dump(config, f, indent=2)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to save config: {e}")
    return emails

@app.delete("/config/emails")
def remove_recipient_email(email: str = Query(...)):
    email = email.strip().lower()
    emails = config.get("recipient_emails", [])
    if email in emails:
        emails.remove(email)
        config["recipient_emails"] = emails
        try:
            with open(CONFIG_PATH, "w", encoding="utf-8") as f:
                json.dump(config, f, indent=2)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to save config: {e}")
    return emails

@app.post("/log/{room}")
async def log_data(room: str, request: Request, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    content_type = request.headers.get('content-type', '')
    if 'application/x-www-form-urlencoded' in content_type:
        form_data = await request.form()
        try:
            if room == "fablab":
                sensor_data = schemas.FablabCreate(
                    temperature=float(form_data.get('temperature', 0)),
                    humidity=float(form_data.get('humidity', 0)),
                    eco2=int(form_data.get('eco2', 0)),
                    tvoc=int(form_data.get('tvoc', 0))
                )
                db_item = models.FablabData(**sensor_data.model_dump())
            elif room == "cleanroom":
                sensor_data = schemas.CleanroomCreate(
                    dht_temp=float(form_data.get('dht_temp', 0)),
                    dht_hum=float(form_data.get('dht_hum', 0)),
                    ds1_temp=float(form_data.get('ds1_temp', 0)),
                    ds2_temp=float(form_data.get('ds2_temp', 0)),
                    ds3_temp=float(form_data.get('ds3_temp', 0))
                )
                db_item = models.CleanroomData(**sensor_data.model_dump())
            else:
                raise HTTPException(status_code=404, detail="Room not found")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid form data values")
    else:
        raise HTTPException(status_code=400, detail="Unsupported Media Type")

    # Update in-memory latest reading for real-time dashboard updates
    now = datetime.now()
    mem_item = sensor_data.model_dump()
    mem_item["timestamp"] = now
    latest_readings[room] = mem_item

    # Downsample database insertion (log only every 30 seconds to prevent file bloat)
    if now - last_db_write[room] >= timedelta(seconds=30):
        db.add(db_item)
        db.commit()
        db.refresh(db_item)
        last_db_write[room] = now
    else:
        # Not saved to DB, set timestamp for in-memory object to pass to checks
        db_item.timestamp = now

    # Trigger alerts asynchronously if thresholds are exceeded (using latest real-time values)
    if room == "fablab":
        check_and_trigger_alerts("fablab", db_item.humidity, db_item.temperature, background_tasks)
    elif room == "cleanroom":
        check_cleanroom_alerts(db_item, background_tasks)
        
    return db_item

def get_model_for_room(room: str):
    if room == "fablab":
        return models.FablabData
    elif room == "cleanroom":
        return models.CleanroomData
    raise HTTPException(status_code=404, detail="Room not found")

def build_latest_response_dict(room: str, latest_record, db: Session):
    if room == "fablab":
        fields = ["temperature", "humidity", "eco2", "tvoc"]
        model = models.FablabData
    else:
        fields = ["dht_temp", "dht_hum", "ds1_temp", "ds2_temp", "ds3_temp"]
        model = models.CleanroomData

    if hasattr(latest_record, "__dict__"):
        res = {k: v for k, v in latest_record.__dict__.items() if not k.startswith("_")}
    else:
        res = dict(latest_record)

    last_valid = {}
    for f in fields:
        val = res.get(f)
        if val == 0.0 or val == 0 or val is None:
            # Query last non-zero, non-null value from database
            last_rec = db.query(model).filter(
                getattr(model, f) != 0.0,
                getattr(model, f) != 0,
                getattr(model, f) != None
            ).order_by(model.timestamp.desc()).first()
            if last_rec:
                last_valid[f] = getattr(last_rec, f)
            else:
                last_valid[f] = None
        else:
            last_valid[f] = val

    res["last_valid"] = last_valid
    return res

@app.get("/data/{room}/latest")
def get_latest_data(room: str, response: Response, db: Session = Depends(get_db)):
    # Serve from in-memory cache if fresh (within 90 seconds) to maintain responsiveness
    latest_mem = latest_readings.get(room)
    if latest_mem:
        time_diff = datetime.now() - latest_mem["timestamp"]
        if time_diff.total_seconds() < 90:
            response.headers["X-Sensor-Active"] = "true"
            return build_latest_response_dict(room, latest_mem, db)

    model = get_model_for_room(room)
    latest = db.query(model).order_by(model.timestamp.desc()).first()
    if not latest:
        raise HTTPException(status_code=404, detail="No data found")
    
    # Check if the latest data is active (within last 90 seconds)
    time_diff = datetime.now() - latest.timestamp
    is_active = "true" if time_diff.total_seconds() < 90 else "false"
    response.headers["X-Sensor-Active"] = is_active
    
    return build_latest_response_dict(room, latest, db)

def parse_iso_datetime(dt_str: str) -> datetime:
    try:
        clean_str = dt_str.replace('Z', '').split('.')[0]
        for fmt in ('%Y-%m-%dT%H:%M:%S', '%Y-%m-%dT%H:%M', '%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M', '%Y-%m-%d'):
            try:
                return datetime.strptime(clean_str, fmt)
            except ValueError:
                continue
        raise ValueError()
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid datetime format: {dt_str}. Use ISO 8601 (e.g. YYYY-MM-DDTHH:MM)")

@app.get("/data/{room}/history")
def get_data_history(
    room: str,
    range: str = Query(None, description="24h or 30d"),
    start_time: str = Query(None, description="ISO start time"),
    end_time: str = Query(None, description="ISO end time"),
    resolution: int = Query(None, description="Grouping resolution in minutes"),
    db: Session = Depends(get_db)
):
    model = get_model_for_room(room)
    now = datetime.now()
    
    start_datetime = None
    end_datetime = None
    
    if start_time:
        start_datetime = parse_iso_datetime(start_time)
    if end_time:
        end_datetime = parse_iso_datetime(end_time)
        
    if not start_datetime:
        if range == "1h":
            start_datetime = now - timedelta(hours=1)
        elif range == "6h":
            start_datetime = now - timedelta(hours=6)
        elif range == "12h":
            start_datetime = now - timedelta(hours=12)
        elif range in ("1d", "24h"):
            start_datetime = now - timedelta(days=1)
        elif range == "3d":
            start_datetime = now - timedelta(days=3)
        elif range == "1w":
            start_datetime = now - timedelta(weeks=1)
        elif range == "2w":
            start_datetime = now - timedelta(weeks=2)
        elif range in ("1m", "30d"):
            start_datetime = now - timedelta(days=30)
        elif range == "3m":
            start_datetime = now - timedelta(days=90)
        elif range == "6m":
            start_datetime = now - timedelta(days=180)
        elif range == "all":
            start_datetime = datetime(2000, 1, 1)  # Fallback to early date since datetime.min might cause overflow with SQLite
        else:
            start_datetime = now - timedelta(hours=24)
            
    if not end_datetime:
        end_datetime = now
        
    if resolution is not None and resolution > 0:
        res_minutes = resolution
    else:
        delta = end_datetime - start_datetime
        if delta <= timedelta(hours=2):
            res_minutes = 1
        elif delta <= timedelta(hours=12):
            res_minutes = 5
        elif delta <= timedelta(days=1):
            res_minutes = 15
        elif delta <= timedelta(days=7):
            res_minutes = 60
        else:
            res_minutes = 1440
            
    half_window_sec = (res_minutes * 60) / 2.0
    half_window = timedelta(seconds=half_window_sec)
    
    fetch_start = start_datetime - half_window
    fetch_end = end_datetime + half_window
    
    raw_rows = db.query(model).filter(
        model.timestamp >= fetch_start,
        model.timestamp <= fetch_end
    ).order_by(model.timestamp.asc()).all()
    
    # Align start_datetime to neat interval boundaries
    bucket_step = timedelta(minutes=res_minutes)
    current_bucket = start_datetime
    
    results = []
    left_idx = 0
    right_idx = 0
    n = len(raw_rows)
    
    def calc_stats(vals, round_digits=2, default_val=0):
        valid_vals = [v for v in vals if v is not None and v != 0.0]
        if not valid_vals:
            return default_val, default_val, default_val
        avg_v = round(sum(valid_vals) / len(valid_vals), round_digits)
        min_v = round(min(valid_vals), round_digits)
        max_v = round(max(valid_vals), round_digits)
        return avg_v, min_v, max_v

    while current_bucket <= end_datetime:
        w_start = current_bucket - half_window
        w_end = current_bucket + half_window
        
        while left_idx < n and raw_rows[left_idx].timestamp < w_start:
            left_idx += 1
        while right_idx < n and raw_rows[right_idx].timestamp <= w_end:
            right_idx += 1
            
        window_rows = raw_rows[left_idx:right_idx]
        
        if window_rows:
            time_str = current_bucket.strftime('%Y-%m-%d %H:%M:%S')
            if room == "fablab":
                avg_t, min_t, max_t = calc_stats([r.temperature for r in window_rows])
                avg_h, min_h, max_h = calc_stats([r.humidity for r in window_rows])
                avg_co2, _, _ = calc_stats([r.eco2 for r in window_rows], round_digits=0)
                avg_tvoc, _, _ = calc_stats([r.tvoc for r in window_rows], round_digits=0)
                
                results.append({
                    "timestamp": time_str,
                    "temperature": avg_t,
                    "min_temp": min_t,
                    "max_temp": max_t,
                    "humidity": avg_h,
                    "min_hum": min_h,
                    "max_hum": max_h,
                    "eco2": avg_co2,
                    "tvoc": avg_tvoc
                })
            else:
                avg_dt, min_dt, max_dt = calc_stats([r.dht_temp for r in window_rows])
                avg_dh, min_dh, max_dh = calc_stats([r.dht_hum for r in window_rows])
                avg_ds1, _, _ = calc_stats([r.ds1_temp for r in window_rows])
                avg_ds2, _, _ = calc_stats([r.ds2_temp for r in window_rows])
                avg_ds3, _, _ = calc_stats([r.ds3_temp for r in window_rows])
                
                results.append({
                    "timestamp": time_str,
                    "dht_temp": avg_dt,
                    "min_dht_temp": min_dt,
                    "max_dht_temp": max_dt,
                    "dht_hum": avg_dh,
                    "min_dht_hum": min_dh,
                    "max_dht_hum": max_dh,
                    "ds1_temp": avg_ds1,
                    "ds2_temp": avg_ds2,
                    "ds3_temp": avg_ds3
                })
                
        current_bucket += bucket_step
        
    return results

@app.get("/data/{room}/export")
def export_data(
    room: str,
    start_time: str = Query(None),
    end_time: str = Query(None),
    db: Session = Depends(get_db)
):
    model = get_model_for_room(room)
    query = db.query(model)
    
    start_dt = None
    end_dt = None
    
    if start_time:
        start_dt = parse_iso_datetime(start_time)
        query = query.filter(model.timestamp >= start_dt)
    if end_time:
        end_dt = parse_iso_datetime(end_time)
        query = query.filter(model.timestamp <= end_dt)
        
    data = query.order_by(model.timestamp.desc()).all()
    
    if start_dt:
        start_str = start_dt.strftime('%d-%m-%Y')
    elif data:
        start_str = data[-1].timestamp.strftime('%d-%m-%Y')
    else:
        start_str = datetime.now().strftime('%d-%m-%Y')
        
    if end_dt:
        end_str = end_dt.strftime('%d-%m-%Y')
    elif data:
        end_str = data[0].timestamp.strftime('%d-%m-%Y')
    else:
        end_str = datetime.now().strftime('%d-%m-%Y')
        
    filename = f"{start_str}_to_{end_str}_{room.capitalize()}.csv"
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    if room == "fablab":
        writer.writerow(['ID', 'Timestamp', 'Temperature (C)', 'Humidity (%)', 'eCO2 (ppm)', 'TVOC (ppb)'])
        for row in data:
            time_str = row.timestamp.strftime('%Y-%m-%d %H:%M:%S') if row.timestamp else ''
            writer.writerow([row.id, time_str, row.temperature, row.humidity, row.eco2, row.tvoc])
    else:
        writer.writerow(['ID', 'Timestamp', 'DHT Temp (C)', 'DHT Humidity (%)', 'Air Inlet (C)', 'Optical Table 1 (C)', 'Optical Table 2 (C)'])
        for row in data:
            time_str = row.timestamp.strftime('%Y-%m-%d %H:%M:%S') if row.timestamp else ''
            writer.writerow([row.id, time_str, row.dht_temp, row.dht_hum, row.ds1_temp, row.ds2_temp, row.ds3_temp])
            
    headers = {
        'Content-Disposition': f'attachment; filename="{filename}"'
    }
    return Response(content=output.getvalue(), media_type='text/csv', headers=headers)

@app.get("/config")
def get_config_endpoint():
    cfg = {}
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                cfg = json.load(f)
        except Exception as e:
            print(f"Error reading config.json in get_config: {e}")
            
    return {
        "smtp_server": cfg.get("smtp_server", smtp_server),
        "smtp_port": cfg.get("smtp_port", smtp_port),
        "smtp_email": cfg.get("smtp_email", smtp_email),
        "recipient_emails": cfg.get("recipient_emails", recipient_emails),
        "humidity_threshold_cleanroom": cfg.get("humidity_threshold_cleanroom", humidity_threshold_cleanroom),
        "humidity_threshold_fablab": cfg.get("humidity_threshold_fablab", humidity_threshold_fablab),
        "temp_threshold_high": cfg.get("temp_threshold_high", temp_threshold_high),
        "temp_threshold_low": cfg.get("temp_threshold_low", temp_threshold_low),
        "alert_cooldown_minutes": cfg.get("alert_cooldown_minutes", alert_cooldown_minutes),
        "daily_summary_time": cfg.get("daily_summary_time", daily_summary_time)
    }

class ConfigUpdateRequest(BaseModel):
    humidity_threshold_cleanroom: Optional[float] = None
    humidity_threshold_fablab: Optional[float] = None
    temp_threshold_high: Optional[float] = None
    temp_threshold_low: Optional[float] = None
    alert_cooldown_minutes: Optional[int] = None
    daily_summary_time: Optional[str] = None
    recipient_emails: Optional[List[str]] = None

@app.post("/config")
def update_config_endpoint(req: ConfigUpdateRequest):
    global humidity_threshold_cleanroom, humidity_threshold_fablab, temp_threshold_high, temp_threshold_low
    global alert_cooldown_minutes, daily_summary_time, recipient_emails
    
    current_cfg = {}
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                current_cfg = json.load(f)
        except Exception as e:
            print(f"Error reading config: {e}")
            
    if req.humidity_threshold_cleanroom is not None:
        humidity_threshold_cleanroom = req.humidity_threshold_cleanroom
        current_cfg["humidity_threshold_cleanroom"] = req.humidity_threshold_cleanroom
    if req.humidity_threshold_fablab is not None:
        humidity_threshold_fablab = req.humidity_threshold_fablab
        current_cfg["humidity_threshold_fablab"] = req.humidity_threshold_fablab
    if req.temp_threshold_high is not None:
        temp_threshold_high = req.temp_threshold_high
        current_cfg["temp_threshold_high"] = req.temp_threshold_high
    if req.temp_threshold_low is not None:
        temp_threshold_low = req.temp_threshold_low
        current_cfg["temp_threshold_low"] = req.temp_threshold_low
    if req.alert_cooldown_minutes is not None:
        alert_cooldown_minutes = req.alert_cooldown_minutes
        current_cfg["alert_cooldown_minutes"] = req.alert_cooldown_minutes
    if req.daily_summary_time is not None:
        daily_summary_time = req.daily_summary_time
        current_cfg["daily_summary_time"] = req.daily_summary_time
    if req.recipient_emails is not None:
        recipient_emails = req.recipient_emails
        current_cfg["recipient_emails"] = req.recipient_emails
        
    try:
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(current_cfg, f, indent=2)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write config.json: {e}")
        
    return {"status": "success", "message": "Thresholds and configuration updated successfully."}

@app.get("/data/{room}/range-info")
def get_room_range_info(room: str, db: Session = Depends(get_db)):
    model = get_model_for_room(room)
    first_rec = db.query(model).order_by(model.timestamp.asc()).first()
    last_rec = db.query(model).order_by(model.timestamp.desc()).first()
    count = db.query(model).count()
    
    if not first_rec or not last_rec:
        return {"has_data": False, "message": "ไม่พบข้อมูลในระบบ"}
        
    return {
        "has_data": True,
        "first_date": first_rec.timestamp.strftime('%d/%m/%Y %H:%M') if first_rec.timestamp else '',
        "last_date": last_rec.timestamp.strftime('%d/%m/%Y %H:%M') if last_rec.timestamp else '',
        "total_records": count
    }

@app.get("/data/{room}/export-pdf")
def export_pdf_endpoint(
    room: str,
    start_time: str = Query(None),
    end_time: str = Query(None),
    db: Session = Depends(get_db)
):
    from pdf_generator import generate_pdf_report
    model = get_model_for_room(room)
    query = db.query(model)
    
    start_dt = None
    end_dt = None
    
    if start_time:
        start_dt = parse_iso_datetime(start_time)
        query = query.filter(model.timestamp >= start_dt)
    if end_time:
        end_dt = parse_iso_datetime(end_time)
        query = query.filter(model.timestamp <= end_dt)
        
    data = query.order_by(model.timestamp.asc()).all()
    
    if not data:
        raise HTTPException(status_code=404, detail="ไม่พบข้อมูลในระบบตามช่วงเวลาที่เลือก ไม่สามารถสร้างรายงาน PDF ได้")
        
    first_actual = data[0].timestamp.strftime('%d/%m/%Y %H:%M') if data[0].timestamp else 'N/A'
    last_actual = data[-1].timestamp.strftime('%d/%m/%Y %H:%M') if data[-1].timestamp else 'N/A'
    actual_range_str = f"{first_actual} to {last_actual}"
    
    # Calculate stats
    metrics = []
    if room == "fablab":
        temps = [r.temperature for r in data if r.temperature and r.temperature != 0.0]
        hums = [r.humidity for r in data if r.humidity and r.humidity != 0.0]
        co2s = [r.eco2 for r in data if r.eco2 and r.eco2 != 0.0]
        tvocs = [r.tvoc for r in data if r.tvoc and r.tvoc != 0.0]
        
        if temps: metrics.append({"name": "Temperature", "avg": round(sum(temps)/len(temps), 1), "min": round(min(temps), 1), "max": round(max(temps), 1), "unit": "°C"})
        if hums: metrics.append({"name": "Humidity", "avg": round(sum(hums)/len(hums), 1), "min": round(min(hums), 1), "max": round(max(hums), 1), "unit": "%"})
        if co2s: metrics.append({"name": "eCO2 Air Quality", "avg": round(sum(co2s)/len(co2s), 0), "min": round(min(co2s), 0), "max": round(max(co2s), 0), "unit": "ppm"})
        if tvocs: metrics.append({"name": "TVOC Air Quality", "avg": round(sum(tvocs)/len(tvocs), 0), "min": round(min(tvocs), 0), "max": round(max(tvocs), 0), "unit": "ppb"})
    else:
        dht_t = [r.dht_temp for r in data if r.dht_temp and r.dht_temp != 0.0]
        dht_h = [r.dht_hum for r in data if r.dht_hum and r.dht_hum != 0.0]
        ds1 = [r.ds1_temp for r in data if r.ds1_temp and r.ds1_temp != 0.0]
        ds2 = [r.ds2_temp for r in data if r.ds2_temp and r.ds2_temp != 0.0]
        ds3 = [r.ds3_temp for r in data if r.ds3_temp and r.ds3_temp != 0.0]
        
        if dht_t: metrics.append({"name": "DHT Ambient Temp", "avg": round(sum(dht_t)/len(dht_t), 1), "min": round(min(dht_t), 1), "max": round(max(dht_t), 1), "unit": "°C"})
        if dht_h: metrics.append({"name": "DHT Humidity", "avg": round(sum(dht_h)/len(dht_h), 1), "min": round(min(dht_h), 1), "max": round(max(dht_h), 1), "unit": "%"})
        if ds1: metrics.append({"name": "Air Inlet Sensor", "avg": round(sum(ds1)/len(ds1), 1), "min": round(min(ds1), 1), "max": round(max(ds1), 1), "unit": "°C"})
        if ds2: metrics.append({"name": "Optical Table 1", "avg": round(sum(ds2)/len(ds2), 1), "min": round(min(ds2), 1), "max": round(max(ds2), 1), "unit": "°C"})
        if ds3: metrics.append({"name": "Optical Table 3", "avg": round(sum(ds3)/len(ds3), 1), "min": round(min(ds3), 1), "max": round(max(ds3), 1), "unit": "°C"})

    # Fetch alerts for this period
    alert_query = db.query(models.AlertLog)
    if start_dt: alert_query = alert_query.filter(models.AlertLog.timestamp >= start_dt)
    if end_dt: alert_query = alert_query.filter(models.AlertLog.timestamp <= end_dt)
    alerts = alert_query.order_by(models.AlertLog.timestamp.desc()).all()
    
    alerts_list = []
    for a in alerts:
        alerts_list.append({
            "timestamp": a.timestamp.strftime('%d/%m/%Y %H:%M') if a.timestamp else '',
            "sensor": a.sensor or '',
            "value": a.value or 0,
            "message": a.message or ''
        })
        
    start_label = start_dt.strftime('%d/%m/%Y %H:%M') if start_dt else "Beginning"
    end_label = end_dt.strftime('%d/%m/%Y %H:%M') if end_dt else "Present"
    
    extra_stats = {
        "metrics": metrics,
        "actual_range": actual_range_str,
        "total_records": len(data)
    }
    
    pdf_bytes = generate_pdf_report(room, start_label, end_label, extra_stats, alerts_list, raw_data=data)
    
    file_start = start_dt.strftime('%d%m%Y') if start_dt else "Start"
    file_end = end_dt.strftime('%d%m%Y') if end_dt else "Now"
    filename = f"Report_{room.capitalize()}_{file_start}_to_{file_end}.pdf"
    headers = {
        'Content-Disposition': f'attachment; filename="{filename}"'
    }
    return Response(content=pdf_bytes, media_type='application/pdf', headers=headers)


