import React, { useState, useEffect, useCallback } from 'react';
import Map, { NavigationControl, Marker, Source, Layer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { 
  TrendingUp, TrendingDown, Search, AlertCircle, 
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

// 1. Geocoding Service (Free OpenStreetMap - No Key Required)
const searchLocationName = async (query) => {
  try {
    const searchQuery = query.toLowerCase().includes('delhi') ? query : `${query} Delhi`;
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`
    );
    const data = await response.json();
    return data.map(item => ({
      name: item.display_name.split(',')[0],
      fullName: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon)
    }));
  } catch (error) {
    console.error("Geocoding failed", error);
    return [];
  }
};

// 2. Gemini Analysis Service
const analyzeLocationWithGemini = async (apiKey, businessType, lat, lng, locationName) => {
  const genAI = new GoogleGenerativeAI(apiKey);
  // Using 1.5-flash as it is the current standard efficient model
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    I want to open a "${businessType}" at coordinates ${lat}, ${lng} (Near ${locationName}) in Delhi, India.
    
    Act as a Business Strategy AI. 
    1. Identify 5-8 REAL existing competitors near this specific location using your internal knowledge.
    2. Estimate their ratings (0-5) and daily footfall based on the area's popularity.
    3. Provide a SWOT analysis for opening a ${businessType} here.

    Return ONLY valid JSON with this structure:
    {
      "locationName": "${locationName}",
      "businessType": "${businessType}",
      "stats": {
        "totalCompetitors": 8,
        "averageRating": 4.2,
        "priceLevelDistribution": [
           { "name": "Budget", "value": 30 },
           { "name": "Moderate", "value": 50 },
           { "name": "Premium", "value": 20 }
        ],
        "sentimentScore": 75
      },
      "strengths": ["Strength 1", "Strength 2", "Strength 3"],
      "weaknesses": ["Weakness 1", "Weakness 2", "Weakness 3"],
      "summary": "Executive summary string.",
      "topCompetitors": [
        { "name": "Name", "rating": 4.5, "address": "Short address" }
      ]
    }
  `;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  // Cleanup markdown formatting if Gemini adds it
  const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(jsonString);
};

// --- COMPONENTS ---

const CompetitorCharts = ({ stats }) => {
  const COLORS = ['#10b981', '#f59e0b', '#ef4444'];
  
  return (
    <div className="grid grid-cols-1 gap-6 mt-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 text-center">
          <p className="text-slate-400 text-[10px] uppercase tracking-wider">Competitors</p>
          <p className="text-2xl font-bold text-white">{stats.totalCompetitors}</p>
        </div>
        <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 text-center">
            <p className="text-slate-400 text-[10px] uppercase tracking-wider">Avg Rating</p>
            <p className="text-2xl font-bold text-yellow-400">{stats.averageRating}</p>
        </div>
        <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 text-center">
          <p className="text-slate-400 text-[10px] uppercase tracking-wider">Sentiment</p>
          <p className="text-2xl font-bold text-blue-400">{stats.sentimentScore}%</p>
        </div>
      </div>

      <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 h-64">
        <h3 className="text-xs font-semibold text-slate-300 mb-2">Market Segments</h3>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={stats.priceLevelDistribution}
              cx="50%" cy="50%"
              innerRadius={40} outerRadius={70}
              paddingAngle={5}
              dataKey="value"
            >
              {stats.priceLevelDistribution.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', color: '#fff' }} />
            <Legend verticalAlign="bottom" height={36} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const Sidebar = ({ 
  businessType, setBusinessType, onAnalyze, loadingState, result, error, apiKey, setApiKey,
  locationQuery, setLocationQuery, onLocationSearch, locationSuggestions, onSelectLocation
}) => {
  return (
    <div className="h-full flex flex-col bg-slate-900/95 backdrop-blur-md border-r border-slate-700 w-full md:w-[450px] shadow-2xl overflow-hidden z-20 relative">
      <div className="p-6 border-b border-slate-700 bg-slate-900">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent flex items-center gap-2">
          Delhi Scout AI
        </h1>
        <p className="text-slate-400 text-sm mt-1">Real-time Location Intelligence</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* API Key */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-400 uppercase">1. Gemini API Key</label>
          <div className="relative">
            <Key className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste Google Gemini Key"
              className="w-full bg-slate-800 border border-slate-700 text-white pl-9 pr-4 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none placeholder-slate-500"
            />
          </div>
        </div>

        {/* Location Search */}
        <div className="space-y-2 relative">
          <label className="text-xs font-medium text-slate-400 uppercase">2. Target Location</label>
          <div className="relative">
            <MapIcon className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={locationQuery}
              onChange={(e) => {
                setLocationQuery(e.target.value);
                if(e.target.value.length > 2) onLocationSearch(e.target.value);
              }}
              placeholder="Search Area (e.g. Connaught Place)"
              className="w-full bg-slate-800 border border-slate-700 text-white pl-9 pr-4 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none placeholder-slate-500"
            />
          </div>
          {/* Suggestions Dropdown */}
          {locationSuggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-60 overflow-y-auto">
              {locationSuggestions.map((suggestion, idx) => (
                <div 
                  key={idx} 
                  onClick={() => onSelectLocation(suggestion)}
                  className="px-4 py-3 hover:bg-slate-700 cursor-pointer border-b border-slate-700 last:border-0"
                >
                  <p className="text-sm text-white font-medium">{suggestion.name}</p>
                  <p className="text-xs text-slate-400 truncate">{suggestion.fullName}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Business Type */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-400 uppercase">3. Business Type</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              placeholder="e.g. Coffee Shop, Gym"
              className="flex-1 bg-slate-800 border border-slate-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              onKeyDown={(e) => e.key === 'Enter' && onAnalyze()}
            />
            <button
              onClick={onAnalyze}
              disabled={loadingState === LoadingState.LOADING || !apiKey}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center"
            >
              {loadingState === LoadingState.LOADING ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Search className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {loadingState === LoadingState.ERROR && (
          <div className="bg-red-900/20 border border-red-800 text-red-200 p-4 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
            <p className="text-sm">{error || "Analysis failed."}</p>
          </div>
        )}

        {result && loadingState === LoadingState.SUCCESS && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="border-b border-slate-700 pb-4">
              <h2 className="text-xl font-semibold text-white">{result.locationName}</h2>
              <p className="text-blue-400 text-xs font-medium uppercase tracking-wide mt-1">
                Analysis for: {result.businessType}
              </p>
              <p className="text-slate-300 text-sm mt-3 leading-relaxed italic border-l-2 border-blue-500 pl-3">
                "{result.summary}"
              </p>
            </div>

            <CompetitorCharts stats={result.stats} />

            <div className="grid grid-cols-2 gap-3">
               <div className="bg-emerald-900/10 border border-emerald-800/30 p-3 rounded-lg">
                 <h3 className="text-emerald-400 text-sm font-semibold mb-2 flex items-center gap-2">
                   <TrendingUp className="w-3 h-3" /> Strengths
                 </h3>
                 <ul className="list-disc list-inside text-[11px] text-slate-300 space-y-1">
                   {result.strengths.map((s, i) => <li key={i}>{s}</li>)}
                 </ul>
               </div>
               <div className="bg-red-900/10 border border-red-800/30 p-3 rounded-lg">
                 <h3 className="text-red-400 text-sm font-semibold mb-2 flex items-center gap-2">
                   <TrendingDown className="w-3 h-3" /> Risks
                 </h3>
                 <ul className="list-disc list-inside text-[11px] text-slate-300 space-y-1">
                   {result.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                 </ul>
               </div>
            </div>

            <div>
              <h3 className="text-slate-200 font-semibold mb-3 flex items-center gap-2 text-sm">
                <Building2 className="w-4 h-4 text-slate-400" /> Top Competitors
              </h3>
              <div className="space-y-2">
                {result.topCompetitors.map((comp, idx) => (
                  <div key={idx} className="bg-slate-800 p-3 rounded-md border border-slate-700 flex justify-between items-start">
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
  
  // Map & Location State
  const [selectedLocation, setSelectedLocation] = useState({ latitude: 28.6139, longitude: 77.2090 });
  const [viewState, setViewState] = useState({ latitude: 28.6139, longitude: 77.2090, zoom: 12 });
  
  // Search State
  const [locationQuery, setLocationQuery] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  
  // Analysis State
  const [loadingState, setLoadingState] = useState(LoadingState.IDLE);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState(null);

  // Handle Location Search
  const handleLocationSearch = useCallback(async (query) => {
    const results = await searchLocationName(query);
    setLocationSuggestions(results);
  }, []);

  // Handle Selecting a Location
  const handleSelectLocation = (suggestion) => {
    const newCoords = { latitude: suggestion.lat, longitude: suggestion.lon };
    setSelectedLocation(newCoords);
    setViewState({ ...newCoords, zoom: 14 }); 
    setLocationQuery(suggestion.name);
    setLocationSuggestions([]);
  };

  // Handle Analysis
  const handleAnalysis = useCallback(async () => {
    if (!apiKey) return setError("API Key is required");
    setLoadingState(LoadingState.LOADING);
    setError(null);
    try {
      const data = await analyzeLocationWithGemini(
        apiKey, 
        businessType, 
        selectedLocation.latitude, 
        selectedLocation.longitude,
        locationQuery || "Selected Location"
      );
      setAnalysisResult(data);
      setLoadingState(LoadingState.SUCCESS);
    } catch (e) {
      console.error(e);
      setLoadingState(LoadingState.ERROR);
      setError("AI Analysis failed. Please check your API key.");
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
                businessType={businessType}
                setBusinessType={setBusinessType}
                onAnalyze={handleAnalysis}
                loadingState={loadingState}
                result={analysisResult}
                error={error}
                apiKey={apiKey}
                setApiKey={setApiKey}
                locationQuery={locationQuery}
                setLocationQuery={setLocationQuery}
                onLocationSearch={handleLocationSearch}
                locationSuggestions={locationSuggestions}
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
          
          <Marker 
            latitude={selectedLocation.latitude} 
            longitude={selectedLocation.longitude} 
            anchor="bottom"
          >
             <div className="relative">
                <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg animate-bounce" />
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-2 bg-black/50 blur-sm rounded-full" />
             </div>
          </Marker>
        </Map>
      </div>
    </div>
  );
}
