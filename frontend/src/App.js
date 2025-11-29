import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
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
      // Updated to use full API URL with /api prefix
      const response = await axios.post(`${API_URL}/api/analyze`, {
        businessType,
        location,
        pincode
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 second timeout
      });

      setAnalysis(response.data);
    } catch (err) {
      // Enhanced error handling
      if (err.code === 'ECONNABORTED') {
        setError('Request timeout. The server took too long to respond. Please try again.');
      } else if (err.response) {
        // Server responded with error
        setError(err.response?.data?.error || `Server error: ${err.response.status}. Please try again.`);
      } else if (err.request) {
        // Request made but no response
        setError('Unable to reach the server. Please check your connection and try again.');
      } else {
        // Something else happened
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
        {/* Header */}
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
          {/* API Status Indicator */}
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-500">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Connected to API: {API_URL}</span>
          </div>
        </div>

        {/* Input Form */}
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
                value={business
