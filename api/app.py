import sys
import os

# Add parent directory to Python path to allow imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, jsonify, request, Response
from flask_cors import CORS
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime, timedelta
from math import sqrt, cos
import json
from backend.database import get_db, init_db, SessionLocal
from backend.models import Firefighter, Position, Vitals, Alert, Beacon
from backend.data_retriever import DataRetriever

app = Flask(__name__)
CORS(app)

# Initialize database
init_db()

# Start data retriever (fetches data from simulator API)
retriever = DataRetriever()
retriever.start()


@app.route('/api/firefighters', methods=['GET'])
def get_firefighters():
    """Get all firefighters with latest position and vitals"""
    db = SessionLocal()
    try:
        firefighters = db.query(Firefighter).all()
        result = []
        
        for ff in firefighters:
            # Get latest position
            latest_pos = db.query(Position).filter(
                Position.firefighter_id == ff.id
            ).order_by(desc(Position.timestamp)).first()
            
            # Get latest vitals
            latest_vitals = db.query(Vitals).filter(
                Vitals.firefighter_id == ff.id
            ).order_by(desc(Vitals.timestamp)).first()
            
            ff_data = {
                'id': ff.id,
                'name': ff.name,
                'badge_number': ff.badge_number,
                'team': getattr(ff, 'team', None) or '',
                'on_mission': getattr(ff, 'on_mission', False),
            }
            
            if latest_pos:
                ff_data['position'] = {
                    'latitude': latest_pos.latitude,
                    'longitude': latest_pos.longitude,
                    'floor': latest_pos.floor,
                    'timestamp': latest_pos.timestamp.isoformat()
                }
            else:
                ff_data['position'] = None
                
            if latest_vitals:
                ff_data['vitals'] = {
                    'heart_rate': latest_vitals.heart_rate,
                    'temperature': latest_vitals.temperature,
                    'oxygen_level': latest_vitals.oxygen_level,
                    'co_level': latest_vitals.co_level,
                    'battery_level': latest_vitals.battery_level,
                    'scba_pressure': latest_vitals.scba_pressure,
                    'timestamp': latest_vitals.timestamp.isoformat()
                }
            else:
                ff_data['vitals'] = None
                
            result.append(ff_data)
            
        return jsonify(result)
    finally:
        db.close()


@app.route('/api/firefighters/<int:firefighter_id>/positions', methods=['GET'])
def get_firefighter_positions(firefighter_id):
    """Get position history for a firefighter"""
    db = SessionLocal()
    try:
        limit = request.args.get('limit', 100, type=int)
        
        positions = db.query(Position).filter(
            Position.firefighter_id == firefighter_id
        ).order_by(desc(Position.timestamp)).limit(limit).all()
        
        result = [{
            'latitude': pos.latitude,
            'longitude': pos.longitude,
            'floor': pos.floor,
            'timestamp': pos.timestamp.isoformat()
        } for pos in reversed(positions)]  # Reverse to get chronological order
        
        return jsonify(result)
    finally:
        db.close()


@app.route('/api/firefighters/<int:firefighter_id>/vitals', methods=['GET'])
def get_firefighter_vitals(firefighter_id):
    """Get vitals history for a firefighter"""
    db = SessionLocal()
    try:
        limit = request.args.get('limit', 100, type=int)
        
        vitals = db.query(Vitals).filter(
            Vitals.firefighter_id == firefighter_id
        ).order_by(desc(Vitals.timestamp)).limit(limit).all()
        
        result = [{
            'heart_rate': v.heart_rate,
            'temperature': v.temperature,
            'oxygen_level': v.oxygen_level,
            'co_level': v.co_level,
            'battery_level': v.battery_level,
            'scba_pressure': v.scba_pressure,
            'timestamp': v.timestamp.isoformat()
        } for v in reversed(vitals)]  # Reverse to get chronological order
        
        return jsonify(result)
    finally:
        db.close()


