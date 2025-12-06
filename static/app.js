// Main application logic
let map;
let firefightersMarkers = {};
let beaconMarkers = {};
let positionHistoryLayers = {}; // Store history trails for each firefighter
let lastPositionCache = {}; // Cache for current position
let previousPositionCache = {}; // Cache for previous position (to display as dot)
let heartRateCache = {}; // Cache for heart rate data (max 50 points per firefighter)
let firefightersCache = {}; // Cache for all firefighters data (growing list, never removed)
let selectedFirefighter = null;
let currentFloor = 0;
let buildingData = null;
let cords = null;
let showHistory = false; // Toggle for showing position history
let heartRateChart = null; // Chart.js instance for heart rate trend

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    try {
        // Get initial building data from server
        const response = await fetch('/api/building');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const buildingInfo = await response.json();
        
        if (buildingInfo && buildingInfo.gps_reference) {
            buildingData = buildingInfo;
            cords = buildingInfo.gps_reference;
            initializeMap();
            initializeFloorSelector();
            startDataUpdates();
        } else {
            console.error('Invalid building data received');
            showMapError();
            startDataUpdates(); // Still start data updates even if map fails
        }
    } catch (error) {
        console.error('Error initializing app:', error);
        showMapError();
        // Still try to start data updates even if building data fails
        startDataUpdates();
    }
}

function initializeMap() {
    try {
        if (!cords || !cords.origin || cords.origin.lat === undefined || cords.origin.lon === undefined) {
            throw new Error('Invalid GPS coordinates');
        }
        
        // Get building location from API data
        const lat = cords.origin.lat;
        const lon = cords.origin.lon;
        
        // Check if map container exists
        const mapContainer = document.getElementById('map');
        if (!mapContainer) {
            throw new Error('Map container not found');
        }
        
        // Initialize map with higher zoom
        map = L.map('map').setView([lat, lon], 22);
        
        // Add error handler for tile loading
        map.on('tileerror', (error, tile) => {
            console.warn('Tile loading error:', error);
        });
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 24,
            errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
        }).addTo(map);
        
        // Wait a bit for map to initialize, then check if it's working
        setTimeout(() => {
            if (!map || !map.getContainer()) {
                console.error('Map failed to initialize properly');
                showMapError();
                return;
            }
        }, 1000);
        
        // Draw building rectangle
        if (buildingData && buildingData.dimensions) {
            drawBuilding(buildingData.dimensions);
        }
        
        // Draw entry points and hazard zones for current floor
        updateFloorDisplay(currentFloor);
    } catch (error) {
        console.error('Error initializing map:', error);
        showMapError();
    }
}

function showMapError() {
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
        // Remove any existing Leaflet map
        if (map) {
            try {
                map.remove();
            } catch (e) {
                console.warn('Error removing map:', e);
            }
        }
        
        // Set minimum height for the error div
        mapContainer.style.minHeight = '400px';
        mapContainer.innerHTML = `
            <div style="width: 100%; height: 100%; min-height: 400px; background: #6c757d; display: flex; align-items: center; justify-content: center; color: white; font-size: 18px; flex-direction: column; gap: 10px; border-radius: 8px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; opacity: 0.7;"></i>
                <div style="text-align: center;">
                    <div style="font-weight: 600; margin-bottom: 5px;">Błąd ładowania mapy</div>
                    <div style="font-size: 14px; opacity: 0.8;">Nie można wyświetlić mapy</div>
                </div>
            </div>
        `;
    }
    map = null; // Set map to null so other functions know it failed
}

function drawBuilding(dimensions) {
    if (!map) {
        console.warn('Map not initialized - cannot draw building');
        return;
    }
    
    try {
        // Based on API: origin (0,0) is at SW corner of building
        // Building extends from (0,0) to (width, depth) in local coordinates
        // Convert corners to GPS
        const sw = convertLocalToGPS(0, 0); // SW corner at origin
        const ne = convertLocalToGPS(dimensions.width_m, dimensions.depth_m); // NE corner
        
        const buildingBounds = [sw, ne];
        
        const buildingRect = L.rectangle(buildingBounds, {
            color: '#495057',
            fillColor: '#495057',
            fillOpacity: 0.15,
            weight: 3,
            opacity: 0.8
        }).addTo(map);
    
        buildingRect.bindPopup(`
            <div style="font-size: 14px; padding: 8px;">
                <b style="font-size: 16px; display: block; margin-bottom: 5px;"><i class="fas fa-building"></i> Budynek</b>
                <span style="font-size: 13px;">${dimensions.width_m}m × ${dimensions.depth_m}m</span>
            </div>
        `, {
            className: 'custom-popup-large'
        });
    } catch (error) {
        console.error('Error drawing building:', error);
    }
}

