import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as turf from '@turf/turf';
import { MapPin, TrendingUp, Users, Package, Clock, BarChart3, Building2 } from 'lucide-react';

const NCRBusinessAnalyzer = () => {
  const [selectedBusiness, setSelectedBusiness] = useState('');
  const [analysisData, setAnalysisData] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  // geojson state for pincode/points analysis
  const [geoLoaded, setGeoLoaded] = useState(false);
  const [pincodeGeo, setPincodeGeo] = useState(null);
  const [pointsGeo, setPointsGeo] = useState(null);
  const [metroStations, setMetroStations] = useState([]);
  const [busStops, setBusStops] = useState([]);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const analysisDataRef = useRef(null);
  const lastLayersRef = useRef([]);

  // Business categories with their priority weights
  const businessCategories = {
    Grocery: { talent: 0.2, cost: 0.3, procurement: 0.35, timing: 0.15 },
    Restaurant: { talent: 0.35, cost: 0.2, procurement: 0.25, timing: 0.2 },
    Cafe: { talent: 0.3, cost: 0.25, procurement: 0.2, timing: 0.25 },
    'Retail Store': { talent: 0.25, cost: 0.3, procurement: 0.3, timing: 0.15 },
    Supermarket: { talent: 0.2, cost: 0.25, procurement: 0.4, timing: 0.15 },
    Pharmacy: { talent: 0.25, cost: 0.3, procurement: 0.35, timing: 0.1 },
    Gym: { talent: 0.4, cost: 0.25, procurement: 0.15, timing: 0.2 },
    'Fitness Center': { talent: 0.45, cost: 0.25, procurement: 0.1, timing: 0.2 },
    Salon: { talent: 0.4, cost: 0.3, procurement: 0.15, timing: 0.15 },
    Spa: { talent: 0.45, cost: 0.25, procurement: 0.15, timing: 0.15 },
    'Electronics Store': { talent: 0.3, cost: 0.3, procurement: 0.3, timing: 0.1 },
    'Clothing Store': { talent: 0.3, cost: 0.3, procurement: 0.25, timing: 0.15 },
    Bakery: { talent: 0.35, cost: 0.25, procurement: 0.3, timing: 0.1 },
    Bookstore: { talent: 0.25, cost: 0.35, procurement: 0.25, timing: 0.15 },
    'Medical Clinic': { talent: 0.5, cost: 0.25, procurement: 0.15, timing: 0.1 },
    Hospital: { talent: 0.45, cost: 0.2, procurement: 0.25, timing: 0.1 },
    School: { talent: 0.5, cost: 0.3, procurement: 0.1, timing: 0.1 }
  };

  // Micro-market data (keeps distances too)
  const microMarketData = [
    { name: 'Delhi CBD (Connaught Place)', rent: 284.45, vacancy: 18.3, absorption: 0.05, stock: 1.53, metroDistanceKm: 0.5, busDistanceKm: 0.2, rating: 4.5, college: 4, corporate: 5, timing: 'Standard B2B Day (10am-7pm)', timingDetail: 'Efficiency: 11:30 am - 5:00 pm. Aligns with government/finance sectors.' },
    { name: 'Cyber City (Gurugram)', rent: 135.0, vacancy: 2.2, absorption: 0.1, stock: 13.99, metroDistanceKm: 1.2, busDistanceKm: 0.6, rating: 4.7, college: 3, corporate: 5, timing: 'Corporate B2B Day (9am-6pm)', timingDetail: 'Efficiency: 10:00 am - 5:00 pm. Structured corporate environment.' },
    { name: 'South-East Delhi (Nehru Place)', rent: 115.6, vacancy: 13.0, absorption: 0.08, stock: 7.09, metroDistanceKm: 0.8, busDistanceKm: 0.3, rating: 3.8, college: 5, corporate: 4, timing: 'Retail/Tech Day (11am-8pm)', timingDetail: 'Efficiency: 3:00 pm - 8:00 pm. Higher evening traffic.' },
    { name: 'Noida Expressway (Sect 125/135)', rent: 75.0, vacancy: 12.0, absorption: 0.85, stock: 10.5, metroDistanceKm: 4.0, busDistanceKm: 2.5, rating: 3.5, college: 4, corporate: 4, timing: 'Tech/Flex Day (10am-7pm)', timingDetail: 'Efficiency: 11:00 am - 6:00 pm. Hybrid-friendly environment.' },
    { name: 'Golf Course Road (Gurugram)', rent: 110.5, vacancy: 11.5, absorption: 0.35, stock: 5.5, metroDistanceKm: 2.0, busDistanceKm: 0.8, rating: 4.5, college: 2, corporate: 5, timing: 'Corporate B2B Day (9am-6pm)', timingDetail: 'Efficiency: 10:00 am - 5:00 pm. Premium corporate location.' },
    { name: 'Sector 62 (Noida)', rent: 85.5, vacancy: 16.0, absorption: 0.45, stock: 4.5, metroDistanceKm: 3.2, busDistanceKm: 1.0, rating: 4.1, college: 5, corporate: 3, timing: 'Retail/Tech Day (11am-8pm)', timingDetail: 'Efficiency: 3:00 pm - 8:00 pm. Tech hub with talent pool.' },
    { name: 'Sector 16 (Noida)', rent: 99.0, vacancy: 10.5, absorption: 0.1, stock: 2.0, metroDistanceKm: 1.1, busDistanceKm: 0.4, rating: 4.0, college: 5, corporate: 3, timing: 'Retail/Tech Day (11am-8pm)', timingDetail: 'Efficiency: 3:00 pm - 8:00 pm. Established market.' },
    { name: 'Sector 18 (Noida)', rent: 120.0, vacancy: 14.0, absorption: 0.05, stock: 0.9, metroDistanceKm: 1.4, busDistanceKm: 0.5, rating: 4.4, college: 4, corporate: 4, timing: 'Retail/Tech Day (11am-8pm)', timingDetail: 'Efficiency: 3:00 pm - 8:00 pm. Prime retail location.' },
    { name: 'Laxmi Nagar (East Delhi)', rent: 82.0, vacancy: 9.0, absorption: 0.15, stock: 0.7, metroDistanceKm: 0.6, busDistanceKm: 0.2, rating: 3.7, college: 5, corporate: 2, timing: 'Retail/Tech Day (11am-8pm)', timingDetail: 'Efficiency: 3:00 pm - 8:00 pm. High footfall area.' },
    { name: 'Central Noida (Sector 58/63)', rent: 70.0, vacancy: 22.0, absorption: 0.6, stock: 3.8, metroDistanceKm: 3.8, busDistanceKm: 1.8, rating: 3.6, college: 4, corporate: 4, timing: 'Tech/Flex Day (10am-7pm)', timingDetail: 'Efficiency: 11:00 am - 6:00 pm. Growing market.' }
  ];

  // helpers
  const normalize = (value, min, max, inverse = false) => {
    if (max === min) return 0.5;
    const normalized = (value - min) / (max - min);
    return inverse ? 1 - normalized : normalized;
  };

  const distanceKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const toRad = v => v * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  const getNearest = (list, lat, lng) => {
    if (!list || list.length === 0) return null;
    let best = null, min = Infinity;
    list.forEach(s => {
      const d = distanceKm(lat, lng, s.lat, s.lng);
      if (d < min) { min = d; best = s; }
    });
    return best ? { station: best, distance_km: min } : null;
  };

  // scoring (same as before but uses metro/bus distances if present)
  const calculateScores = (businessType) => {
    const weights = businessCategories[businessType];
    if (!weights) return null;

    const rentValues = microMarketData.map((m) => m.rent);
    const vacancyValues = microMarketData.map((m) => m.vacancy);
    const absorptionValues = microMarketData.map((m) => m.absorption);
    const stockValues = microMarketData.map((m) => m.stock);
    const metroDistValues = microMarketData.map((m) => m.metroDistanceKm);
    const busDistValues = microMarketData.map((m) => m.busDistanceKm);

    const minRent = Math.min(...rentValues);
    const maxRent = Math.max(...rentValues);
    const minVacancy = Math.min(...vacancyValues);
    const maxVacancy = Math.max(...vacancyValues);
    const minAbsorption = Math.min(...absorptionValues);
    const maxAbsorption = Math.max(...absorptionValues);
    const minStock = Math.min(...stockValues);
    const maxStock = Math.max(...stockValues);
    const minMetroDist = Math.min(...metroDistValues);
    const maxMetroDist = Math.max(...metroDistValues);
    const minBusDist = Math.min(...busDistValues);
    const maxBusDist = Math.max(...busDistValues);

    const scoredMarkets = microMarketData.map((market) => {
      const metroAccess = normalize(market.metroDistanceKm, minMetroDist, maxMetroDist, true);
      const busAccess = normalize(market.busDistanceKm, minBusDist, maxBusDist, true);
      const talentScore = (
        normalize(market.college, 1, 5) * 0.45 +
        ((metroAccess * 0.6) + (busAccess * 0.4)) * 0.35 +
        normalize(market.rating, 2.8, 4.7) * 0.2
      ) * weights.talent;

      const costScore = (
        normalize(market.rent, minRent, maxRent, true) * 0.7 +
        normalize(market.vacancy, minVacancy, maxVacancy, true) * 0.3
      ) * weights.cost;

      const procurementScore = (
        normalize(market.absorption, minAbsorption, maxAbsorption) * 0.4 +
        normalize(market.stock, minStock, maxStock) * 0.3 +
        normalize(market.corporate, 1, 5) * 0.3
      ) * weights.procurement;

      const timingScore = (
        (metroAccess * 0.5) + (normalize(market.rating, 2.8, 4.7) * 0.5)
      ) * weights.timing;

      const totalScore = talentScore + costScore + procurementScore + timingScore;

      return { ...market, talentScore, costScore, procurementScore, timingScore, totalScore, normalizedScore: totalScore * 100 };
    });

    return scoredMarkets.sort((a, b) => b.totalScore - a.totalScore);
  };

  // coordinate map (same)
  const getApproximateCoords = (name) => {
    const coordMap = {
      'Delhi CBD (Connaught Place)': [28.6289, 77.2065],
      'Cyber City (Gurugram)': [28.495, 77.089],
      'South-East Delhi (Nehru Place)': [28.5494, 77.2501],
      'Noida Expressway (Sect 125/135)': [28.5418, 77.392],
      'Golf Course Road (Gurugram)': [28.442, 77.057],
      'Sector 62 (Noida)': [28.6267, 77.3617],
      'Sector 16 (Noida)': [28.5706, 77.3272],
      'Sector 18 (Noida)': [28.5677, 77.3206],
      'Laxmi Nagar (East Delhi)': [28.6357, 77.2777],
      'Central Noida (Sector 58/63)': [28.605, 77.364]
    };
    return coordMap[name] || null;
  };

  // Create map and markers (same as before)
  const createMap = () => {
    if (!L || !mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      try { mapInstanceRef.current.remove(); } catch (e) {}
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
      setMapLoaded(false);
    }

    try {
      const map = L.map(mapContainerRef.current, { center: [28.6139, 77.209], zoom: 10, scrollWheelZoom: true });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 }).addTo(map);

      const markersLayer = L.layerGroup().addTo(map);
      markersLayerRef.current = markersLayer;

      const data = analysisDataRef.current || analysisData;
      if (data && data.length > 0) {
        const bounds = [];
        data.slice(0, 5).forEach((market, idx) => {
          const coords = getApproximateCoords(market.name);
          if (!coords) return;
          bounds.push(coords);

          const iconColor = idx === 0 ? '#10b981' : idx === 1 ? '#3b82f6' : '#6366f1';
          const customIcon = L.divIcon({ className: 'custom-marker', html: `<div style="background-color: ${iconColor}; width: 34px; height: 34px; border-radius: 50%; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; border:3px solid white; box-shadow:0 2px 4px rgba(0,0,0,0.3);">${idx + 1}</div>`, iconSize: [34, 34], iconAnchor: [17, 17] });

          const marker = L.marker(coords, { icon: customIcon }).addTo(markersLayer);
          const popupHtml = `
            <div style="font-family:sans-serif; min-width:200px;">
              <div style="font-weight:bold; font-size:16px; margin-bottom:8px; color:${iconColor};">#${idx + 1} ${market.name}</div>
              <div style="margin-bottom:4px;"><strong>Score:</strong> ${market.normalizedScore.toFixed(1)}/100</div>
              <div style="margin-bottom:4px;"><strong>Rent:</strong> ₹${market.rent}/sqft</div>
              <div style="margin-bottom:4px;"><strong>Vacancy:</strong> ${market.vacancy}%</div>
              <div style="margin-bottom:4px;"><strong>Dist to Metro:</strong> ${market.metroDistanceKm} km</div>
              <div style="margin-bottom:4px;"><strong>Dist to Bus:</strong> ${market.busDistanceKm} km</div>
              <div style="font-size:12px; color:#666; margin-top:8px; padding-top:8px; border-top:1px solid #eee;">${market.timing}</div>
            </div>
          `;
          marker.bindPopup(popupHtml);
          if (idx === 0) setTimeout(() => marker.openPopup(), 500);
        });

        if (bounds.length > 0) map.fitBounds(bounds, { padding: [50, 50] });
      } else {
        map.setView([28.6139, 77.209], 10);
      }

      mapInstanceRef.current = map;
      setMapLoaded(true);
      setTimeout(() => { try { map.invalidateSize(); } catch (e) {} }, 100);

      // If geojsons are not loaded yet, attempt to load them now (for pincode analysis)
      if (!geoLoaded) {
        loadGeoJSONsForTransit();
      }

      console.log('Map created');
    } catch (error) {
      console.error('createMap error', error);
    }
  };

  // load GeoJSON data (tries data/ and root)
  const tryFetchAny = async (filename) => {
    const candidates = [`data/${filename}`, filename];
    for (const p of candidates) {
      try {
        const r = await fetch(p);
        if (!r.ok) continue;
        const json = await r.json();
        return { json, path: p };
      } catch (e) {
        // ignore and try next
      }
    }
    return null;
  };

  const loadGeoJSONsForTransit = async () => {
    try {
      const p = await tryFetchAny('delhi_pincode.geojson');
      const pts = await tryFetchAny('delhi_points.geojson');
      if (p) setPincodeGeo(p.json);
      if (pts) setPointsGeo(pts.json);

      // detect metro/bus from points
      const metros = [];
      const buses = [];
      if (pts && pts.json && Array.isArray(pts.json.features)) {
        pts.json.features.forEach(f => {
          try {
            const props = f.properties || {};
            const geom = f.geometry || {};
            if (geom.type !== 'Point' || !Array.isArray(geom.coordinates)) return;
            const [lng, lat] = geom.coordinates;
            const text = Object.values(props).join(' ').toLowerCase();
            if (text.includes('metro')) metros.push({ name: props.name || props.label || 'metro', lat, lng, props });
            if (text.includes('bus')) buses.push({ name: props.name || props.label || 'bus', lat, lng, props });
          } catch (e) { /* ignore */ }
        });
      }

      setMetroStations(metros);
      setBusStops(buses);
      setGeoLoaded(true);
      console.log('Loaded geojsons', { pincode: !!p, points: !!pts, metros: metros.length, buses: buses.length });
    } catch (e) {
      console.error('loadGeoJSONsForTransit error', e);
    }
  };

  // clear last drawn layers (centroid, lines, markers)
  const clearLast = () => {
    try {
      const arr = lastLayersRef.current || [];
      arr.forEach(l => { if (mapInstanceRef.current && mapInstanceRef.current.hasLayer(l)) mapInstanceRef.current.removeLayer(l); });
    } catch (e) {}
    lastLayersRef.current = [];
  };

  // analyze pincode: find polygon, centroid, nearest metro + bus, draw on map
  const analyzePincode = async (pincode) => {
    try {
      if (!geoLoaded) {
        await loadGeoJSONsForTransit();
      }
      if (!pincodeGeo) return alert('Pincode GeoJSON not found in public/data or project root');

      // find polygon feature whose properties contain the pincode
      const feat = (pincodeGeo.features || []).find(f => {
        try {
          const props = f.properties || {};
          return Object.values(props).some(v => String(v).includes(String(pincode)));
        } catch (e) { return false; }
      });

      if (!feat) return alert('Pincode not found in pincode GeoJSON');

      // draw polygon and fit
      const layer = L.geoJSON(feat, { style: { color: 'blue', weight: 2, fillOpacity: 0.05 } }).addTo(mapInstanceRef.current);
      lastLayersRef.current.push(layer);
      mapInstanceRef.current.fitBounds(layer.getBounds(), { padding: [20,20] });

      // centroid via turf
      const centroid = turf.centroid(feat);
      const [lng, lat] = centroid.geometry.coordinates;

      // nearest stations
      const nearestMetro = getNearest(metroStations, lat, lng);
      const nearestBus = getNearest(busStops, lat, lng);

      clearLast();

      // centroid marker
      const cent = L.circleMarker([lat, lng], { radius:7, color:'#0a9396', fillColor:'#94d2bd', fillOpacity:0.9 }).addTo(mapInstanceRef.current);
      cent.bindPopup(`Centroid for ${pincode}`).openPopup();
      lastLayersRef.current.push(cent);

      if (nearestMetro) {
        const m = nearestMetro.station;
        const mm = L.marker([m.lat, m.lng]).addTo(mapInstanceRef.current).bindPopup(`<b>Metro</b><br>${m.name}`);
        const ml = L.polyline([[lat,lng],[m.lat,m.lng]], { color:'#ee9b00', weight:3, dashArray:'6' }).addTo(mapInstanceRef.current);
        lastLayersRef.current.push(mm, ml);
      }

      if (nearestBus) {
        const b = nearestBus.station;
        const bm = L.marker([b.lat, b.lng]).addTo(mapInstanceRef.current).bindPopup(`<b>Bus</b><br>${b.name}`);
        const bl = L.polyline([[lat,lng],[b.lat,b.lng]], { color:'#005f73', weight:3, dashArray:'5' }).addTo(mapInstanceRef.current);
        lastLayersRef.current.push(bm, bl);
      }

      alert(`Pincode ${pincode}
Nearest metro: ${nearestMetro ? `${nearestMetro.station.name} (${nearestMetro.distance_km.toFixed(2)} km)` : 'none'}
Nearest bus: ${nearestBus ? `${nearestBus.station.name} (${nearestBus.distance_km.toFixed(2)} km)` : 'none'}`);

    } catch (e) {
      console.error('analyzePincode error', e);
      alert('Failed to analyze pincode — check console');
    }
  };

  // Initialize map when showMap toggled on
  useEffect(() => {
    if (showMap) {
      analysisDataRef.current = analysisData;
      createMap();
    } else {
      if (mapInstanceRef.current) {
        try { mapInstanceRef.current.remove(); } catch (e) {}
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
        setMapLoaded(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMap]);

  // Keep analysisDataRef up-to-date and refresh markers if map already exists
  useEffect(() => {
    analysisDataRef.current = analysisData;

    if (mapInstanceRef.current && showMap) {
      if (markersLayerRef.current) markersLayerRef.current.clearLayers();
      const data = analysisDataRef.current || analysisData;
      if (data && data.length > 0 && markersLayerRef.current && mapInstanceRef.current) {
        const bounds = [];
        data.slice(0, 5).forEach((market, idx) => {
          const coords = getApproximateCoords(market.name);
          if (!coords) return;
          bounds.push(coords);

          const iconColor = idx === 0 ? '#10b981' : idx === 1 ? '#3b82f6' : '#6366f1';
          const customIcon = L.divIcon({ className: 'custom-marker', html: `<div style="background-color: ${iconColor}; width: 34px; height: 34px; border-radius: 50%; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; border:3px solid white; box-shadow:0 2px 4px rgba(0,0,0,0.3);">${idx + 1}</div>`, iconSize: [34, 34], iconAnchor: [17, 17] });

          const marker = L.marker(coords, { icon: customIcon }).addTo(markersLayerRef.current);
          const popupHtml = `
            <div style="font-family:sans-serif; min-width:200px;">
              <div style="font-weight:bold; font-size:16px; margin-bottom:8px; color:${iconColor};">#${idx + 1} ${market.name}</div>
              <div style="margin-bottom:4px;"><strong>Score:</strong> ${market.normalizedScore.toFixed(1)}/100</div>
              <div style="margin-bottom:4px;"><strong>Rent:</strong> ₹${market.rent}/sqft</div>
              <div style="margin-bottom:4px;"><strong>Vacancy:</strong> ${market.vacancy}%</div>
              <div style="margin-bottom:4px;"><strong>Dist to Metro:</strong> ${market.metroDistanceKm} km</div>
              <div style="margin-bottom:4px;"><strong>Dist to Bus:</strong> ${market.busDistanceKm} km</div>
              <div style="font-size:12px; color:#666; margin-top:8px; padding-top:8px; border-top:1px solid #eee;">${market.timing}</div>
            </div>
          `;
          marker.bindPopup(popupHtml);
        });

        if (bounds.length > 0) mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisData]);

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        try { mapInstanceRef.current.remove(); } catch (e) {}
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const handleBusinessSelect = (business) => {
    setSelectedBusiness(business);
    const scores = calculateScores(business);
    setAnalysisData(scores);
    setShowMap(false);
    setMapLoaded(false);
    if (mapInstanceRef.current) {
      try { mapInstanceRef.current.remove(); } catch (e) {}
      mapInstanceRef.current = null;
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-orange-600';
  };

  // small UI state for input
  const [pincodeInput, setPincodeInput] = useState('');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-lg border-b-4 border-indigo-600">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <Building2 className="w-10 h-10 text-indigo-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">NCR Business Location Intelligence</h1>
              <p className="text-gray-600">Data-driven insights for optimal business placement in Delhi-NCR</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Business Type Selection */}
        {!selectedBusiness && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Package className="w-6 h-6 text-indigo-600" />
              Select Your Business Type
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Object.keys(businessCategories).map((business) => (
                <button key={business} onClick={() => handleBusinessSelect(business)} className="p-4 border-2 border-gray-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left group">
                  <div className="font-semibold text-gray-900 group-hover:text-indigo-600">{business}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Analysis Results */}
        {selectedBusiness && analysisData && (
          <div className="space-y-6">
            {/* Header with business type */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Analysis for: <span className="text-indigo-600">{selectedBusiness}</span></h2>
                  <p className="text-gray-600 mt-1">Top {analysisData.length} micro-markets ranked by suitability score</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowMap(!showMap)} className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    {showMap ? 'Hide Map' : 'Show Map'}
                  </button>
                  <button onClick={() => { setSelectedBusiness(''); setAnalysisData(null); setShowMap(false); }} className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">Change Business</button>
                </div>
              </div>
            </div>

            {/* Interactive Map + pincode input */}
            {showMap && (
              <div className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2"><MapPin className="w-6 h-6 text-indigo-600" />Interactive Location Map - Top 5 Locations</h3>
                <div ref={mapContainerRef} className="w-full h-[500px] rounded-lg border-2 border-gray-200 bg-gray-100" style={{ position: 'relative' }}>
                  {!mapLoaded && (<div className="absolute inset-0 flex items-center justify-center"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div><p className="text-gray-600">Loading map...</p></div></div>)}
                </div>

                <div className="flex gap-2 items-center">
                  <input value={pincodeInput} onChange={e => setPincodeInput(e.target.value)} placeholder="Enter Delhi pincode (e.g. 110001)" className="p-2 border rounded w-1/3" />
                  <button onClick={() => analyzePincode(pincodeInput.trim())} className="px-4 py-2 bg-indigo-600 text-white rounded">Find nearest metro/bus</button>
                  <button onClick={() => { clearLast(); setPincodeInput(''); }} className="px-4 py-2 bg-gray-200 rounded">Clear</button>
                </div>

                <p className="text-sm text-gray-600">📍 Click on numbered markers to see detailed information about each location. Use the input to analyze a pincode and see nearest metro/bus stops (requires public/data/delhi_pincode.geojson and public/data/delhi_points.geojson).</p>
              </div>
            )}

            {/* Top Recommendation Card */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl shadow-xl p-8 text-white">
              <div className="flex items-start gap-4">
                <div className="bg-white/20 p-3 rounded-lg"><TrendingUp className="w-8 h-8" /></div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-2">🏆 Top Recommended Location</h3>
                  <h4 className="text-3xl font-bold mb-4">{analysisData[0].name}</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white/10 rounded-lg p-3"><div className="text-sm opacity-90">Overall Score</div><div className="text-2xl font-bold">{analysisData[0].normalizedScore.toFixed(1)}/100</div></div>
                    <div className="bg-white/10 rounded-lg p-3"><div className="text-sm opacity-90">Rent per SqFt</div><div className="text-2xl font-bold">₹{analysisData[0].rent}</div></div>
                    <div className="bg-white/10 rounded-lg p-3"><div className="text-sm opacity-90">Vacancy Rate</div><div className="text-2xl font-bold">{analysisData[0].vacancy}%</div></div>
                    <div className="bg-white/10 rounded-lg p-3"><div className="text-sm opacity-90">Dist to Metro</div><div className="text-2xl font-bold">{analysisData[0].metroDistanceKm} km</div></div>
                  </div>
                  <div className="mt-4 bg-white/10 rounded-lg p-4"><div className="flex items-center gap-2 mb-2"><Clock className="w-5 h-5" /><span className="font-semibold">{analysisData[0].timing}</span></div><div className="text-sm opacity-90">{analysisData[0].timingDetail}</div></div>
                </div>
              </div>
            </div>

            {/* Detailed Rankings */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2"><BarChart3 className="w-6 h-6 text-indigo-600" />Detailed Market Rankings</h3>
              <div className="space-y-4">
                {analysisData.map((market, idx) => (
                  <div key={market.name} className="border-2 border-gray-200 rounded-xl p-6 hover:border-indigo-300 transition-all">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex-1"><div className="flex items-center gap-3 mb-2"><span className="text-2xl font-bold text-indigo-600">#{idx + 1}</span><h4 className="text-xl font-bold text-gray-900">{market.name}</h4></div><div className="flex items-center gap-2 text-gray-600"><Clock className="w-4 h-4" /><span className="text-sm">{market.timing}</span></div></div>
                      <div className="text-right"><div className="text-sm text-gray-600">Suitability Score</div><div className={`text-3xl font-bold ${getScoreColor(market.normalizedScore)}`}>{market.normalizedScore.toFixed(1)}</div></div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      <div className="bg-blue-50 rounded-lg p-3"><div className="flex items-center gap-2 text-blue-700 mb-1"><Users className="w-4 h-4" /><span className="text-xs font-semibold">Talent</span></div><div className="text-lg font-bold text-blue-900">{(market.talentScore * 100).toFixed(0)}%</div></div>
                      <div className="bg-green-50 rounded-lg p-3"><div className="flex items-center gap-2 text-green-700 mb-1"><TrendingUp className="w-4 h-4" /><span className="text-xs font-semibold">Cost</span></div><div className="text-lg font-bold text-green-900">{(market.costScore * 100).toFixed(0)}%</div></div>
                      <div className="bg-purple-50 rounded-lg p-3"><div className="flex items-center gap-2 text-purple-700 mb-1"><Package className="w-4 h-4" /><span className="text-xs font-semibold">Procurement</span></div><div className="text-lg font-bold text-purple-900">{(market.procurementScore * 100).toFixed(0)}%</div></div>
                      <div className="bg-orange-50 rounded-lg p-3"><div className="flex items-center gap-2 text-orange-700 mb-1"><Clock className="w-4 h-4" /><span className="text-xs font-semibold">Timing</span></div><div className="text-lg font-bold text-orange-900">{(market.timingScore * 100).toFixed(0)}%</div></div>
                    </div>

                    <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-sm">
                      <div><div className="text-gray-600">Rent/SqFt</div><div className="font-semibold">₹{market.rent}</div></div>
                      <div><div className="text-gray-600">Vacancy</div><div className="font-semibold">{market.vacancy}%</div></div>
                      <div><div className="text-gray-600">Absorption</div><div className="font-semibold">{market.absorption} MSF</div></div>
                      <div><div className="text-gray-600">Dist to Metro</div><div className="font-semibold">{market.metroDistanceKm} km</div></div>
                      <div><div className="text-gray-600">Dist to Bus</div><div className="font-semibold">{market.busDistanceKm} km</div></div>
                      <div><div className="text-gray-600">Rating</div><div className="font-semibold">{market.rating}/5</div></div>
                    </div>

                    <div className="mt-4 bg-gray-50 rounded-lg p-3"><div className="text-xs text-gray-700">{market.timingDetail}</div></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-6"><h3 className="text-xl font-bold text-gray-900 mb-4">💡 Key Insights</h3><div className="space-y-3 text-gray-700"><p>• <strong>Best Overall:</strong> {analysisData[0].name} offers the optimal balance for your {selectedBusiness} business</p><p>• <strong>Cost Leader:</strong> {[...analysisData].sort((a,b) => a.rent - b.rent)[0].name} has the lowest rent at ₹{[...analysisData].sort((a,b) => a.rent - b.rent)[0].rent}/sqft</p><p>• <strong>Talent Hub:</strong> {[...analysisData].sort((a,b) => b.college - a.college)[0].name} provides the best access to talent pool</p><p>• <strong>Growth Market:</strong> {[...analysisData].sort((a,b) => b.absorption - a.absorption)[0].name} shows highest absorption rate at {[...analysisData].sort((a,b) => b.absorption - a.absorption)[0].absorption} MSF</p></div></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NCRBusinessAnalyzer;
