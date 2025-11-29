/* FINAL script.js
   - robust fetch of GeoJSON (tries data/ and root)
   - prechecks primary tile provider; silently falls back to OSM if primary fails
   - detects metro & bus stops by scanning ALL property values for substrings
   - finds pincode polygon, centroid, nearest metro & nearest bus stop
   - draws centroid, markers, connecting lines
   - clear console logging for debugging
*/

// ---------------------- simple log wrappers ----------------------
const log = (...args) => console.log("%c[MAP]", "color:#0b6;", ...args);
const warn = (...args) => console.warn("%c[MAP]", "color:#d96;", ...args);
const err = (...args) => console.error("%c[MAP]", "color:#e33;", ...args);

// ---------------------- banner helper ----------------------
function showBanner(message, isError = true, persist = false) {
  const banner = document.getElementById('map-error-banner');
  if (!banner) return;
  banner.style.background = isError ? 'rgba(200,40,40,0.95)' : 'rgba(20,120,20,0.95)';
  banner.textContent = message;
  banner.style.display = 'block';
  if (!persist) {
    setTimeout(() => { banner.style.display = 'none'; }, 3500);
  }
}

// ---------------------- Tile config & precheck ----------------------
const TILE_PRIMARY = 'https://tiles-v2.latlong.in/blue_essence/{z}/{x}/{y}.png';
const TILE_FALLBACK = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

// safe map variable
let map = null;

// create map container once DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initMapAndLoadData();
});

async function initMapAndLoadData() {
  try {
    // init map
    map = L.map('map', { center: [28.6139, 77.2090], zoom: 11 });

    // precheck primary by attempting a fetch to a sample tile.
    // If it succeeds (status 200), use primary. Otherwise use OSM fallback silently.
    const samplePrimary = TILE_PRIMARY.replace('{z}', '0').replace('{x}', '0').replace('{y}', '0');

    let usePrimary = false;
    try {
      const r = await fetch(samplePrimary, { method: 'GET' });
      usePrimary = r.ok;
      log("Primary tile precheck fetch result:", r.status, "usePrimary=", usePrimary);
    } catch (e) {
      // likely CORS or network error -> will fallback silently
      warn("Primary tile precheck fetch failed (network/CORS). Will fallback silently.", e);
      usePrimary = false;
    }

    if (usePrimary) {
      L.tileLayer(TILE_PRIMARY, { attribution: '&copy; Latlong' }).addTo(map);
      log("Using primary tiles (precheck OK).");
    } else {
      L.tileLayer(TILE_FALLBACK, { attribution: '&copy; OpenStreetMap' }).addTo(map);
      log("Using fallback OSM tiles (primary precheck failed).");
    }

    // defensive: listen for tileerror and log, but don't show persistent banner
    map.eachLayer(layer => {
      if (layer instanceof L.TileLayer) {
        layer.on('tileerror', (e) => {
          warn("Tile error on layer:", layer._url || layer.options?.urlTemplate || "tilelayer", e);
        });
      }
    });

    // now load GeoJSON
    await loadAllDataDefensive();
  } catch (e) {
    err("initMapAndLoadData failed:", e);
    showBanner("Map initialization failed — check console.", true, true);
  }
}

// ---------------------- GEOJSON path helpers ----------------------
const PATH_CANDIDATES = (filename) => [`data/${filename}`, filename];

async function tryFetchAny(filename) {
  const candidates = PATH_CANDIDATES(filename);
  for (const p of candidates) {
    try {
      log("Attempting fetch:", p);
      const res = await fetch(p);
      if (!res.ok) {
        warn(`Fetch returned ${res.status} for ${p}`);
        continue;
      }
      const json = await res.json();
      log("Loaded:", p);
      return { json, path: p };
    } catch (e) {
      warn("Fetch error for", p, e);
    }
  }
  return null;
}

