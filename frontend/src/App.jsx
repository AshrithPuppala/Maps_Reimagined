import React, { useState, useEffect } from 'react';
import { MapPin, TrendingUp, AlertTriangle, Calendar, Building2, Search, Loader2, Wifi, WifiOff } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// PRODUCTION: Use environment variable for API URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const IS_PRODUCTION = process.env.REACT_APP_ENV === 'production';

// Mock future events dataset for Delhi
const FUTURE_EVENTS = {
  "connaught place": [
    { type: "metro", name: "CP Metro Expansion - Phase 5", impact: "positive", date: "2025-06", severity: 0.3, description: "New metro entrance at Janpath" },
    { type: "construction", name: "Rajiv Chowk Station Renovation", impact: "negative", date: "2025-03", severity: 0.7, description: "18-month renovation blocking main entrance" }
  ],
  "karol bagh": [
    { type: "metro", name: "Karol Bagh-Patel Nagar Link", impact: "positive", date: "2026-12", severity: 0.4, description: "Improved connectivity" },
    { type: "construction", name: "Pusa Road Widening", impact: "negative", date: "2025-08", severity: 0.8, description: "2-year road construction project" }
  ],
  "saket": [
    { type: "mall", name: "DLF Mega Mall Renovation", impact: "negative", date: "2025-05", severity: 0.4, description: "6-month closure for upgrades" },
    { type: "college", name: "Amity University New Campus", impact: "positive", date: "2026-07", severity: 0.5, description: "15,000 students expected" }
  ],
  "dwarka": [
    { type: "metro", name: "Dwarka-Gurugram Metro Link", impact: "positive", date: "2027-01", severity: 0.6, description: "Direct connectivity to Cyber City" },
    { type: "construction", name: "Sector 21 Flyover Construction", impact: "negative", date: "2025-11", severity: 0.5, description: "14-month construction blocking main road" }
  ],
  "rohini": [
    { type: "mall", name: "Unity One Mall Expansion", impact: "positive", date: "2026-03", severity: 0.3, description: "Adding 200 new stores" },
    { type: "construction", name: "Rohini-Bahadurgarh Road", impact: "negative", date: "2025-09", severity: 0.6, description: "Road construction for 20 months" }
  ]
};

// Business type seasonality data
const BUSINESS_SEASONALITY = {
  "restaurant": { summer_drop: 0.15, festival_boost: 0.4, weekend_boost: 0.3 },
  "cafe": { summer_drop: 0.25, festival_boost: 0.2, weekend_boost: 0.25 },
  "retail": { summer_drop: 0.1, festival_boost: 0.6, weekend_boost: 0.2 },
  "gym": { summer_drop: 0.3, festival_boost: 0.1, weekend_boost: 0.1 },
  "bookstore": { summer_drop: 0.4, festival_boost: 0.15, weekend_boost: 0.15 }
};

// Area gentrification data
const AREA_TRENDS = {
  "connaught place": { trend: "stable", temp: 85, cafes_6mo: 2, rent_change: 0.05 },
  "karol bagh": { trend: "declining", temp: 45, cafes_6mo: 0, rent_change: -0.03 },
  "saket": { trend: "heating", temp: 75, cafes_6mo: 8, rent_change: 0.12 },
  "dwarka": { trend: "heating", temp: 70, cafes_6mo: 6, rent_change: 0.10 },
  "rohini": { trend: "stable", temp: 60, cafes_6mo: 3, rent_change: 0.04 }
};

