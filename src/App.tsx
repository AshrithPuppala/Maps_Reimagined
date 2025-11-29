import React, { useState, useEffect, useRef, useCallback } from 'react';
import Map, { NavigationControl, Marker, Popup } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as THREE from 'three';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { 
  MapPin, TrendingUp, TrendingDown, Search, AlertCircle, 
  Loader2, Building2, Key, Map as MapIcon, Star, Box, Layers
} from 'lucide-react';

// --- CONSTANTS ---
const MAP_STYLE_URL = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const MAPILLARY_API_KEY = 'MLY|25379176438437050|fd3bd452808882ea14e6749dc065c20f'; // Public token from reference

const LoadingState = {
  IDLE: 'IDLE',
  LOADING: 'LOADING',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR'
};

// --- SERVICES ---

// 1. FREE Real-time Competitor Data (OpenStreetMap/Overpass)
const fetchRealCompetitors = async (lat, lng, type) => {
  try {
    const typeMap = {
      'Restaurant': 'amenity=restaurant',
      'Cafe': 'amenity=cafe',
      'Gym': 'leisure=fitness_centre',
      'Pharmacy': 'amenity=pharmacy',
      'Bank': 'amenity=bank',
      'School': 'amenity=school',
      'Hotel': 'tourism=hotel',
      'Hospital': 'amenity=hospital'
    };

    const tag = typeMap[type] || 'amenity=restaurant'; 
    const radius = 3000; 

    const query = `
      [out:json][timeout:25];
      (
        node[${tag}](around:${radius},${lat},${lng});
        way[${tag}](around:${radius},${lat},${lng});
      );
      out center 15; 
    `;

    const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
    if (!response.ok) return []; 
    const data = await response.json();
    if (!data.elements) return [];

    return data.elements.map(place => ({
      name: place.tags?.name || "Unnamed Business",
      lat: place.lat || place.center?.lat,
      lon: place.lon || place.center?.lon,
      type: type,
      rating: 0, 
      address: "Fetching address..." 
    })).filter(p => p.name !== "Unnamed Business" && p.lat && p.lon).slice(0, 10);

  } catch (error) {
    console.warn("Overpass API Error:", error);
    return []; 
  }
};