@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    """Get all unacknowledged alerts"""
    db = SessionLocal()
    try:
        alerts = db.query(Alert).filter(
            Alert.acknowledged == False
        ).order_by(desc(Alert.timestamp)).all()
        
        result = [{
            'id': alert.id,
            'firefighter_id': alert.firefighter_id,
            'alert_type': alert.alert_type,
            'severity': alert.severity,
            'message': alert.message,
            'timestamp': alert.timestamp.isoformat()
        } for alert in alerts]
        
        return jsonify(result)
    finally:
        db.close()


@app.route('/api/beacons', methods=['GET'])
def get_beacons():
    """Get all beacons"""
    db = SessionLocal()
    try:
        floor = request.args.get('floor', type=int)
        
        query = db.query(Beacon)
        if floor is not None:
            query = query.filter(Beacon.floor == floor)
            
        beacons = query.all()
        
        result = [{
            'id': beacon.id,
            'beacon_id': beacon.beacon_id,
            'name': beacon.name,
            'latitude': beacon.latitude,
            'longitude': beacon.longitude,
            'floor': beacon.floor,
            'battery_percent': beacon.battery_percent,
            'signal_quality': beacon.signal_quality,
            'tags_in_range': beacon.tags_in_range,
            'last_seen': beacon.last_seen.isoformat(),
            'is_online': beacon.is_online,
            'status': 'active' if beacon.is_online else 'inactive'
        } for beacon in beacons]
        
        return jsonify(result)
    finally:
        db.close()


@app.route('/api/building', methods=['GET'])
def get_building():
    """Get building information from simulator API"""
    import requests
    
    try:
        # Get building from simulator API
        response = requests.get('https://niesmiertelnik.replit.app/api/v1/building', timeout=5)
        if response.status_code == 200:
            sim_building = response.json()
            
            # Extract floors
            floors_data = sim_building.get('floors', [])
            floors = []
            for floor in floors_data:
                # Use the actual index from API (can be negative for basement)
                floor_index = floor.get('index')
                if floor_index is None:
                    # Fallback: try to get from 'number' field
                    floor_index = floor.get('number')
                if floor_index is None:
                    # Last resort: use position in array (but this is wrong for basement)
                    floor_index = len(floors)
                floors.append({
                    'index': floor_index,
                    'name': floor.get('name', f'Floor {floor_index}')
                })
            
            # Extract GPS reference/center
            gps_ref = sim_building.get('gps_reference', {})
            origin = gps_ref.get('origin', {})
            
            center = {
                'latitude': origin.get('lat', 52.2297),
                'longitude': origin.get('lon', 21.0122)
            }
            
            return jsonify({
                'name': sim_building.get('name', 'Locero Building'),
                'floors': floors if floors else [
                    {'index': 0, 'name': 'Ground Floor'},
                    {'index': 1, 'name': 'First Floor'},
                    {'index': 2, 'name': 'Second Floor'}
                ],
                'center': center
            })
    except Exception as e:
        print(f"Error fetching building from simulator: {e}")
        # Return default building on error
        return jsonify({
            'name': 'Locero Building',
            'floors': [
                {'index': 0, 'name': 'Ground Floor'},
                {'index': 1, 'name': 'First Floor'},
                {'index': 2, 'name': 'Second Floor'}
            ],
            'center': {
                'latitude': 52.2297,
                'longitude': 21.0122
            }
        })