const PredictiveBusinessAnalyzer = () => {
  const [businessType, setBusinessType] = useState('');
  const [location, setLocation] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [coldStart, setColdStart] = useState(false);
  const [backendStatus, setBackendStatus] = useState('unknown');

  // Check backend connectivity on mount
  useEffect(() => {
    checkBackendHealth();
  }, []);

  const checkBackendHealth = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      if (response.ok) {
        setBackendStatus('connected');
      } else {
        setBackendStatus('error');
      }
    } catch (err) {
      console.error('Backend health check failed:', err);
      setBackendStatus('disconnected');
    }
  };

  const analyzeLocation = async () => {
    setLoading(true);
    setError(null);
    setColdStart(false);

    // Show cold start warning after 10 seconds (Render free tier)
    const coldStartTimer = setTimeout(() => {
      if (loading) {
        setColdStart(true);
      }
    }, 10000);

    try {
      // Production: Try to fetch from backend API
      if (IS_PRODUCTION && backendStatus === 'connected') {
        try {
          const response = await fetch(`${API_BASE_URL}/api/analyze`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              business_type: businessType,
              location: location
            }),
            signal: AbortSignal.timeout(60000) // 60 second timeout for cold start
          });

          if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
          }

          const data = await response.json();
          
          // Use backend data if available
          setAnalysis(data);
          clearTimeout(coldStartTimer);
          setLoading(false);
          return;
        } catch (apiError) {
          console.error('API call failed, falling back to local analysis:', apiError);
          // Fall through to local analysis
        }
      }

      // Fallback: Local analysis (for offline or API failure)
      setTimeout(() => {
        const localAnalysis = performLocalAnalysis();
        setAnalysis(localAnalysis);
        clearTimeout(coldStartTimer);
        setLoading(false);
      }, 1500);

    } catch (err) {
      console.error('Analysis error:', err);
      setError('Failed to analyze location. Please try again.');
      clearTimeout(coldStartTimer);
      setLoading(false);
    }
  };

  const performLocalAnalysis = () => {
    const locationLower = location.toLowerCase();
    const events = FUTURE_EVENTS[locationLower] || [];
    const trend = AREA_TRENDS[locationLower] || { trend: "unknown", temp: 50, cafes_6mo: 0, rent_change: 0 };
    const seasonality = BUSINESS_SEASONALITY[businessType.toLowerCase()] || { summer_drop: 0.2, festival_boost: 0.3, weekend_boost: 0.2 };

    // Calculate risk score
    let riskScore = 50;
    const positiveEvents = events.filter(e => e.impact === "positive");
    const negativeEvents = events.filter(e => e.impact === "negative");
    
    negativeEvents.forEach(e => riskScore += e.severity * 20);
    positiveEvents.forEach(e => riskScore -= e.severity * 15);
    
    if (trend.trend === "declining") riskScore += 15;
    if (trend.trend === "heating") riskScore -= 10;
    
    riskScore = Math.max(0, Math.min(100, riskScore));

    // Generate 10-year risk projection
    const riskProjection = [];
    for (let year = 0; year <= 10; year++) {
      let yearRisk = riskScore;
      
      events.forEach(event => {
        const eventYear = new Date(event.date).getFullYear() - 2025 + year;
        if (eventYear >= 0 && eventYear <= year) {
          if (event.impact === "negative") {
            yearRisk += event.severity * 15 * Math.exp(-0.3 * (year - eventYear));
          } else {
            yearRisk -= event.severity * 12 * Math.exp(-0.2 * (year - eventYear));
          }
        }
      });
      
      if (trend.trend === "heating") yearRisk -= year * 2;
      if (trend.trend === "declining") yearRisk += year * 1.5;
      
      yearRisk = Math.max(0, Math.min(100, yearRisk));
      
      riskProjection.push({
        year: 2025 + year,
        risk: Math.round(yearRisk),
        label: year === 0 ? "Now" : `+${year}y`
      });
    }

    // Determine recommendations
    const alternatives = [];
    if (riskScore > 60) {
      const allLocations = Object.keys(FUTURE_EVENTS);
      allLocations.forEach(loc => {
        if (loc !== locationLower) {
          const locTrend = AREA_TRENDS[loc];
          if (locTrend && locTrend.trend !== "declining") {
            alternatives.push({
              type: "location",
              name: loc.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
              reason: `Lower construction risk, ${locTrend.trend} neighborhood`
            });
          }
        }
      });
    }

    return {
      riskScore,
      events,
      trend,
      seasonality,
      riskProjection,
      alternatives: alternatives.slice(0, 2),
      insights: generateInsights(events, trend, seasonality, businessType)
    };
  };

  const generateInsights = (events, trend, seasonality, business) => {
    const insights = [];
    
    const negativeEvents = events.filter(e => e.impact === "negative");
    const positiveEvents = events.filter(e => e.impact === "positive");
    
    if (negativeEvents.length > 0) {
      const worst = negativeEvents.reduce((max, e) => e.severity > max.severity ? e : max);
      insights.push({
        type: "warning",
        title: "Critical Risk Detected",
        message: `${worst.name} starting ${worst.date} will severely impact accessibility. ${worst.description}`
      });
    }
    
    if (positiveEvents.length > 0) {
      const best = positiveEvents.reduce((max, e) => e.severity > max.severity ? e : max);
      insights.push({
        type: "opportunity",
        title: "Future Opportunity",
        message: `${best.name} by ${best.date} will boost foot traffic. ${best.description}`
      });
    }
    
    if (trend.trend === "heating") {
      insights.push({
        type: "info",
        title: "Gentrifying Area",
        message: `${trend.cafes_6mo} new cafes opened recently. Expect rent to increase ${(trend.rent_change * 100).toFixed(0)}% annually.`
      });
    }
    
    if (trend.trend === "declining") {
      insights.push({
        type: "warning",
        title: "Area in Decline",
        message: "Decreasing business activity detected. Consider alternative locations."
      });
    }
    
    if (seasonality.summer_drop > 0.2) {
      insights.push({
        type: "info",
        title: "Seasonal Impact",
        message: `Expect ${(seasonality.summer_drop * 100).toFixed(0)}% revenue drop during summer months (June-July).`
      });
    }
    
    return insights;
  };

  const getRiskColor = (risk) => {
    if (risk < 40) return "text-green-600 bg-green-50 border-green-200";
    if (risk < 70) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  const getRiskLabel = (risk) => {
    if (risk < 40) return "Low Risk";
    if (risk < 70) return "Moderate Risk";
    return "High Risk";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2 flex items-center justify-center gap-3">
            <MapPin className="text-blue-600" size={40} />
            Delhi Business Predictor
          </h1>
          <p className="text-slate-600">AI-Powered Location Analysis for Smart Business Decisions</p>
          
          {/* Backend Status Indicator */}
          <div className="mt-4 flex items-center justify-center gap-2">
            {backendStatus === 'connected' && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <Wifi size={16} />
                API Connected
              </span>
            )}
            {backendStatus === 'disconnected' && (
              <span className="flex items-center gap-1 text-sm text-yellow-600">
                <WifiOff size={16} />
                Offline Mode (Using Local Data)
              </span>
            )}
            {backendStatus === 'error' && (
              <span className="flex items-center gap-1 text-sm text-red-600">
                <WifiOff size={16} />
                API Error (Using Local Data)
              </span>
            )}
          </div>
        </div>

        {/* Input Section */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Business Type</label>
              <select
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select business type...</option>
                <option value="restaurant">Restaurant</option>
                <option value="cafe">Cafe</option>
                <option value="retail">Retail Store</option>
                <option value="gym">Gym/Fitness Center</option>
                <option value="bookstore">Bookstore</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Location in Delhi</label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select location...</option>
                <option value="connaught place">Connaught Place</option>
                <option value="karol bagh">Karol Bagh</option>
                <option value="saket">Saket</option>
                <option value="dwarka">Dwarka</option>
                <option value="rohini">Rohini</option>
              </select>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {/* Cold Start Warning */}
          {coldStart && (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
              <div className="flex items-center gap-2">
                <Loader2 className="animate-spin" size={20} />
                <span className="font-semibold">Server is starting up...</span>
              </div>
              <p className="text-sm mt-1">
                First request may take 30-50 seconds on free tier. Please wait...
              </p>
            </div>
          )}

          <button
            onClick={analyzeLocation}
            disabled={!businessType || !location || loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                {coldStart ? 'Starting server...' : 'Processing Analysis...'}
              </>
            ) : (
              <>
                <Search size={20} />
                Analyze Location
              </>
            )}
          </button>

          {/* API Info */}
          <div className="mt-4 text-xs text-slate-500 text-center">
            API Endpoint: {API_BASE_URL} | Mode: {IS_PRODUCTION ? 'Production' : 'Development'}
          </div>
        </div>

        {/* Results Section */}
        {analysis && (
          <div className="space-y-6 animate-fade-in">
            {/* Risk Score */}
            <div className={`rounded-xl shadow-lg p-6 border-2 ${getRiskColor(analysis.riskScore)}`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold">{getRiskLabel(analysis.riskScore)}</h2>
                  <p className="text-sm opacity-80">Overall Risk Assessment</p>
                </div>
                <div className="text-5xl font-bold">{Math.round(analysis.riskScore)}</div>
              </div>
              <div className="w-full bg-white rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${
                    analysis.riskScore < 40 ? 'bg-green-500' : 
                    analysis.riskScore < 70 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${analysis.riskScore}%` }}
                ></div>
              </div>
            </div>

            {/* Key Insights */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <AlertTriangle size={24} className="text-blue-600" />
                Key Insights
              </h3>
              <div className="space-y-3">
                {analysis.insights.map((insight, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-lg border-l-4 ${
                      insight.type === 'warning' ? 'bg-red-50 border-red-500' :
                      insight.type === 'opportunity' ? 'bg-green-50 border-green-500' :
                      'bg-blue-50 border-blue-500'
                    }`}
                  >
                    <h4 className="font-semibold mb-1">{insight.title}</h4>
                    <p className="text-sm opacity-90">{insight.message}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Future Events Timeline */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Calendar size={24} className="text-blue-600" />
                Upcoming Events & Infrastructure Changes
              </h3>
              {analysis.events.length > 0 ? (
                <div className="space-y-3">
                  {analysis.events.map((event, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-lg border ${
                        event.impact === 'negative' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              event.type === 'metro' ? 'bg-blue-100 text-blue-700' :
                              event.type === 'construction' ? 'bg-orange-100 text-orange-700' :
                              event.type === 'mall' ? 'bg-purple-100 text-purple-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {event.type.toUpperCase()}
                            </span>
                            <span className="text-sm text-slate-600">{event.date}</span>
                          </div>
                          <h4 className="font-semibold">{event.name}</h4>
                          <p className="text-sm mt-1 text-slate-600">{event.description}</p>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          event.impact === 'negative' ? 'bg-red-200 text-red-800' : 'bg-green-200 text-green-800'
                        }`}>
                          {event.impact === 'negative' ? '⚠️ Risk' : '✓ Opportunity'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-center py-4">No major events detected for this area</p>
              )}
            </div>

            {/* 10-Year Risk Projection */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <TrendingUp size={24} className="text-blue-600" />
                10-Year Risk Projection
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={analysis.riskProjection}>
                  <defs>
                    <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis domain={[0, 100]} label={{ value: 'Risk Score', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="risk" stroke="#ef4444" fillOpacity={1} fill="url(#riskGradient)" />
                </AreaChart>
              </ResponsiveContainer>
              <div className="mt-4 flex items-center justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span>Low Risk (0-40)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span>Moderate (40-70)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span>High Risk (70+)</span>
                </div>
              </div>
            </div>

            {/* Neighborhood Trends */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Building2 size={24} className="text-blue-600" />
                Neighborhood Temperature
              </h3>
              <div className="flex items-center gap-6">
                <div className="flex-1">
                  <div className="mb-2 flex justify-between items-center">
                    <span className="font-semibold">Gentrification Index</span>
                    <span className={`font-bold ${
                      analysis.trend.temp > 70 ? 'text-red-600' :
                      analysis.trend.temp > 50 ? 'text-yellow-600' : 'text-blue-600'
                    }`}>{analysis.trend.temp}°</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-4">
                    <div
                      className={`h-4 rounded-full transition-all ${
                        analysis.trend.temp > 70 ? 'bg-red-500' :
                        analysis.trend.temp > 50 ? 'bg-yellow-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${analysis.trend.temp}%` }}
                    ></div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                    <div className="text-center">
                      <div className="font-semibold text-slate-700">Trend</div>
                      <div className={`font-bold capitalize ${
                        analysis.trend.trend === 'heating' ? 'text-red-600' :
                        analysis.trend.trend === 'declining' ? 'text-blue-600' : 'text-slate-600'
                      }`}>{analysis.trend.trend}</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-slate-700">New Cafes (6mo)</div>
                      <div className="font-bold text-slate-800">{analysis.trend.cafes_6mo}</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-slate-700">Rent Change</div>
                      <div className={`font-bold ${analysis.trend.rent_change > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {analysis.trend.rent_change > 0 ? '+' : ''}{(analysis.trend.rent_change * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recommendations */}
            {analysis.alternatives.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-slate-800 mb-4">Alternative Recommendations</h3>
                <div className="space-y-3">
                  {analysis.alternatives.map((alt, idx) => (
                    <div key={idx} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
                          {alt.type.toUpperCase()}
                        </span>
                        <h4 className="font-semibold">{alt.name}</h4>
                      </div>
                      <p className="text-sm text-slate-600">{alt.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PredictiveBusinessAnalyzer;