// 2. Geocoding
const searchLocationName = async (query) => {
  try {
    const searchQuery = query.toLowerCase().includes('delhi') ? query : `${query} Delhi`;
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&countrycodes=in`
    );
    const data = await response.json();
    return data.map(item => ({
      name: item.display_name.split(',')[0],
      fullName: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon)
    }));
  } catch (error) {
    return [];
  }
};

// 3. Gemini Analysis
const analyzeWithGemini = async (apiKey, businessType, lat, lng, locationName, realCompetitors) => {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const context = realCompetitors.length > 0 
    ? `I have verified these REAL competitors exist nearby: [${realCompetitors.map(c => c.name).join(", ")}].`
    : `Real-time map data was unavailable. Identify likely competitors in "${locationName}".`;

  const prompt = `
    I am opening a "${businessType}" at ${lat}, ${lng} (Near ${locationName}) in Delhi.
    ${context}
    Act as a Business Analyst.
    1. Estimate competitor ratings (3.5-4.9).
    2. Provide SWOT analysis.
    3. Estimate market stats.
    
    Return JSON ONLY:
    {
      "locationName": "${locationName}",
      "businessType": "${businessType}",
      "stats": {
        "totalCompetitors": ${realCompetitors.length > 0 ? realCompetitors.length : 8},
        "averageRating": 4.1,
        "priceLevelDistribution": [
           { "name": "Budget", "value": 30 },
           { "name": "Moderate", "value": 50 },
           { "name": "Premium", "value": 20 }
        ],
        "sentimentScore": 75
      },
      "strengths": ["Str1", "Str2", "Str3"],
      "weaknesses": ["Weak1", "Weak2", "Weak3"],
      "summary": "Executive summary.",
      "enrichedCompetitors": [
        { "name": "Name", "rating": 4.2, "address": "Address" }
      ]
    }
  `;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(jsonString);
};

// --- 3D COMPONENT ---

const MapillaryStreetView = ({ location, businessType, style }) => {
  const mountRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [streetViewImage, setStreetViewImage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchImage = async () => {
      setLoading(true);
      setError(null);
      try {
        const { lat, lng } = location;
        const searchUrl = `https://graph.mapillary.com/images?access_token=${MAPILLARY_API_KEY}&fields=id,thumb_2048_url,computed_compass_angle&bbox=${lng-0.001},${lat-0.001},${lng+0.001},${lat+0.001}&limit=1`;
        const response = await fetch(searchUrl);
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
          setStreetViewImage(data.data[0].thumb_2048_url);
        } else {
          setError('No street view imagery available here.');
        }
      } catch (err) {
        setError('Failed to load street view.');
      } finally {
        setLoading(false);
      }
    };
    fetchImage();
  }, [location]);

  useEffect(() => {
    if (!mountRef.current || !streetViewImage) return;

    const container = mountRef.current;
    // Clear previous scene
    while(container.firstChild) container.removeChild(container.firstChild);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 1.6, 4);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // 360 Sphere
    const loader = new THREE.TextureLoader();
    loader.load(streetViewImage, (texture) => {
      const geometry = new THREE.SphereGeometry(500, 60, 40);
      geometry.scale(-1, 1, 1);
      const material = new THREE.MeshBasicMaterial({ map: texture });
      scene.add(new THREE.Mesh(geometry, material));
    });

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight.position.set(5, 10, 5);
    scene.add(dirLight);

    // Shop Generation Logic
    const createShop = () => {
      const group = new THREE.Group();
      
      let color = 0xE8D5C4;
      if (style === 'Modern Industrial') color = 0x2C3E50;
      if (style === 'Cyberpunk Neon') color = 0x1a1a2e;
      if (style === 'Eco-Friendly Green') color = 0x8FBC8F;

      // Building
      const bGeo = new THREE.BoxGeometry(4, 3, 3);
      const bMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
      const building = new THREE.Mesh(bGeo, bMat);
      building.position.y = 1.5;
      group.add(building);

      // Signage
      const sGeo = new THREE.BoxGeometry(3.5, 0.5, 0.2);
      const sMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
      const sign = new THREE.Mesh(sGeo, sMat);
      sign.position.set(0, 3.3, 1.6);
      group.add(sign);

      // Text (Canvas Texture)
      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.font = 'bold 30px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(businessType.toUpperCase(), 128, 42);
      const tMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true });
      const text = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.8), tMat);
      text.position.set(0, 3.3, 1.71);
      group.add(text);

      // Glass Front
      const gGeo = new THREE.BoxGeometry(3, 2, 0.1);
      const gMat = new THREE.MeshPhysicalMaterial({ color: 0x88CCFF, opacity: 0.3, transparent: true });
      const glass = new THREE.Mesh(gGeo, gMat);
      glass.position.set(0, 1.5, 1.55);
      group.add(glass);

      group.position.z = -5;
      return group;
    };

    const shop = createShop();
    scene.add(shop);

    // Animation Loop
    let animationId;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Interaction
    let isDragging = false;
    let startX = 0;
    
    container.onmousedown = (e) => { isDragging = true; startX = e.clientX; };
    container.onmouseup = () => { isDragging = false; };
    container.onmousemove = (e) => {
      if(isDragging) {
        const delta = e.clientX - startX;
        shop.rotation.y += delta * 0.01;
        startX = e.clientX;
      }
    };

    return () => {
      cancelAnimationFrame(animationId);
      if(container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [streetViewImage, businessType, style]);

  return (
    <div className="relative w-full h-full bg-slate-900 rounded-xl overflow-hidden shadow-2xl border border-slate-700">
      <div ref={mountRef} className="w-full h-full" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <span className="ml-2 text-white">Loading 3D View...</span>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
          <div className="bg-red-500/20 text-red-200 px-4 py-2 rounded border border-red-500">{error}</div>
        </div>
      )}
      {!loading && !error && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full text-white text-xs">
          🖱️ Drag to rotate shop • 🌍 Real location data
        </div>
      )}
    </div>
  );
};

// --- SIDEBAR COMPONENT ---

