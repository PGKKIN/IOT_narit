from pydantic import BaseModel
from datetime import datetime

class FablabCreate(BaseModel):
    temperature: float
    humidity: float
    eco2: int
    tvoc: int

class FablabResponse(FablabCreate):
    id: int
    timestamp: datetime

    class Config:
        from_attributes = True

class CleanroomCreate(BaseModel):
    dht_temp: float
    dht_hum: float
    ds1_temp: float
    ds2_temp: float
    ds3_temp: float

class CleanroomResponse(CleanroomCreate):
    id: int
    timestamp: datetime

    class Config:
        from_attributes = True

class AlertLogResponse(BaseModel):
    id: int
    timestamp: datetime
    room: str
    sensor: str
    value: float
    limit_value: float
    message: str

    class Config:
        from_attributes = True
