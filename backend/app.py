"""
Enhanced Delhi Business Predictor with GeoJSON and LatLong API Integration
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import requests
from datetime import datetime
from typing import Dict, List, Tuple
import math

app = Flask(__name__)
CORS(app)

# LatLong API Configuration
LATLONG_API_BASE = "https://apihub.latlong.ai"
LATLONG_API_KEY = "your_api_key_here"  # Replace with actual key

# GeoJSON Data URLs (from CDN or local files)
GEOJSON_URLS = {
    'areas': 'delhi_area.geojson',
    'pincodes': 'delhi_pincode.geojson',
    'city': 'delhi_city.geojson',
    'points': 'delhi_points.geojson'
}

class GeoJSONHandler:
    """Handle GeoJSON data loading and spatial queries"""
    
    def __init__(self):
        self.data = {}
        self.load_geojson_data()
    
    def load_geojson_data(self):
        """Load all GeoJSON files"""
        for key, filename in GEOJSON_URLS.items():
            try:
                with open(f'data/{filename}', 'r') as f:
                    self.data[key] = json.load(f)
                print(f"✓ Loaded {filename}")
            except FileNotFoundError:
                print(f"✗ Warning: {filename} not found. Using mock data.")
                self.data[key] = self._get_mock_geojson(key)
    
    def _get_mock_geojson(self, data_type: str) -> Dict:
        """Return mock GeoJSON structure"""
        if data_type == 'points':
            return {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "properties": {
                            "name": "Connaught Place Metro",
                            "category": "metro_station",
                            "location": "connaught place"
                        },
                        "geometry": {
                            "type": "Point",
                            "coordinates": [77.2190, 28.6315]
                        }
                    },
                    {
                        "type": "Feature",
                        "properties": {
                            "name": "Select Citywalk Mall",
                            "category": "mall",
                            "location": "saket"
                        },
                        "geometry": {
                            "type": "Point",
                            "coordinates": [77.2167, 28.5244]
                        }
                    }
                ]
            }
        return {"type": "FeatureCollection", "features": []}
    
    def find_nearby_points(self, location: str, category: str = None, 
                          radius_km: float = 2.0) -> List[Dict]:
        """Find nearby points of interest"""
        
        # Get location coordinates
        coords = self.get_location_coordinates(location)
        if not coords:
            return []
        
        nearby = []
        points = self.data.get('points', {}).get('features', [])
        
        for feature in points:
            if category and feature['properties'].get('category') != category:
                continue
            
            point_coords = feature['geometry']['coordinates']
            distance = self._calculate_distance(coords, point_coords)
            
            if distance <= radius_km:
                nearby.append({
                    'name': feature['properties'].get('name', 'Unknown'),
                    'category': feature['properties'].get('category', 'unknown'),
                    'distance_km': round(distance, 2),
                    'coordinates': point_coords
                })
        
        return sorted(nearby, key=lambda x: x['distance_km'])
    
    def get_location_coordinates(self, location: str) -> Tuple[float, float]:
        """Get coordinates for a location name"""
        
        # Known Delhi locations (can be extended)
        location_coords = {
            'connaught place': (77.2190, 28.6315),
            'karol bagh': (77.1900, 28.6519),
            'saket': (77.2167, 28.5244),
            'dwarka': (77.0469, 28.5921),
            'rohini': (77.1025, 28.7496),
            'lajpat nagar': (77.2436, 28.5677),
            'chandni chowk': (77.2300, 28.6506)
        }
        
        coords = location_coords.get(location.lower())
        if coords:
            return coords
        
        # Fallback to LatLong API
        return self._geocode_with_latlong(location)
    
    def _geocode_with_latlong(self, location: str) -> Tuple[float, float]:
        """Use LatLong API for geocoding"""
        try:
            response = requests.get(
                f"{LATLONG_API_BASE}/geocode",
                params={
                    'address': f"{location}, Delhi, India",
                    'api_key': LATLONG_API_KEY
                },
                timeout=5
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('results'):
                    result = data['results'][0]
                    return (result['lng'], result['lat'])
        except Exception as e:
            print(f"Geocoding error: {e}")
        
        return None
    
    def _calculate_distance(self, coords1: Tuple[float, float], 
                          coords2: Tuple[float, float]) -> float:
        """Calculate distance between two coordinates (Haversine formula)"""
        
        lon1, lat1 = coords1
        lon2, lat2 = coords2
        
        R = 6371  # Earth radius in km
        
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)
        
        a = (math.sin(delta_lat/2)**2 + 
             math.cos(lat1_rad) * math.cos(lat2_rad) * 
             math.sin(delta_lon/2)**2)
        
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        
        return R * c


class EnhancedRiskAnalyzer:
    """Enhanced risk analyzer with geospatial intelligence"""
    
    def __init__(self):
        self.geo_handler = GeoJSONHandler()
        self.future_events = self._load_future_events()
    
    def _load_future_events(self) -> Dict:
        """Load future events database"""
        return {
            "connaught place": [
                {
                    "type": "metro",
                    "name": "CP Metro Expansion - Phase 5",
                    "impact": "positive",
                    "date": "2025-06-15",
                    "severity": 0.3,
                    "description": "New metro entrance at Janpath",
                    "coordinates": [77.2190, 28.6315]
                },
                {
                    "type": "construction",
                    "name": "Rajiv Chowk Station Renovation",
                    "impact": "negative",
                    "date": "2025-03-01",
                    "severity": 0.7,
                    "description": "18-month renovation blocking entrance",
                    "coordinates": [77.2177, 28.6328]
                }
            ],
            "karol bagh": [
                {
                    "type": "construction",
                    "name": "Pusa Road Widening",
                    "impact": "negative",
                    "date": "2025-08-15",
                    "severity": 0.8,
                    "description": "2-year road construction",
                    "coordinates": [77.1900, 28.6519]
                }
            ],
            "saket": [
                {
                    "type": "mall",
                    "name": "Select Citywalk Expansion",
                    "impact": "positive",
                    "date": "2026-01-20",
                    "severity": 0.5,
                    "description": "Mall adding 150 stores",
                    "coordinates": [77.2167, 28.5244]
                },
                {
                    "type": "college",
                    "name": "Amity University Campus",
                    "impact": "positive",
                    "date": "2026-07-01",
                    "severity": 0.5,
                    "description": "15,000 students expected",
                    "coordinates": [77.2180, 28.5230]
                }
            ]
        }
    
    def analyze_location(self, location: str, business_type: str) -> Dict:
        """Comprehensive location analysis with geospatial data"""
        
        # Get basic coordinates
        coords = self.geo_handler.get_location_coordinates(location)
        
        # Find nearby infrastructure
        nearby_metros = self.geo_handler.find_nearby_points(location, 'metro_station', 1.5)
        nearby_malls = self.geo_handler.find_nearby_points(location, 'mall', 2.0)
        nearby_colleges = self.geo_handler.find_nearby_points(location, 'college', 2.5)
        
        # Get future events
        events = self.future_events.get(location.lower(), [])
        
        # Calculate base risk score
        risk_score = self._calculate_risk(location, business_type, events, 
                                         nearby_metros, nearby_malls, nearby_colleges)
        
        # Generate insights
        insights = self._generate_enhanced_insights(
            events, nearby_metros, nearby_malls, nearby_colleges, business_type
        )
        
        # Calculate proximity advantages
        proximity_score = self._calculate_proximity_score(
            nearby_metros, nearby_malls, nearby_colleges, business_type
        )
        
        return {
            'risk_score': risk_score,
            'coordinates': coords,
            'events': events,
            'nearby_infrastructure': {
                'metros': nearby_metros[:3],
                'malls': nearby_malls[:3],
                'colleges': nearby_colleges[:2]
            },
            'proximity_score': proximity_score,
            'insights': insights
        }
    
    def _calculate_risk(self, location: str, business_type: str, events: List,
                       metros: List, malls: List, colleges: List) -> float:
        """Calculate comprehensive risk score"""
        
        risk = 50  # Base risk
        
        # Event impacts
        for event in events:
            if event['impact'] == 'negative':
                risk += event['severity'] * 20
            else:
                risk -= event['severity'] * 15
        
        # Proximity benefits (reduce risk)
        if metros:
            risk -= min(len(metros) * 5, 15)
        if malls and business_type in ['retail', 'cafe', 'restaurant']:
            risk -= min(len(malls) * 4, 12)
        if colleges and business_type in ['cafe', 'bookstore', 'restaurant']:
            risk -= min(len(colleges) * 6, 18)
        
        return max(0, min(100, risk))
    
    def _calculate_proximity_score(self, metros: List, malls: List, 
                                   colleges: List, business_type: str) -> Dict:
        """Calculate how well the location matches business needs"""
        
        score = 0
        max_score = 100
        factors = []
        
        # Metro accessibility (universal benefit)
        if metros:
            metro_score = min(30, len(metros) * 10)
            score += metro_score
            closest = metros[0]['distance_km']
            factors.append({
                'factor': 'Metro Access',
                'score': metro_score,
                'detail': f"{len(metros)} metro(s) within 1.5km, closest {closest}km away"
            })
        
        # Mall proximity (for retail/food)
        if business_type in ['retail', 'cafe', 'restaurant']:
            if malls:
                mall_score = min(25, len(malls) * 12)
                score += mall_score
                factors.append({
                    'factor': 'Mall Proximity',
                    'score': mall_score,
                    'detail': f"{len(malls)} mall(s) nearby - high foot traffic"
                })
        
        # College proximity (for cafes/bookstores)
        if business_type in ['cafe', 'bookstore', 'restaurant']:
            if colleges:
                college_score = min(35, len(colleges) * 17)
                score += college_score
                factors.append({
                    'factor': 'Student Population',
                    'score': college_score,
                    'detail': f"{len(colleges)} college(s) nearby - consistent demand"
                })
        
        return {
            'total_score': min(score, max_score),
            'max_score': max_score,
            'percentage': round(min(score, max_score) / max_score * 100, 1),
            'factors': factors
        }
    
    def _generate_enhanced_insights(self, events: List, metros: List, 
                                   malls: List, colleges: List, 
                                   business_type: str) -> List[Dict]:
        """Generate insights with geospatial context"""
        
        insights = []
        
        # Event-based insights
        negative = [e for e in events if e['impact'] == 'negative']
        positive = [e for e in events if e['impact'] == 'positive']
        
        if negative:
            worst = max(negative, key=lambda x: x['severity'])
            insights.append({
                'type': 'warning',
                'title': 'Construction Risk',
                'message': f"{worst['name']} starting {worst['date']}. {worst['description']}"
            })
        
        if positive:
            best = max(positive, key=lambda x: x['severity'])
            insights.append({
                'type': 'opportunity',
                'title': 'Infrastructure Opportunity',
                'message': f"{best['name']} by {best['date']}. {best['description']}"
            })
        
        # Infrastructure insights
        if metros:
            insights.append({
                'type': 'info',
                'title': 'Excellent Transit Access',
                'message': f"{len(metros)} metro station(s) within 1.5km. Easy customer access."
            })
        
        if malls and business_type in ['retail', 'cafe']:
            insights.append({
                'type': 'opportunity',
                'title': 'High Foot Traffic Area',
                'message': f"{len(malls)} shopping destination(s) nearby. Great for retail."
            })
        
        if colleges and business_type in ['cafe', 'bookstore']:
            insights.append({
                'type': 'opportunity',
                'title': 'Student Market',
                'message': f"{len(colleges)} college(s) nearby. Consistent customer base."
            })
        
        if not metros and not malls:
            insights.append({
                'type': 'warning',
                'title': 'Limited Infrastructure',
                'message': 'No major metro or mall nearby. May impact accessibility.'
            })
        
        return insights


# Initialize handlers
geo_handler = GeoJSONHandler()
analyzer = EnhancedRiskAnalyzer()


# API Endpoints

@app.route('/api/v2/analyze', methods=['POST'])
def analyze_v2():
    """Enhanced analysis with geospatial intelligence"""
    
    data = request.json
    business_type = data.get('business_type', '').lower()
    location = data.get('location', '').lower()
    
    if not business_type or not location:
        return jsonify({'error': 'business_type and location required'}), 400
    
    # Run analysis
    result = analyzer.analyze_location(location, business_type)
    
    # Add timestamp
    result['timestamp'] = datetime.now().isoformat()
    result['location'] = location
    result['business_type'] = business_type
    
    return jsonify(result)


@app.route('/api/nearby', methods=['GET'])
def get_nearby():
    """Get nearby points of interest"""
    
    location = request.args.get('location', '')
    category = request.args.get('category')
    radius = float(request.args.get('radius', 2.0))
    
    nearby = geo_handler.find_nearby_points(location, category, radius)
    
    return jsonify({
        'location': location,
        'category': category,
        'radius_km': radius,
        'results': nearby,
        'count': len(nearby)
    })


@app.route('/api/geocode', methods=['GET'])
def geocode():
    """Geocode a location"""
    
    location = request.args.get('location', '')
    coords = geo_handler.get_location_coordinates(location)
    
    if coords:
        return jsonify({
            'location': location,
            'coordinates': {
                'longitude': coords[0],
                'latitude': coords[1]
            }
        })
    
    return jsonify({'error': 'Location not found'}), 404


@app.route('/api/map-data', methods=['GET'])
def get_map_data():
    """Get GeoJSON data for map visualization"""
    
    data_type = request.args.get('type', 'points')
    
    if data_type in geo_handler.data:
        return jsonify(geo_handler.data[data_type])
    
    return jsonify({'error': 'Invalid data type'}), 400


@app.route('/health', methods=['GET'])
def health():
    """Health check"""
    return jsonify({
        'status': 'healthy',
        'geojson_loaded': len(geo_handler.data),
        'timestamp': datetime.now().isoformat()
    })


if __name__ == '__main__':
    print("🚀 Enhanced Delhi Business Predictor API")
    print("=" * 50)
    print("📍 GeoJSON Integration: Active")
    print("🗺️  LatLong API: Configured")
    print("\n📊 Available Endpoints:")
    print("   POST   /api/v2/analyze - Enhanced analysis")
    print("   GET    /api/nearby - Find nearby POIs")
    print("   GET    /api/geocode - Geocode location")
    print("   GET    /api/map-data - Get GeoJSON data")
    print("   GET    /health - Health check")
    print("\n" + "=" * 50)
    print("✅ Server running on http://localhost:5000")
    
    app.run(debug=True, host='0.0.0.0', port=5000)

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5000))
    
    # Development
    if os.environ.get('FLASK_ENV') == 'development':
        app.run(debug=True, host='0.0.0.0', port=port)
    # Production
    else:
        app.run(debug=False, host='0.0.0.0', port=port)
