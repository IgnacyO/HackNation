// API Client for Nieśmiertelnik API - uses Flask proxy to avoid CORS
const API_BASE_URL = '/api'; // Use Flask proxy instead of direct API

class NieśmiertelnikAPI {
    constructor() {
        this.baseUrl = API_BASE_URL;
    }

    async getHealth() {
        try {
            const response = await fetch(`${this.baseUrl}/health`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching health:', error);
            return null;
        }
    }

    async getBuilding() {
        try {
            const response = await fetch(`${this.baseUrl}/building`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching building:', error);
            return null;
        }
    }

    async getFirefighters() {
        try {
            // Build full URL - use relative path for same-origin requests
            const url = `${this.baseUrl}/firefighters`;
            const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
            console.log('=== FETCHING FIREFIGHTERS ===');
            console.log('Base URL:', this.baseUrl);
            console.log('Relative URL:', url);
            console.log('Full URL:', fullUrl);
            console.log('Window location:', window.location.href);
            
            // Add timeout to fetch
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
            
            console.log('Starting fetch request...');
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                cache: 'no-cache',
                signal: controller.signal,
                credentials: 'same-origin' // Include cookies for same-origin requests
            });
            
            clearTimeout(timeoutId);
            console.log('Fetch completed!');
            console.log('Firefighters response status:', response.status, response.statusText);
            console.log('Response headers:', Object.fromEntries(response.headers.entries()));
            
            if (!response.ok) {
                // Try to get error message from response
                let errorText = '';
                try {
                    errorText = await response.text();
                    console.error('Firefighters API error response:', errorText.substring(0, 200));
                } catch (e) {
                    console.error('Could not read error response');
                }
                // Don't throw - return empty array instead
                console.warn(`Firefighters API returned status ${response.status}: ${response.statusText}`);
                return [];
            }
            
            const contentType = response.headers.get('content-type') || '';
            console.log('Firefighters response content-type:', contentType);
            
            if (!contentType.includes('application/json')) {
                console.warn('Firefighters API returned non-JSON response:', contentType);
                const text = await response.text();
                console.warn('Response body:', text.substring(0, 200));
                // Try to parse as JSON anyway
                try {
                    const data = JSON.parse(text);
                    if (Array.isArray(data)) {
                        return data;
                    } else if (data && typeof data === 'object') {
                        return data.firefighters || data.data || [];
                    }
                } catch (e) {
                    console.error('Could not parse response as JSON:', e);
                }
                return [];
            }
            
            const data = await response.json();
            console.log('Firefighters data received:', Array.isArray(data) ? `${data.length} items` : typeof data);
            
            // Handle different response formats
            if (Array.isArray(data)) {
                return data;
            } else if (data && typeof data === 'object') {
                const firefighters = data.firefighters || data.data || [];
                if (Array.isArray(firefighters)) {
                    return firefighters;
                }
            }
            return [];
        } catch (error) {
            // Network errors, CORS errors, timeout, etc.
            console.error('=== FIREFIGHTERS FETCH ERROR ===');
            console.error('Error name:', error.name);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            console.error('Full error object:', error);
            
            if (error.name === 'AbortError') {
                console.error('Firefighters request timeout after 15 seconds');
            } else if (error.name === 'TypeError') {
                if (error.message.includes('fetch')) {
                    console.error('Network error - cannot reach server. Is Flask running?');
                    console.error('Tried to fetch from:', url);
                    console.error('Make sure Flask is running on http://127.0.0.1:5000');
                } else if (error.message.includes('Failed to fetch')) {
                    console.error('Failed to fetch - possible CORS issue or server not reachable');
                    console.error('Tried to fetch from:', url);
                } else {
                    console.error('TypeError:', error.message);
                }
            } else {
                console.error('Unknown error type:', error.name, error.message);
            }
            console.error('=== END ERROR ===');
            // Return empty array instead of throwing
            return [];
        }
    }

