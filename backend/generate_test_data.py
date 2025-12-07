"""
Script to generate test data:
- Firefighters (some on mission, some not)
- Active and inactive beacons near building
- Clean database first
"""
import sys
import os
import random
from datetime import datetime, timedelta

# Add parent directory to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal, init_db
from backend.models import Firefighter, Position, Vitals, Alert, Beacon

# Building center coordinates (Warsaw)
BUILDING_CENTER_LAT = 52.2297
BUILDING_CENTER_LON = 21.0122

def generate_test_data():
    """Generate test data for the application"""
    db = SessionLocal()
    try:
        print("Generating test data...")
        
        # Clean existing data first
        db.query(Alert).delete()
        db.query(Vitals).delete()
        db.query(Position).delete()
        db.query(Beacon).delete()
        db.query(Firefighter).delete()
        db.commit()
        print("✓ Cleaned existing data")
        
        # Generate firefighters
        firefighters_data = [
            {'name': 'Jan Kowalski', 'badge': 'FF-001', 'team': 'RIT', 'on_mission': True},
            {'name': 'Anna Nowak', 'badge': 'FF-002', 'team': 'Engine 1', 'on_mission': True},
            {'name': 'Piotr Wiśniewski', 'badge': 'FF-003', 'team': 'Engine 2', 'on_mission': True},
            {'name': 'Maria Dąbrowska', 'badge': 'FF-004', 'team': 'Ladder 1', 'on_mission': True},
            {'name': 'Krzysztof Lewandowski', 'badge': 'FF-005', 'team': 'RIT', 'on_mission': True},
            {'name': 'Katarzyna Dąbrowska', 'badge': 'TAG-006', 'team': 'RIT', 'on_mission': True},
            {'name': 'Tomasz Zieliński', 'badge': 'FF-007', 'team': 'Engine 1', 'on_mission': False},
            {'name': 'Agnieszka Wójcik', 'badge': 'FF-008', 'team': 'Engine 2', 'on_mission': False},
            {'name': 'Marcin Szymański', 'badge': 'FF-009', 'team': 'Rescue 1', 'on_mission': False},
            {'name': 'Ewa Kowalczyk', 'badge': 'FF-010', 'team': 'Squad 1', 'on_mission': False},
        ]
        
        firefighters = []
        for ff_data in firefighters_data:
            firefighter = Firefighter(
                name=ff_data['name'],
                badge_number=ff_data['badge'],
                team=ff_data['team'],
                on_mission=ff_data['on_mission']
            )
            db.add(firefighter)
            firefighters.append(firefighter)
        
        db.commit()
        print(f"✓ Created {len(firefighters)} firefighters")
        
        # Generate positions and vitals for firefighters on mission
        for firefighter in firefighters:
            if firefighter.on_mission:
                # Random position near building (within 50m)
                lat_offset = random.uniform(-0.0004, 0.0004)  # ~50m
                lon_offset = random.uniform(-0.0004, 0.0004)
                
                position = Position(
                    firefighter_id=firefighter.id,
                    latitude=BUILDING_CENTER_LAT + lat_offset,
                    longitude=BUILDING_CENTER_LON + lon_offset,
                    floor=random.choice([-1, 0, 1, 2]),
                    timestamp=datetime.utcnow() - timedelta(seconds=random.randint(0, 10))
                )
                db.add(position)
                
                # Generate vitals with safe values (to avoid too many alerts)
                vitals = Vitals(
                    firefighter_id=firefighter.id,
                    heart_rate=random.randint(70, 120),  # Normal range
                    temperature=random.uniform(36.0, 37.5),  # Normal
                    oxygen_level=random.uniform(95.0, 99.0),  # Good
                    co_level=random.uniform(0, 20),  # Low CO
                    battery_level=random.uniform(60, 100),  # Good battery
                    scba_pressure=random.uniform(200, 300),  # Good pressure
                    timestamp=datetime.utcnow() - timedelta(seconds=random.randint(0, 10))
                )
                db.add(vitals)
        
        db.commit()
        print(f"✓ Created positions and vitals for firefighters on mission")
        
        # Generate beacons - mix of active and inactive
        beacons_data = [
            # Active beacons inside/near building
            {'id': 'BEACON-001', 'name': 'Klatka schodowa - Parter', 'lat': 0.0002, 'lon': 0.0002, 'floor': 0, 'online': True},
            {'id': 'BEACON-002', 'name': 'Klatka schodowa - 1p', 'lat': 0.0002, 'lon': 0.0002, 'floor': 1, 'online': True},
            {'id': 'BEACON-003', 'name': 'Klatka schodowa - 2p', 'lat': 0.0002, 'lon': 0.0002, 'floor': 2, 'online': True},
            {'id': 'BEACON-004', 'name': 'Wejście główne', 'lat': 0.0003, 'lon': 0.0001, 'floor': 0, 'online': True},
            {'id': 'BEACON-005', 'name': 'Piwnica - Korytarz', 'lat': 0.0001, 'lon': 0.0001, 'floor': -1, 'online': True},
            
            # Inactive beacons near building (within 100m)
            {'id': 'BEACON-006', 'name': 'Beacon zewnętrzny 1', 'lat': 0.0008, 'lon': 0.0008, 'floor': 0, 'online': False},
            {'id': 'BEACON-007', 'name': 'Beacon zewnętrzny 2', 'lat': -0.0008, 'lon': 0.0008, 'floor': 0, 'online': False},
            {'id': 'BEACON-008', 'name': 'Beacon zewnętrzny 3', 'lat': 0.0008, 'lon': -0.0008, 'floor': 0, 'online': False},
            {'id': 'BEACON-009', 'name': 'Beacon zewnętrzny 4', 'lat': -0.0008, 'lon': -0.0008, 'floor': 0, 'online': False},
        ]
        
        for beacon_data in beacons_data:
            beacon = Beacon(
                beacon_id=beacon_data['id'],
                name=beacon_data['name'],
                latitude=BUILDING_CENTER_LAT + beacon_data['lat'],
                longitude=BUILDING_CENTER_LON + beacon_data['lon'],
                floor=beacon_data['floor'],
                is_online=beacon_data['online'],
                battery_percent=random.uniform(20, 100) if beacon_data['online'] else random.uniform(0, 20),
                signal_quality=random.uniform(70, 100) if beacon_data['online'] else random.uniform(0, 30),
                tags_in_range=random.randint(0, 5) if beacon_data['online'] else 0,
                last_seen=datetime.utcnow() if beacon_data['online'] else datetime.utcnow() - timedelta(minutes=random.randint(5, 60))
            )
            db.add(beacon)
        
        db.commit()
        print(f"✓ Created {len(beacons_data)} beacons ({sum(1 for b in beacons_data if b['online'])} active, {sum(1 for b in beacons_data if not b['online'])} inactive)")
        
        print("\n✓ Test data generated successfully!")
        print(f"  - {len([f for f in firefighters if f.on_mission])} firefighters on mission")
        print(f"  - {len([f for f in firefighters if not f.on_mission])} firefighters not on mission")
        print(f"  - {sum(1 for b in beacons_data if b['online'])} active beacons")
        print(f"  - {sum(1 for b in beacons_data if not b['online'])} inactive beacons")
        
    except Exception as e:
        db.rollback()
        print(f"Error generating test data: {e}")
        raise
    finally:
        db.close()

if __name__ == '__main__':
    print("Generating test data...")
    print("This will delete all existing data and create new test data.")
    response = input("Continue? (yes/no): ")
    if response.lower() == 'yes':
        generate_test_data()
    else:
        print("Cancelled.")

