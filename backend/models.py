from sqlalchemy import Column, Integer, Float, DateTime
from datetime import datetime
from database import Base

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
