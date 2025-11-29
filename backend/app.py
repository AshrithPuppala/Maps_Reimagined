from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import math
from datetime import datetime
import os

app = Flask(__name__)

# Fixed CORS configuration
CORS(app, resources={
    r"/*": {
        "origins": [
            "http://localhost:3000",
            "https://maps-reimagined-frontend.onrender.com",
            "https://*.onrender.com"
        ],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

# Load datasets
def load_datasets():
    """Load all geospatial datasets"""
    try:
        # Load future events JSON
        print("\n=== Loading future events ===")
        events_path = os.path.join(os.path.dirname(__file__), 'data', 'delhi_future_events.json')
        
        try:
            with open(events_path, 'r') as f:
                future_events = json.load(f)
            print(f"✓ Loaded {len(future_events)} future events")
        except FileNotFoundError:
            print("⚠️ delhi_future_events.json not found, using empty list")
            future_events = []
        except json.JSONDecodeError as e:
            print(f"⚠️ Error parsing delhi_future_events.json: {e}")
            future_events = []
        
        # Create fallback location data as dictionaries
        delhi_areas_fallback = [
            {'name': 'Connaught Place', 'lat': 28.6315, 'lng': 77.2167},
            {'name': 'Karol Bagh', 'lat': 28.6519, 'lng': 77.1900},
            {'name': 'Saket', 'lat': 28.5244, 'lng': 77.2066},
            {'name': 'Dwarka', 'lat': 28.5921, 'lng': 77.0460},
            {'name': 'Rohini', 'lat': 28.7496, 'lng': 77.0669},
            {'name': 'Lajpat Nagar', 'lat': 28.5677, 'lng': 77.2433},
            {'name': 'Nehru Place', 'lat': 28.5494, 'lng': 77.2501},
            {'name': 'Chandni Chowk', 'lat': 28.6506, 'lng': 77.2303},
            {'name': 'Hauz Khas', 'lat': 28.5494, 'lng': 77.2001},
            {'name': 'Rajouri Garden', 'lat': 28.6414, 'lng': 77.1211},
        ]
        
        delhi_pincodes_fallback = [
            {'pincode': '110001', 'area': 'Connaught Place', 'lat': 28.6315, 'lng': 77.2167},
            {'pincode': '110005', 'area': 'Karol Bagh', 'lat': 28.6519, 'lng': 77.1900},
            {'pincode': '110017', 'area': 'Saket', 'lat': 28.5244, 'lng': 77.2066},
            {'pincode': '110075', 'area': 'Dwarka', 'lat': 28.5921, 'lng': 77.0460},
            {'pincode': '110085', 'area': 'Rohini', 'lat': 28.7496, 'lng': 77.0669},
            {'pincode': '110024', 'area': 'Lajpat Nagar', 'lat': 28.5677, 'lng': 77.2433},
            {'pincode': '110019', 'area': 'Nehru Place', 'lat': 28.5494, 'lng': 77.2501},
            {'pincode': '110006', 'area': 'Chandni Chowk', 'lat': 28.6506, 'lng': 77.2303},
            {'pincode': '110016', 'area': 'Hauz Khas', 'lat': 28.5494, 'lng': 77.2001},
            {'pincode': '110027', 'area': 'Rajouri Garden', 'lat': 28.6414, 'lng': 77.1211},
        ]
        
        print(f"✓ Using fallback location database")
        print(f"  Areas: {len(delhi_areas_fallback)}")
        print(f"  Pincodes: {len(delhi_pincodes_fallback)}")
        print(f"  Future events: {len(future_events)}")
        
        print("\n=== All datasets loaded successfully! ===\n")
        
        return future_events, delhi_areas_fallback, delhi_pincodes_fallback
        
    except Exception as e:
        print(f"❌ Error loading datasets: {e}")
        import traceback
        traceback.print_exc()
        return [], [], []
        
# Initialize datasets
print("=" * 60)
print("INITIALIZING DELHI BUSINESS ANALYZER API")
print("=" * 60)
FUTURE_EVENTS, DELHI_AREAS, DELHI_PINCODES = load_datasets()
print("=" * 60)

@app.route('/')
def home():
    """Root endpoint"""
    datasets_loaded = (
        len(DELHI_AREAS) > 0 and 
        len(DELHI_PINCODES) > 0
    )
    
    return jsonify({
        'status': 'online',
        'message': 'Delhi Business Analyzer API',
        'version': '2.0',
        'datasets_loaded': datasets_loaded,
        'dataset_counts': {
            'future_events': len(FUTURE_EVENTS),
            'areas': len(DELHI_AREAS),
            'pincodes': len(DELHI_PINCODES)
        },
        'endpoints': {
            'analyze': '/api/analyze (POST)',
            'events': '/api/events (GET)',
            'health': '/api/health (GET)'
        }
    }), 200

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two coordinates in meters"""
    R = 6371000  # Earth's radius in meters
    
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

def geocode_location(area_name, pincode):
    """Get coordinates from area name or pincode"""
    area_name_lower = area_name.lower()
    
    # Try to find in areas database
    for area in DELHI_AREAS:
        if area_name_lower in area['name'].lower() or area['name'].lower() in area_name_lower:
            return area['lat'], area['lng']
    
    # Try to find by pincode
    if pincode:
        for pin_data in DELHI_PINCODES:
            if pin_data['pincode'] == str(pincode):
                return pin_data['lat'], pin_data['lng']
    
    # Default to Delhi center
    print(f"Using default coordinates for {area_name}")
    return 28.7041, 77.1025

def calculate_risk_score(positive_impacts, negative_impacts, location_factors):
    """Calculate risk score using the formula"""
    base_risk = 50
    
    avg_positive = sum([abs(e['impact']['score']) for e in positive_impacts]) / len(positive_impacts) if positive_impacts else 0
    avg_negative = sum([abs(e['impact']['score']) for e in negative_impacts]) / len(negative_impacts) if negative_impacts else 0
    
    risk = base_risk + (avg_negative * 40) - (avg_positive * 30) + location_factors
    risk = max(0, min(100, risk))
    
    return round(risk, 2)

def generate_10year_projection(events, base_success_rate=60):
    """Generate 10-year success probability projection"""
    current_year = datetime.now().year
    projection = []
    
    for year_offset in range(11):
        year = current_year + year_offset
        success_prob = base_success_rate
        
        for event in events:
            impact_year = datetime.fromisoformat(event['timelines']['impact_start'].replace('Z', '')).year
            
            if year >= impact_year:
                years_after_impact = year - impact_year
                decay_factor = math.exp(-0.1 * years_after_impact)
                impact_contribution = event['impact']['score'] * 30 * decay_factor
                success_prob += impact_contribution
        
        success_prob = max(20, min(95, success_prob))
        
        projection.append({
            'year': year,
            'probability': round(success_prob, 1),
            'risk': round(100 - success_prob, 1)
        })
    
    return projection

def find_alternative_locations(current_risk):
    """Suggest alternative locations with lower risk"""
    potential_areas = [
        {'name': 'Connaught Place', 'pincode': '110001', 'base_risk': 25, 'reason': 'High footfall, established commercial hub'},
        {'name': 'Saket', 'pincode': '110017', 'base_risk': 30, 'reason': 'Affluent residential area with strong retail demand'},
        {'name': 'Dwarka Sector 10', 'pincode': '110075', 'base_risk': 28, 'reason': 'New residential development, growing population'},
        {'name': 'Hauz Khas', 'pincode': '110016', 'base_risk': 32, 'reason': 'Young demographic, vibrant nightlife'},
        {'name': 'Nehru Place', 'pincode': '110019', 'base_risk': 35, 'reason': 'IT hub with high office worker population'},
        {'name': 'Lajpat Nagar', 'pincode': '110024', 'base_risk': 33, 'reason': 'Busy market area, excellent metro connectivity'}
    ]
    
    alternatives = [area for area in potential_areas if area['base_risk'] < current_risk]
    return sorted(alternatives, key=lambda x: x['base_risk'])[:3]

@app.route('/api/analyze', methods=['POST'])
def analyze_feasibility():
    """Main API endpoint for business feasibility analysis"""
    try:
        data = request.json
        business_type = data.get('businessType', '')
        area_name = data.get('location', '')
        pincode = data.get('pincode', '')
        
        if not business_type or not area_name:
            return jsonify({'error': 'Business type and location are required'}), 400
        
        lat, lng = geocode_location(area_name, pincode)
        
        # Find relevant future events
        relevant_events = []
        for event in FUTURE_EVENTS:
            distance = haversine_distance(
                lat, lng, 
                event['location']['lat'], 
                event['location']['lng']
            )
            
            if distance <= event['impact']['radius_meters']:
                event_copy = event.copy()
                event_copy['distance_meters'] = round(distance, 2)
                relevant_events.append(event_copy)
        
        # Check for sector-matched events
        for event in FUTURE_EVENTS:
            if event not in relevant_events:
                sectors = [s.lower() for s in event['impact']['affected_sectors']]
                if any(business_type.lower() in sector or sector in business_type.lower() for sector in sectors):
                    event_copy = event.copy()
                    event_copy['distance_meters'] = haversine_distance(lat, lng, event['location']['lat'], event['location']['lng'])
                    relevant_events.append(event_copy)
        
        positive_impacts = [e for e in relevant_events if e['impact']['sentiment'] == 'POSITIVE']
        negative_impacts = [e for e in relevant_events if e['impact']['sentiment'] == 'NEGATIVE']
        
        risk_score = calculate_risk_score(positive_impacts, negative_impacts, 0)
        projection_data = generate_10year_projection(relevant_events)
        alternatives = find_alternative_locations(risk_score) if risk_score > 40 else []
        
        response = {
            'riskScore': risk_score,
            'riskLevel': 'Low' if risk_score < 30 else 'Moderate' if risk_score < 50 else 'High' if risk_score < 70 else 'Very High',
            'location': {
                'lat': lat,
                'lng': lng,
                'area': area_name,
                'pincode': pincode
            },
            'events': relevant_events,
            'positiveCount': len(positive_impacts),
            'negativeCount': len(negative_impacts),
            'projectionData': projection_data,
            'alternatives': alternatives,
            'formula': 'Risk = 50 + (Avg_Negative × 40) - (Avg_Positive × 30) + Location_Factor'
        }
        
        return jsonify(response), 200
        
    except Exception as e:
        print(f"Error in analysis: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/events', methods=['GET'])
def get_all_events():
    """Get all future events"""
    return jsonify(FUTURE_EVENTS), 200

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    datasets_ok = len(DELHI_AREAS) > 0 and len(DELHI_PINCODES) > 0
    
    return jsonify({
        'status': 'healthy' if datasets_ok else 'degraded',
        'datasets': {
            'future_events': len(FUTURE_EVENTS),
            'areas': len(DELHI_AREAS),
            'pincodes': len(DELHI_PINCODES)
        }
    }), 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
