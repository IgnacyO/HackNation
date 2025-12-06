import random
import time
import threading
from datetime import datetime, timedelta
from math import sqrt, cos
from sqlalchemy.orm import Session
from backend.database import SessionLocal, init_db
from backend.models import Firefighter, Position, Vitals, Alert, Beacon

# Alert types mapping
ALERT_TYPES = {
    'man_down': {'severity': 'critical', 'description': 'Bezruch >30s'},
    'sos_pressed': {'severity': 'critical', 'description': 'Przycisk SOS'},
    'high_heart_rate': {'severity': 'warning', 'description': 'Tętno >180 bpm'},
    'low_battery': {'severity': 'warning', 'description': 'Bateria <20%'},
    'scba_low_pressure': {'severity': 'warning', 'description': 'Niskie ciśnienie SCBA'},
    'scba_critical': {'severity': 'critical', 'description': 'Krytyczne ciśnienie SCBA'},
    'beacon_offline': {'severity': 'warning', 'description': 'Beacon nie odpowiada'},
    'tag_offline': {'severity': 'critical', 'description': 'Tag strażaka offline'},
    'high_co': {'severity': 'critical', 'description': 'Wysokie CO'},
    'low_oxygen': {'severity': 'critical', 'description': 'Niski O2'},
    'explosive_gas': {'severity': 'critical', 'description': 'Gaz wybuchowy (LEL)'},
    'high_temperature': {'severity': 'warning', 'description': 'Wysoka temperatura'},
}


