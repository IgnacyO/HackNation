from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()


class Firefighter(Base):
    __tablename__ = 'firefighters'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    badge_number = Column(String(50), unique=True)
    team = Column(String(50))  # Team/unit name (e.g., 'RIT', 'Engine 1', etc.)
    on_mission = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    positions = relationship("Position", back_populates="firefighter", cascade="all, delete-orphan")
    vitals = relationship("Vitals", back_populates="firefighter", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="firefighter", cascade="all, delete-orphan")


class Position(Base):
    __tablename__ = 'positions'
    
    id = Column(Integer, primary_key=True)
    firefighter_id = Column(Integer, ForeignKey('firefighters.id'), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    floor = Column(Integer, default=0)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationship
    firefighter = relationship("Firefighter", back_populates="positions")


class Vitals(Base):
    __tablename__ = 'vitals'
    
    id = Column(Integer, primary_key=True)
    firefighter_id = Column(Integer, ForeignKey('firefighters.id'), nullable=False)
    heart_rate = Column(Integer)
    temperature = Column(Float)
    oxygen_level = Column(Float)
    co_level = Column(Float)
    battery_level = Column(Float)
    scba_pressure = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationship
    firefighter = relationship("Firefighter", back_populates="vitals")


class Alert(Base):
    __tablename__ = 'alerts'
    
    id = Column(Integer, primary_key=True)
    firefighter_id = Column(Integer, ForeignKey('firefighters.id'), nullable=True)
    alert_type = Column(String(50), nullable=False)
    severity = Column(String(20), nullable=False)  # 'critical' or 'warning'
    message = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    acknowledged = Column(Boolean, default=False)
    
    # Relationship
    firefighter = relationship("Firefighter", back_populates="alerts")


class Beacon(Base):
    __tablename__ = 'beacons'
    
    id = Column(Integer, primary_key=True)
    beacon_id = Column(String(100), unique=True, nullable=False)
    name = Column(String(100))
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    floor = Column(Integer, default=0)
    battery_percent = Column(Float, default=100.0)
    signal_quality = Column(Float)
    tags_in_range = Column(Integer, default=0)
    last_seen = Column(DateTime, default=datetime.utcnow)
    is_online = Column(Boolean, default=True)

