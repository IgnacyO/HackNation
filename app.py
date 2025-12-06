import requests
import json
import random
import time
from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
from typing import Dict, List, Tuple, Optional


app = Flask(__name__)
# Enable CORS for all routes with more permissive settings
CORS(app, resources={
    r"/api/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

MAPS_URL = "https://staticmap.openstreetmap.de/staticmap.php?center={lon},{lat}&zoom=19&size=800x600&markers={lon},{lat},red"
API_BASE_URL = "https://niesmiertelnik.replit.app/api/v1/"


def get_map_url(lon: float, lat: float) -> str:
    """Generate static map URL for given coordinates."""
    url = MAPS_URL.format(lon=str(lon), lat=str(lat))
    return url


def get_building_info() -> Tuple[Dict, Dict[str, float], List[Dict], List[Dict], List[Dict]]:
    """Fetch complete building information from API."""
    try:
        res = requests.get(API_BASE_URL + "building", timeout=10)
        res.raise_for_status()
        data = res.json()
        
        # Get building info
        building_info = {
            "id": data.get("id", ""),
            "name": data.get("name", ""),
            "address": data.get("address", ""),
            "type": data.get("type", ""),
            "dimensions": data.get("dimensions", {})
        }
        
        # Get floors
        floors = data.get("floors", [])
        
        # Get entry points
        entry_points = data.get("entry_points", [])
        
        # Get hazard zones
        hazard_zones = data.get("hazard_zones", [])
        
        # Get GPS reference
        gps_ref = data.get("gps_reference", {})
        origin = gps_ref.get("origin", {})
        
        cords = {
            "lat": origin.get("lat", 52.2297),
            "lon": origin.get("lon", 21.0122),
            "altitude_m": origin.get("altitude_m", 110),
            "rotation_deg": gps_ref.get("rotation_deg", 0),
            "scale_lat_m_per_deg": gps_ref.get("scale_lat_m_per_deg", 111320),
            "scale_lon_m_per_deg": gps_ref.get("scale_lon_m_per_deg", 71695)
        }
        
        return building_info, cords, floors, entry_points, hazard_zones
    except requests.RequestException as e:
        print(f"Error fetching building info: {e}")
        # Return default values on error
        default_building = {
            "id": "",
            "name": "Brak danych",
            "address": "",
            "type": "",
            "dimensions": {}
        }
        return default_building, {"lat": 52.2297, "lon": 21.0122, "altitude_m": 110, "rotation_deg": 0, "scale_lat_m_per_deg": 111320, "scale_lon_m_per_deg": 71695}, [], [], []


def convert_local_to_gps(x: float, y: float, cords: Dict, floor_height: float = 0) -> List[float]:
    """Convert local coordinates (x, y in meters) to GPS coordinates."""
    lat = cords["lat"] + (y / cords["scale_lat_m_per_deg"])
    lon = cords["lon"] + (x / cords["scale_lon_m_per_deg"])
    return [lat, lon]


def get_floor_data(floors: List[Dict], entry_points: List[Dict], hazard_zones: List[Dict], cords: Dict) -> Dict:
    """Organize floor data with entry points and hazard zones."""
    floor_data = {}
    
    for i, floor in enumerate(floors):
        floor_num = floor.get("number", i)
        
        # Get entry points for this floor
        floor_entry_points = [
            {
                **ep,
                "gps": convert_local_to_gps(
                    ep["position"]["x"],
                    ep["position"]["y"],
                    cords,
                    floor.get("height_m", 0)
                )
            }
            for ep in entry_points if ep.get("floor") == floor_num
        ]
        
        # Get hazard zones for this floor
        floor_hazard_zones = [
            {
                **hz,
                "bounds_gps": {
                    "nw": convert_local_to_gps(hz["bounds"]["x1"], hz["bounds"]["y1"], cords),
                    "se": convert_local_to_gps(hz["bounds"]["x2"], hz["bounds"]["y2"], cords)
                }
            }
            for hz in hazard_zones if hz.get("floor") == floor_num
        ]
        
        floor_data[i] = {
            "floor_info": floor,
            "entry_points": floor_entry_points,
            "hazard_zones": floor_hazard_zones
        }
    
    return floor_data


# Example coordinate sets for each story (x,y in pixels on the image)
STORIES = {
    1: [(120, 200), (220, 260), (310, 180)],
    2: [(140, 210), (230, 270), (330, 190)],
    3: [(150, 220), (240, 280), (350, 200)],
}


@app.route("/")
def index():
    """Main page displaying building floors, map and firefighters list."""
    building_info, cords, floors, entry_points, hazard_zones = get_building_info()
    floor_data = get_floor_data(floors, entry_points, hazard_zones, cords)
    
    # Try to get firefighters list
    firefighters = []
    try:
        res = requests.get(API_BASE_URL + "firefighters", timeout=5)
        if res.status_code == 200:
            data = res.json()
            # Handle different response formats
            if isinstance(data, list):
                firefighters = data
            elif isinstance(data, dict):
                firefighters = data.get("firefighters", data.get("data", []))
    except Exception as e:
        print(f"Error fetching firefighters: {e}")
    
    # If no firefighters from API, add example ones for testing
    if not firefighters or len(firefighters) == 0:
        firefighters = [
            {"id": "FF-001", "name": "Jan Kowalski", "rank": "st. kpt."},
            {"id": "FF-002", "name": "Piotr Nowak", "rank": "kpt."},
        ]

    # Ensure building_dimensions has default values
    building_dims = building_info.get("dimensions", {})
    if not building_dims:
        building_dims = {"width_m": 40, "depth_m": 25, "height_m": 12}
    
    return render_template(
        "index.html",
        building_info=building_info,
        lat=cords["lat"],
        lon=cords["lon"],
        floors=floors,
        floor_data_json=json.dumps(floor_data),
        cords_json=json.dumps(cords),
        firefighters=firefighters,
        api_base_url=API_BASE_URL,
        building_dimensions=building_dims
    )


@app.route("/story/<int:story_id>")
def get_story(story_id: int):
    """Get story points for a given story ID."""
    points = STORIES.get(story_id, [])
    return jsonify({"story": story_id, "points": points})


@app.route("/api/building")
def api_building():
    """Proxy endpoint to fetch building data from original API."""
    try:
        res = requests.get(API_BASE_URL + "building", timeout=10)
        res.raise_for_status()
        try:
            return jsonify(res.json())
        except (ValueError, json.JSONDecodeError) as e:
            print(f"Error parsing building response as JSON: {e}")
            return jsonify({"error": "Invalid JSON response"}), 500
    except requests.exceptions.Timeout:
        return jsonify({"error": "Request timeout"}), 500
    except requests.exceptions.ConnectionError:
        return jsonify({"error": "Connection error"}), 500
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        print(f"Unexpected error in api_building: {type(e).__name__}: {e}")
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/alerts")
def api_alerts():
    """Proxy endpoint to fetch alerts from original API."""
    try:
        active = request.args.get('active', 'true')
        print(f"Fetching alerts from API with active={active}")
        res = requests.get(API_BASE_URL + f"alerts?active={active}", timeout=10)
        print(f"Alerts API response status: {res.status_code}")
        if res.status_code == 200:
            try:
                data = res.json()
                print(f"Alerts API returned data type: {type(data)}")
                # Handle different response formats
                if isinstance(data, list):
                    print(f"Returning {len(data)} alerts as list")
                    return jsonify(data)
                elif isinstance(data, dict):
                    alerts = data.get("alerts", data.get("data", []))
                    if isinstance(alerts, list):
                        print(f"Returning {len(alerts)} alerts from dict")
                        return jsonify(alerts)
                print("No valid alerts found in response")
                return jsonify([])
            except (ValueError, json.JSONDecodeError) as e:
                print(f"Error parsing alerts response as JSON: {e}")
                print(f"Response text (first 500 chars): {res.text[:500]}")
                return jsonify([])
        else:
            print(f"Alerts API returned non-200 status: {res.status_code}")
            return jsonify([])
    except requests.exceptions.Timeout:
        print("Timeout fetching alerts from API")
    except requests.exceptions.ConnectionError as e:
        print(f"Connection error fetching alerts from API: {e}")
    except Exception as e:
        print(f"Error fetching alerts: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
    
    # Return example alerts for testing if API fails
    print("Returning example alerts as fallback")
    return jsonify([
        {
            "id": "ALERT-001",
            "type": "high_heart_rate",
            "severity": "warning",
            "message": "Wysokie tętno wykryte (>180 bpm)",
            "firefighter_id": "FF-001",
            "timestamp": int(time.time() * 1000)
        },
        {
            "id": "ALERT-002",
            "type": "man_down",
            "severity": "critical",
            "message": "Wykryto bezruch strażaka",
            "firefighter_id": "FF-002",
            "timestamp": int(time.time() * 1000) - 5000
        }
    ])


def generate_random_firefighters(building_info, cords):
    """Generate random firefighters for testing."""
    if not building_info or not cords:
        return []
    
    # Get building dimensions
    dimensions = building_info.get("dimensions", {})
    width_m = dimensions.get("width_m", 40)
    depth_m = dimensions.get("depth_m", 25)
    
    # Generate random positions within building bounds
    names = [
        {"name": "Jan Kowalski", "rank": "st. kpt."},
        {"name": "Piotr Nowak", "rank": "kpt."},
        {"name": "Anna Wiśniewska", "rank": "st. ogn."},
        {"name": "Tomasz Zieliński", "rank": "mł. ogn."},
        {"name": "Marek Kamiński", "rank": "sekc."},
        {"name": "Katarzyna Dąbrowska", "rank": "asp."},
    ]
    
    firefighters = []
    scale_lat = cords.get("scale_lat_m_per_deg", 111320)
    scale_lon = cords.get("scale_lon_m_per_deg", 71695)
    origin_lat = cords.get("lat", 52.2297)
    origin_lon = cords.get("lon", 21.0122)
    
    for i, name_data in enumerate(names):  # Generate all 6 firefighters
        # Random position within building (corner-based coordinates: 0,0 = SW corner)
        # Leave some margin from edges (5m)
        x = random.uniform(5, width_m - 5)
        y = random.uniform(5, depth_m - 5)
        
        # Convert to GPS (corner-based: origin is at SW corner)
        lat = origin_lat + (y / scale_lat)
        lon = origin_lon + (x / scale_lon)
        
        firefighter = {
            "id": f"FF-{str(i+1).zfill(3)}",
            "name": name_data["name"],
            "rank": name_data["rank"],
            "position": {
                "gps": [round(lat, 6), round(lon, 6)],
                "x": round(x, 2),
                "y": round(y, 2),
                "z": 0,
                "floor": 0
            },
            "telemetry": {
                "heart_rate": random.randint(70, 120),
                "battery": random.randint(60, 100),
                "is_moving": random.choice([True, False])
            }
        }
        firefighters.append(firefighter)
    
    return firefighters


@app.route("/api/firefighters", methods=['GET', 'OPTIONS'])
def api_firefighters():
    """Get list of all firefighters - proxy to external API."""
    # Handle CORS preflight
    if request.method == 'OPTIONS':
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,OPTIONS')
        return response
    
    try:
        # Try to get building info for fallback
        try:
            building_info, cords_dict, _, _, _ = get_building_info()
        except Exception as e:
            print(f"Error getting building info: {e}")
            building_info = None
            cords_dict = None
        
        # Try to fetch from external API
        try:
            print("Fetching firefighters from API...")
            res = requests.get(API_BASE_URL + "firefighters", timeout=10)
            print(f"Firefighters API response status: {res.status_code}, content-length: {len(res.content) if res.content else 0}")
            print(f"Firefighters API response headers: {dict(res.headers)}")
            if res.status_code == 200:
                try:
                    data = res.json()
                    # Handle different response formats
                    firefighters = []
                    if isinstance(data, list):
                        firefighters = data
                    elif isinstance(data, dict):
                        firefighters = data.get("firefighters", data.get("data", []))
                    
                    # Filter and transform firefighters data
                    # API returns structure: {"firefighters": [{"firefighter": {...}, "position": {...}, ...}]}
                    valid_firefighters = []
                    for ff_item in firefighters:
                        if not isinstance(ff_item, dict):
                            continue
                        
                        # Extract firefighter info from nested structure
                        firefighter_obj = ff_item.get("firefighter", {})
                        if not firefighter_obj or not isinstance(firefighter_obj, dict):
                            continue
                        
                        firefighter_id = firefighter_obj.get("id")
                        firefighter_name = firefighter_obj.get("name") or firefighter_obj.get("full_name")
                        
                        if firefighter_id and firefighter_name:
                            # Extract telemetry data from vitals and device
                            vitals = ff_item.get("vitals", {})
                            device = ff_item.get("device", {})
                            position = ff_item.get("position", {})
                            
                            # Build telemetry object with proper field names
                            telemetry = {
                                "heart_rate": vitals.get("heart_rate_bpm"),
                                "battery": device.get("battery_percent"),
                                "is_moving": vitals.get("motion_state") not in ["motionless", "stationary"] if vitals.get("motion_state") else None,
                                "motion_state": vitals.get("motion_state"),
                                "co2": vitals.get("co2") or ff_item.get("environment", {}).get("co2_ppm")
                            }
                            
                            # Transform to expected format
                            transformed_ff = {
                                "id": firefighter_id,
                                "name": firefighter_name,
                                "rank": firefighter_obj.get("rank", ""),
                                "role": firefighter_obj.get("role", ""),
                                "position": position,
                                "telemetry": telemetry,
                                "tag_id": ff_item.get("tag_id", firefighter_id),
                                "vitals": vitals,
                                "device": device
                            }
                            # Add all other fields from original response
                            for key, value in ff_item.items():
                                if key not in ["firefighter"]:
                                    transformed_ff[key] = value
                            
                            valid_firefighters.append(transformed_ff)
                    
                    # If we have valid firefighters from API, return them
                    if len(valid_firefighters) > 0:
                        print(f"Returning {len(valid_firefighters)} valid firefighters from API")
                        response = jsonify(valid_firefighters)
                        response.headers.add('Access-Control-Allow-Origin', '*')
                        response.headers.add('Content-Type', 'application/json')
                        return response
                    else:
                        print(f"API returned {len(firefighters)} firefighters but none are valid (missing name/id)")
                        # Continue to fallback
                except (ValueError, json.JSONDecodeError) as e:
                    print(f"Error parsing API response as JSON: {e}")
        except requests.exceptions.Timeout:
            print("Timeout fetching firefighters from API")
        except requests.exceptions.ConnectionError as e:
            print(f"Connection error fetching firefighters from API: {e}")
        except Exception as e:
            print(f"Error fetching firefighters: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
        
        # Always return random firefighters as fallback
        if building_info and cords_dict:
            try:
                random_firefighters = generate_random_firefighters(building_info, cords_dict)
                if random_firefighters and len(random_firefighters) > 0:
                    print(f"Returning {len(random_firefighters)} random firefighters as fallback")
                    response = jsonify(random_firefighters)
                    response.headers.add('Access-Control-Allow-Origin', '*')
                    response.headers.add('Content-Type', 'application/json')
                    return response
            except Exception as e:
                print(f"Error generating random firefighters: {e}")
                import traceback
                traceback.print_exc()
    except Exception as e:
        print(f"Unexpected error in api_firefighters: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
    
    # Last resort - return empty list (always valid JSON)
    print("Returning empty firefighters list as last resort")
    response = jsonify([])
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Content-Type', 'application/json')
    return response


@app.route("/api/firefighters/<firefighter_id>")
def api_firefighter(firefighter_id: str):
    """Get detailed data for a specific firefighter."""
    try:
        res = requests.get(API_BASE_URL + f"firefighters/{firefighter_id}", timeout=10)
        if res.status_code == 200:
            return jsonify(res.json())
        return jsonify({"error": "Not found"}), 404
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/firefighters/<firefighter_id>/history")
def api_firefighter_history(firefighter_id: str):
    """Get position history for a firefighter."""
    try:
        res = requests.get(API_BASE_URL + f"firefighters/{firefighter_id}/history", timeout=10)
        if res.status_code == 200:
            return jsonify(res.json())
        return jsonify([])
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 500


@app.route("/firefighter/<firefighter_id>")
def firefighter_detail(firefighter_id: str):
    """Page displaying detailed firefighter information."""
    building_info, cords, floors, entry_points, hazard_zones = get_building_info()
    
    return render_template(
        "firefighter.html",
        firefighter_id=firefighter_id,
        building_info=building_info,
        lat=cords["lat"],
        lon=cords["lon"],
        floors=floors,
        floor_data_json=json.dumps(get_floor_data(floors, entry_points, hazard_zones, cords)),
        cords_json=json.dumps(cords),
        api_base_url=API_BASE_URL
    )


@app.route("/api/beacons")
def api_beacons():
    """Get list of all beacons."""
    try:
        res = requests.get(API_BASE_URL + "beacons", timeout=10)
        res.raise_for_status()
        return jsonify(res.json())
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 500


@app.route("/beacons")
def beacons_view():
    """Page displaying beacons (placeholder for future implementation)."""
    building_info, cords, floors, entry_points, hazard_zones = get_building_info()
    
    return render_template(
        "beacons.html",
        building_info=building_info,
        lat=cords["lat"],
        lon=cords["lon"],
        floors=floors,
        floor_data_json=json.dumps(get_floor_data(floors, entry_points, hazard_zones, cords)),
        cords_json=json.dumps(cords),
        api_base_url=API_BASE_URL
    )


if __name__ == "__main__":
    print("=" * 50)
    print("Starting Flask server...")
    print("Server will be available at: http://127.0.0.1:5000")
    print("API endpoints:")
    print("  - http://127.0.0.1:5000/api/firefighters")
    print("  - http://127.0.0.1:5000/api/alerts")
    print("=" * 50)
    app.run(debug=True, host="0.0.0.0", port=5000)