class DataSimulator:
    def __init__(self):
        self.running = False
        self.thread = None
        self.firefighters = []
        self.beacons = []
        
    def start(self):
        """Start the data simulator"""
        if self.running:
            return
            
        # Initialize database
        init_db()
        
        # Create initial firefighters and beacons
        self._create_initial_data()
        
        self.running = True
        self.thread = threading.Thread(target=self._simulate_loop, daemon=True)
        self.thread.start()
        print("Data simulator started")
        
    def stop(self):
        """Stop the data simulator"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=2)
        print("Data simulator stopped")
        
    def _create_initial_data(self):
        """Create initial firefighters and beacons"""
        db = SessionLocal()
        try:
            # Create firefighters
            if db.query(Firefighter).count() == 0:
                firefighters_data = [
                    {'name': 'Jan Kowalski', 'badge_number': 'FF001'},
                    {'name': 'Piotr Nowak', 'badge_number': 'FF002'},
                    {'name': 'Anna Wiśniewska', 'badge_number': 'FF003'},
                    {'name': 'Marek Zieliński', 'badge_number': 'FF004'},
                ]
                
                for ff_data in firefighters_data:
                    firefighter = Firefighter(**ff_data)
                    db.add(firefighter)
                    
                db.commit()
                
            # Create beacons
            if db.query(Beacon).count() == 0:
                beacons_data = [
                    {'beacon_id': 'B001', 'name': 'Beacon 1', 'latitude': 50.0614, 'longitude': 19.9366, 'floor': 0},
                    {'beacon_id': 'B002', 'name': 'Beacon 2', 'latitude': 50.0615, 'longitude': 19.9367, 'floor': 0},
                    {'beacon_id': 'B003', 'name': 'Beacon 3', 'latitude': 50.0616, 'longitude': 19.9368, 'floor': 1},
                    {'beacon_id': 'B004', 'name': 'Beacon 4', 'latitude': 50.0617, 'longitude': 19.9369, 'floor': 1},
                ]
                
                for beacon_data in beacons_data:
                    beacon = Beacon(**beacon_data)
                    db.add(beacon)
                    
                db.commit()
                
            # Store references
            self.firefighters = db.query(Firefighter).all()
            self.beacons = db.query(Beacon).all()
            
        finally:
            db.close()
            
    def _simulate_loop(self):
        """Main simulation loop"""
        while self.running:
            try:
                db = SessionLocal()
                try:
                    self._update_firefighters(db)
                    self._update_beacons(db)
                    self._generate_alerts(db)
                finally:
                    db.close()
                    
                time.sleep(1.5)  # Update every 1.5 seconds
            except Exception as e:
                print(f"Error in simulation loop: {e}")
                time.sleep(1)
                
    def _update_firefighters(self, db: Session):
        """Update firefighter positions and vitals"""
        for firefighter in self.firefighters:
            # Update position (small random movement)
            last_pos = db.query(Position).filter(
                Position.firefighter_id == firefighter.id
            ).order_by(Position.timestamp.desc()).first()
            
            if last_pos:
                # Small random movement
                lat = last_pos.latitude + random.uniform(-0.0001, 0.0001)
                lon = last_pos.longitude + random.uniform(-0.0001, 0.0001)
                floor = last_pos.floor
            else:
                # Initial position
                lat = 50.0614 + random.uniform(-0.001, 0.001)
                lon = 19.9366 + random.uniform(-0.001, 0.001)
                floor = random.randint(0, 2)
                
            position = Position(
                firefighter_id=firefighter.id,
                latitude=lat,
                longitude=lon,
                floor=floor,
                timestamp=datetime.utcnow()
            )
            db.add(position)
            
            # Update vitals
            last_vitals = db.query(Vitals).filter(
                Vitals.firefighter_id == firefighter.id
            ).order_by(Vitals.timestamp.desc()).first()
            
            if last_vitals:
                heart_rate = max(60, min(200, last_vitals.heart_rate + random.randint(-5, 5)))
                temperature = max(35.0, min(42.0, last_vitals.temperature + random.uniform(-0.2, 0.2)))
                oxygen_level = max(90.0, min(100.0, last_vitals.oxygen_level + random.uniform(-1, 1)))
                co_level = max(0, min(50, last_vitals.co_level + random.uniform(-1, 1)))
                battery_level = max(0, min(100, last_vitals.battery_level - random.uniform(0, 0.1)))
                scba_pressure = max(0, min(300, last_vitals.scba_pressure - random.uniform(0, 0.5)))
            else:
                heart_rate = random.randint(70, 100)
                temperature = random.uniform(36.5, 37.5)
                oxygen_level = random.uniform(95, 100)
                co_level = random.uniform(0, 10)
                battery_level = random.uniform(80, 100)
                scba_pressure = random.uniform(200, 300)
                
            vitals = Vitals(
                firefighter_id=firefighter.id,
                heart_rate=heart_rate,
                temperature=temperature,
                oxygen_level=oxygen_level,
                co_level=co_level,
                battery_level=battery_level,
                scba_pressure=scba_pressure,
                timestamp=datetime.utcnow()
            )
            db.add(vitals)
            
        db.commit()
        
    def _update_beacons(self, db: Session):
        """Update beacon status"""
        for beacon in self.beacons:
            beacon.battery_percent = max(0, min(100, beacon.battery_percent - random.uniform(0, 0.05)))
            beacon.signal_quality = random.uniform(70, 100)
            beacon.tags_in_range = random.randint(0, 5)
            beacon.last_seen = datetime.utcnow()
            beacon.is_online = random.random() > 0.05  # 95% online
            
        db.commit()
        
    def _generate_alerts(self, db: Session):
        """Generate random alerts based on vitals and position"""
        for firefighter in self.firefighters:
            last_vitals = db.query(Vitals).filter(
                Vitals.firefighter_id == firefighter.id
            ).order_by(Vitals.timestamp.desc()).first()
            
            if not last_vitals:
                continue
            
            # Check for MAN-DOWN (30 seconds stationary)
            positions = db.query(Position).filter(
                Position.firefighter_id == firefighter.id
            ).order_by(Position.timestamp.desc()).limit(100).all()
            
            if len(positions) > 1:
                first_pos = positions[0]
                stationary_since = first_pos.timestamp
                
                for pos in positions[1:]:
                    # Check if position changed (more than 5 meters)
                    lat_diff = abs(pos.latitude - first_pos.latitude) * 111000
                    lon_diff = abs(pos.longitude - first_pos.longitude) * 111000 * cos(first_pos.latitude * 3.14159 / 180)
                    distance = sqrt(lat_diff**2 + lon_diff**2)
                    
                    if distance > 5:  # Moved more than 5 meters
                        break
                    stationary_since = pos.timestamp
                
                time_stationary = (datetime.utcnow() - stationary_since).total_seconds()
                
                # Generate MAN-DOWN alert if stationary for 30+ seconds
                if time_stationary >= 30:
                    self._create_alert(db, firefighter.id, 'man_down')
                
            # Check for high heart rate
            if last_vitals.heart_rate > 180:
                self._create_alert(db, firefighter.id, 'high_heart_rate')
                
            # Check for low battery
            if last_vitals.battery_level < 20:
                self._create_alert(db, firefighter.id, 'low_battery')
                
            # Check for low SCBA pressure
            if last_vitals.scba_pressure < 50:
                self._create_alert(db, firefighter.id, 'scba_critical')
            elif last_vitals.scba_pressure < 100:
                self._create_alert(db, firefighter.id, 'scba_low_pressure')
                
            # Check for high CO
            if last_vitals.co_level > 30:
                self._create_alert(db, firefighter.id, 'high_co')
                
            # Check for low oxygen
            if last_vitals.oxygen_level < 90:
                self._create_alert(db, firefighter.id, 'low_oxygen')
                
            # Check for high temperature
            if last_vitals.temperature > 40:
                self._create_alert(db, firefighter.id, 'high_temperature')
                
        # Check for offline beacons
        for beacon in self.beacons:
            if not beacon.is_online:
                self._create_alert(db, None, 'beacon_offline')
                
        db.commit()
        
    def _create_alert(self, db: Session, firefighter_id: int, alert_type: str):
        """Create an alert if it doesn't exist recently"""
        # Check if alert already exists in last 30 seconds
        recent_alert = db.query(Alert).filter(
            Alert.firefighter_id == firefighter_id,
            Alert.alert_type == alert_type,
            Alert.timestamp > datetime.utcnow() - timedelta(seconds=30),
            Alert.acknowledged == False
        ).first()
        
        if not recent_alert:
            alert_info = ALERT_TYPES.get(alert_type, {'severity': 'warning', 'description': alert_type})
            alert = Alert(
                firefighter_id=firefighter_id,
                alert_type=alert_type,
                severity=alert_info['severity'],
                message=alert_info['description'],
                timestamp=datetime.utcnow()
            )
            db.add(alert)