function initializeFloorSelector() {
    if (!buildingData || !buildingData.floors || !Array.isArray(buildingData.floors)) return;
    
    const floorSelect = document.getElementById('floor-select');
    if (!floorSelect) return;
    
    // Clear existing options
    floorSelect.innerHTML = '';
    
    // Add options for each floor
    buildingData.floors.forEach((floor, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${floor.name || 'Piętro'} (Poziom ${floor.number !== undefined ? floor.number : index})`;
        floorSelect.appendChild(option);
    });
    
    // Set initial value and display first floor
    if (buildingData.floors.length > 0) {
        floorSelect.value = 0;
        currentFloor = 0;
        updateFloorDisplay(0);
    }
    
    floorSelect.addEventListener('change', (e) => {
        currentFloor = parseInt(e.target.value);
        updateFloorDisplay(currentFloor);
        // Update beacons when floor changes (only if toggle is enabled)
        const toggleBeacons = document.getElementById('toggle-beacons');
        if (toggleBeacons && toggleBeacons.checked && map) {
            updateBeaconsDisplay();
        } else if (map) {
            // If toggle is off, make sure beacons are removed
            Object.values(beaconMarkers).forEach(beaconData => {
                try {
                    if (beaconData.marker && map.hasLayer(beaconData.marker)) {
                        map.removeLayer(beaconData.marker);
                    }
                    if (beaconData.circle && map.hasLayer(beaconData.circle)) {
                        map.removeLayer(beaconData.circle);
                    }
                } catch (e) {
                    console.warn('Error removing beacon:', e);
                }
            });
            beaconMarkers = {};
        }
    });
}

// Store floor layers to properly remove them
let floorLayers = [];

function updateFloorDisplay(floorIndex) {
    if (!buildingData || !buildingData.floors) return;
    
    if (!map) {
        console.warn('Map not initialized - cannot update floor display');
        return;
    }
    
    const floor = buildingData.floors[floorIndex];
    if (!floor) return;
    
    // Clear existing floor markers
    try {
        floorLayers.forEach(layer => {
            if (map.hasLayer(layer)) {
                map.removeLayer(layer);
            }
        });
    } catch (e) {
        console.warn('Error removing floor layers:', e);
    }
    floorLayers = [];
    
    // Draw entry points for this floor
    if (buildingData.entry_points && Array.isArray(buildingData.entry_points)) {
        buildingData.entry_points
            .filter(ep => {
                // Handle both number and string comparison
                const epFloor = ep.floor !== undefined ? ep.floor : null;
                return epFloor === floor.number || epFloor === String(floor.number);
            })
            .forEach(ep => {
                if (ep.position && ep.position.x !== undefined && ep.position.y !== undefined) {
                    // Entry points use corner-based coordinates (0,0 = SW corner of building)
                    // So we can directly convert x,y to GPS
                    const gps = convertLocalToGPS(ep.position.x, ep.position.y);
                    
                    // Create larger entry point marker
                    const entryIcon = L.divIcon({
                        className: 'entry-point-marker',
                        html: `<div style="background: #28a745; width: 35px; height: 35px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;"><i class="fas fa-door-open" style="color: white; font-size: 16px;"></i></div>`,
                        iconSize: [35, 35],
                        iconAnchor: [17.5, 17.5]
                    });
                    const marker = L.marker(gps, { 
                        isEntryPoint: true,
                        icon: entryIcon
                    }).addTo(map);
                    marker.bindPopup(`
                        <div style="font-size: 15px; padding: 8px; min-width: 180px;">
                            <b style="font-size: 17px; display: block; margin-bottom: 6px;"><i class="fas fa-door-open"></i> ${ep.name || 'Wejście'}</b>
                            <span style="font-size: 13px; color: #6c757d;">ID: ${ep.id || 'N/A'}</span>
                        </div>
                    `, {
                        className: 'custom-popup-large'
                    });
                    floorLayers.push(marker);
                }
            });
    }
    
    // Draw hazard zones for this floor
    if (buildingData.hazard_zones && Array.isArray(buildingData.hazard_zones)) {
        buildingData.hazard_zones
            .filter(hz => {
                // Handle both number and string comparison
                const hzFloor = hz.floor !== undefined ? hz.floor : null;
                return hzFloor === floor.number || hzFloor === String(floor.number);
            })
            .forEach(hz => {
                if (hz.bounds && hz.bounds.x1 !== undefined && hz.bounds.y1 !== undefined && 
                    hz.bounds.x2 !== undefined && hz.bounds.y2 !== undefined) {
                    // Hazard zones also use corner-based coordinates
                    // Convert bounds to GPS - ensure correct order (SW to NE)
                    const sw = convertLocalToGPS(Math.min(hz.bounds.x1, hz.bounds.x2), Math.min(hz.bounds.y1, hz.bounds.y2));
                    const ne = convertLocalToGPS(Math.max(hz.bounds.x1, hz.bounds.x2), Math.max(hz.bounds.y1, hz.bounds.y2));
                    const rectangle = L.rectangle([sw, ne], {
                        color: '#dc3545',
                        fillColor: '#dc3545',
                        fillOpacity: 0.2,
                        weight: 3,
                        isHazardZone: true
                    }).addTo(map);
                    rectangle.bindPopup(`
                        <div style="font-size: 14px; padding: 8px; min-width: 180px;">
                            <b style="font-size: 16px; display: block; margin-bottom: 5px;"><i class="fas fa-exclamation-triangle"></i> ${hz.name || 'Strefa'}</b>
                            <span style="font-size: 13px; color: #6c757d;">Typ: ${hz.type || 'N/A'}</span>
                        </div>
                    `, {
                        className: 'custom-popup-large'
                    });
                    floorLayers.push(rectangle);
                }
            });
    }
}

function convertLocalToGPS(x, y) {
    // Based on API data analysis:
    // - Entry points have positions like x=0, y=5 and x=40, y=20
    // - Building is 40m × 25m
    // - This suggests origin (0,0) is at SW corner, not center
    // - So we convert directly: origin GPS + (x,y in meters converted to degrees)
    const lat = cords.origin.lat + (y / cords.scale_lat_m_per_deg);
    const lon = cords.origin.lon + (x / cords.scale_lon_m_per_deg);
    return [lat, lon];
}

async function updateFirefighters() {
    let firefighters = [];
    let alerts = [];
    let firefightersData = null;
    
    try {
        console.log('Starting to fetch firefighters...');
        firefightersData = await api.getFirefighters();
        console.log('Firefighters data received:', firefightersData ? (Array.isArray(firefightersData) ? `${firefightersData.length} items` : typeof firefightersData) : 'null');
        
        // Handle different response formats
        if (Array.isArray(firefightersData)) {
            firefighters = firefightersData;
            console.log(`Using ${firefighters.length} firefighters from array`);
        } else if (firefightersData && typeof firefightersData === 'object') {
            firefighters = firefightersData.firefighters || firefightersData.data || [];
            console.log(`Using ${firefighters.length} firefighters from object`);
        } else {
            console.warn('Firefighters data is not in expected format:', typeof firefightersData);
            firefighters = [];
        }
    } catch (error) {
        console.error('Error fetching firefighters:', error.name, error.message);
        console.error('Error stack:', error.stack);
        firefighters = []; // Will be handled by empty check
    }
    
    try {
        alerts = await api.getAlerts(true);
        if (!Array.isArray(alerts)) {
            alerts = [];
        }
    } catch (error) {
        console.error('Error fetching alerts:', error);
        alerts = [];
    }
    
    // Log for debugging
    console.log('Firefighters data:', firefighters.length, 'firefighters');
    if (firefighters.length > 0) {
        console.log('First firefighter sample:', firefighters[0]);
    }
    
    // Ensure firefighters is an array
    if (!Array.isArray(firefighters)) {
        console.warn('Firefighters is not an array:', typeof firefighters, firefighters);
        firefighters = [];
    }
    
    // Filter out firefighters without proper data
    firefighters = firefighters.filter(ff => {
        const hasId = ff && ff.id;
        const hasName = ff && (ff.name || ff.getName);
        return hasId && hasName;
    });
    
    // If no valid firefighters, log it
    if (firefighters.length === 0) {
        console.warn('No valid firefighters found, original data was:', firefightersData);
    }
    
    // Create alerts map by firefighter ID
    const alertsByFirefighter = {};
    if (Array.isArray(alerts) && alerts.length > 0) {
        console.log('Received alerts:', alerts.length);
        alerts.forEach(alert => {
            // Try different possible field names for firefighter ID
            const ffId = alert.firefighter_id || alert.firefighterId || alert.firefighter || 
                       (alert.firefighter && alert.firefighter.id) || 
                       (alert.tag_id && alert.tag_id.startsWith('FF-') ? alert.tag_id : null);
            if (ffId) {
                if (!alertsByFirefighter[ffId]) {
                    alertsByFirefighter[ffId] = [];
                }
                alertsByFirefighter[ffId].push(alert);
            } else {
                // Log alerts without firefighter ID for debugging
                console.log('Alert without firefighter ID:', alert);
            }
        });
    } else {
        console.log('No alerts or alerts is not an array:', alerts);
    }
    
    updateFirefightersList(firefighters, alertsByFirefighter);
    updateFirefightersOnMap(firefighters, alertsByFirefighter);
    
    // Update beacons display if toggle is enabled
    // Beacons are handled separately in updateFirefightersOnly() based on toggle state
    
    // Update position history if enabled
    if (showHistory) {
        updatePositionHistory(firefighters);
    }
}

// Separate function to update only alerts
async function updateAlertsOnly() {
    console.log('=== UPDATING ALERTS ===');
    let alerts = [];
    
    try {
        console.log('Fetching alerts...');
        const alertsData = await api.getAlerts(true);
        console.log('Alerts received:', alertsData ? (Array.isArray(alertsData) ? `${alertsData.length} items` : typeof alertsData) : 'null');
        
        if (Array.isArray(alertsData)) {
            alerts = alertsData;
        } else if (alertsData && typeof alertsData === 'object') {
            // Try to extract alerts from object
            alerts = alertsData.alerts || alertsData.data || [];
            if (!Array.isArray(alerts)) {
                alerts = [];
            }
        } else {
            alerts = [];
        }
        
        console.log(`Processed ${alerts.length} alerts`);
        if (alerts.length > 0) {
            console.log('Sample alert:', JSON.stringify(alerts[0], null, 2));
        }
    } catch (error) {
        console.error('Error fetching alerts:', error.name, error.message);
        console.error('Error stack:', error.stack);
        alerts = [];
    }
    
    console.log(`Updating alerts display with ${alerts.length} alerts`);
    updateAlertsDisplay(alerts);
    console.log('Alerts update completed');
}

function updateFirefightersList(firefighters, alertsByFirefighter) {
    const listContainer = document.getElementById('firefighters-list');
    const countBadge = document.getElementById('firefighters-count');
    
    console.log('updateFirefightersList called with', firefighters.length, 'firefighters');
    
    if (!listContainer) {
        console.error('firefighters-list container not found!');
        return;
    }
    
    // Ensure firefighters is an array
    if (!Array.isArray(firefighters)) {
        console.warn('updateFirefightersList: firefighters is not an array:', typeof firefighters);
        firefighters = [];
    }
    
    // Update cache with new/updated firefighters (merge, never remove)
    firefighters.forEach(ff => {
        const id = (ff && ff.id) ? ff.id : '';
        if (id) {
            // Merge with existing data, keeping old data if new data is missing
            if (firefightersCache[id]) {
                // Update with new data, but keep old data for missing fields
                firefightersCache[id] = {
                    ...firefightersCache[id],
                    ...ff,
                    lastUpdate: Date.now()
                };
            } else {
                // New firefighter
                firefightersCache[id] = {
                    ...ff,
                    lastUpdate: Date.now()
                };
            }
        }
    });
    
    // Get all cached firefighters (growing list)
    const allFirefighters = Object.values(firefightersCache);
    
    if (countBadge) {
        countBadge.textContent = allFirefighters.length;
    }
    
    if (allFirefighters.length === 0) {
        listContainer.innerHTML = '<p class="text-muted text-center small mb-0">Brak aktywnych strażaków</p>';
        return;
    }
    
    // Render all cached firefighters
    listContainer.innerHTML = allFirefighters.map(ff => {
        // Safely extract data with multiple fallbacks
        const id = (ff && ff.id) ? ff.id : (ff && ff.getId) ? ff.getId() : '';
        const name = (ff && ff.name) ? ff.name : (ff && ff.getName) ? ff.getName() : (ff && ff.full_name) ? ff.full_name : 'N/A';
        const rank = (ff && ff.rank) ? ff.rank : (ff && ff.getRank) ? ff.getRank() : (ff && ff.rank_name) ? ff.rank_name : 'N/A';
        const hasAlerts = alertsByFirefighter[id] && alertsByFirefighter[id].length > 0;
        const alertClass = hasAlerts ? 'firefighter-alert' : '';
        const selectedClass = selectedFirefighter === id ? 'selected' : '';
        
        // Check if firefighter was recently updated (within last 10 seconds)
        const lastUpdate = ff.lastUpdate || 0;
        const isOnline = (Date.now() - lastUpdate) < 10000;
        const statusClass = isOnline ? 'status-online' : 'status-offline';
        const statusText = isOnline ? 'Online' : 'Offline';
        
        // Skip if still no valid name
        if (name === 'N/A' && !id) {
            console.warn('Skipping firefighter with no data:', ff);
            return '';
        }
        
        return `
            <a href="#" class="firefighter-card ${alertClass} ${selectedClass}" data-firefighter-id="${id}">
                <div class="firefighter-name">${name}</div>
                <div class="firefighter-details">
                    <span class="me-2">${rank}</span>
                    ${hasAlerts ? '<span class="status-badge status-warning"><i class="fas fa-exclamation-triangle"></i> Alert</span>' : `<span class="status-badge ${statusClass}">${statusText}</span>`}
                </div>
            </a>
        `;
    }).filter(html => html !== '').join('');
    
    // Attach click handlers
    listContainer.querySelectorAll('.firefighter-card').forEach(card => {
        card.addEventListener('click', (e) => {
            e.preventDefault();
            const ffId = card.dataset.firefighterId;
            selectFirefighter(ffId);
        });
    });
}

function updateFirefightersOnMap(firefighters, alertsByFirefighter) {
    console.log('updateFirefightersOnMap called with', firefighters.length, 'firefighters');
    
    if (!map) {
        console.warn('Map not initialized - skipping map update');
        return;
    }
    
    // Use all cached firefighters (growing list), not just current update
    const allFirefighters = Object.values(firefightersCache);
    console.log(`Rendering ${allFirefighters.length} firefighters from cache on map`);
    
    // Store current markers before removing (for error recovery)
    const currentMarkers = {...firefightersMarkers};
    
    try {
        // Remove old markers
        Object.values(firefightersMarkers).forEach(marker => {
            try {
                if (map.hasLayer(marker)) {
                    map.removeLayer(marker);
                }
            } catch (e) {
                console.warn('Error removing marker:', e);
            }
        });
        firefightersMarkers = {};
        
        let markersAdded = 0;
        let markersSkipped = 0;
        
        // Add markers for all cached firefighters (use last known position)
        allFirefighters.forEach(ff => {
            try {
                const id = ff.id;
                if (!id) return; // Skip if no ID
                
                // Try different possible positions in the data structure
                let lat, lon;
                
                // Check various possible data structures
                if (ff.position) {
                    if (ff.position.gps && Array.isArray(ff.position.gps) && ff.position.gps.length >= 2) {
                        [lat, lon] = ff.position.gps;
                    } else if (ff.position.lat !== undefined && ff.position.lon !== undefined) {
                        lat = parseFloat(ff.position.lat);
                        lon = parseFloat(ff.position.lon);
                    } else if (Array.isArray(ff.position) && ff.position.length >= 2) {
                        [lat, lon] = ff.position;
                    }
                } else if (ff.telemetry) {
                    if (ff.telemetry.position) {
                        if (ff.telemetry.position.gps && Array.isArray(ff.telemetry.position.gps)) {
                            [lat, lon] = ff.telemetry.position.gps;
                        } else if (ff.telemetry.position.lat !== undefined && ff.telemetry.position.lon !== undefined) {
                            lat = parseFloat(ff.telemetry.position.lat);
                            lon = parseFloat(ff.telemetry.position.lon);
                        }
                    } else if (ff.telemetry.gps && Array.isArray(ff.telemetry.gps)) {
                        [lat, lon] = ff.telemetry.gps;
                    } else if (ff.telemetry.lat !== undefined && ff.telemetry.lon !== undefined) {
                        lat = parseFloat(ff.telemetry.lat);
                        lon = parseFloat(ff.telemetry.lon);
                    }
                } else if (ff.gps && Array.isArray(ff.gps)) {
                    [lat, lon] = ff.gps;
                } else if (ff.lat !== undefined && ff.lon !== undefined) {
                    lat = parseFloat(ff.lat);
                    lon = parseFloat(ff.lon);
                }
                
                // If we don't have GPS coordinates, try to convert from local coordinates
                if ((lat === undefined || lon === undefined || isNaN(lat) || isNaN(lon)) && cords) {
                    // Try to get local coordinates and convert to GPS
                    if (ff.position) {
                        const x = ff.position.x;
                        const y = ff.position.y;
                        if (x !== undefined && y !== undefined && !isNaN(x) && !isNaN(y)) {
                            console.log(`Converting local position for ${id}: x=${x}, y=${y}`);
                            [lat, lon] = convertLocalToGPS(x, y);
                            console.log(`Converted to GPS: lat=${lat}, lon=${lon}`);
                        }
                    }
                }
                
                // If still no position, try to get from lastPositionCache (last known position)
                if ((lat === undefined || lon === undefined || isNaN(lat) || isNaN(lon)) && lastPositionCache[id]) {
                    const lastPos = lastPositionCache[id];
                    if (lastPos.gps && Array.isArray(lastPos.gps)) {
                        [lat, lon] = lastPos.gps;
                    } else if (lastPos.lat !== undefined && lastPos.lon !== undefined) {
                        lat = parseFloat(lastPos.lat);
                        lon = parseFloat(lastPos.lon);
                    }
                }
                
                // Skip if we still don't have valid coordinates
                if (lat === undefined || lon === undefined || isNaN(lat) || isNaN(lon)) {
                    console.warn(`No valid position data for firefighter ${id}, skipping marker`);
                    markersSkipped++;
                    return;
                }
                
                const hasAlerts = alertsByFirefighter[id] && alertsByFirefighter[id].length > 0;
                
                // Create marker with appropriate color and blinking animation (larger size)
                const markerColor = hasAlerts ? '#dc3545' : '#28a745';
                const markerSize = 32; // Increased from 20 to 32
                const markerHtml = `<div class="firefighter-marker-blink" style="background: ${markerColor}; width: ${markerSize}px; height: ${markerSize}px; border-radius: 50%; border: 3px solid white; box-shadow: 0 3px 10px rgba(0,0,0,0.4);"></div>`;
                
                const marker = L.marker([lat, lon], {
                    hasAlerts: hasAlerts,
                    isSelected: false,
                    originalColor: markerColor,
                    icon: L.divIcon({
                        className: 'custom-firefighter-marker',
                        html: markerHtml,
                        iconSize: [markerSize, markerSize],
                        iconAnchor: [markerSize/2, markerSize/2]
                    })
                }).addTo(map);
                
                // Get position quality info (QoS - number of visible beacons)
                const position = ff.position || {};
                const uwbMeasurements = ff.uwb_measurements || [];
                const beaconsVisible = uwbMeasurements.length || (position.beacons_used || 0);
                const positionAccuracy = position.accuracy_m || position.confidence || null;
                
                // Determine position quality color
                let qualityColor = '#6c757d';
                let qualityText = 'Niska';
                if (beaconsVisible >= 3) {
                    qualityColor = '#28a745';
                    qualityText = 'Wysoka';
                } else if (beaconsVisible >= 1) {
                    qualityColor = '#ffc107';
                    qualityText = 'Średnia';
                }
                
                // Get telemetry data (use last known if current is missing)
                const telemetry = ff.telemetry || {};
                let heartRate = telemetry.heart_rate || ff.vitals?.heart_rate_bpm || null;
                // If no current heart rate, try to get last known from cache
                if (heartRate === null && heartRateCache[id] && heartRateCache[id].length > 0) {
                    const lastHR = heartRateCache[id][heartRateCache[id].length - 1];
                    heartRate = lastHR.value;
                }
                const battery = telemetry.battery || ff.device?.battery_percent || null;
                const motionState = telemetry.motion_state || ff.vitals?.motion_state || null;
                const floor = position.floor !== undefined ? position.floor : (ff.position?.z !== undefined ? Math.round(ff.position.z / 3) : null);
                
                // Determine if this is selected firefighter (larger popup)
                const isSelected = selectedFirefighter === id;
                const popupClass = isSelected ? 'firefighter-popup-large' : 'custom-popup-large';
                const popupMinWidth = isSelected ? '350px' : '220px';
                const fontSize = isSelected ? '15px' : '14px';
                const headerSize = isSelected ? '20px' : '16px';
                
                marker.bindPopup(`
                    <div style="font-size: ${fontSize}; padding: ${isSelected ? '12px' : '8px'}; min-width: ${popupMinWidth};">
                        <div class="popup-header" style="font-size: ${headerSize}; display: block; margin-bottom: ${isSelected ? '8px' : '5px'};">
                            <b>${ff.name || 'N/A'}</b>
                        </div>
                        <div style="font-size: ${isSelected ? '14px' : '13px'}; color: #6c757d; margin-bottom: ${isSelected ? '8px' : '4px'};">
                            ${ff.rank || ''}
                        </div>
                        ${floor !== null ? `<div style="margin-top: ${isSelected ? '6px' : '4px'}; font-size: ${isSelected ? '13px' : '12px'};"><i class="fas fa-layer-group"></i> Piętro: ${floor}</div>` : ''}
                        <div class="popup-section" style="margin-top: ${isSelected ? '10px' : '6px'}; padding-top: ${isSelected ? '10px' : '6px'}; border-top: 1px solid #dee2e6;">
                            <div style="font-size: ${isSelected ? '13px' : '12px'}; margin-bottom: ${isSelected ? '6px' : '4px'};">
                                <span style="color: ${qualityColor};"><i class="fas fa-signal"></i> Jakość: ${qualityText}</span>
                                ${beaconsVisible > 0 ? `<span style="color: #6c757d; margin-left: 8px;">(${beaconsVisible} beacon${beaconsVisible > 1 ? 'ów' : ''})</span>` : ''}
                            </div>
                            ${positionAccuracy !== null ? `<div style="font-size: ${isSelected ? '12px' : '11px'}; color: #6c757d; margin-bottom: ${isSelected ? '4px' : '2px'};" class="popup-value">Dokładność: ±${positionAccuracy.toFixed(1)}m</div>` : ''}
                            ${heartRate !== null ? `<div style="font-size: ${isSelected ? '13px' : '12px'}; margin-top: ${isSelected ? '6px' : '4px'};" class="popup-value"><i class="fas fa-heart" style="color: ${heartRate > 150 ? '#dc3545' : '#6c757d'}"></i> Tętno: <strong>${Math.round(heartRate)} bpm</strong></div>` : ''}
                            ${battery !== null ? `<div style="font-size: ${isSelected ? '13px' : '12px'}; margin-top: ${isSelected ? '4px' : '2px'};" class="popup-value"><i class="fas fa-battery-${battery > 50 ? 'half' : 'quarter'}" style="color: ${battery < 20 ? '#dc3545' : '#6c757d'}"></i> Bateria: <strong>${Math.round(battery)}%</strong></div>` : ''}
                            ${motionState ? `<div style="font-size: ${isSelected ? '13px' : '12px'}; margin-top: ${isSelected ? '4px' : '2px'};" class="popup-value"><i class="fas fa-${motionState === 'motionless' ? 'pause' : 'walking'}"></i> ${motionState === 'motionless' ? 'Bezruch' : 'W ruchu'}</div>` : ''}
                        </div>
                        ${hasAlerts ? `<div style="margin-top: ${isSelected ? '10px' : '8px'}; color: red; font-size: ${isSelected ? '14px' : '13px'}; font-weight: 600;"><i class="fas fa-exclamation-triangle"></i> Aktywne alerty</div>` : ''}
                    </div>
                `, {
                    className: popupClass
                });
                
                firefightersMarkers[id] = marker;
                markersAdded++;
                
                // If this is selected firefighter, highlight it
                if (isSelected) {
                    highlightFirefighterMarker(id);
                }
            } catch (error) {
                console.error(`Error adding marker for firefighter ${ff.id || 'unknown'}:`, error);
                markersSkipped++;
            }
        });
        
        console.log(`Map update completed: ${markersAdded} markers added, ${markersSkipped} skipped`);
    } catch (error) {
        console.error('Error in updateFirefightersOnMap:', error);
        // Restore previous markers on error
        firefightersMarkers = currentMarkers;
        console.warn('Restored previous markers due to error');
    }
}

function selectFirefighter(ffId) {
    selectedFirefighter = ffId;
    
    // Update UI
    document.querySelectorAll('.firefighter-card').forEach(card => {
        card.classList.remove('selected');
        if (card.dataset.firefighterId === ffId) {
            card.classList.add('selected');
        }
    });
    
    // Highlight on map
    highlightFirefighterMarker(ffId);
    
    // Center map on firefighter
    const marker = firefightersMarkers[ffId];
    if (marker && map) {
        map.setView(marker.getLatLng(), 22);
        marker.openPopup();
    }
    
    // Update heart rate chart
    updateHeartRateChart(ffId);
}

// Initialize and update heart rate trend chart
function updateHeartRateChart(ffId) {
    const chartContainer = document.getElementById('heart-rate-chart-container');
    const chartTitle = document.getElementById('heart-rate-chart-title');
    const chartCanvas = document.getElementById('heart-rate-chart');
    
    if (!chartContainer || !chartCanvas) return;
    
    // Get heart rate data from cache
    const heartRateData = heartRateCache[ffId] || [];
    
    if (heartRateData.length === 0) {
        chartContainer.style.display = 'none';
        return;
    }
    
    chartContainer.style.display = 'block';
    
    // Get firefighter name from current data
    const firefighter = Array.from(document.querySelectorAll('.firefighter-card')).find(card => 
        card.dataset.firefighterId === ffId
    );
    const firefighterName = firefighter ? firefighter.querySelector('.firefighter-name')?.textContent || ffId : ffId;
    chartTitle.textContent = firefighterName;
    
    // Prepare chart data
    const labels = heartRateData.map((point, index) => {
        const date = new Date(point.timestamp);
        return date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    });
    const values = heartRateData.map(point => point.value);
    
    // Destroy existing chart if it exists
    if (heartRateChart) {
        heartRateChart.destroy();
    }
    
    // Create new chart
    const ctx = chartCanvas.getContext('2d');
    heartRateChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Tętno (BPM)',
                data: values,
                borderColor: '#dc3545',
                backgroundColor: 'rgba(220, 53, 69, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                pointHoverRadius: 5,
                pointBackgroundColor: '#dc3545',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    min: Math.max(0, Math.min(...values) - 20),
                    max: Math.max(...values) + 20,
                    title: {
                        display: true,
                        text: 'BPM'
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

function highlightFirefighterMarker(ffId) {
    // Highlight selected - store original color info
    const marker = firefightersMarkers[ffId];
    if (marker) {
        // Get current marker color from stored data
        const hasAlerts = marker.options.hasAlerts || false;
        const baseColor = hasAlerts ? '#dc3545' : '#28a745';
        
        const selectedSize = 38; // Increased from 24 to 38
        marker.setIcon(L.divIcon({
            className: 'custom-firefighter-marker',
            html: `<div class="firefighter-marker-blink" style="background: #17a2b8; width: ${selectedSize}px; height: ${selectedSize}px; border-radius: 50%; border: 4px solid #0d6efd; box-shadow: 0 5px 15px rgba(13, 110, 253, 0.6);"></div>`,
            iconSize: [selectedSize, selectedSize],
            iconAnchor: [selectedSize/2, selectedSize/2]
        }));
        marker.options.isSelected = true;
        marker.options.originalColor = baseColor;
    }
    
    // Reset other markers to their original colors
    Object.entries(firefightersMarkers).forEach(([id, m]) => {
        if (id !== ffId && m.options.isSelected) {
            const originalColor = m.options.originalColor || '#28a745';
            const hasAlerts = m.options.hasAlerts || false;
            const color = hasAlerts ? '#dc3545' : '#28a745';
            
            const normalSize = 32; // Increased from 20 to 32
            m.setIcon(L.divIcon({
                className: 'custom-firefighter-marker',
                html: `<div class="firefighter-marker-blink" style="background: ${color}; width: ${normalSize}px; height: ${normalSize}px; border-radius: 50%; border: 3px solid white; box-shadow: 0 3px 10px rgba(0,0,0,0.4);"></div>`,
                iconSize: [normalSize, normalSize],
                iconAnchor: [normalSize/2, normalSize/2]
            }));
            m.options.isSelected = false;
        }
    });
}

// Alert type definitions
const ALERT_TYPES = {
    'man_down': { severity: 'critical', description: 'Bezruch >30s' },
    'sos_pressed': { severity: 'critical', description: 'Przycisk SOS' },
    'high_heart_rate': { severity: 'warning', description: 'Tętno >180 bpm' },
    'low_battery': { severity: 'warning', description: 'Bateria <20%' },
    'scba_low_pressure': { severity: 'warning', description: 'Niskie ciśnienie SCBA' },
    'scba_critical': { severity: 'critical', description: 'Krytyczne ciśnienie SCBA' },
    'beacon_offline': { severity: 'warning', description: 'Beacon nie odpowiada' },
    'tag_offline': { severity: 'critical', description: 'Tag strażaka offline' },
    'high_co': { severity: 'critical', description: 'Wysokie CO' },
    'low_oxygen': { severity: 'critical', description: 'Niski O2' },
    'explosive_gas': { severity: 'critical', description: 'Gaz wybuchowy (LEL)' },
    'high_temperature': { severity: 'warning', description: 'Wysoka temperatura' }
};

function updateAlertsDisplay(alerts) {
    const alertsContainer = document.getElementById('alerts-container');
    if (!alertsContainer) {
        console.warn('Alerts container not found');
        return;
    }
    
    console.log('Updating alerts display, count:', alerts ? alerts.length : 0);
    
    if (!alerts || !Array.isArray(alerts) || alerts.length === 0) {
        alertsContainer.innerHTML = '<p class="text-muted text-center small mb-0">Brak aktywnych alertów</p>';
        return;
    }
    
    // Sort alerts by timestamp (newest first) and severity
    const sortedAlerts = alerts.slice().sort((a, b) => {
        const aTime = a.timestamp || 0;
        const bTime = b.timestamp || 0;
        if (aTime !== bTime) return bTime - aTime;
        // Critical first
        if (a.severity === 'critical' && b.severity !== 'critical') return -1;
        if (b.severity === 'critical' && a.severity !== 'critical') return 1;
        return 0;
    });
    
    // Update banner with most critical alert
    const criticalAlert = sortedAlerts.find(a => (a.severity === 'critical' || a.severity === 'error'));
    if (criticalAlert) {
        updateAlertBanner(criticalAlert);
    } else if (sortedAlerts.length > 0) {
        updateAlertBanner(sortedAlerts[0]);
    } else {
        const alertBanner = document.getElementById('alert-banner');
        if (alertBanner) {
            alertBanner.style.display = 'none';
        }
    }
    
    alertsContainer.innerHTML = sortedAlerts.slice(0, 10).map(alert => {
        // Extract alert type code
        let alertCode = '';
        if (typeof alert.type === 'string') {
            alertCode = alert.type;
        } else if (typeof alert.alert_type === 'string') {
            alertCode = alert.alert_type;
        } else if (typeof alert.name === 'string') {
            alertCode = alert.name;
        }
        
        // Get alert info from mapping or use defaults
        const alertInfo = ALERT_TYPES[alertCode] || { 
            severity: alert.severity || 'warning', 
            description: alert.message || alert.description || 'Nieznany alert' 
        };
        
        const severity = alert.severity || alertInfo.severity || 'warning';
        const isCritical = severity === 'critical' || severity === 'error';
        const borderColor = isCritical ? '#dc3545' : '#ff9800'; // Red for critical, orange for warning
        const bgColor = isCritical ? 'rgba(220, 53, 69, 0.1)' : 'rgba(255, 152, 0, 0.1)';
        const icon = isCritical ? 'fa-exclamation-circle' : 'fa-exclamation-triangle';
        
        // Extract firefighter ID
        let ffId = '';
        if (typeof alert.firefighter_id === 'string') {
            ffId = alert.firefighter_id;
        } else if (typeof alert.firefighterId === 'string') {
            ffId = alert.firefighterId;
        } else if (typeof alert.firefighter === 'string') {
            ffId = alert.firefighter;
        } else if (alert.firefighter && typeof alert.firefighter === 'object') {
            if (typeof alert.firefighter.id === 'string') {
                ffId = alert.firefighter.id;
            } else if (typeof alert.firefighter.name === 'string') {
                ffId = alert.firefighter.name;
            }
        } else if (alert.tag_id && typeof alert.tag_id === 'string') {
            ffId = alert.tag_id;
        }
        
        // Format timestamp
        const timestamp = alert.timestamp || alert.created_at || alert.time || Date.now();
        const date = new Date(timestamp);
        const timeStr = date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        // Get description from mapping - always use the mapped description
        const description = alertInfo.description || 'Nieznany alert';
        
        // Format alert code for display (e.g., "man_down" -> "MAN-DOWN")
        const displayCode = alertCode ? alertCode.toUpperCase().replace(/_/g, '-') : 'UNKNOWN';
        
        return `
            <div class="alert-item" style="border-left-color: ${borderColor}; background: ${bgColor}; padding: 0.75rem; margin-bottom: 0.5rem; border-radius: 4px;">
                <div class="d-flex align-items-start" style="gap: 0.75rem;">
                    <div style="flex-shrink: 0; font-weight: 600; font-size: 0.9rem; min-width: 100px;">
                        <i class="fas ${icon}" style="margin-right: 4px;"></i>${displayCode}
                    </div>
                    <div style="flex-grow: 1; font-size: 0.85rem;">
                        <div style="margin-bottom: 4px;">${description}</div>
                        ${ffId ? `<div class="small" style="margin-top: 4px; color: #6c757d;"><i class="fas fa-user me-1"></i>Strażak: <strong>${ffId}</strong></div>` : ''}
                        <div class="small" style="margin-top: 4px; color: #6c757d;">${timeStr}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Update alert banner at top of page
async function updateAlertBanner(alert) {
    const alertBanner = document.getElementById('alert-banner');
    const alertTitle = document.getElementById('alert-banner-title');
    const alertDetails = document.getElementById('alert-banner-details');
    
    if (!alertBanner || !alertTitle || !alertDetails) return;
    
    // Extract alert type code
    let alertCode = '';
    if (typeof alert.type === 'string') {
        alertCode = alert.type;
    } else if (typeof alert.alert_type === 'string') {
        alertCode = alert.alert_type;
    } else if (typeof alert.name === 'string') {
        alertCode = alert.name;
    }
    
    // Get alert info from mapping
    const alertInfo = ALERT_TYPES[alertCode] || { 
        severity: alert.severity || 'warning', 
        description: alert.message || alert.description || 'Nieznany alert' 
    };
    
    const severity = alert.severity || alertInfo.severity || 'warning';
    const isCritical = severity === 'critical' || severity === 'error';
    
    // Set banner color class
    alertBanner.className = isCritical ? 'alert-banner' : 'alert-banner alert-warning';
    
    // Format alert code for display (e.g., "man_down" -> "MAN-DOWN")
    const displayCode = alertCode.toUpperCase().replace(/_/g, '-');
    
    // Extract firefighter ID
    let ffId = '';
    if (typeof alert.firefighter_id === 'string') {
        ffId = alert.firefighter_id;
    } else if (typeof alert.firefighterId === 'string') {
        ffId = alert.firefighterId;
    } else if (typeof alert.firefighter === 'string') {
        ffId = alert.firefighter;
    } else if (alert.firefighter && typeof alert.firefighter === 'object') {
        if (typeof alert.firefighter.id === 'string') {
            ffId = alert.firefighter.id;
        } else if (typeof alert.firefighter.name === 'string') {
            ffId = alert.firefighter.name;
        }
    } else if (alert.tag_id && typeof alert.tag_id === 'string') {
        ffId = alert.tag_id;
    }
    
    // Try to get firefighter details from current firefighters list
    let firefighterName = '';
    let firefighterLocation = '';
    let heartRate = '';
    let motionlessTime = '';
    
    if (ffId) {
        // Try to find firefighter in current data
        const allFirefighters = await api.getFirefighters().catch(() => []);
        const firefighter = Array.isArray(allFirefighters) ? allFirefighters.find(ff => ff.id === ffId) : null;
        
        if (firefighter) {
            firefighterName = firefighter.name || firefighter.firefighter?.name || '';
            
            // Get location
            const position = firefighter.position || firefighter.telemetry?.position || {};
            const floor = position.floor !== undefined ? position.floor : (position.z !== undefined ? Math.round(position.z / 3) : null);
            const x = position.x !== undefined ? position.x.toFixed(1) : null;
            const y = position.y !== undefined ? position.y.toFixed(1) : null;
            
            if (floor !== null && x !== null && y !== null) {
                const floorNames = ['Piwnica', 'Parter', 'I piętro', 'II piętro', 'III piętro'];
                const floorName = floorNames[floor + 1] || `Piętro ${floor}`;
                firefighterLocation = `${floorName} X: ${x}m, Y: ${y}m`;
            }
            
            // Get heart rate
            const vitals = firefighter.vitals || firefighter.telemetry || {};
            const hr = vitals.heart_rate_bpm || vitals.heart_rate || null;
            if (hr !== null) {
                heartRate = `Tętno: ${Math.round(hr)} BPM`;
            }
            
            // Get motionless time (if man_down alert)
            if (alertCode === 'man_down') {
                const motionState = vitals.motion_state || '';
                const motionlessDuration = alert.motionless_duration || alert.duration || 35;
                if (motionState === 'motionless' || alertCode === 'man_down') {
                    motionlessTime = `Bezruch: ${motionlessDuration}s`;
                }
            }
        }
    }
    
    // Build title
    let titleText = displayCode || 'ALERT';
    if (firefighterName) {
        titleText += `: ${firefighterName}`;
    } else if (ffId) {
        titleText += `: ${ffId}`;
    }
    
    // Build details
    const detailsParts = [];
    if (firefighterLocation) {
        detailsParts.push(`<i class="fas fa-map-marker-alt"></i>${firefighterLocation}`);
    }
    if (heartRate) {
        detailsParts.push(heartRate);
    }
    if (motionlessTime) {
        detailsParts.push(motionlessTime);
    }
    if (detailsParts.length === 0) {
        detailsParts.push(alertInfo.description || 'Brak szczegółów');
    }
    
    alertTitle.textContent = titleText;
    alertDetails.innerHTML = detailsParts.join(' ');
    alertBanner.style.display = 'block';
}

// Update beacons display on map
async function updateBeaconsDisplay() {
    console.log('=== UPDATING BEACONS ===');
    
    // Check if beacons toggle is enabled
    const toggleBeacons = document.getElementById('toggle-beacons');
    if (!toggleBeacons || !toggleBeacons.checked) {
        console.log('Beacons toggle is disabled - skipping beacons display');
        // Make sure beacons are removed if toggle is off
        if (map && Object.keys(beaconMarkers).length > 0) {
            Object.values(beaconMarkers).forEach(beaconData => {
                try {
                    if (beaconData.marker && map.hasLayer(beaconData.marker)) {
                        map.removeLayer(beaconData.marker);
                    }
                    if (beaconData.circle && map.hasLayer(beaconData.circle)) {
                        map.removeLayer(beaconData.circle);
                    }
                } catch (e) {
                    console.warn('Error removing beacon:', e);
                }
            });
            beaconMarkers = {};
        }
        return;
    }
    
    if (!map) {
        console.warn('Map not initialized - skipping beacons display');
        return;
    }
    
    try {
        console.log('Fetching beacons...');
        const beacons = await api.getBeacons();
        console.log('Beacons received:', Array.isArray(beacons) ? `${beacons.length} items` : typeof beacons);
        if (!Array.isArray(beacons)) {
            console.warn('Beacons is not an array');
            return;
        }
        
        if (beacons.length === 0) {
            console.log('No beacons to display');
            // Remove all beacons if none available
            Object.values(beaconMarkers).forEach(beaconData => {
                try {
                    if (beaconData.marker && map.hasLayer(beaconData.marker)) {
                        map.removeLayer(beaconData.marker);
                    }
                    if (beaconData.circle && map.hasLayer(beaconData.circle)) {
                        map.removeLayer(beaconData.circle);
                    }
                } catch (e) {
                    console.warn('Error removing beacon:', e);
                }
            });
            beaconMarkers = {};
            return;
        }
        
        // Filter beacons by current floor
        const filteredBeacons = beacons.filter(beacon => {
            const beaconFloor = beacon.floor !== undefined ? beacon.floor : 
                              (beacon.position && beacon.position.z !== undefined ? Math.round(beacon.position.z / 3) : null);
            // Handle floor comparison - currentFloor is index, beacon.floor might be number
            if (beaconFloor === null || beaconFloor === undefined) {
                // If no floor info, show on floor 0
                return currentFloor === 0;
            }
            // Compare floor numbers - check both direct comparison and floor number
            const floorNumber = buildingData?.floors?.[currentFloor]?.number;
            return beaconFloor === currentFloor || beaconFloor === floorNumber;
        });
        
        console.log(`Filtered beacons: ${beacons.length} -> ${filteredBeacons.length} for floor ${currentFloor}`);
        
        if (filteredBeacons.length === 0) {
            console.log('No beacons on current floor');
            // Remove all beacons if none on current floor
            Object.values(beaconMarkers).forEach(beaconData => {
                try {
                    if (beaconData.marker && map.hasLayer(beaconData.marker)) {
                        map.removeLayer(beaconData.marker);
                    }
                    if (beaconData.circle && map.hasLayer(beaconData.circle)) {
                        map.removeLayer(beaconData.circle);
                    }
                } catch (e) {
                    console.warn('Error removing beacon:', e);
                }
            });
            beaconMarkers = {};
            return;
        }
        
        // Remove old beacon markers and circles
        Object.values(beaconMarkers).forEach(beaconData => {
            try {
                if (beaconData.marker && map.hasLayer(beaconData.marker)) {
                    map.removeLayer(beaconData.marker);
                }
                if (beaconData.circle && map.hasLayer(beaconData.circle)) {
                    map.removeLayer(beaconData.circle);
                }
            } catch (e) {
                console.warn('Error removing beacon:', e);
            }
        });
        beaconMarkers = {};
        
        // Add new beacon markers with range circles (only for current floor)
        filteredBeacons.forEach(beacon => {
            try {
                // Try to get position from various possible structures
                let lat, lon;
                
                // First check for gps object: { gps: { lat, lon, altitude_m } }
                if (beacon.gps && typeof beacon.gps === 'object') {
                    if (beacon.gps.lat !== undefined && beacon.gps.lon !== undefined) {
                        lat = parseFloat(beacon.gps.lat);
                        lon = parseFloat(beacon.gps.lon);
                    }
                } else if (beacon.position) {
                    if (beacon.position.gps && Array.isArray(beacon.position.gps)) {
                        [lat, lon] = beacon.position.gps;
                    } else if (beacon.position.gps && typeof beacon.position.gps === 'object') {
                        lat = parseFloat(beacon.position.gps.lat);
                        lon = parseFloat(beacon.position.gps.lon);
                    } else if (beacon.position.lat !== undefined && beacon.position.lon !== undefined) {
                        lat = parseFloat(beacon.position.lat);
                        lon = parseFloat(beacon.position.lon);
                    } else if (beacon.position.x !== undefined && beacon.position.y !== undefined && cords) {
                        // Convert local coordinates to GPS
                        [lat, lon] = convertLocalToGPS(beacon.position.x, beacon.position.y);
                    }
                } else if (beacon.lat !== undefined && beacon.lon !== undefined) {
                    lat = parseFloat(beacon.lat);
                    lon = parseFloat(beacon.lon);
                } else if (beacon.x !== undefined && beacon.y !== undefined && cords) {
                    // Convert local coordinates to GPS
                    [lat, lon] = convertLocalToGPS(beacon.x, beacon.y);
                }
                
                if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
                    console.warn('Beacon without valid position:', beacon);
                    console.warn('Beacon data structure:', JSON.stringify(beacon, null, 2));
                    return;
                }
                
                console.log(`Adding beacon ${beacon.id || 'unknown'} at lat=${lat}, lon=${lon}`);
                
                // Determine beacon type/color
                const beaconType = beacon.type || beacon.beacon_type || 'anchor';
                const isEntry = beaconType === 'entry' || beacon.name?.toLowerCase().includes('entry');
                const isExit = beaconType === 'exit' || beacon.name?.toLowerCase().includes('exit');
                const isFloor = beaconType === 'floor' || beacon.name?.toLowerCase().includes('floor');
                
                let color = '#17a2b8'; // Default blue for anchor
                let icon = 'fa-anchor';
                
                if (isEntry) {
                    color = '#28a745'; // Green for entry
                    icon = 'fa-sign-in-alt';
                } else if (isExit) {
                    color = '#dc3545'; // Red for exit
                    icon = 'fa-sign-out-alt';
                } else if (isFloor) {
                    color = '#ffc107'; // Yellow for floor marker
                    icon = 'fa-layer-group';
                }
                
                // Get beacon range (default 15m for UWB)
                const range = beacon.range_m || beacon.range || 15;
                
                // Draw range circle (semi-transparent with dashed border)
                const rangeCircle = L.circle([lat, lon], {
                    radius: range,
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.1,
                    weight: 2,
                    opacity: 0.6,
                    dashArray: '10, 5'
                }).addTo(map);
                
                const marker = L.marker([lat, lon], {
                    icon: L.divIcon({
                        className: 'beacon-marker',
                        html: `<div style="background: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
                            <i class="fas ${icon}" style="color: white; font-size: 12px;"></i>
                        </div>`,
                        iconSize: [24, 24],
                        iconAnchor: [12, 12]
                    })
                }).addTo(map);
                
                marker.bindPopup(`
                    <div style="font-size: 13px; padding: 6px; min-width: 150px;">
                        <b style="font-size: 14px; display: block; margin-bottom: 4px;">
                            <i class="fas ${icon}"></i> ${beacon.name || beacon.id || 'Beacon'}
                        </b>
                        <div style="font-size: 12px; color: #6c757d;">
                            <div>ID: ${beacon.id || 'N/A'}</div>
                            <div>Zasięg: ${range}m</div>
                            ${beacon.floor !== undefined ? `<div>Piętro: ${beacon.floor}</div>` : ''}
                            ${beacon.battery_percent !== undefined ? `<div>Bateria: ${beacon.battery_percent}%</div>` : (beacon.battery !== undefined ? `<div>Bateria: ${beacon.battery}%</div>` : '')}
                            ${beacon.signal_quality ? `<div>Jakość sygnału: ${beacon.signal_quality}</div>` : (beacon.signal_strength !== undefined ? `<div>Siła sygnału: ${beacon.signal_strength} dBm</div>` : '')}
                            ${beacon.tags_in_range && Array.isArray(beacon.tags_in_range) ? `<div>Tagi w zasięgu: ${beacon.tags_in_range.length}</div>` : ''}
                        </div>
                    </div>
                `, {
                    className: 'custom-popup-large'
                });
                
                // Store both marker and circle
                const beaconKey = beacon.id || `beacon-${lat}-${lon}`;
                beaconMarkers[beaconKey] = { marker, circle: rangeCircle };
            } catch (error) {
                console.error('Error adding beacon:', error, beacon);
            }
        });
    } catch (error) {
        console.error('Error updating beacons:', error);
    }
}

// Update position cache with current positions
function updatePositionCache(firefighters) {
    const now = Date.now();
    
    firefighters.forEach(ff => {
        if (!ff.id) return;
        
        // Get current position
        let lat, lon, floor;
        const position = ff.position || ff.telemetry?.position || {};
        
        if (position.gps && Array.isArray(position.gps)) {
            [lat, lon] = position.gps;
        } else if (position.lat !== undefined && position.lon !== undefined) {
            lat = parseFloat(position.lat);
            lon = parseFloat(position.lon);
        } else if (position.x !== undefined && position.y !== undefined && cords) {
            [lat, lon] = convertLocalToGPS(position.x, position.y);
        }
        
        floor = position.floor !== undefined ? position.floor : 
                (position.z !== undefined ? Math.round(position.z / 3) : null);
        
        if (lat !== undefined && lon !== undefined && !isNaN(lat) && !isNaN(lon)) {
            // Get current position from cache
            const currentPos = lastPositionCache[ff.id];
            
            // If position changed significantly, save current as previous and update current
            if (currentPos && (Math.abs(currentPos.lat - lat) > 0.0001 || Math.abs(currentPos.lon - lon) > 0.0001)) {
                // Position changed - save current position as previous
                previousPositionCache[ff.id] = {
                    lat: currentPos.lat,
                    lon: currentPos.lon,
                    floor: currentPos.floor,
                    timestamp: currentPos.timestamp,
                    gps: currentPos.gps || [currentPos.lat, currentPos.lon]
                };
                
                // Update current position
                lastPositionCache[ff.id] = {
                    lat, lon, floor,
                    timestamp: now,
                    gps: [lat, lon]
                };
            } else if (!currentPos) {
                // First time storing position - no previous position yet
                lastPositionCache[ff.id] = {
                    lat, lon, floor,
                    timestamp: now,
                    gps: [lat, lon]
                };
            } else {
                // Position hasn't changed, just update timestamp
                lastPositionCache[ff.id].timestamp = now;
            }
        }
        
        // Update heart rate cache
        const vitals = ff.vitals || ff.telemetry || {};
        const heartRate = vitals.heart_rate_bpm || vitals.heart_rate || null;
        
        if (heartRate !== null && !isNaN(heartRate)) {
            if (!heartRateCache[ff.id]) {
                heartRateCache[ff.id] = [];
            }
            
            // Add new heart rate (avoid duplicates if same value within 1 second)
            const lastHR = heartRateCache[ff.id][heartRateCache[ff.id].length - 1];
            if (!lastHR || (now - lastHR.timestamp) > 1000 || Math.abs(lastHR.value - heartRate) > 1) {
                heartRateCache[ff.id].push({
                    value: Math.round(heartRate),
                    timestamp: now
                });
                
                // Keep only last 50 heart rate readings
                if (heartRateCache[ff.id].length > 50) {
                    heartRateCache[ff.id].shift();
                }
                
                // Update chart if this firefighter is selected
                if (selectedFirefighter === ff.id) {
                    updateHeartRateChart(ff.id);
                }
            }
        }
    });
    
    // Don't update visualization here - it will be called from updateFirefightersOnly()
    // to avoid double rendering
}

// Update position history visualization from cache
function updatePositionHistoryFromCache() {
    if (!map) {
        console.warn('Map not available for history visualization');
        return;
    }
    
    if (!showHistory) {
        // Remove all last position markers if history is disabled
        Object.values(positionHistoryLayers).forEach(layer => {
            try {
                if (map.hasLayer(layer)) {
                    map.removeLayer(layer);
                }
            } catch (e) {
                console.warn('Error removing last position marker:', e);
            }
        });
        positionHistoryLayers = {};
        return;
    }
    
    // Remove old last position markers
    Object.values(positionHistoryLayers).forEach(layer => {
        try {
            if (map.hasLayer(layer)) {
                map.removeLayer(layer);
            }
        } catch (e) {
            console.warn('Error removing last position marker:', e);
        }
    });
    positionHistoryLayers = {};
    
    // Draw previous position for each firefighter (as gray dot)
    // Also check current positions - if no previous, use current as "last" (but offset slightly to avoid overlap)
    let dotsDrawn = 0;
    let dotsSkipped = 0;
    
    // First, draw previous positions
    Object.entries(previousPositionCache).forEach(([ffId, prevPos]) => {
        if (!prevPos || !prevPos.lat || !prevPos.lon) {
            dotsSkipped++;
            return;
        }
        
        try {
            // Get GPS coordinates
            let lat, lon, floor;
            if (prevPos.gps && Array.isArray(prevPos.gps)) {
                [lat, lon] = prevPos.gps;
                floor = prevPos.floor;
            } else if (prevPos.lat !== undefined && prevPos.lon !== undefined) {
                lat = parseFloat(prevPos.lat);
                lon = parseFloat(prevPos.lon);
                floor = prevPos.floor;
            } else {
                dotsSkipped++;
                return;
            }
            
            if (isNaN(lat) || isNaN(lon)) {
                dotsSkipped++;
                return;
            }
            
            // Check if position is on current floor (but be more lenient - show if floor is null/undefined)
            if (floor !== undefined && floor !== null) {
                const floorMatch = floor === currentFloor || floor === buildingData?.floors?.[currentFloor]?.number;
                if (!floorMatch) {
                    dotsSkipped++;
                    return; // Skip if not on current floor
                }
            }
            // If floor is null/undefined, show it anyway (might be valid data)
            
            // Draw small gray dot for previous position
            const dot = L.circleMarker([lat, lon], {
                radius: 3,
                fillColor: '#6c757d',
                color: '#495057',
                weight: 1,
                opacity: 0.7,
                fillOpacity: 0.5
            });
            
            dot.addTo(map);
            positionHistoryLayers[ffId] = dot;
            dotsDrawn++;
        } catch (error) {
            console.error(`Error drawing previous position for ${ffId}:`, error);
            dotsSkipped++;
        }
    });
    
    // Also check current positions - if we have a current position but no previous, 
    // and it's been there for a while, show it as a dot (slightly offset to avoid overlap with marker)
    Object.entries(lastPositionCache).forEach(([ffId, currentPos]) => {
        // Skip if we already have a dot for this firefighter
        if (positionHistoryLayers[ffId]) {
            return;
        }
        
        // Skip if we have a previous position (already drawn above)
        if (previousPositionCache[ffId]) {
            return;
        }
        
        // Only show if position is old enough (at least 3 seconds old)
        const age = Date.now() - (currentPos.timestamp || 0);
        if (age < 3000) {
            return; // Too recent, don't show yet
        }
        
        if (!currentPos || !currentPos.lat || !currentPos.lon) {
            return;
        }
        
        try {
            // Get GPS coordinates
            let lat, lon, floor;
            if (currentPos.gps && Array.isArray(currentPos.gps)) {
                [lat, lon] = currentPos.gps;
                floor = currentPos.floor;
            } else if (currentPos.lat !== undefined && currentPos.lon !== undefined) {
                lat = parseFloat(currentPos.lat);
                lon = parseFloat(currentPos.lon);
                floor = currentPos.floor;
            } else {
                return;
            }
            
            if (isNaN(lat) || isNaN(lon)) {
                return;
            }
            
            // Check if position is on current floor
            if (floor !== undefined && floor !== null) {
                const floorMatch = floor === currentFloor || floor === buildingData?.floors?.[currentFloor]?.number;
                if (!floorMatch) {
                    return; // Skip if not on current floor
                }
            }
            
            // Draw small gray dot for current position (slightly offset to avoid overlap)
            const dot = L.circleMarker([lat, lon], {
                radius: 3,
                fillColor: '#6c757d',
                color: '#495057',
                weight: 1,
                opacity: 0.7,
                fillOpacity: 0.5
            });
            
            dot.addTo(map);
            positionHistoryLayers[ffId] = dot;
            dotsDrawn++;
        } catch (error) {
            console.error(`Error drawing current position as dot for ${ffId}:`, error);
        }
    });
    
    console.log(`Drew ${dotsDrawn} position dots (skipped ${dotsSkipped}) - previous: ${Object.keys(previousPositionCache).length}, current: ${Object.keys(lastPositionCache).length}`);
}

// Update last position (simplified - just store last position)
async function updatePositionHistory(firefighters) {
    // Update cache first (if not already done)
    updatePositionCache(firefighters);
    
    // Update visualization from cache
    updatePositionHistoryFromCache();
}

// Separate update functions for firefighters and alerts
async function updateFirefightersOnly() {
    let firefighters = [];
    let firefightersData = null;
    
    try {
        console.log('Starting to fetch firefighters...');
        firefightersData = await api.getFirefighters();
        console.log('Firefighters data received:', firefightersData ? (Array.isArray(firefightersData) ? `${firefightersData.length} items` : typeof firefightersData) : 'null');
        
        // Handle different response formats
        if (Array.isArray(firefightersData)) {
            firefighters = firefightersData;
            console.log(`Using ${firefighters.length} firefighters from array`);
        } else if (firefightersData && typeof firefightersData === 'object') {
            firefighters = firefightersData.firefighters || firefightersData.data || [];
            console.log(`Using ${firefighters.length} firefighters from object`);
        } else {
            console.warn('Firefighters data is not in expected format:', typeof firefightersData);
            firefighters = [];
        }
    } catch (error) {
        console.error('Error fetching firefighters:', error.name, error.message);
        console.error('Error stack:', error.stack);
        firefighters = [];
    }
    
    // Ensure firefighters is an array
    if (!Array.isArray(firefighters)) {
        console.warn('Firefighters is not an array:', typeof firefighters, firefighters);
        firefighters = [];
    }
    
    // Filter out firefighters without proper data
    const beforeFilter = firefighters.length;
    firefighters = firefighters.filter(ff => {
        const hasId = ff && ff.id;
        const hasName = ff && (ff.name || ff.getName);
        const result = hasId && hasName;
        if (!result) {
            console.warn('Filtering out firefighter without id/name:', {
                id: ff?.id,
                name: ff?.name,
                hasId: !!hasId,
                hasName: !!hasName
            });
        }
        return result;
    });
    console.log(`Filtered firefighters: ${beforeFilter} -> ${firefighters.length}`);
    
    // Log sample firefighter data structure
    if (firefighters.length > 0) {
        console.log('Sample firefighter data structure:', {
            id: firefighters[0].id,
            name: firefighters[0].name,
            rank: firefighters[0].rank,
            position: firefighters[0].position,
            telemetry: firefighters[0].telemetry ? Object.keys(firefighters[0].telemetry) : null
        });
    } else {
        console.warn('No firefighters after filtering!');
    }
    
    // Get alerts for mapping (but don't update alerts display here)
    // We still need alerts to highlight firefighters with alerts on the map
    // But we don't update the alerts display panel here - that's done separately
    let alerts = [];
    try {
        alerts = await api.getAlerts(true);
        if (!Array.isArray(alerts)) {
            alerts = [];
        }
    } catch (error) {
        // Silently fail - alerts will be updated separately
        alerts = [];
    }
    
    // Create alerts map by firefighter ID
    const alertsByFirefighter = {};
    if (Array.isArray(alerts) && alerts.length > 0) {
        alerts.forEach(alert => {
            const ffId = alert.firefighter_id || alert.firefighterId || alert.firefighter || 
                       (alert.firefighter && alert.firefighter.id) || 
                       (alert.tag_id && alert.tag_id.startsWith('FF-') ? alert.tag_id : null);
            if (ffId) {
                if (!alertsByFirefighter[ffId]) {
                    alertsByFirefighter[ffId] = [];
                }
                alertsByFirefighter[ffId].push(alert);
            }
        });
    }
    
    console.log(`=== UPDATING UI WITH ${firefighters.length} FIREFIGHTERS ===`);
    updateFirefightersList(firefighters, alertsByFirefighter);
    updateFirefightersOnMap(firefighters, alertsByFirefighter);
    console.log('=== UI UPDATE COMPLETED ===');
    
    // Always update position cache (needed for heart rate chart and history)
    updatePositionCache(firefighters);
    
    // Update beacons display based on toggle state
    const toggleBeacons = document.getElementById('toggle-beacons');
    if (map) {
        if (toggleBeacons && toggleBeacons.checked) {
            console.log('Beacons toggle is enabled, updating beacons...');
            updateBeaconsDisplay();
        } else {
            // If toggle is off, make sure beacons are removed
            if (Object.keys(beaconMarkers).length > 0) {
                console.log('Beacons toggle is disabled, removing beacons...');
                Object.values(beaconMarkers).forEach(beaconData => {
                    try {
                        if (beaconData.marker && map.hasLayer(beaconData.marker)) {
                            map.removeLayer(beaconData.marker);
                        }
                        if (beaconData.circle && map.hasLayer(beaconData.circle)) {
                            map.removeLayer(beaconData.circle);
                        }
                    } catch (e) {
                        console.warn('Error removing beacon:', e);
                    }
                });
                beaconMarkers = {};
            }
        }
    }
    
    // Update position history if enabled
    if (showHistory && map) {
        // Update cache first (already done above), then visualize immediately
        updatePositionHistoryFromCache();
    } else if (!showHistory && map) {
        // If history is disabled, make sure dots are removed
        Object.values(positionHistoryLayers).forEach(layer => {
            try {
                if (map.hasLayer(layer)) {
                    map.removeLayer(layer);
                }
            } catch (e) {
                console.warn('Error removing last position marker:', e);
            }
        });
        positionHistoryLayers = {};
    }
}

function startDataUpdates() {
    // Initial load
    updateFirefightersOnly();
    updateAlertsOnly();
    
    // Update firefighters every 1.5 seconds
    setInterval(updateFirefightersOnly, 1500);
    
    // Update alerts every 5 seconds
    setInterval(updateAlertsOnly, 5000);
    
    // Setup map control toggles
    const toggleHistory = document.getElementById('toggle-history');
    const toggleBeacons = document.getElementById('toggle-beacons');
    
    if (toggleHistory) {
        toggleHistory.addEventListener('change', (e) => {
            showHistory = e.target.checked;
            console.log('History toggle changed to:', showHistory);
            if (!showHistory) {
                // Remove all history layers
                if (map) {
                    Object.values(positionHistoryLayers).forEach(layer => {
                        try {
                            if (layer instanceof L.LayerGroup) {
                                layer.clearLayers();
                                if (map.hasLayer(layer)) {
                                    map.removeLayer(layer);
                                }
                            } else if (map.hasLayer(layer)) {
                                map.removeLayer(layer);
                            }
                        } catch (e) {
                            console.warn('Error removing history layer:', e);
                        }
                    });
                }
                positionHistoryLayers = {};
            } else {
                // Show history from cache immediately
                if (map) {
                    updatePositionHistoryFromCache();
                }
                // Also trigger update to fetch from API
                updateFirefightersOnly();
            }
        });
    }
    
    if (toggleBeacons) {
        toggleBeacons.addEventListener('change', (e) => {
            console.log('Beacons toggle changed to:', e.target.checked);
            if (e.target.checked) {
                if (map) {
                    updateBeaconsDisplay();
                }
            } else {
                // Remove all beacon markers and circles
                if (map) {
                    Object.values(beaconMarkers).forEach(beaconData => {
                        try {
                            if (beaconData.marker && map.hasLayer(beaconData.marker)) {
                                map.removeLayer(beaconData.marker);
                            }
                            if (beaconData.circle && map.hasLayer(beaconData.circle)) {
                                map.removeLayer(beaconData.circle);
                            }
                        } catch (e) {
                            console.warn('Error removing beacon:', e);
                        }
                    });
                }
                beaconMarkers = {};
            }
        });
    }
}