    async getFirefighter(id) {
        try {
            const response = await fetch(`${this.baseUrl}/firefighters/${id}`);
            if (!response.ok) throw new Error('Network response was not ok');
            return await response.json();
        } catch (error) {
            console.error(`Error fetching firefighter ${id}:`, error);
            return null;
        }
    }

    async getFirefighterHistory(id) {
        try {
            const response = await fetch(`${this.baseUrl}/firefighters/${id}/history`);
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            // Handle different response formats
            if (Array.isArray(data)) {
                return data;
            } else if (data && typeof data === 'object') {
                return data.history || data.data || [];
            }
            return [];
        } catch (error) {
            console.error(`Error fetching firefighter history ${id}:`, error);
            return [];
        }
    }

    async getBeacons() {
        try {
            const response = await fetch(`${this.baseUrl}/beacons`);
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            
            // Handle different response formats
            if (Array.isArray(data)) {
                return data;
            } else if (data && typeof data === 'object') {
                // Check for beacons_status format: { type: "beacons_status", beacons: [...] }
                if (data.beacons && Array.isArray(data.beacons)) {
                    return data.beacons;
                }
                // Check for other possible formats
                return data.data || [];
            }
            return [];
        } catch (error) {
            console.error('Error fetching beacons:', error);
            return [];
        }
    }

    async getBeacon(id) {
        try {
            const response = await fetch(`${this.baseUrl}/beacons/${id}`);
            if (!response.ok) throw new Error('Network response was not ok');
            return await response.json();
        } catch (error) {
            console.error(`Error fetching beacon ${id}:`, error);
            return null;
        }
    }

    async getAlerts(active = true) {
        try {
            const url = `${this.baseUrl}/alerts?active=${active}`;
            console.log('Fetching alerts from:', url);
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                cache: 'no-cache'
            });
            
            console.log('Alerts response status:', response.status, response.statusText);
            
            if (!response.ok) {
                // Try to get error message from response
                let errorText = '';
                try {
                    errorText = await response.text();
                    console.error('Alerts API error response:', errorText.substring(0, 200));
                } catch (e) {
                    console.error('Could not read error response');
                }
                // Don't throw - return empty array instead
                console.warn(`Alerts API returned status ${response.status}: ${response.statusText}`);
                return [];
            }
            
            const contentType = response.headers.get('content-type') || '';
            console.log('Alerts response content-type:', contentType);
            
            if (!contentType.includes('application/json')) {
                console.warn('Alerts API returned non-JSON response:', contentType);
                const text = await response.text();
                console.warn('Response body:', text.substring(0, 200));
                // Try to parse as JSON anyway
                try {
                    const data = JSON.parse(text);
                    if (Array.isArray(data)) {
                        return data;
                    } else if (data && typeof data === 'object') {
                        return data.alerts || data.data || [];
                    }
                } catch (e) {
                    console.error('Could not parse response as JSON:', e);
                }
                return [];
            }
            
            const data = await response.json();
            console.log('Alerts data received:', Array.isArray(data) ? `${data.length} items` : typeof data);
            
            // Handle different response formats
            if (Array.isArray(data)) {
                return data;
            } else if (data && typeof data === 'object') {
                const alerts = data.alerts || data.data || [];
                if (Array.isArray(alerts)) {
                    return alerts;
                }
            }
            return [];
        } catch (error) {
            // Network errors, CORS errors, etc.
            console.error('Error fetching alerts:', error.name, error.message);
            // Return empty array instead of throwing
            return [];
        }
    }

    async getNIB() {
        try {
            const response = await fetch(`${this.baseUrl}/nib`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching NIB:', error);
            return null;
        }
    }

    async getSCBA() {
        try {
            const response = await fetch(`${this.baseUrl}/scba`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching SCBA:', error);
            return null;
        }
    }

    async getRECCO() {
        try {
            const response = await fetch(`${this.baseUrl}/recco`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching RECCO:', error);
            return null;
        }
    }

    async getWeather() {
        try {
            const response = await fetch(`${this.baseUrl}/weather`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching weather:', error);
            return null;
        }
    }
}

// Export for use in other scripts
const api = new NieśmiertelnikAPI();

