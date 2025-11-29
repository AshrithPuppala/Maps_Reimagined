import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Map, { Source, Layer, NavigationControl, Marker, Popup } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { 
  MapPin, TrendingUp, TrendingDown, Search, AlertCircle, 
  Loader2, Building2, Key, Map as MapIcon, Star
} from 'lucide-react';

// --- CONFIGURATION ---
const MAP_STYLE_URL = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

// --- TYPES ---
const LoadingState = {
  IDLE: 'IDLE',
  LOADING: 'LOADING',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR'
};

// --- SERVICES ---

// 1. FREE Real-time Competitor Data (OpenStreetMap/Overpass)
// This finds ACTUAL places with exact coordinates
const fetchRealCompetitors = async (lat, lng, type) => {
  try {
    // Map common business types to OSM tags
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

    const tag = typeMap[type] || 'amenity=restaurant'; // Default
    const radius = 1000; // 1km radius

    // Overpass QL Query
    const query = `
      [out:json][timeout:25];
      (
        node[${tag}](around:${radius},${lat},${lng});
        way[${tag}](around:${radius},${lat},${lng});
      );
      out center 10; 
    `;

    const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
    const data = await response.json();

    return data.elements.map(place => ({
      name: place.tags.name || "Unnamed Business",
      lat: place.lat || place.center.lat,
      lon: place.lon || place.center.lon,
      type: type,
      // Placeholder for AI enrichment
      rating: 0, 
      address: "Loading..." 
    })).filter(p => p.name !== "Unnamed Business").slice(0, 8); // Top 8 results

  } catch (error) {
    console.error("Overpass API Error:", error);
    return [];
  }
};

