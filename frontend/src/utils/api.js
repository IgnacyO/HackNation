const API_BASE_URL = '/api';

export const api = {
  async getFirefighters() {
    const response = await fetch(`${API_BASE_URL}/firefighters`);
    if (!response.ok) throw new Error('Failed to fetch firefighters');
    return response.json();
  },

  async getFirefighterPositions(firefighterId, limit = 100) {
    const response = await fetch(`${API_BASE_URL}/firefighters/${firefighterId}/positions?limit=${limit}`);
    if (!response.ok) throw new Error('Failed to fetch positions');
    return response.json();
  },

  async getFirefighterVitals(firefighterId, limit = 100) {
    const response = await fetch(`${API_BASE_URL}/firefighters/${firefighterId}/vitals?limit=${limit}`);
    if (!response.ok) throw new Error('Failed to fetch vitals');
    return response.json();
  },

  async getAlerts() {
    const response = await fetch(`${API_BASE_URL}/alerts`);
    if (!response.ok) throw new Error('Failed to fetch alerts');
    return response.json();
  },

  async getBeacons(floor = null) {
    const url = floor !== null 
      ? `${API_BASE_URL}/beacons?floor=${floor}`
      : `${API_BASE_URL}/beacons`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch beacons');
    return response.json();
  },

  async getBuilding() {
    const response = await fetch(`${API_BASE_URL}/building`);
    if (!response.ok) throw new Error('Failed to fetch building');
    return response.json();
  },

  async getFirefighterBeacon(firefighterId) {
    const response = await fetch(`${API_BASE_URL}/firefighters/${firefighterId}/beacon`);
    if (!response.ok) throw new Error('Failed to fetch firefighter beacon');
    return response.json();
  },

  async getBeaconFirefighters(beaconId) {
    const response = await fetch(`${API_BASE_URL}/beacons/${beaconId}/firefighters`);
    if (!response.ok) throw new Error('Failed to fetch beacon firefighters');
    return response.json();
  },

  async getAllFirefighters() {
    const response = await fetch(`${API_BASE_URL}/firefighters/all`);
    if (!response.ok) throw new Error('Failed to fetch all firefighters');
    return response.json();
  },

  async getAllAlerts(severity = null, acknowledged = false) {
    let url = `${API_BASE_URL}/alerts/all?acknowledged=${acknowledged}`;
    if (severity) {
      url += `&severity=${severity}`;
    }
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch all alerts');
    return response.json();
  },

  async getBeacon(beaconId) {
    const response = await fetch(`${API_BASE_URL}/beacons/${beaconId}`);
    if (!response.ok) throw new Error('Failed to fetch beacon');
    return response.json();
  }
};

