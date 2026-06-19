from fastapi import FastAPI, Depends, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
import io
import csv

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
)

@app.post("/log/{room}")
async def log_data(room: str, request: Request, db: Session = Depends(get_db)):
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

    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

def get_model_for_room(room: str):
    if room == "fablab":
        return models.FablabData
    elif room == "cleanroom":
        return models.CleanroomData
    raise HTTPException(status_code=404, detail="Room not found")

@app.get("/data/{room}/latest")
def get_latest_data(room: str, db: Session = Depends(get_db)):
    model = get_model_for_room(room)
    latest = db.query(model).order_by(model.timestamp.desc()).first()
    if not latest:
        raise HTTPException(status_code=404, detail="No data found")
    return latest

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
        if range == "24h":
            start_datetime = now - timedelta(hours=24)
        elif range == "30d":
            start_datetime = now - timedelta(days=30)
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
            
    bucket_size = res_minutes * 60
    
    time_bucket = func.datetime(
        func.cast(func.cast(func.strftime('%s', model.timestamp), models.Integer) / bucket_size, models.Integer) * bucket_size,
        'unixepoch'
    ).label("time_bucket")
    
    if room == "fablab":
        results = db.query(
            time_bucket,
            func.avg(model.temperature).label("temperature"),
            func.avg(model.humidity).label("humidity"),
            func.avg(model.eco2).label("eco2"),
            func.avg(model.tvoc).label("tvoc")
        ).filter(
            model.timestamp >= start_datetime,
            model.timestamp <= end_datetime
        ).group_by("time_bucket").order_by("time_bucket").all()
        
        return [
            {
                "timestamp": row.time_bucket,
                "temperature": round(row.temperature, 2) if row.temperature else 0,
                "humidity": round(row.humidity, 2) if row.humidity else 0,
                "eco2": round(row.eco2, 0) if row.eco2 else 0,
                "tvoc": round(row.tvoc, 0) if row.tvoc else 0
            } for row in results if row.time_bucket is not None
        ]
    else:
        results = db.query(
            time_bucket,
            func.avg(model.dht_temp).label("dht_temp"),
            func.avg(model.dht_hum).label("dht_hum"),
            func.avg(model.ds1_temp).label("ds1_temp"),
            func.avg(model.ds2_temp).label("ds2_temp"),
            func.avg(model.ds3_temp).label("ds3_temp")
        ).filter(
            model.timestamp >= start_datetime,
            model.timestamp <= end_datetime
        ).group_by("time_bucket").order_by("time_bucket").all()
        
        return [
            {
                "timestamp": row.time_bucket,
                "dht_temp": round(row.dht_temp, 2) if row.dht_temp else 0,
                "dht_hum": round(row.dht_hum, 2) if row.dht_hum else 0,
                "ds1_temp": round(row.ds1_temp, 2) if row.ds1_temp else 0,
                "ds2_temp": round(row.ds2_temp, 2) if row.ds2_temp else 0,
                "ds3_temp": round(row.ds3_temp, 2) if row.ds3_temp else 0
            } for row in results if row.time_bucket is not None
        ]

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
        start_str = start_dt.strftime('%Y%m%d')
    elif data:
        start_str = data[-1].timestamp.strftime('%Y%m%d')
    else:
        start_str = datetime.now().strftime('%Y%m%d')
        
    if end_dt:
        end_str = end_dt.strftime('%Y%m%d')
    elif data:
        end_str = data[0].timestamp.strftime('%Y%m%d')
    else:
        end_str = datetime.now().strftime('%Y%m%d')
        
    filename = f"{start_str}-{end_str}_{room.capitalize()}.csv"
    
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