@app.route('/api/firefighters/<int:firefighter_id>/beacon', methods=['GET'])
def get_firefighter_beacon(firefighter_id):
    """Get the last beacon that detected this firefighter"""
    db = SessionLocal()
    try:
        # Get latest position
        latest_pos = db.query(Position).filter(
            Position.firefighter_id == firefighter_id
        ).order_by(desc(Position.timestamp)).first()
        
        if not latest_pos:
            return jsonify({'beacon': None, 'time_stationary': 0})
        
        # Calculate which beacon is closest (within range)
        beacons = db.query(Beacon).filter(Beacon.floor == latest_pos.floor).all()
        closest_beacon = None
        min_distance = float('inf')
        BEACON_RANGE = 50  # meters
        
        for beacon in beacons:
            # Calculate distance using simplified formula for small distances
            lat_diff = (beacon.latitude - latest_pos.latitude) * 111000  # meters
            lon_diff = (beacon.longitude - latest_pos.longitude) * 111000 * cos(beacon.latitude * 3.14159 / 180)
            distance = sqrt(lat_diff**2 + lon_diff**2)
            
            if distance < BEACON_RANGE and distance < min_distance:
                min_distance = distance
                closest_beacon = beacon
        
        # Get latest vitals
        latest_vitals = db.query(Vitals).filter(
            Vitals.firefighter_id == firefighter_id
        ).order_by(desc(Vitals.timestamp)).first()
        
        # Calculate time stationary
        positions = db.query(Position).filter(
            Position.firefighter_id == firefighter_id
        ).order_by(desc(Position.timestamp)).limit(100).all()
        
        time_stationary = 0  # seconds
        if len(positions) > 1:
            # Check if position hasn't changed significantly
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
        
        # Determine movement status
        movement_status = 'ruch' if time_stationary < 30 else 'bezruch'
        
        # Calculate time since last contact (most recent of position or vitals)
        last_contact_time = None
        if latest_pos:
            last_contact_time = latest_pos.timestamp
        if latest_vitals and latest_vitals.timestamp:
            if not last_contact_time or latest_vitals.timestamp > last_contact_time:
                last_contact_time = latest_vitals.timestamp
        
        time_since_contact = None
        if last_contact_time:
            time_since_contact = (datetime.utcnow() - last_contact_time).total_seconds()
        
        result = {
            'beacon': {
                'id': closest_beacon.id,
                'beacon_id': closest_beacon.beacon_id,
                'name': closest_beacon.name,
                'distance': round(min_distance, 2) if closest_beacon else None
            } if closest_beacon else None,
            'time_stationary': round(time_stationary, 1),  # in seconds
            'movement_status': movement_status,
            'vitals': {
                'heart_rate': latest_vitals.heart_rate if latest_vitals else None,
                'battery_level': latest_vitals.battery_level if latest_vitals else None
            } if latest_vitals else None,
            'last_position': {
                'latitude': latest_pos.latitude,
                'longitude': latest_pos.longitude,
                'floor': latest_pos.floor,
                'timestamp': latest_pos.timestamp.isoformat()
            } if latest_pos else None,
            'last_contact': {
                'timestamp': last_contact_time.isoformat() if last_contact_time else None,
                'seconds_ago': round(time_since_contact, 1) if time_since_contact is not None else None
            }
        }
        
        return jsonify(result)
    finally:
        db.close()


@app.route('/api/beacons/<int:beacon_id>', methods=['GET'])
def get_beacon(beacon_id):
    """Get beacon details"""
    db = SessionLocal()
    try:
        beacon = db.query(Beacon).filter(Beacon.id == beacon_id).first()
        if not beacon:
            return jsonify({'error': 'Beacon not found'}), 404
        
        return jsonify({
            'id': beacon.id,
            'beacon_id': beacon.beacon_id,
            'name': beacon.name,
            'latitude': beacon.latitude,
            'longitude': beacon.longitude,
            'floor': beacon.floor,
            'battery_percent': beacon.battery_percent,
            'signal_quality': beacon.signal_quality,
            'tags_in_range': beacon.tags_in_range,
            'last_seen': beacon.last_seen.isoformat(),
            'is_online': beacon.is_online
        })
    finally:
        db.close()


