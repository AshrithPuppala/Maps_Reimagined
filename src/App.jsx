import React, { useState, useEffect, useCallback } from 'react';
import Map, { Source, Layer, NavigationControl, Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { TrendingUp, TrendingDown, Search, AlertCircle, Loader2, Building2, Key, Activity, Target } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'https://integrated-lovp.onrender.com';
const MAP_STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const LoadingState = {
  IDLE: 'IDLE',
  LOADING: 'LOADING',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR'
};

const searchLocationName = async (query) => {
  try {
    const url = 'https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(query + ' Delhi') + '&limit=5';
    const response = await fetch(url);
    const data = await response.json();
    return data.map(item => ({
      name: item.display_name.split(',')[0],
      fullName: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon)
    }));
  } catch (error) {
    console.error('Geocoding failed', error);
    return [];
  }
};

const analyzeLocationWithGemini = async (apiKey, businessType, lat, lng, locationName) => {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const prompt = 'I want to open a "' + businessType + '" at coordinates ' + lat + ', ' + lng + ' (Near ' + locationName + ') in Delhi, India. Act as a Business Strategy AI. Return ONLY valid JSON with this structure: {"locationName":"' + locationName + '","businessType":"' + businessType + '","stats":{"totalCompetitors":8,"averageRating":4.2,"priceLevelDistribution":[{"name":"Budget","value":30},{"name":"Moderate","value":50},{"name":"Premium","value":20}],"sentimentScore":75},"strengths":["Strength 1","Strength 2"],"weaknesses":["Weakness 1","Weakness 2"],"summary":"Executive summary.","topCompetitors":[{"name":"Name","rating":4.5,"address":"Address"}]}';
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(jsonString);
};

const analyzeRiskWithBackend = async (businessType, location, pincode) => {
  console.log('Request to:', API_URL + '/api/analyze');
  const response = await fetch(API_URL + '/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ businessType: businessType, location: location, pincode: pincode })
  });
  if (!response.ok) {
    throw new Error('Backend analysis failed: ' + response.status);
  }
  return await response.json();
};

