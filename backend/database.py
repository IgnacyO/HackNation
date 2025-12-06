from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
from backend.models import Base
import os

# Database path
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'database', 'locero.db')

# Create engine
engine = create_engine(f'sqlite:///{DB_PATH}', echo=False)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """Initialize database and create all tables"""
    # Ensure database directory exists
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    # Run migrations
    migrate_db()
    
    print(f"Database initialized at {DB_PATH}")


def migrate_db():
    """Run database migrations"""
    inspector = inspect(engine)
    
    # Check if firefighters table exists
    if 'firefighters' in inspector.get_table_names():
        # Get existing columns
        columns = [col['name'] for col in inspector.get_columns('firefighters')]
        
        # Add on_mission column if it doesn't exist
        if 'on_mission' not in columns:
            with engine.connect() as conn:
                conn.execute(text('ALTER TABLE firefighters ADD COLUMN on_mission BOOLEAN DEFAULT 0'))
                conn.commit()
            print("Added 'on_mission' column to firefighters table")
        
        # Add team column if it doesn't exist
        if 'team' not in columns:
            with engine.connect() as conn:
                conn.execute(text('ALTER TABLE firefighters ADD COLUMN team VARCHAR(50)'))
                conn.commit()
            print("Added 'team' column to firefighters table")


def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

