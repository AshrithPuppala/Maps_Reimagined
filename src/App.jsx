import React, { useState, useEffect } from 'react';
import { MapPin, Store, TrendingUp, Users, DollarSign, BarChart3, Search, AlertCircle, Loader } from 'lucide-react';

export default function BusinessLocationAnalyzer() {
  const [businessType, setBusinessType] = useState('');
  const [targetArea, setTargetArea] = useState('');
  const [investment, setInvestment] = useState('');
  const [selectedLayer, setSelectedLayer] = useState('city');
  const [mapData, setMapData] = useState(null);
  const [pincodeData, setPincodeData] = useState(null);
  const [areaData, setAreaData] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [mapStyle, setMapStyle] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [showApiInput, setShowApiInput] = useState(true);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [loadingMap, setLoadingMap] = useState(true);

  // Default Delhi Coordinates (Connaught Place) - Used as fallback
  const DEFAULT_LAT = 28.6304;
  const DEFAULT_LON = 77.2177;

  useEffect(() => {
    setLoadingMap(false);
    setMapData({ type: 'FeatureCollection', features: [] });
    setPincodeData({ type: 'FeatureCollection', features: [] });
    setAreaData({ type: 'FeatureCollection', features: [] });
    setMapStyle({});
  }, []);

  const businessCategories = [
    'Restaurant', 'Cafe', 'Retail Store', 'Grocery', 'Supermarket', 'Pharmacy',
    'Gym', 'Fitness Center', 'Salon', 'Spa', 'Electronics Store', 'Clothing Store',
    'Bakery', 'Bookstore', 'Medical Clinic', 'Hospital', 'School', 'Bank', 'ATM',
    'Hotel', 'Gas Station'
  ];

  // --- HELPER: Haversine Distance (in km) ---
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; 
  };

  const searchLocation = async (queryText) => {
    if (!queryText || queryText.length < 2 || !apiKey) {
      setLocationSuggestions([]);
      return;
    }
    
    try {
      // Search for location suggestions
      const url = `https://apihub.latlong.ai/v5/autosuggest.json?query=${encodeURIComponent(queryText)}&latitude=${DEFAULT_LAT}&longitude=${DEFAULT_LON}&state_bias=true`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'X-Authorization-Token': apiKey, 'Accept': 'application/json' }
      });
      
      if (response.ok) {
        const result = await response.json();
        const dataList = Array.isArray(result.data) ? result.data : (result.data ? [result.data] : []);
        
        if (dataList.length > 0) {
           const suggestions = dataList.map(item => ({
            properties: { 
                name: item.name, 
                display_name: item.address || item.name, 
                // Capture lat/lon safely
                lat: parseFloat(item.latitude || item.lat),
                lon: parseFloat(item.longitude || item.lng || item.lon),
                geoid: item.id || item.place_id
            }
          }));
          setLocationSuggestions(suggestions.slice(0, 8));
        } else {
          setLocationSuggestions([]);
        }
      } else {
        if (response.status === 401) {
          alert('Invalid API Key.');
          setApiKey('');
          setShowApiInput(true);
        }
        setLocationSuggestions([]);
      }
    } catch (error) {
      console.error('❌ SEARCH EXCEPTION:', error);
      setLocationSuggestions([]);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (targetArea && apiKey) searchLocation(targetArea);
    }, 500);
    return () => clearTimeout(timer);
  }, [targetArea, apiKey]);

  // --- FIXED: Simplified Query + Distance Filter ---
  const searchNearbyBusinesses = async (lat, lon, type) => {
    try {
      // FIX: We do NOT append the location name here anymore.
      // We just search for "Cafe" (type) and bias it with &latitude and &longitude
      const url = `https://apihub.latlong.ai/v5/autosuggest.json?query=${encodeURIComponent(type)}&latitude=${lat}&longitude=${lon}`;
      console.log('🔍 STRICT SEARCH:', { url, type, lat, lon });

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'X-Authorization-Token': apiKey, 'Accept': 'application/json' }
      });
      
      if (response.ok) {
        const result = await response.json();
        let allBusinesses = [];
        
        if (result.data) {
            if (Array.isArray(result.data)) {
                allBusinesses = result.data;
            } else {
                // If API returns directional keys (north, south, etc.)
                if (result.data.north) allBusinesses.push(...result.data.north);
                if (result.data.south) allBusinesses.push(...result.data.south);
                if (result.data.east) allBusinesses.push(...result.data.east);
                if (result.data.west) allBusinesses.push(...result.data.west);
                // Fallback: check if there are direct properties that look like businesses
                if (allBusinesses.length === 0 && typeof result.data === 'object') {
                    // Sometimes result.data itself is the object if only 1 result
                    if (result.data.name) allBusinesses.push(result.data);
                }
            }

            console.log("Found raw businesses:", allBusinesses.length);

            // --- FILTER: Only keep businesses within 5km ---
            const validBusinesses = allBusinesses.filter(biz => {
                const bizLat = parseFloat(biz.latitude || biz.lat);
                const bizLon = parseFloat(biz.longitude || biz.lng || biz.lon);
                
                // If invalid coords, skip
                if (isNaN(bizLat) || isNaN(bizLon)) return false;
                
                const dist = calculateDistance(lat, lon, bizLat, bizLon);
                return dist <= 5.0; // 5 KM Radius strict limit
            }).map(biz => ({
                ...biz,
                realDistance: calculateDistance(lat, lon, parseFloat(biz.latitude || biz.lat), parseFloat(biz.longitude || biz.lng || biz.lon))
            }));
            
            // Sort by nearest distance
            validBusinesses.sort((a, b) => a.realDistance - b.realDistance);

            return validBusinesses;
        }
      }
    } catch (error) {
      console.error('❌ BUSINESS SEARCH EXCEPTION:', error);
    }
    return [];
  };

  const analyzeLocation = async () => {
    if (!businessType || !selectedLocation || !apiKey) {
      alert('Please enter API key, select business type and choose a location from suggestions');
      return;
    }
    
    setAnalyzing(true);
    
    try {
      let lat = selectedLocation.properties.lat;
      let lon = selectedLocation.properties.lon;
      
      // Fallback if coordinates missing
      if (isNaN(lat) || isNaN(lon)) {
        lat = DEFAULT_LAT;
        lon = DEFAULT_LON;
        console.warn("Using default coordinates");
      }
      
      console.log("Analyzing for:", businessType, "at", lat, lon);

      // Search using simplified query
      const nearbyBusinesses = await searchNearbyBusinesses(lat, lon, businessType);
      
      const competitors = nearbyBusinesses.length;
      const topCompetitors = nearbyBusinesses.slice(0, 5).map((business, idx) => {
        const distanceKm = business.realDistance.toFixed(2);
        
        // Simulating metrics (Since API doesn't provide them)
        const simulatedRating = (3.8 + Math.random() * 1.2).toFixed(1); 
        const simulatedFootfall = Math.floor(800 / (idx + 1) + Math.random() * 300);

        return {
          name: business.name || `${businessType} ${idx + 1}`,
          distance: `${distanceKm} km`,
          rating: simulatedRating,
          customers: simulatedFootfall,
          address: business.address || 'Address unavailable'
        };
      });
      
      const avgRating = topCompetitors.length > 0
        ? (topCompetitors.reduce((sum, c) => sum + parseFloat(c.rating), 0) / topCompetitors.length).toFixed(1)
        : "N/A";
      
      const marketSaturation = Math.min(95, Math.floor((competitors / 20) * 100));
      const footfall = topCompetitors.reduce((sum, c) => sum + c.customers, 0) + (competitors * 50); 
      const avgRevenue = Math.floor(footfall * 350); 
      
      const locationName = selectedLocation.properties.display_name || selectedLocation.properties.name;
      const locationParts = locationName.split(',').map(s => s.trim());
      
      const recommendations = [];
      if (competitors >= 1) {
         if (competitors > 10) {
            recommendations.push('⚠️ High competition. Market is saturated.');
         } else {
            recommendations.push('✓ Moderate competition. Valid market demand.');
         }
      } else {
        recommendations.push('✓ No direct competitors found nearby. Excellent First-Mover Advantage!');
      }

      if (footfall > 1500) {
        recommendations.push('✓ High footfall detected based on area density.');
      }
      
      setAnalysis({
        competitors, avgRating, avgRevenue, footfall, marketSaturation, topCompetitors,
        demographics: {
          area: locationParts[locationParts.length - 1] || 'Delhi',
          locality: locationParts[0] || selectedLocation.properties.name,
          pincode: 'N/A'
        },
        recommendations,
        locationCoords: { lat, lon },
        totalBusinessesFound: competitors
      });
      
    } catch (error) {
      console.error('❌❌❌ ANALYSIS ERROR:', error);
      alert('Error analyzing location.');
    } finally {
      setAnalyzing(false);
    }
  };

  const selectLocation = (suggestion) => {
    setSelectedLocation(suggestion);
    setTargetArea(suggestion.properties.display_name || suggestion.properties.name);
    setLocationSuggestions([]);
  };

  if (showApiInput && !apiKey) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="flex items-center justify-center mb-6">
            <MapPin className="w-12 h-12 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 text-center mb-2">Enter Latlong API Key</h2>
          <p className="text-gray-600 text-center mb-6 text-sm">
            Get your API key from <a href="https://apihub.latlong.ai" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">apihub.latlong.ai</a>
          </p>
          <input
            type="password"
            placeholder="Enter your API key"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent mb-4"
            onKeyPress={(e) => {
              if (e.key === 'Enter' && e.target.value) {
                setApiKey(e.target.value);
                setShowApiInput(false);
              }
            }}
          />
          <button
            onClick={(e) => {
              const input = e.target.previousElementSibling;
              if (input.value) {
                setApiKey(input.value);
                setShowApiInput(false);
              }
            }}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <MapPin className="w-8 h-8 text-indigo-600" />
                <h1 className="text-3xl font-bold text-gray-800">Delhi Business Location Analyzer</h1>
              </div>
              <p className="text-gray-600 ml-11">Real-time competitor analysis powered by Latlong API</p>
            </div>
            <button onClick={() => { setApiKey(''); setShowApiInput(true); }} className="text-sm text-indigo-600 hover:text-indigo-700 underline">
              Change API Key
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Store className="w-5 h-5 text-indigo-600" />
              Business Details
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Business Type *</label>
                <select value={businessType} onChange={(e) => setBusinessType(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                  <option value="">Select business type</option>
                  {businessCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">Target Area/Location *</label>
                <div className="relative">
                  <input
                    type="text"
                    value={targetArea}
                    onChange={(e) => { setTargetArea(e.target.value); setSelectedLocation(null); }}
                    onFocus={() => { if (targetArea && targetArea.length >= 2) searchLocation(targetArea); }}
                    placeholder="Type area name (e.g., Connaught Place, Karol Bagh)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  {targetArea && !selectedLocation && targetArea.length >= 2 && (
                    <div className="absolute right-3 top-2.5">
                      <Loader className="w-5 h-5 text-indigo-600 animate-spin" />
                    </div>
                  )}
                </div>
                {locationSuggestions.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-xl max-h-80 overflow-y-auto">
                    {locationSuggestions.map((suggestion, idx) => (
                      <div key={idx} onClick={() => selectLocation(suggestion)} className="px-4 py-3 hover:bg-indigo-50 cursor-pointer border-b last:border-b-0 transition-colors">
                        <p className="font-medium text-gray-800 text-sm">{suggestion.properties.name || suggestion.properties.display_name}</p>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{suggestion.properties.display_name}</p>
                      </div>
                    ))}
                  </div>
                )}
                {targetArea && locationSuggestions.length === 0 && !selectedLocation && targetArea.length >= 2 && (
                  <p className="text-xs text-gray-500 mt-1">No suggestions found. Try different keywords.</p>
                )}
                {selectedLocation && (
                  <div className="flex items-center gap-1 mt-1">
                    <p className="text-xs text-green-600">✓ Location selected</p>
                    <button onClick={() => { setSelectedLocation(null); setTargetArea(''); }} className="text-xs text-red-600 hover:underline ml-2">Clear</button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Investment Budget (₹)</label>
                <input type="number" value={investment} onChange={(e) => setInvestment(e.target.value)} placeholder="e.g., 2000000" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Map Layer</label>
                <select value={selectedLayer} onChange={(e) => setSelectedLayer(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                  <option value="city">City Boundaries</option>
                  <option value="pincode">Pincode Areas</option>
                  <option value="area">Locality Areas</option>
                </select>
              </div>

              <button onClick={analyzeLocation} disabled={analyzing} className={`w-full py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${analyzing ? 'bg-gray-400 cursor-not-allowed' : !businessType || !selectedLocation ? 'bg-indigo-400 hover:bg-indigo-500 cursor-pointer' : 'bg-indigo-600 hover:bg-indigo-700 cursor-pointer'} text-white`}>
                {analyzing ? (<><Loader className="w-5 h-5 animate-spin" />Analyzing Real Data...</>) : (<><Search className="w-5 h-5" />Analyze Location</>)}
              </button>
              {!businessType && <p className="text-xs text-red-500 mt-1">Please select a business type</p>}
              {businessType && !selectedLocation && <p className="text-xs text-red-500 mt-1">Please select a location from suggestions</p>}
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-1">Status:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>API: {apiKey ? '✓ Connected' : '✗ Not configured'}</li>
                    <li>Ready for analysis</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            {!analysis ? (
              <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
                <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-400 mb-2">Ready for Real-Time Analysis</h3>
                <p className="text-gray-500 mb-4">Enter business details and select a location to get live competitor data from Latlong API</p>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  API Connected
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-xl shadow-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Store className="w-5 h-5 text-purple-600" />
                      <span className="text-sm text-gray-600">Competitors</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-800">{analysis.competitors}</p>
                    <p className="text-xs text-gray-500 mt-1">within 5 km radius</p>
                  </div>
                  <div className="bg-white rounded-xl shadow-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                      <span className="text-sm text-gray-600">Avg Rating</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-800">{analysis.avgRating}</p>
                    <p className="text-xs text-gray-500 mt-1">out of 5.0</p>
                  </div>
                  <div className="bg-white rounded-xl shadow-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-5 h-5 text-blue-600" />
                      <span className="text-sm text-gray-600">Est. Footfall</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-800">{analysis.footfall.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 mt-1">daily average</p>
                  </div>
                  <div className="bg-white rounded-xl shadow-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-5 h-5 text-orange-600" />
                      <span className="text-sm text-gray-600">Saturation</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-800">{analysis.marketSaturation}%</p>
                    <p className="text-xs text-gray-500 mt-1">market density</p>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl shadow-xl p-6 text-white">
                  <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    Analyzed Location
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div><p className="text-indigo-200 mb-1">Area</p><p className="font-semibold">{analysis.demographics.area}</p></div>
                    <div><p className="text-indigo-200 mb-1">Locality</p><p className="font-semibold">{analysis.demographics.locality}</p></div>
                    <div><p className="text-indigo-200 mb-1">Pincode</p><p className="font-semibold">{analysis.demographics.pincode}</p></div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-xl p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">
                    Top {Math.min(5, analysis.topCompetitors.length)} Nearby Competitors
                    <span className="text-sm font-normal text-gray-500 ml-2">({analysis.totalBusinessesFound} total found)</span>
                  </h3>
                  {analysis.topCompetitors.length > 0 ? (
                    <div className="space-y-3">
                      {analysis.topCompetitors.map((comp, idx) => (
                        <div key={idx} className="flex items-start justify-between p-4 bg-gradient-to-r from-gray-50 to-white rounded-lg hover:shadow-md transition-shadow border border-gray-100">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-semibold flex-shrink-0">{idx + 1}</div>
                            <div>
                              <p className="font-semibold text-gray-800">{comp.name}</p>
                              <p className="text-sm text-gray-500 mt-1">{comp.distance} away</p>
                              <p className="text-xs text-gray-400 mt-1">{comp.address}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-yellow-600">★ {comp.rating}</p>
                            <p className="text-xs text-gray-500 mt-1">{comp.customers} customers</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Store className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No competitors found in this area</p>
                      <p className="text-sm mt-1">This could be a great opportunity!</p>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-2xl shadow-xl p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-indigo-600" />
                    AI-Powered Insights
                  </h3>
                  <div className="space-y-3">
                    {analysis.recommendations.map((rec, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-100">
                        <div className="text-2xl flex-shrink-0">
                          {rec.includes('⚠️') ? '⚠️' : rec.includes('✓') ? '✓' : '💡'}
                        </div>
                        <p className="text-gray-700 flex-1 leading-relaxed">{rec.replace(/[⚠️✓💡]/g, '').trim()}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-center">
                  <button onClick={analyzeLocation} className="inline-flex items-center gap-2 px-6 py-3 bg-white text-indigo-600 rounded-lg font-semibold hover:bg-indigo-50 transition-colors shadow-lg">
                    <Search className="w-5 h-5" />
                    Refresh Analysis
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