const CompetitorCharts = function(props) {
  const stats = props.stats;
  const COLORS = ['#10b981', '#f59e0b', '#ef4444'];
  return (
    <div className="grid grid-cols-1 gap-6 mt-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 text-center">
          <p className="text-slate-400 text-xs uppercase">Competitors</p>
          <p className="text-2xl font-bold text-white">{stats.totalCompetitors}</p>
        </div>
        <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 text-center">
          <p className="text-slate-400 text-xs uppercase">Avg Rating</p>
          <p className="text-2xl font-bold text-yellow-400">{stats.averageRating}</p>
        </div>
        <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 text-center">
          <p className="text-slate-400 text-xs uppercase">Sentiment</p>
          <p className="text-2xl font-bold text-blue-400">{stats.sentimentScore}%</p>
        </div>
      </div>
      <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 h-64">
        <h3 className="text-xs font-semibold text-slate-300 mb-2">Market Segments</h3>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={stats.priceLevelDistribution} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={5} dataKey="value">
              {stats.priceLevelDistribution.map(function(entry, index) {
                return <Cell key={'cell-' + index} fill={COLORS[index % COLORS.length]} />;
              })}
            </Pie>
            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', color: '#fff' }} />
            <Legend verticalAlign="bottom" height={36} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const RiskAnalysisPanel = function(props) {
  const riskData = props.riskData;
  const getRiskColor = function(level) {
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
      <div className={'p-4 rounded-lg border-2 ' + getRiskColor(riskData.riskLevel)}>
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
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', color: '#fff' }} />
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
            {riskData.alternatives.map(function(alt, idx) {
              return (
                <div key={idx} className="bg-slate-900/50 p-3 rounded border border-slate-700">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-white text-sm">{alt.name}</p>
                      <p className="text-xs text-slate-400 mt-1">{alt.reason}</p>
                    </div>
                    <div className="bg-green-900/30 px-2 py-1 rounded">
                      <p className="text-xs text-green-400">Risk: {alt.base_risk}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {riskData.events && riskData.events.length > 0 && (
        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Nearby Future Events</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {riskData.events.slice(0, 5).map(function(event, idx) {
              return (
                <div key={idx} className="bg-slate-900/50 p-2 rounded border border-slate-700">
                  <p className="text-xs font-medium text-white">{event.name}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Distance: {Math.round(event.distance_meters)}m | Impact: {event.impact.sentiment}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const Sidebar = function(props) {
  return (
    <div className="h-full flex flex-col bg-slate-900/95 backdrop-blur-md border-r border-slate-700 w-full md:w-96 shadow-2xl overflow-hidden z-20 relative">
      <div className="p-6 border-b border-slate-700 bg-slate-900">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">Delhi Scout AI</h1>
        <p className="text-slate-400 text-sm mt-1">Business Intelligence Platform</p>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
          <p className="text-xs text-slate-400 mb-2 uppercase">Analysis Type</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={function() { props.setAnalysisMode('competitor'); }} className={'p-2 rounded text-sm font-medium transition-colors ' + (props.analysisMode === 'competitor' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600')}>Competitor</button>
            <button onClick={function() { props.setAnalysisMode('risk'); }} className={'p-2 rounded text-sm font-medium transition-colors ' + (props.analysisMode === 'risk' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600')}>Risk Analysis</button>
          </div>
        </div>
        {props.analysisMode === 'competitor' && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 uppercase">1. Gemini API Key</label>
            <div className="relative">
              <Key className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input type="password" value={props.apiKey} onChange={function(e) { props.setApiKey(e.target.value); }} placeholder="Paste Google Gemini Key" className="w-full bg-slate-800 border border-slate-700 text-white pl-9 pr-4 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>
        )}
        <div className="space-y-2 relative">
          <label className="text-xs font-medium text-slate-400 uppercase">{props.analysisMode === 'competitor' ? '2' : '1'}. Target Location</label>
          <div className="relative">
            <Activity className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input type="text" value={props.locationQuery} onChange={function(e) { props.setLocationQuery(e.target.value); if (e.target.value.length > 2) props.onLocationSearch(e.target.value); }} placeholder="Search Area (e.g. Connaught Place)" className="w-full bg-slate-800 border border-slate-700 text-white pl-9 pr-4 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          {props.locationSuggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-60 overflow-y-auto">
              {props.locationSuggestions.map(function(suggestion, idx) {
                return (
                  <div key={idx} onClick={function() { props.onSelectLocation(suggestion); }} className="px-4 py-3 hover:bg-slate-700 cursor-pointer border-b border-slate-700 last:border-0">
                    <p className="text-sm text-white font-medium">{suggestion.name}</p>
                    <p className="text-xs text-slate-400 truncate">{suggestion.fullName}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-400 uppercase">{props.analysisMode === 'competitor' ? '3' : '2'}. Business Type</label>
          <div className="flex gap-2">
            <input type="text" value={props.businessType} onChange={function(e) { props.setBusinessType(e.target.value); }} placeholder="e.g. Coffee Shop, Cafe" className="flex-1 bg-slate-800 border border-slate-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" onKeyDown={function(e) { if (e.key === 'Enter') props.onAnalyze(); }} />
            <button onClick={props.onAnalyze} disabled={props.loadingState === LoadingState.LOADING || (props.analysisMode === 'competitor' && !props.apiKey)} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center">
              {props.loadingState === LoadingState.LOADING ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {props.loadingState === LoadingState.ERROR && (
          <div className="bg-red-900/20 border border-red-800 text-red-200 p-4 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
            <div><p className="text-sm font-semibold">Analysis Failed</p><p className="text-xs mt-1">{props.error || 'Unknown error occurred'}</p></div>
          </div>
        )}
        {props.loadingState === LoadingState.SUCCESS && (
          <div className="animate-in fade-in duration-500">
            {props.analysisMode === 'competitor' && props.competitorResult && (
              <div className="space-y-6">
                <div className="border-b border-slate-700 pb-4">
                  <h2 className="text-xl font-semibold text-white">{props.competitorResult.locationName}</h2>
                  <p className="text-blue-400 text-xs font-medium uppercase mt-1">{props.competitorResult.businessType}</p>
                  <p className="text-slate-300 text-sm mt-3 leading-relaxed italic border-l-2 border-blue-500 pl-3">{props.competitorResult.summary}</p>
                </div>
                <CompetitorCharts stats={props.competitorResult.stats} />
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-900/10 border border-emerald-800/30 p-3 rounded-lg">
                    <h3 className="text-emerald-400 text-sm font-semibold mb-2 flex items-center gap-2"><TrendingUp className="w-3 h-3" /> Strengths</h3>
                    <ul className="list-disc list-inside text-xs text-slate-300 space-y-1">{props.competitorResult.strengths.map(function(s, i) { return <li key={i}>{s}</li>; })}</ul>
                  </div>
                  <div className="bg-red-900/10 border border-red-800/30 p-3 rounded-lg">
                    <h3 className="text-red-400 text-sm font-semibold mb-2 flex items-center gap-2"><TrendingDown className="w-3 h-3" /> Risks</h3>
                    <ul className="list-disc list-inside text-xs text-slate-300 space-y-1">{props.competitorResult.weaknesses.map(function(w, i) { return <li key={i}>{w}</li>; })}</ul>
                  </div>
                </div>
                <div>
                  <h3 className="text-slate-200 font-semibold mb-3 flex items-center gap-2 text-sm"><Building2 className="w-4 h-4 text-slate-400" /> Top Competitors</h3>
                  <div className="space-y-2">
                    {props.competitorResult.topCompetitors.map(function(comp, idx) {
                      return (
                        <div key={idx} className="bg-slate-800 p-3 rounded-md border border-slate-700 flex justify-between items-start">
                          <div><p className="font-medium text-slate-200 text-sm">{comp.name}</p><p className="text-xs text-slate-500 truncate max-w-xs">{comp.address}</p></div>
                          <div className="flex items-center bg-slate-900 px-2 py-1 rounded"><span className="text-yellow-400 text-xs font-bold">★</span><span className="text-xs text-white ml-1">{comp.rating}</span></div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            {props.analysisMode === 'risk' && props.riskResult && <RiskAnalysisPanel riskData={props.riskResult} />}
          </div>
        )}
      </div>
    </div>
  );
};

export default function App() {
  const state1 = useState('');
  const apiKey = state1[0];
  const setApiKey = state1[1];
  
  const state2 = useState('');
  const businessType = state2[0];
  const setBusinessType = state2[1];
  
  const state3 = useState('risk');
  const analysisMode = state3[0];
  const setAnalysisMode = state3[1];
  
  const state4 = useState({ latitude: 28.6139, longitude: 77.2090 });
  const selectedLocation = state4[0];
  const setSelectedLocation = state4[1];
  
  const state5 = useState({ latitude: 28.6139, longitude: 77.2090, zoom: 12 });
  const viewState = state5[0];
  const setViewState = state5[1];
  
  const state6 = useState({ city: null, area: null });
  const geoData = state6[0];
  const setGeoData = state6[1];
  
  const state7 = useState('');
  const locationQuery = state7[0];
  const setLocationQuery = state7[1];
  
  const state8 = useState([]);
  const locationSuggestions = state8[0];
  const setLocationSuggestions = state8[1];
  
  const state9 = useState(LoadingState.IDLE);
  const loadingState = state9[0];
  const setLoadingState = state9[1];
  
  const state10 = useState(null);
  const competitorResult = state10[0];
  const setCompetitorResult = state10[1];
  
  const state11 = useState(null);
  const riskResult = state11[0];
  const setRiskResult = state11[1];
  
  const state12 = useState(null);
  const error = state12[0];
  const setError = state12[1];

  useEffect(function() {
    const fetchData = async function() {
      try {
        const cityRes = await fetch('https://d3ucb59hn6tk5w.cloudfront.net/delhi_city.geojson');
        const areaRes = await fetch('https://d3ucb59hn6tk5w.cloudfront.net/delhi_area.geojson');
        setGeoData({ city: await cityRes.json(), area: await areaRes.json() });
      } catch (e) { 
        console.error('Map data error', e); 
      }
    };
    fetchData();
  }, []);

  const handleLocationSearch = useCallback(async function(query) {
    const results = await searchLocationName(query);
    setLocationSuggestions(results);
  }, []);

  const handleSelectLocation = function(suggestion) {
    const newCoords = { latitude: suggestion.lat, longitude: suggestion.lon };
    setSelectedLocation(newCoords);
    setViewState({ latitude: suggestion.lat, longitude: suggestion.lon, zoom: 14 });
    setLocationQuery(suggestion.name);
    setLocationSuggestions([]);
  };

  const handleAnalysis = useCallback(async function() {
    if (!businessType.trim()) {
      setError('Please enter a business type');
      setLoadingState(LoadingState.ERROR);
      return;
    }
    if (!locationQuery.trim()) {
      setError('Please select a location');
      setLoadingState(LoadingState.ERROR);
      return;
    }
    if (analysisMode === 'competitor' && !apiKey) {
      setError('API Key is required for competitor analysis');
      setLoadingState(LoadingState.ERROR);
      return;
    }
    setLoadingState(LoadingState.LOADING);
    setError(null);
    try {
      if (analysisMode === 'competitor') {
        const data = await analyzeLocationWithGemini(apiKey, businessType, selectedLocation.latitude, selectedLocation.longitude, locationQuery || 'Selected Location');
        setCompetitorResult(data);
        setRiskResult(null);
        setLoadingState(LoadingState.SUCCESS);
      } else {
        const data = await analyzeRiskWithBackend(businessType, locationQuery || 'Selected Location', '');
        setRiskResult(data);
        setCompetitorResult(null);
        setLoadingState(LoadingState.SUCCESS);
      }
    } catch (e) {
      console.error('Analysis error:', e);
      setLoadingState(LoadingState.ERROR);
      setError(analysisMode === 'competitor' ? 'AI Analysis failed: ' + e.message : 'Risk analysis failed: ' + e.message);
    }
  }, [apiKey, businessType, selectedLocation, locationQuery, analysisMode]);

  const onMapClick = function(evt) {
    const coords = evt.lngLat;
    setSelectedLocation({ latitude: coords.lat, longitude: coords.lng });
    setLocationQuery('Custom Map Pin');
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-y-0 left-0 md:relative w-full md:w-auto z-20 pointer-events-none">
        <div className="h-full pointer-events-auto">
          <Sidebar businessType={businessType} setBusinessType={setBusinessType} onAnalyze={handleAnalysis} loadingState={loadingState} competitorResult={competitorResult} riskResult={riskResult} error={error} apiKey={apiKey} setApiKey={setApiKey} locationQuery={locationQuery} setLocationQuery={setLocationQuery} onLocationSearch={handleLocationSearch} locationSuggestions={locationSuggestions} onSelectLocation={handleSelectLocation} analysisMode={analysisMode} setAnalysisMode={setAnalysisMode} />
        </div>
      </div>
      <div className="flex-1 relative z-10">
        <Map latitude={viewState.latitude} longitude={viewState.longitude} zoom={viewState.zoom} onMove={function(evt) { setViewState(evt.viewState); }} style={{ width: '100%', height: '100%' }} mapStyle={MAP_STYLE_URL} onClick={onMapClick} cursor="crosshair">
          <NavigationControl position="top-right" />
          <Marker latitude={selectedLocation.latitude} longitude={selectedLocation.longitude} anchor="bottom">
            <div className="relative">
              <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg animate-bounce" />
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-2 bg-black/50 blur-sm rounded-full" />
            </div>
          </Marker>
          {geoData.city && <Source id="delhi-city" type="geojson" data={geoData.city}><Layer id="city-fill" type="fill" paint={{ 'fill-color': '#3b82f6', 'fill-opacity': 0.05 }} /></Source>}
          {geoData.area && <Source id="delhi-area" type="geojson" data={geoData.area}><Layer id="area-line" type="line" paint={{ 'line-color': '#34d399', 'line-width': 1, 'line-opacity': 0.3 }} /></Source>}
        </Map>
      </div>
    </div>
  );
}