// 2. Geocoding (Nominatim)
const searchLocationName = async (query) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + " Delhi")}&limit=5`
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

// 3. Gemini Analysis (Enriches the REAL data)
const analyzeWithGemini = async (apiKey, businessType, lat, lng, locationName, realCompetitors) => {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const competitorNames = realCompetitors.map(c => c.name).join(", ");

  const prompt = `
    I am opening a "${businessType}" at ${lat}, ${lng} (Near ${locationName}) in Delhi.
    
    I have verified these REAL competitors exist nearby: [${competitorNames}].

    Act as a Data Analyst.
    1. For each verified competitor, estimate their Rating (0-5) and one-line Address based on your knowledge.
    2. Provide a SWOT analysis for my new business in this specific context.
    3. Estimate market stats.

    Return JSON ONLY:
    {
      "locationName": "${locationName}",
      "businessType": "${businessType}",
      "stats": {
        "totalCompetitors": ${realCompetitors.length},
        "averageRating": 4.1,
        "priceLevelDistribution": [
           { "name": "Budget", "value": 30 },
           { "name": "Moderate", "value": 50 },
           { "name": "Premium", "value": 20 }
        ],
        "sentimentScore": 75
      },
      "strengths": ["Str1", "Str2"],
      "weaknesses": ["Weak1", "Weak2"],
      "summary": "Summary text.",
      "enrichedCompetitors": [
        { "name": "${realCompetitors[0]?.name || 'Example'}", "rating": 4.2, "address": "Block B, Connaught Place" }
        // ... return data for all passed competitors
      ]
    }
  `;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(jsonString);
};

// --- COMPONENTS ---

const Sidebar = ({ 
  businessType, setBusinessType, onAnalyze, loadingState, result, error, apiKey, setApiKey,
  locationQuery, setLocationQuery, onLocationSearch, locationSuggestions, onSelectLocation
}) => {
  
  const COLORS = ['#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="h-full flex flex-col bg-slate-900/95 backdrop-blur-md border-r border-slate-700 w-full md:w-[450px] shadow-2xl overflow-hidden z-20 relative">
      <div className="p-6 border-b border-slate-700 bg-slate-900">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent flex items-center gap-2">
          Delhi Scout AI
        </h1>
        <p className="text-slate-400 text-sm mt-1">Real-time Location Intelligence</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* INPUTS */}
        <div className="space-y-4">
          <div className="relative">
            <Key className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Gemini API Key" className="w-full bg-slate-800 border border-slate-700 text-white pl-9 pr-4 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>

          <div className="relative">
            <MapIcon className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input type="text" value={locationQuery} onChange={(e) => { setLocationQuery(e.target.value); if(e.target.value.length > 2) onLocationSearch(e.target.value); }} placeholder="Search Location (e.g. Hauz Khas)" className="w-full bg-slate-800 border border-slate-700 text-white pl-9 pr-4 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
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

          <div className="flex gap-2">
            <select 
              value={businessType} 
              onChange={(e) => setBusinessType(e.target.value)}
              className="flex-1 bg-slate-800 border border-slate-700 text-white px-4 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
            >
              <option value="">Select Business Type</option>
              {['Restaurant', 'Cafe', 'Gym', 'Pharmacy', 'Bank', 'School', 'Hotel'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={onAnalyze} disabled={loadingState === LoadingState.LOADING || !apiKey} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg">
              {loadingState === LoadingState.LOADING ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* ERROR */}
        {loadingState === LoadingState.ERROR && (
          <div className="bg-red-900/20 border border-red-800 text-red-200 p-4 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* RESULTS */}
        {result && loadingState === LoadingState.SUCCESS && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Header Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 text-center">
                <p className="text-slate-400 text-[10px] uppercase">Competitors</p>
                <p className="text-2xl font-bold text-white">{result.stats.totalCompetitors}</p>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 text-center">
                  <p className="text-slate-400 text-[10px] uppercase">Avg Rating</p>
                  <p className="text-2xl font-bold text-yellow-400">{result.stats.averageRating}</p>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 text-center">
                <p className="text-slate-400 text-[10px] uppercase">Sentiment</p>
                <p className="text-2xl font-bold text-blue-400">{result.stats.sentimentScore}%</p>
              </div>
            </div>

            {/* SWOT */}
            <div className="grid grid-cols-2 gap-3">
               <div className="bg-emerald-900/10 border border-emerald-800/30 p-3 rounded-lg">
                 <h3 className="text-emerald-400 text-xs font-bold mb-2 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> STRENGTHS</h3>
                 <ul className="list-disc list-inside text-[11px] text-slate-300 space-y-1">
                   {result.strengths.slice(0,3).map((s, i) => <li key={i}>{s}</li>)}
                 </ul>
               </div>
               <div className="bg-red-900/10 border border-red-800/30 p-3 rounded-lg">
                 <h3 className="text-red-400 text-xs font-bold mb-2 flex items-center gap-1"><TrendingDown className="w-3 h-3" /> WEAKNESSES</h3>
                 <ul className="list-disc list-inside text-[11px] text-slate-300 space-y-1">
                   {result.weaknesses.slice(0,3).map((w, i) => <li key={i}>{w}</li>)}
                 </ul>
               </div>
            </div>

            {/* Competitor List */}
            <div>
              <h3 className="text-slate-200 font-semibold mb-3 flex items-center gap-2 text-sm">
                <Building2 className="w-4 h-4 text-slate-400" /> Top Competitors (Real Data)
              </h3>
              <div className="space-y-2">
                {result.topCompetitors.map((comp, idx) => (
                  <div key={idx} className="bg-slate-800 p-3 rounded-md border border-slate-700 flex justify-between items-start group hover:border-blue-500 transition-colors cursor-default">
                    <div>
                      <p className="font-medium text-slate-200 text-sm">{comp.name}</p>
                      <p className="text-[10px] text-slate-500 truncate max-w-[150px]">{comp.address}</p>
                    </div>
                    <div className="flex items-center bg-slate-900 px-2 py-1 rounded">
                      <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 mr-1" />
                      <span className="text-xs text-white">{comp.rating}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={result.stats.priceLevelDistribution} cx="50%" cy="50%" innerRadius={30} outerRadius={60} paddingAngle={5} dataKey="value">
                    {result.stats.priceLevelDistribution.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Legend verticalAlign="bottom" height={36} iconSize={8} wrapperStyle={{fontSize: '10px'}} />
                </PieChart>
              </ResponsiveContainer>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

// --- MAIN APP ---

export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [businessType, setBusinessType] = useState('');
  
  const [selectedLocation, setSelectedLocation] = useState({ latitude: 28.6139, longitude: 77.2090 });
  const [viewState, setViewState] = useState({ latitude: 28.6139, longitude: 77.2090, zoom: 13 });
  const [geoData, setGeoData] = useState({ city: null, area: null });
  
  const [locationQuery, setLocationQuery] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  
  const [loadingState, setLoadingState] = useState(LoadingState.IDLE);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [competitorPins, setCompetitorPins] = useState([]); // Store real pins
  const [error, setError] = useState(null);
  const [hoveredPin, setHoveredPin] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [cityRes, areaRes] = await Promise.all([
          fetch('https://d3ucb59hn6tk5w.cloudfront.net/delhi_city.geojson'),
          fetch('https://d3ucb59hn6tk5w.cloudfront.net/delhi_area.geojson')
        ]);
        setGeoData({ city: await cityRes.json(), area: await areaRes.json() });
      } catch (e) { console.error("Map data error", e); }
    };
    fetchData();
  }, []);

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
    setCompetitorPins([]); // Clear old pins

    try {
      // 1. Fetch REAL pins from OpenStreetMap
      const realCompetitors = await fetchRealCompetitors(selectedLocation.latitude, selectedLocation.longitude, businessType);
      
      if (realCompetitors.length === 0) {
        throw new Error("No existing competitors found in this area on OSM.");
      }

      // 2. Enrich with Gemini
      const data = await analyzeWithGemini(
        apiKey, 
        businessType, 
        selectedLocation.latitude, 
        selectedLocation.longitude,
        locationQuery || "Selected Location",
        realCompetitors
      );

      // 3. Merge Real Locations with AI Ratings
      const mergedCompetitors = realCompetitors.map(real => {
        const enriched = data.enrichedCompetitors.find(e => e.name === real.name) || {};
        return { ...real, ...enriched };
      });

      setCompetitorPins(mergedCompetitors);
      
      // Update result with merged data
      setAnalysisResult({
        ...data,
        topCompetitors: mergedCompetitors
      });

      setLoadingState(LoadingState.SUCCESS);
    } catch (e) {
      console.error(e);
      setLoadingState(LoadingState.ERROR);
      setError(e.message || "Analysis failed.");
    }
  }, [apiKey, businessType, selectedLocation, locationQuery]);

  const onMapClick = (evt) => {
    const { lng, lat } = evt.lngLat;
    setSelectedLocation({ latitude: lat, longitude: lng });
    setLocationQuery("Custom Map Pin");
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-white font-sans">
      <div className="absolute inset-y-0 left-0 md:relative w-full md:w-auto z-20 pointer-events-none">
          <div className="h-full pointer-events-auto">
            <Sidebar
                businessType={businessType} setBusinessType={setBusinessType}
                onAnalyze={handleAnalysis} loadingState={loadingState}
                result={analysisResult} error={error}
                apiKey={apiKey} setApiKey={setApiKey}
                locationQuery={locationQuery} setLocationQuery={setLocationQuery}
                onLocationSearch={handleLocationSearch} locationSuggestions={locationSuggestions}
                onSelectLocation={handleSelectLocation}
            />
          </div>
      </div>

      <div className="flex-1 relative z-10">
        <Map
          {...viewState}
          onMove={evt => setViewState(evt.viewState)}
          style={{ width: '100%', height: '100%' }}
          mapStyle={MAP_STYLE_URL}
          onClick={onMapClick}
          cursor="crosshair"
        >
          <NavigationControl position="top-right" />
          
          {/* User Location Pin */}
          <Marker latitude={selectedLocation.latitude} longitude={selectedLocation.longitude} anchor="bottom">
             <div className="relative">
                <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-[0_0_15px_rgba(59,130,246,0.5)] animate-bounce" />
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-2 bg-black/50 blur-sm rounded-full" />
             </div>
          </Marker>

          {/* Competitor Pins (Red) */}
          {competitorPins.map((comp, idx) => (
            <Marker 
              key={idx} 
              latitude={comp.lat} 
              longitude={comp.lon} 
              anchor="bottom"
              onClick={e => {
                e.originalEvent.stopPropagation();
                setHoveredPin(comp);
              }}
            >
              <div className="group relative cursor-pointer">
                <MapPin className="w-6 h-6 text-red-500 fill-red-900 drop-shadow-md transition-transform hover:scale-110" />
              </div>
            </Marker>
          ))}

          {/* Popup for Competitors */}
          {hoveredPin && (
            <Popup
              latitude={hoveredPin.lat}
              longitude={hoveredPin.lon}
              onClose={() => setHoveredPin(null)}
              closeButton={true}
              closeOnClick={false}
              offset={15}
              className="text-black"
            >
              <div className="p-2 min-w-[150px]">
                <h3 className="font-bold text-sm">{hoveredPin.name}</h3>
                <div className="flex items-center gap-1 mt-1">
                  <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                  <span className="text-xs font-medium">{hoveredPin.rating || "N/A"}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{hoveredPin.address}</p>
              </div>
            </Popup>
          )}

          {geoData.city && <Source id="delhi-city" type="geojson" data={geoData.city}><Layer id="city-fill" type="fill" paint={{ 'fill-color': '#3b82f6', 'fill-opacity': 0.05 }} /></Source>}
          {geoData.area && <Source id="delhi-area" type="geojson" data={geoData.area}><Layer id="area-line" type="line" paint={{ 'line-color': '#34d399', 'line-width': 1, 'line-opacity': 0.3 }} /></Source>}
        </Map>
      </div>
    </div>
  );
}