// ---------------------- global layers & arrays ----------------------
let delhiAreasLayer = null;
let delhiPincodeLayer = null;
let delhiCityLayer = null;
let delhiPointsLayer = null;

let metroStations = []; // {name, lat, lng, props}
let busStops = [];      // {name, lat, lng, props}

// ---------------------- loadAllData (defensive) ----------------------
async function loadAllDataDefensive() {
  try {
    showBanner("Loading GeoJSON files...", false, false);

    const files = {
      areas: "delhi_area.geojson",
      pincodes: "delhi_pincode.geojson",
      city: "delhi_city.geojson",
      points: "delhi_points.geojson"
    };

    const results = {};
    for (const key of Object.keys(files)) {
      const r = await tryFetchAny(files[key]);
      if (!r) throw new Error(`Failed to load ${files[key]}. Tried: ${PATH_CANDIDATES(files[key]).join(', ')}`);
      results[key] = r;
    }

    // add polygon layers (if present)
    if (results.areas) {
      delhiAreasLayer = L.geoJSON(results.areas.json, { style: { color: "orange", weight: 1, fillOpacity: 0.12 } }).addTo(map);
      log("Added areas layer from", results.areas.path);
    }
    if (results.pincodes) {
      delhiPincodeLayer = L.geoJSON(results.pincodes.json, { style: { color: "blue", weight: 1, fillOpacity: 0.10 } }).addTo(map);
      log("Added pincode layer from", results.pincodes.path);
    }
    if (results.city) {
      delhiCityLayer = L.geoJSON(results.city.json, { style: { color: "purple", weight: 2, fillOpacity: 0.03 } }).addTo(map);
      log("Added city layer from", results.city.path);
    }

    // points layer (show popups)
    if (results.points) {
      delhiPointsLayer = L.geoJSON(results.points.json, {
        pointToLayer: (feature, latlng) => L.circleMarker(latlng, { radius: 4, color: '#d9534f', fillOpacity: 0.9 }),
        onEachFeature: (feature, layer) => {
          const props = feature.properties || {};
          const pretty = Object.entries(props).map(([k,v]) => `<b>${k}:</b> ${v}`).join("<br>");
          layer.bindPopup(pretty);
        }
      }).addTo(map);
      log("Added points layer from", results.points.path);
    }

    // detect metro & bus stops by scanning ALL property values (case-insensitive)
    metroStations = [];
    busStops = [];
    const pointsJSON = results.points.json;
    if (pointsJSON && Array.isArray(pointsJSON.features)) {
      pointsJSON.features.forEach(f => {
        try {
          const props = f.properties || {};
          const geom = f.geometry || {};
          if (!geom || geom.type !== "Point" || !Array.isArray(geom.coordinates)) return;
          const [lng, lat] = geom.coordinates;
          const searchText = Object.values(props).join(" ").toLowerCase();

          if (searchText.includes("metro")) {
            metroStations.push({
              name: props.name || props.label || props.station || "Unnamed Metro",
              lat, lng, props
            });
          }
          if (searchText.includes("bus")) {
            busStops.push({
              name: props.name || props.label || props.stop || "Unnamed Bus Stop",
              lat, lng, props
            });
          }
        } catch (e) {
          warn("Error scanning point feature:", e);
        }
      });
    } else {
      warn("Points GeoJSON missing features array or invalid.");
    }

    log("Detected metroStations:", metroStations.length);
    log("Detected busStops:", busStops.length);

    showBanner("All data loaded — ready.", false, false);
  } catch (e) {
    err("loadAllDataDefensive error:", e);
    showBanner("Failed to load some data — check console.", true, true);
  }
}

// ---------------------- find pincode polygon ----------------------
function findPolygonForPincode(pincode) {
  if (!delhiPincodeLayer) {
    warn("Pincode layer not loaded yet.");
    return null;
  }
  let found = null;
  delhiPincodeLayer.eachLayer(layer => {
    try {
      const props = (layer.feature && layer.feature.properties) ? layer.feature.properties : {};
      for (const key in props) {
        if (!Object.prototype.hasOwnProperty.call(props, key)) continue;
        const v = String(props[key]).trim();
        if (v === String(pincode) || v.includes(String(pincode))) {
          found = layer;
          return;
        }
      }
    } catch (e) {
      warn("Error inspecting pincode feature:", e);
    }
  });
  return found;
}

