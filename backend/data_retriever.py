import sys
import os

# Add parent directory to Python path to allow imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests
import time
import threading
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import desc
from backend.database import SessionLocal, init_db
from backend.models import Firefighter, Position, Vitals, Alert, Beacon

# API Configuration
SIMULATOR_API_BASE = 'https://niesmiertelnik.replit.app/api/v1'

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


class DataRetriever:
    def __init__(self):
        self.running = False
        self.thread = None
        self.firefighter_map = {}  # Map simulator tag_id -> local firefighter_id
        self.beacon_map = {}  # Map simulator beacon_id -> local beacon_id
    
    def _convert_signal_quality(self, value):
        """Convert signal_quality from string to float"""
        if value is None:
            return 100.0
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            # Map common string values to numbers
            quality_map = {
                'excellent': 100.0,
                'good': 75.0,
                'fair': 50.0,
                'poor': 25.0,
                'weak': 10.0
            }
            return quality_map.get(value.lower(), 100.0)
        return 100.0
    
    def _convert_to_float(self, value, default=100.0):
        """Convert value to float, handling strings and None"""
        if value is None:
            return default
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            try:
                return float(value)
            except ValueError:
                return default
        return default
    
    def _convert_to_int(self, value, default=0):
        """Convert value to int, handling lists and None"""
        if value is None:
            return default
        if isinstance(value, int):
            return value
        if isinstance(value, (float, str)):
            try:
                return int(value)
            except (ValueError, TypeError):
                return default
        if isinstance(value, list):
            # If it's a list, return the count
            return len(value)
        return default
        
    def start(self):
        """Start the data retriever"""
        if self.running:
            return
            
        # Initialize database
        init_db()
        
        # Create initial mappings
        self._sync_initial_data()
        
        self.running = True
        self.thread = threading.Thread(target=self._retrieve_loop, daemon=True)
        self.thread.start()
        print("Data retriever started")
        
    def stop(self):
        """Stop the data retriever"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=2)
        print("Data retriever stopped")
        
    def _sync_initial_data(self):
        """Sync firefighters and beacons from simulator"""
        try:
            # Get firefighters from simulator
            response = requests.get(f'{SIMULATOR_API_BASE}/firefighters', timeout=5)
            if response.status_code == 200:
                try:
                    sim_firefighters = response.json()
                except ValueError:
                    print(f"Invalid JSON response from firefighters API: {response.text[:100]}")
                    return
                
                # Handle both list and dict responses
                if isinstance(sim_firefighters, dict):
                    # Try common keys
                    sim_firefighters = sim_firefighters.get('firefighters') or sim_firefighters.get('data') or sim_firefighters.get('items') or list(sim_firefighters.values())[0] if sim_firefighters else []
                
                # Check if we have a list now
                if not isinstance(sim_firefighters, list):
                    print(f"Could not extract list from firefighters API response: {type(sim_firefighters)}")
                    return
                
                db = SessionLocal()
                try:
                    for sim_ff in sim_firefighters:
                        # Check if sim_ff is a dict
                        if not isinstance(sim_ff, dict):
                            continue
                        tag_id = sim_ff.get('tag_id') or sim_ff.get('id')
                        
                        # Try to get name and team from multiple possible keys
                        firefighter_data = sim_ff.get('firefighter') or {}
                        if isinstance(firefighter_data, dict):
                            name = (
                                firefighter_data.get('name') or
                                sim_ff.get('name') or 
                                sim_ff.get('firefighter_name') or
                                sim_ff.get('full_name') or
                                sim_ff.get('display_name') or
                                ''
                            )
                            team = firefighter_data.get('team') or sim_ff.get('team') or ''
                        else:
                            name = (
                                sim_ff.get('name') or 
                                sim_ff.get('firefighter_name') or
                                sim_ff.get('full_name') or
                                sim_ff.get('display_name') or
                                ''
                            )
                            team = sim_ff.get('team') or ''
                        
                        badge_number = sim_ff.get('badge_number') or sim_ff.get('badge') or tag_id
                        
                        # Find or create firefighter
                        firefighter = db.query(Firefighter).filter(
                            Firefighter.badge_number == badge_number
                        ).first()
                        
                    if not firefighter:
                        firefighter = Firefighter(
                            name=name or f'Strażak {badge_number}',
                            badge_number=badge_number,
                            team=team or None
                        )
                        db.add(firefighter)
                        db.commit()
                        db.refresh(firefighter)
                        print(f"Created firefighter {badge_number} with name: {firefighter.name}, team: {team or 'None'}")
                    else:
                        # Always update name if available and different (including if current is "Unknown")
                        if name and name.strip() and name != firefighter.name:
                            old_name = firefighter.name
                            firefighter.name = name
                            db.commit()
                            print(f"Updated firefighter {firefighter.badge_number} name: '{old_name}' -> '{name}'")
                        # Always update team if available
                        if team and team.strip() and team != firefighter.team:
                            firefighter.team = team
                            db.commit()
                        
                        self.firefighter_map[tag_id] = firefighter.id
                    
                    # Get beacons from simulator
                    response = requests.get(f'{SIMULATOR_API_BASE}/beacons', timeout=5)
                    if response.status_code == 200:
                        try:
                            sim_beacons = response.json()
                            print(sim_beacons)
                        except ValueError:
                            print(f"Invalid JSON response from beacons API: {response.text[:100]}")
                            sim_beacons = []
                        
                        # Handle both list and dict responses
                        if isinstance(sim_beacons, dict):
                            # Try common keys
                            sim_beacons = sim_beacons.get('beacons') or sim_beacons.get('data') or sim_beacons.get('items') or list(sim_beacons.values())[0] if sim_beacons else []
                        
                        # Check if we have a list now
                        if not isinstance(sim_beacons, list):
                            print(f"Could not extract list from beacons API response: {type(sim_beacons)}")
                            sim_beacons = []
                        
                        for sim_beacon in sim_beacons:
                            # Check if sim_beacon is a dict
                            if not isinstance(sim_beacon, dict):
                                continue
                            beacon_id = sim_beacon.get('beacon_id') or sim_beacon.get('id')
                            if not beacon_id:
                                continue
                            
                            # Convert to string to ensure type consistency
                            beacon_id = str(beacon_id)
                                
                            name = sim_beacon.get('name') or f'Beacon {beacon_id}'
                            
                            # Extract position
                            position = sim_beacon.get('position') or {}
                            lat = None
                            lon = None
                            floor = 0
                            
                            if isinstance(position, dict):
                                gps = position.get('gps') or []
                                
                                # Handle both list and dict formats for GPS
                                if isinstance(gps, list) and len(gps) >= 2:
                                    lat, lon = gps[0], gps[1]
                                elif isinstance(gps, dict):
                                    lat = gps.get('latitude') or gps.get('lat')
                                    lon = gps.get('longitude') or gps.get('lon')
                                else:
                                    # Try direct lat/lon in position
                                    lat = position.get('latitude') or position.get('lat')
                                    lon = position.get('longitude') or position.get('lon')
                                
                                # Try to get floor from position, or directly from sim_beacon
                                floor = position.get('floor') or sim_beacon.get('floor') or 0
                            else:
                                # If position is not a dict, try to get floor directly from sim_beacon
                                floor = sim_beacon.get('floor') or 0
                            
                            # Find or create beacon
                            beacon = db.query(Beacon).filter(
                                Beacon.beacon_id == beacon_id
                            ).first()
                            
                            if not beacon:
                                if lat is not None and lon is not None:
                                    beacon = Beacon(
                                        beacon_id=beacon_id,
                                        name=name,
                                        latitude=float(lat),
                                        longitude=float(lon),
                                        floor=int(floor)
                                    )
                                else:
                                    # Create beacon without position if GPS not available
                                    beacon = Beacon(
                                        beacon_id=beacon_id,
                                        name=name,
                                        latitude=float(lat),  # Default coordinates
                                        longitude=float(lon),
                                        floor=int(floor)
                                    )
                                    print("Created beacon", beacon_id)
                                db.add(beacon)
                            else:
                                # Update position if provided
                                if lat is not None and lon is not None:
                                    beacon.latitude = float(lat)
                                    beacon.longitude = float(lon)
                                # Update floor if provided (check both position and sim_beacon)
                                floor_val = position.get('floor') if isinstance(position, dict) else None
                                if floor_val is None:
                                    floor_val = sim_beacon.get('floor')
                                if floor_val is not None:
                                    try:
                                        beacon.floor = int(floor_val)
                                    except (ValueError, TypeError):
                                        print(f"Warning: Could not convert floor value '{floor_val}' to int for beacon {beacon_id}")
                            
                            # Update status
                            status = sim_beacon.get('status')
                            # Ensure status is a dict, not a string
                            if not isinstance(status, dict):
                                status = {}
                            
                            battery_val = status.get('battery_percent') or sim_beacon.get('battery_percent') or beacon.battery_percent
                            beacon.battery_percent = self._convert_to_float(battery_val, beacon.battery_percent or 100.0)
                            
                            signal_val = status.get('signal_quality') or sim_beacon.get('signal_quality') or beacon.signal_quality
                            beacon.signal_quality = self._convert_signal_quality(signal_val)
                            
                            tags_val = status.get('tags_in_range') or sim_beacon.get('tags_in_range') or beacon.tags_in_range
                            beacon.tags_in_range = self._convert_to_int(tags_val, beacon.tags_in_range or 0)
                            
                            beacon.is_online = status.get('is_online', True)
                            beacon.last_seen = datetime.utcnow()
                            
                            db.commit()
                            db.refresh(beacon)
                            self.beacon_map[beacon_id] = beacon.id
                finally:
                    db.close()
        except Exception as e:
            print(f"Error syncing initial data: {e}")
            
    def _retrieve_loop(self):
        """Main retrieval loop"""
        while self.running:
            try:
                db = SessionLocal()
                try:
                    self._update_firefighters(db)
                    self._update_beacons(db)
                    self._update_alerts(db)
                finally:
                    db.close()
                    
                time.sleep(1.5)  # Update every 1.5 seconds
            except Exception as e:
                print(f"Error in retrieval loop: {e}")
                time.sleep(1)
                
    def _update_firefighters(self, db: Session):
        """Update firefighters from simulator API"""
        try:
            response = requests.get(f'{SIMULATOR_API_BASE}/firefighters', timeout=5)
            if response.status_code != 200:
                return
            
            try:
                sim_firefighters = response.json()
            except ValueError:
                print(f"Invalid JSON response from firefighters API: {response.text[:100]}")
                return

            
            
            # Handle both list and dict responses
            if isinstance(sim_firefighters, dict):
                # Try common keys
                sim_firefighters = sim_firefighters.get('firefighters') or sim_firefighters.get('data') or sim_firefighters.get('items') or list(sim_firefighters.values())[0] if sim_firefighters else []

            # Check if we have a list now
            if not isinstance(sim_firefighters, list):
                print(f"Could not extract list from firefighters API response: {type(sim_firefighters)}")
                return
            
            for sim_ff in sim_firefighters:
                # Check if sim_ff is a dict
                if not isinstance(sim_ff, dict):
                    continue
                tag_id = sim_ff.get('tag_id') or sim_ff.get('id')
                if not tag_id:
                    continue
                
                # Debug: log first firefighter structure
                if len(self.firefighter_map) == 0:
                    print(f"DEBUG: First firefighter structure - keys: {list(sim_ff.keys())}")
                    print(f"DEBUG: First firefighter data: {sim_ff}")
                    
                # Try to get name from multiple possible keys
                # Check firefighter object first (new API structure)
                firefighter_data = sim_ff.get('firefighter') or {}
                if isinstance(firefighter_data, dict):
                    name = (
                        firefighter_data.get('name') or
                        sim_ff.get('name') or 
                        sim_ff.get('firefighter_name') or
                        sim_ff.get('full_name') or
                        sim_ff.get('display_name') or
                        ''
                    )
                    badge_number = (
                        firefighter_data.get('id') or
                        firefighter_data.get('badge_number') or
                        sim_ff.get('badge_number') or 
                        sim_ff.get('badge') or 
                        tag_id
                    )
                    team = firefighter_data.get('team') or sim_ff.get('team') or ''
                else:
                    name = (
                        sim_ff.get('name') or 
                        sim_ff.get('firefighter_name') or
                        sim_ff.get('full_name') or
                        sim_ff.get('display_name') or
                        ''
                    )
                    badge_number = sim_ff.get('badge_number') or sim_ff.get('badge') or tag_id
                    team = sim_ff.get('team') or ''
                    
                # If tag_id not in map, try to add it
                if tag_id not in self.firefighter_map:
                    firefighter = db.query(Firefighter).filter(
                        Firefighter.badge_number == badge_number
                    ).first()
                    
                    if not firefighter:
                        firefighter = Firefighter(
                            name=name or f'Strażak {badge_number}',
                            badge_number=badge_number,
                            team=team or None
                        )
                        db.add(firefighter)
                        db.commit()
                        db.refresh(firefighter)
                        print(f"Created firefighter {badge_number} with name: {firefighter.name}, team: {team}")
                    
                    self.firefighter_map[tag_id] = firefighter.id
                    
                firefighter_id = self.firefighter_map[tag_id]
                
                # Get or create firefighter
                firefighter = db.query(Firefighter).filter(
                    Firefighter.id == firefighter_id
                ).first()
                
                if not firefighter:
                    continue
                
                # Always update name if available and different (including if current is "Unknown")
                if name and name.strip() and name != firefighter.name:
                    old_name = firefighter.name
                    firefighter.name = name
                    print(f"Updated firefighter {firefighter.badge_number} name: '{old_name}' -> '{name}'")
                
                # Always update team if available
                if team and team.strip() and team != firefighter.team:
                    firefighter.team = team
                
                # Update position
                position_data = sim_ff.get('position') or {}
                if isinstance(position_data, dict):
                    # Check GPS in position.gps (new API structure)
                    gps = position_data.get('gps') or {}
                    
                    # Handle both list and dict formats for GPS
                    if isinstance(gps, list) and len(gps) >= 2:
                        lat, lon = gps[0], gps[1]
                    elif isinstance(gps, dict):
                        lat = gps.get('lat') or gps.get('latitude')
                        lon = gps.get('lon') or gps.get('longitude')
                    else:
                        # Try direct lat/lon in position_data
                        lat = position_data.get('latitude') or position_data.get('lat')
                        lon = position_data.get('longitude') or position_data.get('lon')
                    
                    if lat is not None and lon is not None:
                        floor = position_data.get('floor', 0)
                        
                        position = Position(
                            firefighter_id=firefighter_id,
                            latitude=float(lat),
                            longitude=float(lon),
                            floor=int(floor),
                            timestamp=datetime.utcnow()
                        )
                        db.add(position)
                
                # Update vitals - always update, even if some data is missing
                # New API structure: vitals and device are directly in sim_ff, not in telemetry
                vitals_data = sim_ff.get('vitals') or {}
                device_data = sim_ff.get('device') or {}
                scba_data = sim_ff.get('scba') or {}
                environment_data = sim_ff.get('environment') or {}
                
                # Try to get battery from multiple sources (device.battery_percent is the main source)
                battery_level = (
                    device_data.get('battery_percent') or
                    vitals_data.get('battery_percent') or 
                    vitals_data.get('battery_level') or
                    vitals_data.get('battery') or
                    sim_ff.get('battery_percent') or
                    sim_ff.get('battery_level') or
                    sim_ff.get('battery') or
                    sim_ff.get('device_battery') or
                    sim_ff.get('tag_battery')
                )
                
                # Get other vitals data - check multiple possible keys
                heart_rate = (
                    vitals_data.get('heart_rate_bpm') or 
                    vitals_data.get('heart_rate') or
                    vitals_data.get('hr') or
                    sim_ff.get('heart_rate')
                )
                
                temperature = (
                    vitals_data.get('skin_temperature_c') or
                    vitals_data.get('temperature_celsius') or 
                    vitals_data.get('temperature') or
                    vitals_data.get('temp') or
                    sim_ff.get('temperature')
                )
                
                oxygen_level = (
                    environment_data.get('o2_percent') or
                    vitals_data.get('oxygen_level_percent') or 
                    vitals_data.get('oxygen_level') or
                    vitals_data.get('o2') or
                    sim_ff.get('oxygen_level')
                )
                
                co_level = (
                    environment_data.get('co_ppm') or
                    vitals_data.get('co_ppm') or 
                    vitals_data.get('co_level') or
                    vitals_data.get('co') or
                    sim_ff.get('co_level')
                )
                
                scba_pressure = (
                    scba_data.get('cylinder_pressure_bar') or
                    vitals_data.get('scba_pressure_bar') or 
                    vitals_data.get('scba_pressure') or
                    vitals_data.get('scba') or
                    sim_ff.get('scba_pressure')
                )
                
                # Always create vitals entry, even if some values are None
                # This ensures we update all firefighters, including those with missing data
                vitals = Vitals(
                    firefighter_id=firefighter_id,
                    heart_rate=heart_rate,
                    temperature=temperature,
                    oxygen_level=oxygen_level,
                    co_level=co_level,
                    battery_level=battery_level,
                    scba_pressure=scba_pressure,
                    timestamp=datetime.utcnow()
                )
                db.add(vitals)
                
                # Log if battery level is missing - show what data we have
                if battery_level is None:
                    debug_info = {
                        'tag_id': tag_id,
                        'badge': badge_number,
                        'name': firefighter.name,
                        'has_vitals_data': bool(vitals_data),
                        'has_device_data': bool(device_data),
                        'vitals_keys': list(vitals_data.keys()) if isinstance(vitals_data, dict) else [],
                        'device_keys': list(device_data.keys()) if isinstance(device_data, dict) else [],
                        'sim_ff_keys': list(sim_ff.keys())
                    }
                    print(f"Warning: Firefighter {firefighter.badge_number} ({firefighter.name or 'Unknown'}) has no battery level data. Debug: {debug_info}")
            
            db.commit()
            
            # After updating, check if there are any firefighters in DB that weren't updated
            all_db_firefighters = db.query(Firefighter).all()
            updated_firefighter_ids = set(self.firefighter_map.values())
            missing_firefighters = [ff for ff in all_db_firefighters if ff.id not in updated_firefighter_ids]
            
            if missing_firefighters:
                print(f"Note: {len(missing_firefighters)} firefighters in DB were not in API response")
        except Exception as e:
            print(f"Error updating firefighters: {e}")
            import traceback
            traceback.print_exc()
            
    def _update_beacons(self, db: Session):
        """Update beacons from simulator API"""
        try:
            response = requests.get(f'{SIMULATOR_API_BASE}/beacons', timeout=5)
            if response.status_code != 200:
                return
            
            try:
                sim_beacons = response.json()
            except ValueError:
                print(f"Invalid JSON response from beacons API: {response.text[:100]}")
                return
            
            # Debug: log the raw response type
            print(f"DEBUG: Raw API response type: {type(sim_beacons)}")
            if isinstance(sim_beacons, dict):
                print(f"DEBUG: Dict keys: {list(sim_beacons.keys())}")
            elif isinstance(sim_beacons, list):
                print(f"DEBUG: List length: {len(sim_beacons)}, first item type: {type(sim_beacons[0]) if sim_beacons else 'empty'}")
            
            # Handle both list and dict responses
            if isinstance(sim_beacons, dict):
                original_dict = sim_beacons
                # Try common keys
                sim_beacons = original_dict.get('beacons') or original_dict.get('data') or original_dict.get('items')
                # If still not found, try to get first value that is a list
                if not isinstance(sim_beacons, list):
                    for value in original_dict.values():
                        if isinstance(value, list):
                            sim_beacons = value
                            break
                    # If still not a list, set to empty list
                    if not isinstance(sim_beacons, list):
                        sim_beacons = []
            
            # Check if we have a list now
            if not isinstance(sim_beacons, list):
                print(f"Could not extract list from beacons API response: {type(sim_beacons)}, value: {sim_beacons}")
                return
            
            # Validate that all items in the list are dicts
            if sim_beacons and not all(isinstance(item, dict) for item in sim_beacons):
                print(f"Warning: Some items in beacons list are not dicts. Filtering...")
                sim_beacons = [item for item in sim_beacons if isinstance(item, dict)]
            
            # Collect all beacon IDs from simulation
            sim_beacon_ids = set()
            for sim_beacon in sim_beacons:
                if isinstance(sim_beacon, dict):
                    beacon_id = sim_beacon.get('beacon_id') or sim_beacon.get('id')
                    if beacon_id:
                        sim_beacon_ids.add(str(beacon_id))
            
            print(f"Found {len(sim_beacon_ids)} beacons in simulation: {sim_beacon_ids}")
            
            # Mark beacons as offline if they're not in the simulation response
            # Only delete test beacons (B001-B004) if they're not in simulation
            # Keep other beacons for history (just mark as offline)
            all_local_beacons = db.query(Beacon).all()
            print(f"Total local beacons: {len(all_local_beacons)}")
            
            for local_beacon in all_local_beacons:
                if str(local_beacon.beacon_id) not in sim_beacon_ids:
                    # Beacon not in simulation
                    beacon_id_str = str(local_beacon.beacon_id)
                    is_test_beacon = beacon_id_str in ['B001', 'B002', 'B003', 'B004']
                    
                    if is_test_beacon:
                        # Test beacon - delete it (it's from old simulator)
                        print(f"Deleting test beacon {local_beacon.beacon_id} (not in simulation)")
                        db.delete(local_beacon)
                    else:
                        # Real beacon - mark as offline (keep for history)
                        local_beacon.is_online = False
                        print(f"Marked beacon {local_beacon.beacon_id} as offline (not in simulation)")
            
            # Now update/create beacons from simulation
            created_count = 0
            updated_count = 0
            skipped_count = 0
            print(f"DEBUG: Starting to process {len(sim_beacons)} beacons from API")
            for idx, sim_beacon in enumerate(sim_beacons):
                try:
                    # Check if sim_beacon is a dict
                    if not isinstance(sim_beacon, dict):
                        skipped_count += 1
                        print(f"Warning: Beacon {idx} is not a dict, skipping. Type: {type(sim_beacon)}")
                        continue
                    beacon_id = sim_beacon.get('beacon_id') or sim_beacon.get('id')
                    
                    # Skip if beacon_id is missing
                    if not beacon_id:
                        skipped_count += 1
                        print(f"Warning: Skipping beacon {idx} with missing beacon_id: {sim_beacon}")
                        continue
                    
                    # Convert to string to ensure type consistency
                    beacon_id = str(beacon_id)
                    print(f"DEBUG: Processing beacon {idx+1}/{len(sim_beacons)}: {beacon_id}")
                    
                    # Debug: log structure for first beacon to see where floor is
                    if idx == 0:
                        print(f"DEBUG: First beacon structure - keys: {list(sim_beacon.keys())}")
                        print(f"DEBUG: First beacon position: {sim_beacon.get('position')}")
                        print(f"DEBUG: First beacon floor (direct): {sim_beacon.get('floor')}")
                        if isinstance(sim_beacon.get('position'), dict):
                            print(f"DEBUG: First beacon position.floor: {sim_beacon.get('position', {}).get('floor')}")
                    
                    # Find beacon in local DB
                    beacon = db.query(Beacon).filter(
                        Beacon.beacon_id == beacon_id
                    ).first()
                    
                    if not beacon:
                        # Create new beacon if not exists
                        position = sim_beacon.get('position') or {}
                        lat = None
                        lon = None
                        floor = 0
                        
                        if isinstance(position, dict):
                            gps = position.get('gps') or []
                            
                            # Handle both list and dict formats for GPS
                            if isinstance(gps, list) and len(gps) >= 2:
                                lat, lon = gps[0], gps[1]
                            elif isinstance(gps, dict):
                                lat = gps.get('latitude') or gps.get('lat') or gps.get(0)
                                lon = gps.get('longitude') or gps.get('lon') or gps.get(1)
                            else:
                                # Try direct lat/lon in position
                                lat = position.get('latitude') or position.get('lat')
                                lon = position.get('longitude') or position.get('lon')
                            
                            # Try to get floor from position, or directly from sim_beacon
                            floor = position.get('floor') or sim_beacon.get('floor') or 0
                        else:
                            # If position is not a dict, try to get floor directly from sim_beacon
                            floor = sim_beacon.get('floor') or 0
                        
                        # Debug: log floor value
                        if floor != 0:
                            print(f"DEBUG: Beacon {beacon_id} floor from API: {floor} (type: {type(floor)})")
                        
                        # Use default coordinates if GPS not available (building center or default location)
                        if lat is None or lon is None:
                            # Default to Warsaw coordinates if not available
                            lat = lat or 52.2297
                            lon = lon or 21.0122
                            print(f"Warning: Beacon {beacon_id} has no GPS, using default coordinates ({lat}, {lon})")
                        
                        beacon = Beacon(
                            beacon_id=beacon_id,
                            name=sim_beacon.get('name') or f'Beacon {beacon_id}',
                            latitude=float(lat),
                            longitude=float(lon),
                            floor=int(floor)
                        )
                        db.add(beacon)
                        db.commit()
                        db.refresh(beacon)
                        self.beacon_map[beacon_id] = beacon.id
                        created_count += 1
                        print(f"Created new beacon {beacon_id} at ({lat}, {lon})")
                    
                    if beacon:
                        updated_count += 1
                        # Update position from simulator (ALWAYS update if available)
                        position = sim_beacon.get('position') or {}
                        lat = None
                        lon = None
                        
                        if isinstance(position, dict):
                            gps = position.get('gps') or []
                            
                            # Handle both list and dict formats for GPS
                            if isinstance(gps, list) and len(gps) >= 2:
                                lat, lon = gps[0], gps[1]
                            elif isinstance(gps, dict):
                                lat = gps.get('latitude') or gps.get('lat')
                                lon = gps.get('longitude') or gps.get('lon')
                            else:
                                # Try direct lat/lon in position
                                lat = position.get('latitude') or position.get('lat')
                                lon = position.get('longitude') or position.get('lon')
                            
                            # Always update position if GPS is available
                            if lat is not None and lon is not None:
                                old_lat = beacon.latitude
                                old_lon = beacon.longitude
                                beacon.latitude = float(lat)
                                beacon.longitude = float(lon)
                                # Log if position changed significantly
                                if abs(old_lat - float(lat)) > 0.0001 or abs(old_lon - float(lon)) > 0.0001:
                                    print(f"Updated beacon {beacon_id} position: ({old_lat}, {old_lon}) -> ({lat}, {lon})")
                            
                            # Update floor if provided (check both position and sim_beacon)
                            floor_val = position.get('floor') if isinstance(position, dict) else None
                            if floor_val is None:
                                floor_val = sim_beacon.get('floor')
                            if floor_val is not None:
                                try:
                                    new_floor = int(floor_val)
                                    if new_floor != beacon.floor:
                                        print(f"DEBUG: Updating beacon {beacon_id} floor from {beacon.floor} to {new_floor}")
                                    beacon.floor = new_floor
                                except (ValueError, TypeError):
                                    print(f"Warning: Could not convert floor value '{floor_val}' to int for beacon {beacon_id}")
                        
                        # Update beacon status from simulator
                        status = sim_beacon.get('status')
                        # Ensure status is a dict, not a string
                        if not isinstance(status, dict):
                            status = {}
                        # Also check direct fields in sim_beacon
                        battery_val = status.get('battery_percent') or sim_beacon.get('battery_percent') or beacon.battery_percent
                        beacon.battery_percent = self._convert_to_float(battery_val, beacon.battery_percent or 100.0)
                        
                        signal_val = status.get('signal_quality') or sim_beacon.get('signal_quality') or beacon.signal_quality
                        beacon.signal_quality = self._convert_signal_quality(signal_val)
                        
                        tags_val = status.get('tags_in_range') or sim_beacon.get('tags_in_range') or beacon.tags_in_range
                        beacon.tags_in_range = self._convert_to_int(tags_val, beacon.tags_in_range or 0)
                        
                        beacon.is_online = status.get('is_online') if isinstance(status, dict) and 'is_online' in status else (sim_beacon.get('is_online', True))
                        beacon.last_seen = datetime.utcnow()
                except Exception as e:
                    print(f"ERROR processing beacon {idx+1} (beacon_id: {beacon_id if 'beacon_id' in locals() else 'unknown'}): {e}")
                    import traceback
                    traceback.print_exc()
                    db.rollback()  # Rollback transaction to allow continuation
                    skipped_count += 1
                    continue
            
            db.commit()
            print(f"Beacon update summary: {created_count} created, {updated_count} updated, {skipped_count} skipped, {len(sim_beacons)} total in API response")
        except Exception as e:
            print(f"Error updating beacons: {e}")
            import traceback
            traceback.print_exc()
            db.rollback()  # Rollback transaction on error
            
    def _update_alerts(self, db: Session):
        """Update alerts from simulator API and generate local alerts"""
        try:
            # Get alerts from simulator
            response = requests.get(f'{SIMULATOR_API_BASE}/alerts', timeout=5)
            if response.status_code == 200:
                try:
                    sim_alerts = response.json()
                except ValueError:
                    print(f"Invalid JSON response from alerts API: {response.text[:100]}")
                    sim_alerts = []
                
                # Handle both list and dict responses
                if isinstance(sim_alerts, dict):
                    # Try common keys
                    sim_alerts = sim_alerts.get('alerts') or sim_alerts.get('data') or sim_alerts.get('items') or list(sim_alerts.values())[0] if sim_alerts else []
                
                # Check if we have a list now
                if not isinstance(sim_alerts, list):
                    print(f"Could not extract list from alerts API response: {type(sim_alerts)}")
                    sim_alerts = []
                
                for sim_alert in sim_alerts:
                    # Check if sim_alert is a dict
                    if not isinstance(sim_alert, dict):
                        continue
                    alert_type = sim_alert.get('alert_type') or sim_alert.get('type')
                    tag_id = sim_alert.get('tag_id') or sim_alert.get('firefighter_id')
                    
                    if not alert_type:
                        continue
                    
                    firefighter_id = None
                    if tag_id and tag_id in self.firefighter_map:
                        firefighter_id = self.firefighter_map[tag_id]
                    
                    # Check if alert already exists
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
            
            # Generate local alerts based on vitals
            self._generate_local_alerts(db)
            
            db.commit()
            
            # Clean up old alerts - keep only last 50
            self._cleanup_old_alerts(db)
        except Exception as e:
            print(f"Error updating alerts: {e}")
            
    def _generate_local_alerts(self, db: Session):
        """Generate alerts based on local vitals data"""
        from math import sqrt, cos
        
        for firefighter_id in self.firefighter_map.values():
            # Get latest vitals
            last_vitals = db.query(Vitals).filter(
                Vitals.firefighter_id == firefighter_id
            ).order_by(desc(Vitals.timestamp)).first()
            
            if not last_vitals:
                continue
            
            # Check for MAN-DOWN (30 seconds stationary)
            positions = db.query(Position).filter(
                Position.firefighter_id == firefighter_id
            ).order_by(desc(Position.timestamp)).limit(100).all()
            
            if len(positions) > 1:
                first_pos = positions[0]
                stationary_since = first_pos.timestamp
                
                for pos in positions[1:]:
                    lat_diff = abs(pos.latitude - first_pos.latitude) * 111000
                    lon_diff = abs(pos.longitude - first_pos.longitude) * 111000 * cos(first_pos.latitude * 3.14159 / 180)
                    distance = sqrt(lat_diff**2 + lon_diff**2)
                    
                    if distance > 5:
                        break
                    stationary_since = pos.timestamp
                
                time_stationary = (datetime.utcnow() - stationary_since).total_seconds()
                
                if time_stationary >= 30:
                    self._create_alert(db, firefighter_id, 'man_down')
            
            # Check for high heart rate
            if last_vitals.heart_rate and last_vitals.heart_rate > 180:
                self._create_alert(db, firefighter_id, 'high_heart_rate')
                
            # Check for low battery
            if last_vitals.battery_level and last_vitals.battery_level < 20:
                self._create_alert(db, firefighter_id, 'low_battery')
                
            # Check for low SCBA pressure
            if last_vitals.scba_pressure:
                if last_vitals.scba_pressure < 50:
                    self._create_alert(db, firefighter_id, 'scba_critical')
                elif last_vitals.scba_pressure < 100:
                    self._create_alert(db, firefighter_id, 'scba_low_pressure')
            
            # Check for high CO
            if last_vitals.co_level and last_vitals.co_level > 30:
                self._create_alert(db, firefighter_id, 'high_co')
                
            # Check for low oxygen
            if last_vitals.oxygen_level and last_vitals.oxygen_level < 90:
                self._create_alert(db, firefighter_id, 'low_oxygen')
                
            # Check for high temperature
            if last_vitals.temperature and last_vitals.temperature > 40:
                self._create_alert(db, firefighter_id, 'high_temperature')
        
        # Check for offline beacons
        beacons = db.query(Beacon).all()
        for beacon in beacons:
            if not beacon.is_online:
                self._create_alert(db, None, 'beacon_offline')
    
    def _cleanup_old_alerts(self, db: Session):
        """Remove old alerts, keeping only the last 50 most recent ones"""
        try:
            # Get total count of alerts
            total_alerts = db.query(Alert).count()
            
            if total_alerts > 50:
                # Get the 50 most recent alerts (by timestamp, descending)
                recent_alerts = db.query(Alert).order_by(desc(Alert.timestamp)).limit(50).all()
                recent_alert_ids = {alert.id for alert in recent_alerts}
                
                # Delete all alerts that are not in the recent 50
                deleted_count = db.query(Alert).filter(
                    ~Alert.id.in_(recent_alert_ids)
                ).delete(synchronize_session=False)
                
                db.commit()
                print(f"Cleaned up {deleted_count} old alerts, kept {len(recent_alerts)} most recent")
        except Exception as e:
            print(f"Error cleaning up old alerts: {e}")
            db.rollback()
                
    def _create_alert(self, db: Session, firefighter_id: int, alert_type: str):
        """Create an alert if it doesn't exist recently"""
        
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

