import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AlertCircle, TrendingUp, TrendingDown, MapPin, Calendar, AlertTriangle, Loader } from 'lucide-react';
import axios from 'axios';

// Updated API URL configuration for production
const API_URL = process.env.REACT_APP_API_URL || 'https://maps-reimagined-prediction.onrender.com';

const BusinessFeasibilityTool = () => {
  const [businessType, setBusinessType] = useState('');
  const [location, setLocation] = useState('');
  const [pincode, setPincode] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const analyzeLocation = async () => {
    if (!businessType || !location) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.post(`${API_URL}/api/analyze`, {
        businessType,
        location,
        pincode
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });

      setAnalysis(response.data);
    } catch (err) {
      if (err.code === 'ECONNABORTED') {
        setError('Request timeout. The server took too long to respond. Please try again.');
      } else if (err.response) {
        setError(err.response?.data?.error || `Server error: ${err.response.status}. Please try again.`);
      } else if (err.request) {
        setError('Unable to reach the server. Please check your connection and try again.');
      } else {
        setError('Failed to analyze location. Please try again.');
      }
      console.error('Analysis error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (score) => {
    if (score < 30) return 'text-green-600';
    if (score < 50) return 'text-yellow-600';
    if (score < 70) return 'text-orange-600';
    return 'text-red-600';
  };

  const getRiskBgColor = (score) => {
    if (score < 30) return 'bg-green-50 border-green-500';
    if (score < 50) return 'bg-yellow-50 border-yellow-500';
    if (score < 70) return 'bg-orange-50 border-orange-500';
    return 'bg-red-50 border-red-500';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-indigo-900 mb-3">
            Delhi Business Feasibility Tool
          </h1>
          <p className="text-gray-600 text-lg">
            Predictive analysis for business success in Delhi NCR
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Powered by real-time future development data
          </p>
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-500">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Connected to API: {API_URL}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-2xl p-6 md:p-8 mb-8 border border-indigo-100">
          <h2 className="text-2xl font-semibold mb-6 text-gray-800 flex items-center gap-2">
            <MapPin className="w-6 h-6 text-indigo-600" />
            Enter Business Details
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Business Type *
              </label>
              <input
                type="text"
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                placeholder="e.g., Cafe, Restaurant, Gym"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Area Name *
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Connaught Place"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pincode (Optional)
              </label>
              <input
                type="text"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="e.g., 110001"
                maxLength="6"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={analyzeLocation}
            disabled={!businessType || !location || loading}
            className="mt-6 w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Analyzing...
              </>
            ) : (
              'Analyze Feasibility'
            )}
          </button>
        </div>

        {analysis && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-2xl p-6 md:p-8 border border-indigo-100">
              <h2 className="text-2xl font-semibold mb-6 text-gray-800">Risk Assessment</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className={`border-l-4 p-6 rounded-lg ${getRiskBgColor(analysis.riskScore)}`}>
                  <p className="text-gray-600 mb-2">Overall Risk Score</p>
                  <div className="flex items-baseline gap-3">
                    <span className={`text-6xl font-bold ${getRiskColor(analysis.riskScore)}`}>
                      {analysis.riskScore}%
                    </span>
                    <span className={`text-xl font-semibold ${getRiskColor(analysis.riskScore)}`}>
                      {analysis.riskLevel} Risk
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-1 bg-gradient-to-br from-green-50 to-green-100 px-4 py-6 rounded-lg border border-green-200">
                    <TrendingUp className="w-8 h-8 text-green-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 text-center mb-1">Positive Events</p>
                    <p className="text-3xl font-bold text-green-600 text-center">{analysis.positiveCount}</p>
                  </div>
                  <div className="flex-1 bg-gradient-to-br from-red-50 to-red-100 px-4 py-6 rounded-lg border border-red-200">
                    <TrendingDown className="w-8 h-8 text-red-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 text-center mb-1">Negative Events</p>
                    <p className="text-3xl font-bold text-red-600 text-center">{analysis.negativeCount}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 p-4 rounded-lg">
                <p className="text-sm font-semibold text-gray-800 mb-1">Risk Calculation Formula:</p>
                <p className="text-xs text-gray-700 font-mono">{analysis.formula}</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-2xl p-6 md:p-8 border border-indigo-100">
              <h2 className="text-2xl font-semibold mb-6 text-gray-800">
                Future Impact Events ({analysis.events.length})
              </h2>
              
              {analysis.events.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No significant future events found in this area</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {analysis.events.map((event, idx) => (
                    <div 
                      key={idx}
                      className={`border-l-4 p-5 rounded-lg transition-all hover:shadow-md ${
                        event.impact.sentiment === 'POSITIVE' 
                          ? 'border-green-500 bg-gradient-to-r from-green-50 to-white' 
                          : 'border-red-500 bg-gradient-to-r from-red-50 to-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg text-gray-800 mb-2">{event.name}</h3>
                          <p className="text-sm text-gray-600 mb-3">{event.description}</p>
                          
                          <div className="flex flex-wrap gap-4 text-sm text-gray-700">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4 text-indigo-600" />
                              <span>Impact: {new Date(event.timelines.impact_start).toLocaleDateString('en-IN')}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <MapPin className="w-4 h-4 text-indigo-600" />
                              <span>{event.location.area_name}</span>
                            </div>
                            {event.distance_meters && (
                              <div className="text-gray-500">
                                {(event.distance_meters / 1000).toFixed(2)} km away
                              </div>
                            )}
                          </div>
                          
                          <div className="mt-3 flex gap-2">
                            <span className="text-xs bg-white px-3 py-1 rounded-full border border-gray-200 font-medium">
                              {event.status}
                            </span>
                            <span className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-medium">
                              {event.type.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>
                        
                        <div className={`text-right min-w-[100px] ${
                          event.impact.sentiment === 'POSITIVE' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          <p className="text-3xl font-bold">
                            {event.impact.sentiment === 'POSITIVE' ? '+' : ''}
                            {Math.round(event.impact.score * 100)}%
                          </p>
                          <p className="text-xs mt-1 font-medium">Impact Score</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-2xl p-6 md:p-8 border border-indigo-100">
              <h2 className="text-2xl font-semibold mb-6 text-gray-800">
                10-Year Success Projection
              </h2>
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-lg mb-6">
                <p className="text-sm text-gray-700">
                  This projection accounts for the timing and decay of impact from all identified future events.
                  Success probability adjusts as events materialize and their effects diminish over time.
                </p>
              </div>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={analysis.projectionData}>
                  <defs>
                    <linearGradient id="colorProb" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.2}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="year" 
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    domain={[0, 100]} 
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                    label={{ 
                      value: 'Success Probability (%)', 
                      angle: -90, 
                      position: 'insideLeft',
                      style: { fontSize: '12px', fill: '#6b7280' }
                    }} 
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="probability" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    fill="url(#colorProb)"
                    name="Success Probability (%)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {analysis.riskScore > 40 && (
              <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl shadow-2xl p-6 md:p-8 border-2 border-orange-200">
                <div className="flex items-center gap-3 mb-6">
                  <AlertTriangle className="w-8 h-8 text-orange-600" />
                  <h2 className="text-2xl font-semibold text-gray-800">Recommendations</h2>
                </div>
                
                {analysis.alternatives && analysis.alternatives.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold mb-4 text-gray-700">
                      🎯 Alternative Locations (Lower Risk)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {analysis.alternatives.map((alt, idx) => (
                        <div 
                          key={idx} 
                          className="bg-white border-2 border-gray-200 rounded-lg p-5 hover:shadow-lg hover:border-indigo-300 transition-all cursor-pointer"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <h4 className="font-semibold text-indigo-600 text-lg">{alt.area}</h4>
                            <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full">
                              {alt.risk}% Risk
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-3">{alt.reason}</p>
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            <span>PIN: {alt.pincode}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {analysis.alternateBusiness && analysis.alternateBusiness.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4 text-gray-700">
                      💡 Alternative Business Types for This Location
                    </h3>
                    <div className="space-y-3">
                      {analysis.alternateBusiness.map((biz, idx) => (
                        <div 
                          key={idx} 
                          className="flex items-start gap-3 bg-white p-4 rounded-lg border border-gray-200 hover:border-indigo-300 transition-all"
                        >
                          <AlertCircle className="w-6 h-6 text-indigo-600 flex-shrink-0 mt-1" />
                          <div>
                            <p className="font-semibold text-gray-800 text-lg">{biz.type}</p>
                            <p className="text-sm text-gray-600 mt-1">{biz.reason}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {analysis.riskScore <= 40 && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl shadow-xl p-6 border-2 border-green-200 text-center">
                <div className="text-green-600 text-6xl mb-3">✓</div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">Great Choice!</h3>
                <p className="text-gray-600">
                  This location shows favorable conditions for your {businessType} business.
                  The risk score of {analysis.riskScore}% indicates good growth potential.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BusinessFeasibilityTool;
