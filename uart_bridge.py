import serial
import json
import requests
import time
import sys

# ---- Configuration ----
COM_PORT = "COM4"  # เปลี่ยนตรงนี้ให้ตรงกับเลข COM Port ของ ESP32
BAUD_RATE = 115200
API_URL = "http://127.0.0.1:8000/log/cleanroom"

print(f"Starting UART to HTTP Bridge for Cleanroom...")
print(f"Attempting to connect to {COM_PORT} at {BAUD_RATE} baud...")

try:
    ser = serial.Serial(COM_PORT, BAUD_RATE, timeout=2)
    print("✅ Connected to Serial Port successfully.")
except Exception as e:
    print(f"❌ Error opening {COM_PORT}: {e}")
    print("Please check if the port is correct and not used by Arduino IDE Serial Monitor.")
    sys.exit(1)

while True:
    try:
        if ser.in_waiting > 0:
            line = ser.readline().decode('utf-8').strip()
            
            # ตรวจสอบว่าเป็นรูปแบบ JSON ที่ ESP32 ส่งมาหรือไม่
            if line.startswith("{") and line.endswith("}"):
                data = json.loads(line)
                print(f"\n📡 Received from UART: {data}")
                
                # ส่งข้อมูลต่อเข้า FastAPI Backend ของเรา
                try:
                    response = requests.post(API_URL, data=data)
                    if response.status_code == 200:
                        print("✅ Forwarded to Dashboard successfully.")
                    else:
                        print(f"❌ Failed to forward. Server returned: {response.status_code}")
                except requests.exceptions.ConnectionError:
                    print("❌ Could not connect to Backend. Is start.bat running?")
    except KeyboardInterrupt:
        print("\nExiting...")
        break
    except Exception as e:
        print(f"Warning: {e}")
        time.sleep(1)
