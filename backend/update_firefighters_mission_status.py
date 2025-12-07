"""
Script to update all firefighters to have on_mission = False by default
Only those explicitly set in generate_test_data.py will be on mission
"""
import sys
import os

# Add parent directory to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal
from backend.models import Firefighter

def update_mission_status():
    """Set all firefighters to on_mission = False"""
    db = SessionLocal()
    try:
        # Get all firefighters
        firefighters = db.query(Firefighter).all()
        
        # List of firefighters that should be on mission (from generate_test_data.py)
        on_mission_badges = ['FF-001', 'FF-002', 'FF-003', 'FF-004', 'FF-005', 'TAG-006']
        
        updated_count = 0
        for firefighter in firefighters:
            should_be_on_mission = firefighter.badge_number in on_mission_badges
            
            if firefighter.on_mission != should_be_on_mission:
                firefighter.on_mission = should_be_on_mission
                updated_count += 1
                print(f"Updated {firefighter.badge_number} ({firefighter.name}): on_mission = {should_be_on_mission}")
        
        db.commit()
        print(f"\n✓ Updated {updated_count} firefighters")
        print(f"  - {len([f for f in firefighters if f.on_mission])} on mission")
        print(f"  - {len([f for f in firefighters if not f.on_mission])} not on mission")
        
    except Exception as e:
        db.rollback()
        print(f"Error updating mission status: {e}")
        raise
    finally:
        db.close()

if __name__ == '__main__':
    print("Updating firefighters mission status...")
    update_mission_status()

