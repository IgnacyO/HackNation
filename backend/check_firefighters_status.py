"""
Script to check current on_mission status of all firefighters
"""
import sys
import os

# Add parent directory to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal
from backend.models import Firefighter

def check_status():
    """Check on_mission status of all firefighters"""
    db = SessionLocal()
    try:
        firefighters = db.query(Firefighter).all()
        
        print(f"\nTotal firefighters: {len(firefighters)}\n")
        print("Status:")
        print("-" * 60)
        
        on_mission = []
        not_on_mission = []
        
        for ff in firefighters:
            status = "ON MISSION" if ff.on_mission else "NOT ON MISSION"
            print(f"{ff.badge_number:10} | {ff.name:25} | {status}")
            
            if ff.on_mission:
                on_mission.append(ff)
            else:
                not_on_mission.append(ff)
        
        print("-" * 60)
        print(f"\nSummary:")
        print(f"  On mission: {len(on_mission)}")
        print(f"  Not on mission: {len(not_on_mission)}")
        
        # Check if FF-007, FF-008, FF-009, FF-010 should be NOT on mission
        should_not_be_on_mission = ['FF-007', 'FF-008', 'FF-009', 'FF-010']
        print(f"\nChecking FF-007, FF-008, FF-009, FF-010:")
        for badge in should_not_be_on_mission:
            ff = db.query(Firefighter).filter(Firefighter.badge_number == badge).first()
            if ff:
                status = "✓ OK" if not ff.on_mission else "✗ ERROR - Should be NOT on mission"
                print(f"  {badge}: {status} (on_mission = {ff.on_mission})")
        
    finally:
        db.close()

if __name__ == '__main__':
    check_status()

