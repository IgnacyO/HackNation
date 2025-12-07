"""
Script to fix on_mission status and ensure it's not overwritten
"""
import sys
import os

# Add parent directory to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal
from backend.models import Firefighter

def fix_mission_status():
    """Set correct on_mission status for all firefighters"""
    db = SessionLocal()
    try:
        # List of firefighters that should be on mission
        on_mission_badges = ['FF-001', 'FF-002', 'FF-003', 'FF-004', 'FF-005', 'TAG-006']
        
        # Get all firefighters
        firefighters = db.query(Firefighter).all()
        
        updated_count = 0
        for firefighter in firefighters:
            should_be_on_mission = firefighter.badge_number in on_mission_badges
            
            # Force update even if value seems correct (to ensure it's saved)
            firefighter.on_mission = should_be_on_mission
            updated_count += 1
            print(f"Set {firefighter.badge_number} ({firefighter.name}): on_mission = {should_be_on_mission}")
        
        db.commit()
        print(f"\n✓ Updated {updated_count} firefighters")
        
        # Verify
        on_mission_count = db.query(Firefighter).filter(Firefighter.on_mission == True).count()
        not_on_mission_count = db.query(Firefighter).filter(Firefighter.on_mission == False).count()
        print(f"  - {on_mission_count} on mission")
        print(f"  - {not_on_mission_count} not on mission")
        
        # Double check by reading directly
        print("\nVerification:")
        for ff in firefighters:
            print(f"  {ff.badge_number}: {ff.on_mission}")
        
    except Exception as e:
        db.rollback()
        print(f"Error fixing mission status: {e}")
        raise
    finally:
        db.close()

if __name__ == '__main__':
    print("Fixing firefighters mission status...")
    fix_mission_status()