@app.route('/api/beacons/<int:beacon_id>/firefighters', methods=['GET'])
def get_beacon_firefighters(beacon_id):
    """Get all firefighters currently in range of this beacon"""
    db = SessionLocal()
    try:
        beacon = db.query(Beacon).filter(Beacon.id == beacon_id).first()
        if not beacon:
            return jsonify([])
        
        # Get all firefighters on the same floor
        latest_positions = {}
        firefighters = db.query(Firefighter).all()
        
        BEACON_RANGE = 50  # meters
        
        for ff in firefighters:
            latest_pos = db.query(Position).filter(
                Position.firefighter_id == ff.id
            ).order_by(desc(Position.timestamp)).first()
            
            if latest_pos and latest_pos.floor == beacon.floor:
                # Calculate distance
                lat_diff = (beacon.latitude - latest_pos.latitude) * 111000
                lon_diff = (beacon.longitude - latest_pos.longitude) * 111000 * cos(beacon.latitude * 3.14159 / 180)
                distance = sqrt(lat_diff**2 + lon_diff**2)
                
                if distance < BEACON_RANGE:
                    latest_vitals = db.query(Vitals).filter(
                        Vitals.firefighter_id == ff.id
                    ).order_by(desc(Vitals.timestamp)).first()
                    
                    latest_positions[ff.id] = {
                        'firefighter': {
                            'id': ff.id,
                            'name': ff.name,
                            'badge_number': ff.badge_number
                        },
                        'position': {
                            'latitude': latest_pos.latitude,
                            'longitude': latest_pos.longitude,
                            'floor': latest_pos.floor,
                            'timestamp': latest_pos.timestamp.isoformat()
                        },
                        'vitals': {
                            'heart_rate': latest_vitals.heart_rate if latest_vitals else None,
                            'battery_level': latest_vitals.battery_level if latest_vitals else None
                        } if latest_vitals else None,
                        'distance': round(distance, 2)
                    }
        
        return jsonify(list(latest_positions.values()))
    finally:
        db.close()


@app.route('/api/firefighters/all', methods=['GET'])
def get_all_firefighters():
    """Get all firefighters with mission status"""
    db = SessionLocal()
    try:
        firefighters = db.query(Firefighter).all()
        result = []
        
        for ff in firefighters:
            latest_pos = db.query(Position).filter(
                Position.firefighter_id == ff.id
            ).order_by(desc(Position.timestamp)).first()
            
            latest_vitals = db.query(Vitals).filter(
                Vitals.firefighter_id == ff.id
            ).order_by(desc(Vitals.timestamp)).first()
            
            # Calculate time stationary
            positions = db.query(Position).filter(
                Position.firefighter_id == ff.id
            ).order_by(desc(Position.timestamp)).limit(100).all()
            
            time_stationary = 0
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
                
                time_stationary = (datetime.utcnow() - stationary_since).total_seconds() / 60
            
            result.append({
                'id': ff.id,
                'name': ff.name,
                'badge_number': ff.badge_number,
                'team': getattr(ff, 'team', None) or '',
                'on_mission': getattr(ff, 'on_mission', False),
                'position': {
                    'latitude': latest_pos.latitude,
                    'longitude': latest_pos.longitude,
                    'floor': latest_pos.floor,
                    'timestamp': latest_pos.timestamp.isoformat()
                } if latest_pos else None,
                'vitals': {
                    'heart_rate': latest_vitals.heart_rate,
                    'battery_level': latest_vitals.battery_level
                } if latest_vitals else None,
                'time_stationary': round(time_stationary, 1)
            })
        
        return jsonify(result)
    finally:
        db.close()


@app.route('/api/alerts/all', methods=['GET'])
def get_all_alerts():
    """Get all alerts (including acknowledged) with filtering"""
    db = SessionLocal()
    try:
        severity_filter = request.args.get('severity')
        acknowledged_filter = request.args.get('acknowledged', 'false')
        
        query = db.query(Alert)
        
        if severity_filter:
            query = query.filter(Alert.severity == severity_filter)
        
        if acknowledged_filter.lower() == 'false':
            query = query.filter(Alert.acknowledged == False)
        
        alerts = query.order_by(desc(Alert.timestamp)).all()
        
        result = [{
            'id': alert.id,
            'firefighter_id': alert.firefighter_id,
            'alert_type': alert.alert_type,
            'severity': alert.severity,
            'message': alert.message,
            'timestamp': alert.timestamp.isoformat(),
            'acknowledged': alert.acknowledged
        } for alert in alerts]
        
        return jsonify(result)
    finally:
        db.close()