const Sidebar = ({ 
  businessType, setBusinessType, onAnalyze, loadingState, result, error, apiKey, setApiKey,
  locationQuery, setLocationQuery, onLocationSearch, locationSuggestions, onSelectLocation,
  archStyle, setArchStyle, viewMode, setViewMode
}) => {
  const COLORS = ['#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="h-full flex flex-col bg-slate-950 border-r border-slate-800 w-full md:w-[420px] shadow-2xl relative z-20">
      <div className="p-5 border-b border-slate-800 bg-slate-900">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent flex items-center gap-2">
          Delhi Scout AI
        </h1>
        <p className="text-slate-400 text-xs mt-1">Feasibility & Visualization Engine</p>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        
        {/* CONFIG SECTION */}
        <div className="space-y-4">
          
          {/* API Key */}
          <div className="relative">
            <Key className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Gemini API Key" className="w-full bg-slate-900 border border-slate-700 text-white pl-9 pr-4 py-2 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
          </div>

          {/* Location Search */}
          <div className="relative">
            <MapIcon className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input type="text" value={locationQuery} onChange={(e) => { setLocationQuery(e.target.value); if(e.target.value.length > 2) onLocationSearch(e.target.value); }} placeholder="Search Location (e.g. Lajpat Nagar)" className="w-full bg-slate-900 border border-slate-700 text-white pl-9 pr-4 py-2 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
            {locationSuggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                {locationSuggestions.map((s, idx) => (
                  <div key={idx} onClick={() => onSelectLocation(s)} className="px-4 py-3 hover:bg-slate-700 cursor-pointer border-b border-slate-700">
                    <p className="text-sm text-white">{s.name}</p>
                    <p className="text-xs text-slate-400 truncate">{s.fullName}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Business & Style */}
          <div className="grid grid-cols-2 gap-2">
            <select value={businessType} onChange={(e) => setBusinessType(e.target.value)} className="bg-slate-900 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm outline-none">
              <option value="">Type</option>
              {['Restaurant', 'Cafe', 'Gym', 'Pharmacy', 'Bank', 'Hotel'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={archStyle} onChange={(e) => setArchStyle(e.target.value)} className="bg-slate-900 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm outline-none">
              <option value="Modern Industrial">Modern</option>
              <option value="Cyberpunk Neon">Cyberpunk</option>
              <option value="Eco-Friendly Green">Eco</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button onClick={onAnalyze} disabled={loadingState === LoadingState.LOADING || !apiKey || !businessType} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors flex justify-center items-center gap-2">
              {loadingState === LoadingState.LOADING ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Search className="w-4 h-4" /> Analyze</>}
            </button>
          </div>
          
          {/* View Toggles */}
          <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button onClick={() => setViewMode('map')} className={`flex-1 py-1.5 text-xs font-medium rounded ${viewMode === 'map' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>Map View</button>
            <button onClick={() => setViewMode('3d')} className={`flex-1 py-1.5 text-xs font-medium rounded ${viewMode === '3d' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>3D Sim</button>
          </div>
        </div>

        {/* ERROR */}
        {loadingState === LoadingState.ERROR && (
          <div className="bg-red-900/20 border border-red-800 text-red-200 p-3 rounded-lg text-xs">{error}</div>
        )}

        {/* ANALYTICS RESULTS */}
        {result && loadingState === LoadingState.SUCCESS && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-800 p-2 rounded border border-slate-700 text-center">
                <p className="text-slate-400 text-[10px] uppercase">Competitors</p>
                <p className="text-xl font-bold text-white">{result.stats.totalCompetitors}</p>
              </div>
              <div className="bg-slate-800 p-2 rounded border border-slate-700 text-center">
                  <p className="text-slate-400 text-[10px] uppercase">Avg Rating</p>
                  <p className="text-xl font-bold text-yellow-400">{result.stats.averageRating}</p>
              </div>
              <div className="bg-slate-800 p-2 rounded border border-slate-700 text-center">
                <p className="text-slate-400 text-[10px] uppercase">Sentiment</p>
                <p className="text-xl font-bold text-blue-400">{result.stats.sentimentScore}%</p>
              </div>
            </div>

            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={result.stats.priceLevelDistribution} cx="50%" cy="50%" innerRadius={30} outerRadius={55} paddingAngle={5} dataKey="value">
                    {result.stats.priceLevelDistribution.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Legend verticalAlign="bottom" height={36} iconSize={8} wrapperStyle={{fontSize: '10px'}} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2">
              <h3 className="text-slate-300 text-xs font-bold uppercase flex items-center gap-2"><Building2 className="w-3 h-3" /> Top Competitors</h3>
              {result.topCompetitors.map((comp, idx) => (
                <div key={idx} className="bg-slate-800 p-2 rounded border border-slate-700 flex justify-between items-center">
                  <div>
                    <p className="text-white text-xs font-medium">{comp.name}</p>
                    <p className="text-[10px] text-slate-500 truncate max-w-[150px]">{comp.address}</p>
                  </div>
                  <div className="flex items-center bg-slate-900 px-1.5 py-0.5 rounded">
                    <Star className="w-3 h-3 text-yellow-400 mr-1" />
                    <span className="text-xs text-white">{comp.rating}</span>
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

// --- MAIN LAYOUT ---

export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [archStyle, setArchStyle] = useState('Modern Industrial');
  
  const [selectedLocation, setSelectedLocation] = useState({ latitude: 28.6139, longitude: 77.2090 });
  const [viewState, setViewState] = useState({ latitude: 28.6139, longitude: 77.2090, zoom: 12 });
  const [viewMode, setViewMode] = useState('map'); // 'map' or '3d'
  
  const [locationQuery, setLocationQuery] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  
  const [loadingState, setLoadingState] = useState(LoadingState.IDLE);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [competitorPins, setCompetitorPins] = useState([]); 
  const [error, setError] = useState(null);
  const [hoveredPin, setHoveredPin] = useState(null);

  const handleLocationSearch = useCallback(async (query) => {
    const results = await searchLocationName(query);
    setLocationSuggestions(results);
  }, []);

  const handleSelectLocation = (suggestion) => {
    const newCoords = { latitude: suggestion.lat, longitude: suggestion.lon };
    setSelectedLocation(newCoords);
    setViewState({ ...newCoords, zoom: 15 });
    setLocationQuery(suggestion.name);
    setLocationSuggestions([]);
  };

  const handleAnalysis = useCallback(async () => {
    if (!apiKey || !businessType) return setError("API Key and Business Type required");
    setLoadingState(LoadingState.LOADING);
    setError(null);
    setCompetitorPins([]); 

    try {
      const realCompetitors = await fetchRealCompetitors(selectedLocation.latitude, selectedLocation.longitude, businessType);
      
      const data = await analyzeWithGemini(
        apiKey, businessType, selectedLocation.latitude, selectedLocation.longitude,
        locationQuery || "Selected Location", realCompetitors
      );

      let mergedPins = [];
      let finalCompetitorsList = [];

      if (realCompetitors.length > 0) {
          mergedPins = realCompetitors.map(real => {
            const enriched = data.enrichedCompetitors?.find(e => e.name === real.name) || {};
            return { ...real, ...enriched, rating: enriched.rating || (3.5 + Math.random()).toFixed(1) };
          });
          finalCompetitorsList = mergedPins;
      } else {
          finalCompetitorsList = data.enrichedCompetitors || [];
      }

      setCompetitorPins(mergedPins);
      setAnalysisResult({ ...data, topCompetitors: finalCompetitorsList });
      setLoadingState(LoadingState.SUCCESS);

    } catch (e) {
      console.error(e);
      setLoadingState(LoadingState.ERROR);
      setError("Analysis failed. Check API Key.");
    }
  }, [apiKey, businessType, selectedLocation, locationQuery]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-white font-sans">
      <div className="h-full pointer-events-auto z-20">
        <Sidebar
            businessType={businessType} setBusinessType={setBusinessType}
            archStyle={archStyle} setArchStyle={setArchStyle}
            viewMode={viewMode} setViewMode={setViewMode}
            onAnalyze={handleAnalysis} loadingState={loadingState}
            result={analysisResult} error={error}
            apiKey={apiKey} setApiKey={setApiKey}
            locationQuery={locationQuery} setLocationQuery={setLocationQuery}
            onLocationSearch={handleLocationSearch} locationSuggestions={locationSuggestions}
            onSelectLocation={handleSelectLocation}
        />
      </div>

      <div className="flex-1 relative z-10 bg-black">
        {viewMode === 'map' ? (
          <Map
            {...viewState}
            onMove={evt => setViewState(evt.viewState)}
            style={{ width: '100%', height: '100%' }}
            mapStyle={MAP_STYLE_URL}
            onClick={(evt) => setSelectedLocation({ latitude: evt.lngLat.lat, longitude: evt.lngLat.lng })}
            cursor="crosshair"
          >
            <NavigationControl position="top-right" />
            <Marker latitude={selectedLocation.latitude} longitude={selectedLocation.longitude} anchor="bottom">
               <div className="relative">
                  <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-[0_0_15px_rgba(59,130,246,0.5)] animate-bounce" />
               </div>
            </Marker>
            {competitorPins.map((comp, idx) => (
              <Marker key={idx} latitude={comp.lat} longitude={comp.lon} anchor="bottom" onClick={e => { e.originalEvent.stopPropagation(); setHoveredPin(comp); }}>
                <div className="group relative cursor-pointer hover:scale-110 transition-transform">
                  <MapPin className="w-6 h-6 text-red-500 fill-red-900 drop-shadow-md" />
                </div>
              </Marker>
            ))}
            {hoveredPin && (
              <Popup latitude={hoveredPin.lat} longitude={hoveredPin.lon} onClose={() => setHoveredPin(null)} closeButton={true} closeOnClick={false} offset={15} className="text-black">
                <div className="p-2 min-w-[150px]">
                  <h3 className="font-bold text-sm text-slate-800">{hoveredPin.name}</h3>
                  <div className="flex items-center gap-1 mt-1">
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                    <span className="text-xs font-medium text-slate-600">{hoveredPin.rating || "N/A"}</span>
                  </div>
                </div>
              </Popup>
            )}
          </Map>
        ) : (
          <div className="w-full h-full p-6">
             <MapillaryStreetView 
                location={{ lat: selectedLocation.latitude, lng: selectedLocation.longitude }} 
                businessType={businessType} 
                style={archStyle} 
             />
          </div>
        )}
      </div>
    </div>
  );
}
