"""
Script to remove duplicate firefighters from database.
Keeps the one with TAG badge_number, removes the one with FF badge_number.
"""
import sys
import os

# Add parent directory to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal
from backend.models import Firefighter, Position, Vitals, Alert

def remove_duplicate_firefighters():
    """Remove duplicate firefighters - keep TAG, remove FF"""
    db = SessionLocal()
    try:
        # Find all firefighters
        all_firefighters = db.query(Firefighter).all()
        
        # Group by name
        name_groups = {}
        for ff in all_firefighters:
            name = ff.name.strip() if ff.name else None
            if name:
                if name not in name_groups:
                    name_groups[name] = []
                name_groups[name].append(ff)
        
        # Find duplicates
        duplicates_found = []
        for name, firefighters in name_groups.items():
            if len(firefighters) > 1:
                # Check if we have TAG and FF versions
                tag_ff = None
                ff_ff = None
                
                for ff in firefighters:
                    badge = ff.badge_number or ''
                    if badge.startswith('TAG-'):
                        tag_ff = ff
                    elif badge.startswith('FF-'):
                        ff_ff = ff
                
                if tag_ff and ff_ff:
                    duplicates_found.append({
                        'name': name,
                        'tag': tag_ff,
                        'ff': ff_ff
                    })
        
        if not duplicates_found:
            print("No duplicates found (TAG and FF with same name)")
            return
        
        # Remove FF versions
        for dup in duplicates_found:
            ff_to_remove = dup['ff']
            tag_to_keep = dup['tag']
            
            print(f"\nFound duplicate: {dup['name']}")
            print(f"  Keeping: {tag_to_keep.badge_number} (ID: {tag_to_keep.id})")
            print(f"  Removing: {ff_to_remove.badge_number} (ID: {ff_to_remove.id})")
            
            # Count related records
            positions_count = db.query(Position).filter(Position.firefighter_id == ff_to_remove.id).count()
            vitals_count = db.query(Vitals).filter(Vitals.firefighter_id == ff_to_remove.id).count()
            alerts_count = db.query(Alert).filter(Alert.firefighter_id == ff_to_remove.id).count()
            
            print(f"  Related records: {positions_count} positions, {vitals_count} vitals, {alerts_count} alerts")
            
            # Update alerts to point to TAG version
            if alerts_count > 0:
                db.query(Alert).filter(Alert.firefighter_id == ff_to_remove.id).update({
                    'firefighter_id': tag_to_keep.id
                })
                print(f"  Updated {alerts_count} alerts to point to TAG version")
            
            # Delete related records (cascade should handle this, but let's be explicit)
            db.query(Position).filter(Position.firefighter_id == ff_to_remove.id).delete()
            db.query(Vitals).filter(Vitals.firefighter_id == ff_to_remove.id).delete()
            
            # Delete the firefighter
            db.delete(ff_to_remove)
            print(f"  Deleted firefighter {ff_to_remove.badge_number}")
        
        db.commit()
        print(f"\n✓ Successfully removed {len(duplicates_found)} duplicate(s)")
        
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()

if __name__ == '__main__':
    print("Removing duplicate firefighters (keeping TAG, removing FF)...")
    remove_duplicate_firefighters()

