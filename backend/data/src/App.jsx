import React, { useState, useEffect, useCallback } from 'react';
import Map, { Source, Layer, NavigationControl, Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { 
  MapPin, TrendingUp, TrendingDown, Search, AlertCircle, 
  Loader2, Building2, Key, Map as MapIcon, Activity, Target,
  ArrowRight, AlertTriangle, CheckCircle
} from 'lucide-react';

// Configuration
const MAP_STYLE_URL = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const LoadingState = {
  IDLE: 'IDLE',
  LOADING: 'LOADING',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR'
};

// Geocoding Service
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
    console.error("Geocoding failed", error);
    return [];
  }
};

// Gemini Analysis
const analyzeLocationWithGemini = async (apiKey, businessType, lat, lng, locationName) => {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    I want to open a "${businessType}" at coordinates ${lat}, ${lng} (Near ${locationName}) in Delhi, India.
    
    Act as a Business Strategy AI. 
    1. Identify 5-8 REAL existing competitors near this specific location.
    2. Estimate their ratings (0-5) and provide realistic market data.
    3. Provide a SWOT analysis for opening a ${businessType} here.

    Return ONLY valid JSON:
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
  const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(jsonString);
};

// Backend Risk Analysis
const analyzeRiskWithBackend = async (businessType, location, pincode) => {
  const response = await fetch(`${API_URL}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ businessType, location, pincode })
  });
  
  if (!response.ok) throw new Error('Backend analysis failed');
  return await response.json();
};

// Components
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

const RiskAnalysisPanel = ({ riskData }) => {
  const getRiskColor = (level) => {
    const colors = {
      'Low': 'text-green-400 border-green-800 bg-green-900/20',
      'Moderate': 'text-yellow-400 border-yellow-800 bg-yellow-900/20',
      'High': 'text-orange-400 border-orange-800 bg-orange-900/20',
      'Very High': 'text-red-400 border-red-800 bg-red-900/20'
    };
    return colors[level] || colors['Moderate'];
  };

  return (
    <div className="space-y-4">
      <div className={`p-4 rounded-lg border-2 ${getRiskColor(riskData.riskLevel)}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider opacity-80">Risk Assessment</p>
            <p className="text-3xl font-bold mt-1">{riskData.riskLevel}</p>
          </div>
          <div className="text-right">
            <p className="text-xs opacity-80">Risk Score</p>
            <p className="text-4xl font-bold">{riskData.riskScore}</p>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
        <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4" /> Impact Summary
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-900/20 border border-green-800/30 p-3 rounded">
            <p className="text-xs text-green-400">Positive Events</p>
            <p className="text-2xl font-bold text-white">{riskData.positiveCount}</p>
          </div>
          <div className="bg-red-900/20 border border-red-800/30 p-3 rounded">
            <p className="text-xs text-red-400">Risk Events</p>
            <p className="text-2xl font-bold text-white">{riskData.negativeCount}</p>
          </div>
        </div>
      </div>

      {riskData.projectionData && riskData.projectionData.length > 0 && (
        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 h-64">
          <h3 className="text-sm font-semibold text-slate-300 mb-2">10-Year Success Projection</h3>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={riskData.projectionData}>
              <XAxis dataKey="year" stroke="#94a3b8" style={{ fontSize: '11px' }} />
              <YAxis stroke="#94a3b8" style={{ fontSize: '11px' }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: 'none', color: '#fff' }} 
              />
              <Line type="monotone" dataKey="probability" stroke="#3b82f6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {riskData.alternatives && riskData.alternatives.length > 0 && (
        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <Target className="w-4 h-4" /> Alternative Locations
          </h3>
          <div className="space-y-2">
            {riskData.alternatives.map((alt, idx) => (
              <div key={idx} className="bg-slate-900/50 p-3 rounded border border-slate-700">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-white text-sm">{alt.area}</p>
                    <p className="text-xs text-slate-400 mt-1">{alt.reason}</p>
                  </div>
                  <div className="bg-green-900/30 px-2 py-1 rounded">
                    <p className="text-xs text-green-400">Risk: {alt.risk}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {riskData.events && riskData.events.length > 0 && (
        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Nearby Future Events</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {riskData.events.slice(0, 5).map((event, idx) => (
              <div key={idx} className="bg-slate-900/50 p-2 rounded border border-slate-700">
                <p className="text-xs font-medium text-white">{event.name}</p>
                <p className="text-[10px] text-slate-400 mt-1">
                  Distance: {Math.round(event.distance_meters)}m | 
                  Impact: {event.impact.sentiment}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const Sidebar = ({ 
  businessType, setBusinessType, onAnalyze, loadingState, 
  competitorResult, riskResult, error, apiKey, setApiKey,
  locationQuery, setLocationQuery, onLocationSearch, locationSuggestions, onSelectLocation,
  analysisMode, setAnalysisMode
}) => {
  return (
    <div className="h-full flex flex-col bg-slate-900/95 backdrop-blur-md border-r border-slate-700 w-full md:w-[450px] shadow-2xl overflow-hidden z-20 relative">
      <div className="p-6 border-b border-slate-700 bg-slate-900">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent flex items-center gap-2">
          Delhi Scout AI
        </h1>
        <p className="text-slate-400 text-sm mt-1">Complete Business Intelligence Platform</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* Analysis Mode Toggle */}
        <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
          <p className="text-xs text-slate-400 mb-2 uppercase tracking-wider">Analysis Type</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setAnalysisMode('competitor')}
              className={`p-2 rounded text-sm font-medium transition-colors ${
                analysisMode === 'competitor' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Competitor Analysis
            </button>
            <button
              onClick={() => setAnalysisMode('risk')}
              className={`p-2 rounded text-sm font-medium transition-colors ${
                analysisMode === 'risk' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Risk Analysis
            </button>
          </div>
        </div>

        {/* API Key (only for competitor mode) */}
        {analysisMode === 'competitor' && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 uppercase">1. Gemini API Key</label>
            <div className="relative">
              <Key className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste Google Gemini Key"
                className="w-full bg-slate-800 border border-slate-700 text-white pl-9 pr-4 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
        )}

        {/* Location Search */}
        <div className="space-y-2 relative">
          <label className="text-xs font-medium text-slate-400 uppercase">
            {analysisMode === 'competitor' ? '2' : '1'}. Target Location
          </label>
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
              className="w-full bg-slate-800 border border-slate-700 text-white pl-9 pr-4 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
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
          <label className="text-xs font-medium text-slate-400 uppercase">
            {analysisMode === 'competitor' ? '3' : '2'}. Business Type
          </label>
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
              disabled={loadingState === LoadingState.LOADING || (analysisMode === 'competitor' && !apiKey)}
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

        {/* Results Display */}
        {loadingState === LoadingState.SUCCESS && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {analysisMode === 'competitor' && competitorResult && (
              <div className="space-y-6">
                <div className="border-b border-slate-700 pb-4">
                  <h2 className="text-xl font-semibold text-white">{competitorResult.locationName}</h2>
                  <p className="text-blue-400 text-xs font-medium uppercase tracking-wide mt-1">
                    Analysis for: {competitorResult.businessType}
                  </p>
                  <p className="text-slate-300 text-sm mt-3 leading-relaxed italic border-l-2 border-blue-500 pl-3">
                    "{competitorResult.summary}"
                  </p>
                </div>

                <CompetitorCharts stats={competitorResult.stats} />

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-900/10 border border-emerald-800/30 p-3 rounded-lg">
                    <h3 className="text-emerald-400 text-sm font-semibold mb-2 flex items-center gap-2">
                      <TrendingUp className="w-3 h-3" /> Strengths
                    </h3>
                    <ul className="list-disc list-inside text-[11px] text-slate-300 space-y-1">
                      {competitorResult.strengths.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                  <div className="bg-red-900/10 border border-red-800/30 p-3 rounded-lg">
                    <h3 className="text-red-400 text-sm font-semibold mb-2 flex items-center gap-2">
                      <TrendingDown className="w-3 h-3" /> Risks
                    </h3>
                    <ul className="list-disc list-inside text-[11px] text-slate-300 space-y-1">
                      {competitorResult.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                </div>

                <div>
                  <h3 className="text-slate-200 font-semibold mb-3 flex items-center gap-2 text-sm">
                    <Building2 className="w-4 h-4 text-slate-400" /> Top Competitors
                  </h3>
                  <div className="space-y-2">
                    {competitorResult.topCompetitors.map((comp, idx) => (
                      <div key={idx} className="bg-slate-800 p-3 rounded-md border border-slate-700 flex justify-between items-start">
                        <div>
                          <p className="font-medium text-slate-200 text-sm">{comp.name}</p>
                          <p className="text-[10px] text-slate-500 truncate max-w-[150px]">{comp.address}</p>
                        </div>
                        <div className="flex items-center bg-slate-900 px-2 py-1 rounded">
                          <span className="text-yellow-400 text-xs font-bold">★</span>
                          <span className="text-xs text-white ml-1">{comp.rating}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {analysisMode === 'risk' && riskResult && (
              <RiskAnalysisPanel riskData={riskResult} />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Main App
export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [analysisMode, setAnalysisMode] = useState('competitor');
  
  const [selectedLocation, setSelectedLocation] = useState({ latitude: 28.6139, longitude: 77.2090 });
  const [viewState, setViewState] = useState({ latitude: 28.6139, longitude: 77.2090, zoom: 12 });
  const [geoData, setGeoData] = useState({ city: null, area: null });
  
  const [locationQuery, setLocationQuery] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  
  const [loadingState, setLoadingState] = useState(LoadingState.IDLE);
  const [competitorResult, setCompetitorResult] = useState(null);
  const [riskResult, setRiskResult] = useState(null);
  const [error, setError] = useState(null);

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
    setViewState({ ...newCoords, zoom: 14 });
    setLocationQuery(suggestion.name);
    setLocationSuggestions([]);
  };

  const handleAnalysis = useCallback(async () => {
    if (analysisMode === 'competitor' && !apiKey) {
      setError("API Key is required for competitor analysis");
      return;
    }
    
    setLoadingState(LoadingState.LOADING);
    setError(null);
    
    try {
      if (analysisMode === 'competitor') {
        const data = await analyzeLocationWithGemini(
          apiKey, businessType, selectedLocation.latitude, 
          selectedLocation.longitude, locationQuery || "Selected Location"
        );
        setCompetitorResult(data);
        setRiskResult(null);
      } else {
        const data = await analyzeRiskWithBackend(
          businessType, locationQuery || "Selected Location", ""
        );
        setRiskResult(data);
        setCompetitorResult(null);
      }
      
      setLoadingState(LoadingState.SUCCESS);
    } catch (e) {
      console.error(e);
      setLoadingState(LoadingState.ERROR);
      setError(analysisMode === 'competitor' 
        ? "AI Analysis failed. Check your API key." 
        : "Risk analysis failed. Check backend connection.");
    }
  }, [apiKey, businessType, selectedLocation, locationQuery, analysisMode]);

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
            competitorResult={competitorResult}
            riskResult={riskResult}
            error={error}
            apiKey={apiKey}
            setApiKey={setApiKey}
            locationQuery={locationQuery}
            setLocationQuery={setLocationQuery}
            onLocationSearch={handleLocationSearch}
            locationSuggestions={locationSuggestions}
            onSelectLocation={handleSelectLocation}
            analysisMode={analysisMode}
            setAnalysisMode={setAnalysisMode}
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
          
          <Marker latitude={selectedLocation.latitude} longitude={selectedLocation.longitude} anchor="bottom">
            <div className="relative">
              <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg animate-bounce" />
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-2 bg-black/50 blur-sm rounded-full" />
            </div>
          </Marker>

          {geoData.city && (
            <Source id="delhi-city" type="geojson" data={geoData.city}>
              <Layer id="city-fill" type="fill" paint={{ 'fill-color': '#3b82f6', 'fill-opacity': 0.05 }} />
            </Source>
          )}
          {geoData.area && (
            <Source id="delhi-area" type="geojson" data={geoData.area}>
              <Layer id="area-line" type="line" paint={{ 'line-color': '#34d399', 'line-width': 1, 'line-opacity': 0.3 }} />
            </Source>
          )}
        </Map>
      </div>
    </div>
  );
}
