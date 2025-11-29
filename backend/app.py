from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import math
from datetime import datetime
from shapely.geometry import shape, Point
import geopandas as gpd
import os

app = Flask(__name__)
CORS(app)

# Load datasets
def load_datasets():
    """Load all geospatial datasets"""
    try:
        # Check if files exist
        base_path = 'data'
        files_to_check = [
            'delhi_future_events.json',
            'delhi_area.geojson',
            'delhi_pincode.geojson',
            'delhi_points.geojson'
        ]
        
        print("=== Checking data files ===")
        for file in files_to_check:
            file_path = os.path.join(base_path, file)
            exists = os.path.exists(file_path)
            print(f"{file}: {'✓ EXISTS' if exists else '✗ MISSING'}")
            if exists:
                print(f"  Size: {os.path.getsize(file_path)} bytes")
        
        # Load future events JSON
        print("\n=== Loading future events ===")
        with open('data/delhi_future_events.json', 'r') as f:
            future_events = json.load(f)
        print(f"✓ Loaded {len(future_events)} future events")
        
        # Load GeoJSON files with error handling
        print("\n=== Loading GeoJSON files ===")
        
        print("Loading delhi_area.geojson...")
        delhi_areas = gpd.read_file('data/delhi_area.geojson')
        print(f"✓ Loaded {len(delhi_areas)} areas")
        print(f"  Columns: {list(delhi_areas.columns)}")
        print(f"  CRS: {delhi_areas.crs}")
        print(f"  Has geometry: {'geometry' in delhi_areas.columns}")
        
        print("\nLoading delhi_pincode.geojson...")
        delhi_pincodes = gpd.read_file('data/delhi_pincode.geojson')
        print(f"✓ Loaded {len(delhi_pincodes)} pincodes")
        print(f"  Columns: {list(delhi_pincodes.columns)}")
        print(f"  CRS: {delhi_pincodes.crs}")
        
        print("\nLoading delhi_points.geojson...")
        delhi_points = gpd.read_file('data/delhi_points.geojson')
        print(f"✓ Loaded {len(delhi_points)} points")
        print(f"  Columns: {list(delhi_points.columns)}")
        print(f"  CRS: {delhi_points.crs}")
        
        print("\n=== All datasets loaded successfully! ===\n")
        
        return future_events, delhi_areas, delhi_pincodes, delhi_points
        
    except FileNotFoundError as e:
        print(f"❌ File not found: {e}")
        print("Please ensure all data files are in the 'data' directory")
        # Return empty but valid structures
        return [], gpd.GeoDataFrame(columns=['geometry'], geometry='geometry'), \
               gpd.GeoDataFrame(columns=['geometry'], geometry='geometry'), \
               gpd.GeoDataFrame(columns=['geometry'], geometry='geometry')
    
    except Exception as e:
        print(f"❌ Error loading datasets: {e}")
        import traceback
        traceback.print_exc()
        # Return empty but valid structures
        return [], gpd.GeoDataFrame(columns=['geometry'], geometry='geometry'), \
               gpd.GeoDataFrame(columns=['geometry'], geometry='geometry'), \
               gpd.GeoDataFrame(columns=['geometry'], geometry='geometry')

# Initialize datasets
print("=" * 60)
print("INITIALIZING MAPS REIMAGINED API")
print("=" * 60)
FUTURE_EVENTS, DELHI_AREAS, DELHI_PINCODES, DELHI_POINTS = load_datasets()
print("=" * 60)

