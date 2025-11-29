const searchLocation = async (query) => {
    if (!query || query.length < 2 || !apiKey) {
      setLocationSuggestions([]);
      return;
    }
    
    try {
      // FIX 1: Changed 'v5' to 'v4'
      // FIX 2: Changed 'query=' to 'q='
      const url = `https://apihub.latlong.ai/v4/autosuggest.json?q=${encodeURIComponent(query)}`;
      console.log('🔍 SEARCH REQUEST:', {
        url, query, apiKeyPresent: !!apiKey, apiKeyLength: apiKey.length,
        headers: { 'X-Authorization-Token': apiKey.substring(0, 10) + '...', 'Accept': 'application/json' }
      });
      
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'X-Authorization-Token': apiKey, 'Accept': 'application/json' }
      });
      
      console.log('📡 SEARCH RESPONSE STATUS:', response.status, response.statusText);
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Autocomplete SUCCESS:', result);
        
        if (result.status === 'Success' && result.data && result.data.length > 0) {
          const delhiResults = result.data.filter(item => 
            item.name && item.name.toLowerCase().includes('delhi')
          );
          
          // Note: Autosuggest results often contain the location (lat/lon) directly.
          // We map 'geo' or 'position' if available, otherwise fallback.
          const suggestions = (delhiResults.length > 0 ? delhiResults : result.data).map(item => ({
            properties: { name: item.name, display_name: item.name, geoid: item.geo },
            // If the API returns lat/lon directly (e.g., item.latitude), use it here. 
            // Otherwise, we'll keep your default or fetch it later.
            geometry: { coordinates: [parseFloat(item.longitude || 77.2090), parseFloat(item.latitude || 28.6139)] }
          }));
          setLocationSuggestions(suggestions.slice(0, 8));
        } else {
          console.log('No suggestions found or empty data');
          setLocationSuggestions([]);
        }
      } else {
        const errorText = await response.text();
        console.error('❌ SEARCH API ERROR:', { status: response.status, statusText: response.statusText, errorBody: errorText, url });
        if (response.status === 401) {
          alert('Invalid API Key. Please check your Latlong API key and try again.');
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

  const getLocationDetailsFromGeoid = async (geoid) => {
    try {
      // FIX: Changed 'v5' to 'v4' and 'query' to 'q'
      // Note: Typically you use a /lookup or /geocode endpoint for IDs, but if autosuggest handles IDs, 'q' is the param.
      const url = `https://apihub.latlong.ai/v4/autosuggest.json?q=${geoid}`;
      console.log('🔍 GEOCODER REQUEST:', { url, geoid, apiKeyPresent: !!apiKey });
      
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'X-Authorization-Token': apiKey, 'Accept': 'application/json' }
      });
      
      console.log('📡 GEOCODER RESPONSE STATUS:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ GEOCODER SUCCESS:', result);
        if (result.status === 'Success' && result.data && result.data.length > 0) {
          return result.data[0];
        }
      } else {
        console.error('❌ GEOCODER ERROR:', response.status, await response.text());
      }
    } catch (error) {
      console.error('❌ GEOCODER EXCEPTION:', error);
    }
    return null;
  };

  const searchNearbyBusinesses = async (lat, lon, businessType) => {
    try {
      // FIX: Changed 'v5' to 'v4' and 'query' to 'q'
      // Added '&location=' or '&at=' to actually search NEAR the coordinates if supported.
      // Based on common patterns, adding location context:
      const url = `https://apihub.latlong.ai/v4/autosuggest.json?q=${encodeURIComponent(businessType)}&location=${lat},${lon}`;
      console.log('🔍 BUSINESS SEARCH REQUEST:', { url, lat, lon, businessType, apiKeyPresent: !!apiKey });
      
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'X-Authorization-Token': apiKey, 'Accept': 'application/json' }
      });
      
      console.log('📡 BUSINESS SEARCH RESPONSE STATUS:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ BUSINESS SEARCH SUCCESS:', result);
        if (result.status === 'Success' && result.data) {
          // Flatten the response if it returns categorized data (north/south/etc) or a flat list
          const allBusinesses = Array.isArray(result.data) ? result.data : [
            ...(result.data.north || []),
            ...(result.data.south || []),
            ...(result.data.east || []),
            ...(result.data.west || [])
          ];
          console.log('📊 Total businesses found:', allBusinesses.length);
          return allBusinesses;
        }
      } else {
        console.error('❌ BUSINESS SEARCH ERROR:', response.status, await response.text());
      }
    } catch (error) {
      console.error('❌ BUSINESS SEARCH EXCEPTION:', error);
    }
    return [];
  };