// ---------------------- distance & nearest helpers ----------------------
function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = v => v * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function getNearest(list, lat, lng) {
  if (!list || list.length === 0) return null;
  let best = null, min = Infinity;
  list.forEach(s => {
    const d = distanceKm(lat, lng, s.lat, s.lng);
    if (d < min) { min = d; best = s; }
  });
  return best ? { station: best, distance_km: min } : null;
}

// ---------------------- visualization state ----------------------
let lastLayers = [];
function clearLast() {
  lastLayers.forEach(l => { try { if (map.hasLayer(l)) map.removeLayer(l); } catch(e){} });
  lastLayers = [];
}

// ---------------------- main analyze function ----------------------
async function analyzeUserPincode(pincode) {
  try {
    if (!delhiPincodeLayer) {
      alert("Data still loading — please wait a moment and try again.");
      return;
    }
    const polygonLayer = findPolygonForPincode(pincode);
    if (!polygonLayer) {
      alert("Pincode not found in dataset (check dataset or try another pincode).");
      return;
    }

    map.fitBounds(polygonLayer.getBounds(), { padding: [20,20] });

    // centroid via turf
    let centroid;
    try {
      centroid = turf.centroid(polygonLayer.toGeoJSON());
    } catch (e) {
      err("Turf centroid error:", e);
      alert("Failed to compute polygon centroid.");
      return;
    }
    const [lng, lat] = centroid.geometry.coordinates;

    const nearestMetro = getNearest(metroStations, lat, lng);
    const nearestBus = getNearest(busStops, lat, lng);

    // clear previous visuals
    clearLast();

    // centroid marker
    const centM = L.circleMarker([lat, lng], { radius:7, color:'#0a9396', fillColor:'#94d2bd', fillOpacity:0.9 }).addTo(map);
    centM.bindPopup(`Centroid for pincode ${pincode}`).openPopup();
    lastLayers.push(centM);

    let metroText = "No metro detected.";
    if (nearestMetro) {
      const m = nearestMetro.station;
      const mMarker = L.marker([m.lat, m.lng]).addTo(map).bindPopup(`<b>Metro</b><br>${m.name}`);
      const mLine = L.polyline([[lat,lng],[m.lat,m.lng]], { color:'#ee9b00', weight:3, dashArray:'6' }).addTo(map);
      lastLayers.push(mMarker, mLine);
      metroText = `${m.name} (${nearestMetro.distance_km.toFixed(2)} km)`;
    }

    let busText = "No bus stop detected.";
    if (nearestBus) {
      const b = nearestBus.station;
      const bMarker = L.marker([b.lat, b.lng]).addTo(map).bindPopup(`<b>Bus</b><br>${b.name}`);
      const bLine = L.polyline([[lat,lng],[b.lat,b.lng]], { color:'#005f73', weight:3, dashArray:'5' }).addTo(map);
      lastLayers.push(bMarker, bLine);
      busText = `${b.name} (${nearestBus.distance_km.toFixed(2)} km)`;
    }

    alert(`Pincode: ${pincode}\nNearest Metro: ${metroText}\nNearest Bus Stop: ${busText}`);
    log("analyze result:", { pincode, centroid: {lat, lng}, nearestMetro, nearestBus });
  } catch (e) {
    err("analyzeUserPincode failed:", e);
    alert("An unexpected error occurred — check console.");
  }
}

// ---------------------- button hook ----------------------
window.findLocation = () => {
  const p = prompt("Enter a Delhi pincode:");
  if (!p) return;
  analyzeUserPincode(p.trim());
};