@app.route('/')
def home():
    """Root endpoint"""
    datasets_loaded = (
        len(FUTURE_EVENTS) > 0 and 
        not DELHI_AREAS.empty and 
        not DELHI_PINCODES.empty and 
        not DELHI_POINTS.empty
    )
    
    return jsonify({
        'status': 'online',
        'message': 'Maps Reimagined Business Feasibility API',
        'version': '1.0',
        'datasets_loaded': datasets_loaded,
        'dataset_counts': {
            'future_events': len(FUTURE_EVENTS),
            'areas': len(DELHI_AREAS),
            'pincodes': len(DELHI_PINCODES),
            'points': len(DELHI_POINTS)
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
    # Try to find in areas dataset
    if not DELHI_AREAS.empty and 'name' in DELHI_AREAS.columns:
        try:
            area_match = DELHI_AREAS[DELHI_AREAS['name'].str.contains(area_name, case=False, na=False)]
            if not area_match.empty:
                centroid = area_match.iloc[0].geometry.centroid
                return centroid.y, centroid.x
        except Exception as e:
            print(f"Error searching areas: {e}")
    
    # Try to find in pincodes dataset
    if not DELHI_PINCODES.empty and 'pincode' in DELHI_PINCODES.columns and pincode:
        try:
            pincode_match = DELHI_PINCODES[DELHI_PINCODES['pincode'] == pincode]
            if not pincode_match.empty:
                centroid = pincode_match.iloc[0].geometry.centroid
                return centroid.y, centroid.x
        except Exception as e:
            print(f"Error searching pincodes: {e}")
    
    # Default to Delhi center
    print(f"Using default coordinates for {area_name}")
    return 28.7041, 77.1025

def calculate_risk_score(positive_impacts, negative_impacts, business_type, location_factors):
    """
    Calculate risk score using the formula:
    Risk = Base_Risk + (Avg_Negative_Impact × 40) - (Avg_Positive_Impact × 30) + Location_Factor
    """
    base_risk = 50
    
    avg_positive = sum([abs(e['impact']['score']) for e in positive_impacts]) / len(positive_impacts) if positive_impacts else 0
    avg_negative = sum([abs(e['impact']['score']) for e in negative_impacts]) / len(negative_impacts) if negative_impacts else 0
    
    # Calculate risk
    risk = base_risk + (avg_negative * 40) - (avg_positive * 30) + location_factors
    
    # Clamp between 0 and 100
    risk = max(0, min(100, risk))
    
    return round(risk, 2)

def generate_10year_projection(events, business_type, base_success_rate=60):
    """Generate 10-year success probability projection"""
    current_year = datetime.now().year
    projection = []
    
    for year_offset in range(11):  # 0 to 10 years
        year = current_year + year_offset
        success_prob = base_success_rate
        
        for event in events:
            impact_year = datetime.fromisoformat(event['timelines']['impact_start'].replace('Z', '')).year
            
            if year >= impact_year:
                years_after_impact = year - impact_year
                # Apply exponential decay to impact over time
                decay_factor = math.exp(-0.1 * years_after_impact)
                impact_contribution = event['impact']['score'] * 30 * decay_factor
                success_prob += impact_contribution
        
        # Clamp probability between 20 and 95
        success_prob = max(20, min(95, success_prob))
        
        projection.append({
            'year': year,
            'probability': round(success_prob, 1),
            'risk': round(100 - success_prob, 1)
        })
    
    return projection

def find_alternative_locations(business_type, current_risk, delhi_areas_data):
    """Suggest alternative locations with lower risk"""
    alternatives = []
    
    # Predefined high-potential areas in Delhi
    potential_areas = [
        {'name': 'Connaught Place', 'pincode': '110001', 'base_risk': 25, 'reason': 'High footfall, established commercial hub'},
        {'name': 'Saket', 'pincode': '110017', 'base_risk': 30, 'reason': 'Affluent residential area with strong retail demand'},
        {'name': 'Dwarka Sector 10', 'pincode': '110075', 'base_risk': 28, 'reason': 'New residential development, growing population'},
        {'name': 'Hauz Khas', 'pincode': '110016', 'base_risk': 32, 'reason': 'Young demographic, vibrant nightlife'},
        {'name': 'Nehru Place', 'pincode': '110019', 'base_risk': 35, 'reason': 'IT hub with high office worker population'},
        {'name': 'Lajpat Nagar', 'pincode': '110024', 'base_risk': 33, 'reason': 'Busy market area, excellent metro connectivity'}
    ]
    
    # Filter areas with lower risk than current
    for area in potential_areas:
        if area['base_risk'] < current_risk:
            alternatives.append({
                'area': area['name'],
                'pincode': area['pincode'],
                'risk': area['base_risk'],
                'reason': area['reason']
            })
    
    return sorted(alternatives, key=lambda x: x['risk'])[:3]

def suggest_alternative_businesses(business_type, area_characteristics):
    """Suggest alternative business types for the same location"""
    # Business type mapping based on common patterns
    business_alternatives = {
        'cafe': [
            {'type': 'Cloud Kitchen', 'reason': 'Lower overhead, delivery-focused model'},
            {'type': 'Co-working Space', 'reason': 'Growing remote work culture'}
        ],
        'restaurant': [
            {'type': 'Quick Service Restaurant (QSR)', 'reason': 'Faster turnover, lower staffing needs'},
            {'type': 'Ghost Kitchen', 'reason': 'Multi-brand delivery model'}
        ],
        'gym': [
            {'type': 'Yoga Studio', 'reason': 'Lower equipment costs, wellness trend'},
            {'type': 'Boutique Fitness Studio', 'reason': 'Premium pricing, loyal membership base'}
        ],
        'retail': [
            {'type': 'E-commerce Fulfillment Center', 'reason': 'Growing online shopping trend'},
            {'type': 'Experience Store', 'reason': 'Showroom + online sales model'}
        ],
        'default': [
            {'type': 'Service-based Business', 'reason': 'Lower inventory costs, flexible operations'},
            {'type': 'Franchise Opportunity', 'reason': 'Established brand, proven model'}
        ]
    }
    
    business_lower = business_type.lower()
    for key in business_alternatives:
        if key in business_lower:
            return business_alternatives[key]
    
    return business_alternatives['default']

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
        
        # Get coordinates
        lat, lng = geocode_location(area_name, pincode)
        
        # Find relevant future events
        relevant_events = []
        for event in FUTURE_EVENTS:
            distance = haversine_distance(
                lat, lng, 
                event['location']['lat'], 
                event['location']['lng']
            )
            
            # Check if within impact radius
            if distance <= event['impact']['radius_meters']:
                event_copy = event.copy()
                event_copy['distance_meters'] = round(distance, 2)
                relevant_events.append(event_copy)
        
        # Also check for sector-matched events
        for event in FUTURE_EVENTS:
            if event not in relevant_events:
                sectors = [s.lower() for s in event['impact']['affected_sectors']]
                if any(business_type.lower() in sector or sector in business_type.lower() for sector in sectors):
                    event_copy = event.copy()
                    event_copy['distance_meters'] = haversine_distance(
                        lat, lng, 
                        event['location']['lat'], 
                        event['location']['lng']
                    )
                    relevant_events.append(event_copy)
        
        # Separate positive and negative impacts
        positive_impacts = [e for e in relevant_events if e['impact']['sentiment'] == 'POSITIVE']
        negative_impacts = [e for e in relevant_events if e['impact']['sentiment'] == 'NEGATIVE']
        
        # Calculate location factors based on nearby points
        location_factor = 0
        if not DELHI_POINTS.empty:
            try:
                point = Point(lng, lat)
                nearby_points = DELHI_POINTS[DELHI_POINTS.geometry.distance(point) < 0.01]  # ~1km
                location_factor = len(nearby_points) * 0.5  # Positive factor for infrastructure
            except Exception as e:
                print(f"Error calculating location factor: {e}")
        
        # Calculate risk score
        risk_score = calculate_risk_score(positive_impacts, negative_impacts, business_type, location_factor)
        
        # Generate 10-year projection
        projection_data = generate_10year_projection(relevant_events, business_type)
        
        # Generate alternatives if high risk
        alternatives = []
        alternate_businesses = []
        
        if risk_score > 40:
            alternatives = find_alternative_locations(business_type, risk_score, DELHI_AREAS)
            alternate_businesses = suggest_alternative_businesses(business_type, {})
        
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
            'alternateBusiness': alternate_businesses,
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
    datasets_ok = (
        len(FUTURE_EVENTS) > 0 and 
        not DELHI_AREAS.empty and 
        not DELHI_PINCODES.empty and 
        not DELHI_POINTS.empty
    )
    
    return jsonify({
        'status': 'healthy' if datasets_ok else 'degraded',
        'datasets': {
            'future_events': len(FUTURE_EVENTS),
            'areas': len(DELHI_AREAS),
            'pincodes': len(DELHI_PINCODES),
            'points': len(DELHI_POINTS)
        }
    }), 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
