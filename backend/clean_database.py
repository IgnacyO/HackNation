"""
Script to clean database - remove all data and prepare for fresh start
"""
import sys
import os

# Add parent directory to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal, engine
from backend.models import Base, Firefighter, Position, Vitals, Alert, Beacon
from sqlalchemy import text

def clean_database():
    """Remove all data from database"""
    db = SessionLocal()
    try:
        print("Cleaning database...")
        
        # Delete all data
        db.query(Alert).delete()
        db.query(Vitals).delete()
        db.query(Position).delete()
        db.query(Beacon).delete()
        db.query(Firefighter).delete()
        
        db.commit()
        print("✓ Database cleaned successfully")
        
    except Exception as e:
        db.rollback()
        print(f"Error cleaning database: {e}")
        raise
    finally:
        db.close()

if __name__ == '__main__':
    print("This will delete ALL data from the database!")
    response = input("Are you sure? (yes/no): ")
    if response.lower() == 'yes':
        clean_database()
    else:
        print("Cancelled.")