@app.route('/api/export/blackbox', methods=['GET'])
def export_blackbox():
    """Export all database data as JSON (black box data)"""
    db = SessionLocal()
    try:
        export_timestamp = datetime.utcnow().isoformat()
        
        # Get all firefighters
        firefighters = db.query(Firefighter).all()
        firefighters_data = []
        for ff in firefighters:
            # Get all positions for this firefighter
            positions = db.query(Position).filter(
                Position.firefighter_id == ff.id
            ).order_by(desc(Position.timestamp)).all()
            
            # Get all vitals for this firefighter
            vitals = db.query(Vitals).filter(
                Vitals.firefighter_id == ff.id
            ).order_by(desc(Vitals.timestamp)).all()
            
            # Get all alerts for this firefighter
            alerts = db.query(Alert).filter(
                Alert.firefighter_id == ff.id
            ).order_by(desc(Alert.timestamp)).all()
            
            firefighters_data.append({
                'id': ff.id,
                'name': ff.name,
                'badge_number': ff.badge_number,
                'team': getattr(ff, 'team', None),
                'on_mission': getattr(ff, 'on_mission', False),
                'created_at': ff.created_at.isoformat() if ff.created_at else None,
                'positions': [{
                    'id': pos.id,
                    'latitude': pos.latitude,
                    'longitude': pos.longitude,
                    'floor': pos.floor,
                    'timestamp': pos.timestamp.isoformat()
                } for pos in positions],
                'vitals': [{
                    'id': vit.id,
                    'heart_rate': vit.heart_rate,
                    'temperature': vit.temperature,
                    'oxygen_level': vit.oxygen_level,
                    'co_level': vit.co_level,
                    'battery_level': vit.battery_level,
                    'scba_pressure': vit.scba_pressure,
                    'timestamp': vit.timestamp.isoformat()
                } for vit in vitals],
                'alerts': [{
                    'id': alert.id,
                    'alert_type': alert.alert_type,
                    'severity': alert.severity,
                    'message': alert.message,
                    'timestamp': alert.timestamp.isoformat(),
                    'acknowledged': alert.acknowledged
                } for alert in alerts]
            })
        
        # Get all beacons
        beacons = db.query(Beacon).all()
        beacons_data = [{
            'id': beacon.id,
            'beacon_id': beacon.beacon_id,
            'name': beacon.name,
            'latitude': beacon.latitude,
            'longitude': beacon.longitude,
            'floor': beacon.floor,
            'battery_percent': beacon.battery_percent,
            'signal_quality': beacon.signal_quality,
            'tags_in_range': beacon.tags_in_range,
            'last_seen': beacon.last_seen.isoformat() if beacon.last_seen else None,
            'is_online': beacon.is_online
        } for beacon in beacons]
        
        # Get all system alerts (alerts without firefighter_id)
        system_alerts = db.query(Alert).filter(
            Alert.firefighter_id == None
        ).order_by(desc(Alert.timestamp)).all()
        
        blackbox_data = {
            'export_timestamp': export_timestamp,
            'export_type': 'blackbox',
            'version': '1.0',
            'data': {
                'firefighters': firefighters_data,
                'beacons': beacons_data,
                'system_alerts': [{
                    'id': alert.id,
                    'alert_type': alert.alert_type,
                    'severity': alert.severity,
                    'message': alert.message,
                    'timestamp': alert.timestamp.isoformat(),
                    'acknowledged': alert.acknowledged
                } for alert in system_alerts]
            },
            'statistics': {
                'total_firefighters': len(firefighters_data),
                'total_beacons': len(beacons_data),
                'total_positions': sum(len(ff['positions']) for ff in firefighters_data),
                'total_vitals': sum(len(ff['vitals']) for ff in firefighters_data),
                'total_alerts': sum(len(ff['alerts']) for ff in firefighters_data) + len(system_alerts)
            }
        }
        
        # Return as JSON with proper headers for download
        json_str = json.dumps(blackbox_data, indent=2, ensure_ascii=False)
        filename = f'blackbox_export_{export_timestamp.replace(":", "-").split(".")[0]}.json'
        
        response = Response(
            json_str,
            mimetype='application/json',
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"'
            }
        )
        return response
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


if __name__ == '__main__':
    app.run(debug=True, port=5000)

