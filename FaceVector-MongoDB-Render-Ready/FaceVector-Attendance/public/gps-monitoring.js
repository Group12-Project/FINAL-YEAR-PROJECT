'use strict';
document.addEventListener('DOMContentLoaded', () => { startGpsPage(); });

async function startGpsPage() {
  if (!await requireRole(['admin', 'teacher', 'guard'])) return;
  if (!window.L) return notice('The map library did not load. Check the network connection and reload.');
  const map = L.map('map').setView([22.5726, 88.3639], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(map);
  const locate = el('locate'), stop = el('stopLocate'), status = el('geofenceStatus'), coords = el('coords');
  let watchId = null, marker = null, accuracyCircle = null, campusCircle = null;
  try {
    const config = await api('/geofence');
    if (config.configured) {
      const zone = config.geofence;
      campusCircle = L.circle([zone.lat, zone.lng], { radius: zone.radiusM, color: '#247b64', fillOpacity: 0.08 }).addTo(map);
      campusCircle.bindPopup(`${esc(zone.name || 'Campus')} · ${zone.radiusM} m`);
      map.fitBounds(campusCircle.getBounds(), { padding: [24, 24] });
      status.textContent = `Campus boundary: ${zone.name || 'Campus'}, radius ${zone.radiusM} m${config.required ? ' (required for attendance)' : ''}.`;
    } else status.textContent = 'No campus boundary is configured. Your live coordinates will still be displayed.';
    locate.onclick = () => {
      if (!navigator.geolocation) return notice('Geolocation is not supported by this browser.');
      if (watchId !== null) return;
      notice('Requesting location permission…'); locate.disabled = true; stop.disabled = false;
      watchId = navigator.geolocation.watchPosition(updateLocation, locationError, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    };
    stop.onclick = stopLiveLocation;
  } catch (error) { status.textContent = 'Could not load the campus boundary.'; notice(error.message); }

  async function updateLocation(position) {
    const point = { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy };
    if (!marker) marker = L.marker([point.lat, point.lng]).addTo(map);
    else marker.setLatLng([point.lat, point.lng]);
    if (!accuracyCircle) accuracyCircle = L.circle([point.lat, point.lng], { radius: point.accuracy, color: '#456c8a', fillOpacity: 0.08 }).addTo(map);
    else accuracyCircle.setLatLng([point.lat, point.lng]).setRadius(point.accuracy);
    map.setView([point.lat, point.lng], Math.max(map.getZoom(), 16));
    coords.textContent = `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)} · accuracy ${Math.round(point.accuracy)} m · updated ${new Date(position.timestamp).toLocaleTimeString()}`;
    try {
      const result = await api('/geofence/check', { method: 'POST', body: JSON.stringify({ coordinates: point }) });
      const labels = { inside: 'Inside campus boundary', outside: 'Outside campus boundary', uncertain: 'Location overlaps boundary; accuracy is not enough to decide', 'low-accuracy': 'GPS fix is too imprecise', 'not-configured': 'No campus geofence configured' };
      status.textContent = `${labels[result.status] || result.status}${result.distanceM === null ? '' : ` · ${result.distanceM} m from campus centre`}`;
      marker.bindPopup(`${labels[result.status] || result.status} · ±${Math.round(point.accuracy)} m`);
    } catch (error) { notice(error.message); }
    locate.disabled = false;
    notice('Live location is active on this device.');
  }

  function locationError(error) {
    const messages = { 1: 'Location permission was denied. Enable it in browser site settings to retry.', 2: 'The device could not determine your location.', 3: 'Location request timed out. Move to an area with a better GPS signal.' };
    notice(messages[error.code] || 'Could not read the device location.');
    stopLiveLocation();
  }
  function stopLiveLocation() {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    watchId = null; locate.disabled = false; stop.disabled = true;
    notice('Live location stopped.');
  }
  window.addEventListener('pagehide', () => { if (watchId !== null) navigator.geolocation.clearWatch(watchId); });
}
