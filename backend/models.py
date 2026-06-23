from sqlalchemy import Column, Integer, Float, DateTime, String
from datetime import datetime
from database import Base

class AlertLog(Base):
    __tablename__ = "alert_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.now)
    room = Column(String)
    sensor = Column(String)
    value = Column(Float)
    limit_value = Column(Float)
    message = Column(String)

class FablabData(Base):
    __tablename__ = "fablab_data"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.now)
    temperature = Column(Float)
    humidity = Column(Float)
    eco2 = Column(Integer)
    tvoc = Column(Integer)

class CleanroomData(Base):
    __tablename__ = "cleanroom_data"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.now)
    dht_temp = Column(Float)
    dht_hum = Column(Float)
    ds1_temp = Column(Float)
    ds2_temp = Column(Float)
    ds3_temp = Column(Float)
