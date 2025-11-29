import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';

interface GeoJSONFeature {
  type: "Feature";
  properties: {
    [key: string]: any;
    name?: string;
    pin_code?: string;
    area?: string;
  };
  geometry: {
    type: string;
    coordinates: any[];
  };
}

interface GeoJSONCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

enum MapLayer {
  CITY = "City",
  PINCODE = "Pincode",
  AREA = "Area"
}

interface SelectedLocation {
  name: string;
  type: string;
  coordinates: [number, number];
  properties: any;
}

interface SimulationConfig {
  businessType: string;
  architecturalStyle: string;
  timeOfDay: string;
}

const FALLBACK_DATA: GeoJSONCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Connaught Place", area: "Connaught Place", pin_code: "110001" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [77.2140, 28.6340], [77.2220, 28.6340], [77.2220, 28.6270], [77.2140, 28.6270], [77.2140, 28.6340]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Hauz Khas Village", area: "Hauz Khas", pin_code: "110016" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [77.1930, 28.5560], [77.1980, 28.5560], [77.1980, 28.5520], [77.1930, 28.5520], [77.1930, 28.5560]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Saket District Centre", area: "Saket", pin_code: "110017" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [77.2170, 28.5260], [77.2240, 28.5260], [77.2240, 28.5200], [77.2170, 28.5200], [77.2170, 28.5260]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Karol Bagh", area: "Karol Bagh", pin_code: "110005" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [77.1850, 28.6550], [77.1950, 28.6550], [77.1950, 28.6450], [77.1850, 28.6450], [77.1850, 28.6550]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Lajpat Nagar", area: "Lajpat Nagar", pin_code: "110024" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [77.2350, 28.5700], [77.2450, 28.5700], [77.2450, 28.5600], [77.2350, 28.5600], [77.2350, 28.5700]
        ]]
      }
    }
  ]
};

const StreetView3D: React.FC<{
  location: SelectedLocation;
  config: SimulationConfig;
}> = ({ location, config }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [heading, setHeading] = useState(0);

  useEffect(() => {
    if (!mountRef.current) return;

    setLoading(true);
    const container = mountRef.current;
    
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x87CEEB, 100, 500);
    
    const camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 1.6, 5);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x555555,
      roughness: 0.8
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const sidewalkGeometry = new THREE.BoxGeometry(4, 0.2, 100);
    const sidewalkMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const sidewalk1 = new THREE.Mesh(sidewalkGeometry, sidewalkMaterial);
    sidewalk1.position.set(-8, 0.1, 0);
    scene.add(sidewalk1);

    const sidewalk2 = new THREE.Mesh(sidewalkGeometry, sidewalkMaterial);
    sidewalk2.position.set(8, 0.1, 0);
    scene.add(sidewalk2);

    const createShop = () => {
      const shopGroup = new THREE.Group();

      const buildingGeometry = new THREE.BoxGeometry(8, 5, 6);
      let buildingColor = 0xE8D5C4;
      
      switch(config.architecturalStyle) {
        case 'Modern Industrial':
          buildingColor = 0x2C3E50;
          break;
        case 'Minimalist Scandinavian':
          buildingColor = 0xF5F5F5;
          break;
        case 'Traditional Indian Heritage':
          buildingColor = 0xD4A574;
          break;
        case 'Cyberpunk Neon':
          buildingColor = 0x1a1a2e;
          break;
        case 'Eco-Friendly Green':
          buildingColor = 0x8FBC8F;
          break;
      }

      const buildingMaterial = new THREE.MeshStandardMaterial({ 
        color: buildingColor,
        roughness: 0.7
      });
      const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
      building.position.y = 2.5;
      building.castShadow = true;
      shopGroup.add(building);

      const glassGeometry = new THREE.BoxGeometry(6, 3, 0.2);
      const glassMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x88CCFF,
        transparent: true,
        opacity: 0.4,
        metalness: 0.1,
        roughness: 0.1
      });
      const glass = new THREE.Mesh(glassGeometry, glassMaterial);
      glass.position.set(0, 2, 3.1);
      shopGroup.add(glass);

      const doorGeometry = new THREE.BoxGeometry(1.5, 2.5, 0.2);
      const doorMaterial = new THREE.MeshStandardMaterial({ 
        color: config.architecturalStyle === 'Cyberpunk Neon' ? 0xFF0080 : 0x654321
      });
      const door = new THREE.Mesh(doorGeometry, doorMaterial);
      door.position.set(-2, 1.25, 3.1);
      shopGroup.add(door);

      const signGeometry = new THREE.BoxGeometry(6, 0.8, 0.3);
      const signMaterial = new THREE.MeshStandardMaterial({ 
        color: config.businessType.includes('Coffee') ? 0x6F4E37 : 0x34495E
      });
      const sign = new THREE.Mesh(signGeometry, signMaterial);
      sign.position.set(0, 4.8, 3.2);
      shopGroup.add(sign);

      if (config.architecturalStyle === 'Cyberpunk Neon') {
        const neonLight1 = new THREE.PointLight(0xFF0080, 2, 10);
        neonLight1.position.set(-2, 4.5, 3.5);
        shopGroup.add(neonLight1);

        const neonLight2 = new THREE.PointLight(0x00FFFF, 2, 10);
        neonLight2.position.set(2, 4.5, 3.5);
        shopGroup.add(neonLight2);
      }

      if (config.architecturalStyle === 'Traditional Indian Heritage') {
        const awningGeometry = new THREE.ConeGeometry(4, 1, 4);
        const awningMaterial = new THREE.MeshStandardMaterial({ color: 0xFF6347 });
        const awning = new THREE.Mesh(awningGeometry, awningMaterial);
        awning.rotation.y = Math.PI / 4;
        awning.position.set(0, 5.5, 2);
        shopGroup.add(awning);
      }

      if (config.architecturalStyle === 'Eco-Friendly Green') {
        for (let i = 0; i < 3; i++) {
          const plantGeometry = new THREE.ConeGeometry(0.3, 1, 8);
          const plantMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });
          const plant = new THREE.Mesh(plantGeometry, plantMaterial);
          plant.position.set(-3 + i * 1.5, 0.5, 3.5);
          shopGroup.add(plant);
        }
      }

      shopGroup.position.set(-10, 0, -10);
      return shopGroup;
    };

    const shop = createShop();
    scene.add(shop);

    for (let i = 0; i < 5; i++) {
      const height = 8 + Math.random() * 10;
      const buildingGeometry = new THREE.BoxGeometry(6, height, 8);
      const buildingMaterial = new THREE.MeshStandardMaterial({ 
        color: Math.random() * 0xffffff,
        roughness: 0.8
      });
      const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
      building.position.set(
        -15 + i * 8,
        height / 2,
        -30 - Math.random() * 20
      );
      building.castShadow = true;
      scene.add(building);
    }

    for (let i = 0; i < 6; i++) {
      const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.4, 3);
      const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
      const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);

      const foliageGeometry = new THREE.SphereGeometry(1.5, 8, 8);
      const foliageMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });
      const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
      foliage.position.y = 3;

      const tree = new THREE.Group();
      tree.add(trunk);
      tree.add(foliage);
      tree.position.set(
        i % 2 === 0 ? -10 : 10,
        1.5,
        -15 + i * 8
      );
      scene.add(tree);
    }

    const skyGeometry = new THREE.SphereGeometry(400, 32, 32);
    const skyMaterial = new THREE.MeshBasicMaterial({ 
      color: config.timeOfDay.includes('Night') ? 0x000428 : 0x87CEEB,
      side: THREE.BackSide
    });
    const sky = new THREE.Mesh(skyGeometry, skyMaterial);
    scene.add(sky);

    setLoading(false);

    let isDragging = false;
    let previousMouseX = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      previousMouseX = e.clientX;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const deltaX = e.clientX - previousMouseX;
        setHeading(prev => prev + deltaX * 0.5);
        previousMouseX = e.clientX;
      }
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    container.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      
      camera.position.x = Math.sin(heading * Math.PI / 180) * 5;
      camera.position.z = Math.cos(heading * Math.PI / 180) * 5;
      camera.lookAt(shop.position);
      
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current) return;
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      container.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', handleResize);
      
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (object.material instanceof THREE.Material) {
            object.material.dispose();
          }
        }
      });
      renderer.dispose();
    };
  }, [location, config, heading]);

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="w-full h-full bg-gray-900 rounded-xl overflow-hidden" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="text-white text-center">
            <svg className="animate-spin h-8 w-8 text-indigo-500 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-sm">Building 3D scene...</p>
          </div>
        </div>
      )}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-4 py-2 rounded-full backdrop-blur-md pointer-events-none">
        Drag to rotate • {location.name}
      </div>
      <div className="absolute top-3 right-3 bg-indigo-600/90 text-white text-xs font-bold px-3 py-1 rounded-lg shadow-lg backdrop-blur-sm">
        3D STREET VIEW
      </div>
    </div>
  );
};

const SimpleMap: React.FC<{
  data: GeoJSONCollection;
  onLocationSelect: (loc: SelectedLocation) => void;
  activeLayer: MapLayer;
}> = ({ data, onLocationSelect, activeLayer }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div className="relative w-full h-full bg-gradient-to-br from-blue-50 to-indigo-100 p-8 overflow-auto">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
          Select a Location in Delhi
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.features.map((feature, index) => {
            const name = feature.properties.name || 
                        feature.properties.area || 
                        feature.properties.pin_code || 
                        'Unknown';
            
            const coords = feature.geometry.coordinates[0];
            const centerLat = coords.reduce((sum: number, c: number[]) => sum + c[1], 0) / coords.length;
            const centerLng = coords.reduce((sum: number, c: number[]) => sum + c[0], 0) / coords.length;

            return (
              <button
                key={index}
                onClick={() => onLocationSelect({
                  name,
                  type: activeLayer,
                  coordinates: [centerLat, centerLng],
                  properties: feature.properties
                })}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`p-6 rounded-xl border-2 transition-all text-left ${
                  hoveredIndex === index
                    ? 'border-indigo-500 bg-white shadow-xl scale-105'
                    : 'border-gray-200 bg-white/80 hover:border-indigo-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-xl">📍</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 text-lg mb-1 truncate">{name}</h3>
                    <p className="text-sm text-gray-500">
                      {feature.properties.area && `Area: ${feature.properties.area}`}
                      {feature.properties.pin_code && ` • PIN: ${feature.properties.pin_code}`}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      {centerLat.toFixed(4)}, {centerLng.toFixed(4)}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [activeLayer, setActiveLayer] = useState<MapLayer>(MapLayer.AREA);
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [geoData, setGeoData] = useState<GeoJSONCollection>(FALLBACK_DATA);
  const [loading, setLoading] = useState(false);
  
  const [config, setConfig] = useState<SimulationConfig>({
    businessType: 'Coffee Shop',
    architecturalStyle: 'Modern Industrial',
    timeOfDay: 'Sunny afternoon'
  });

  const DATA_URLS = {
    [MapLayer.CITY]: 'https://d3ucb59hn6tk5w.cloudfront.net/delhi_city.geojson',
    [MapLayer.PINCODE]: 'https://d3ucb59hn6tk5w.cloudfront.net/delhi_pincode.geojson',
    [MapLayer.AREA]: 'https://d3ucb59hn6tk5w.cloudfront.net/delhi_area.geojson',
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(DATA_URLS[activeLayer]);
        if (!response.ok) throw new Error('Fetch failed');
        const json = await response.json();
        if (!json.features || json.features.length === 0) throw new Error('Empty data');
        setGeoData(json);
      } catch (error) {
        console.warn('Using fallback data:', error);
        setGeoData(FALLBACK_DATA);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [activeLayer]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50">
      <div className="flex flex-col md:flex-row w-full h-full">
        
        <div className="flex-1 h-1/2 md:h-full relative">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              <div className="text-center">
                <svg className="animate-spin h-12 w-12 text-indigo-600 mx-auto mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-gray-600 font-semibold">Loading locations...</p>
              </div>
            </div>
          ) : (
            <SimpleMap 
              data={geoData}
              onLocationSelect={setSelectedLocation}
              activeLayer={activeLayer}
            />
          )}
        </div>

        <div className="w-full md:w-[450px] bg-white border-l border-gray-200 h-full overflow-y-auto shadow-xl flex flex-col">
          
          <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
            <h1 className="text-xl font-bold flex items-center gap-2">
              🏪 DelhiBizViz
            </h1>
            <p className="text-indigo-100 text-sm mt-1">3D Business Location Visualizer</p>
          </div>

          <div className="p-6 space-y-6 flex-1 overflow-y-auto">
            
            <div className="space-y-3">
              <label className="text-xs font-semibold text-gray-500 uppercase">Map Layer</label>
              <div className="flex bg-gray-100 p-1 rounded-lg">
                {Object.values(MapLayer).map((layer) => (
                  <button
                    key={layer}
                    onClick={() => setActiveLayer(layer)}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                      activeLayer === layer 
                        ? 'bg-white text-indigo-600 shadow-sm' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {layer}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-indigo-400 uppercase mb-2">Selected Location</p>
              <h2 className="text-lg font-bold text-gray-900">
                {selectedLocation ? selectedLocation.name : "No location selected"}
              </h2>
              {selectedLocation && (
                <p className="text-xs text-gray-500 mt-2">
                  {selectedLocation.coordinates[0].toFixed(4)}, {selectedLocation.coordinates[1].toFixed(4)}
                </p>
              )}
            </div>

            <div className="space-y-4">
              <label className="text-xs font-semibold text-gray-500 uppercase">Configuration</label>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Type</label>
                <select
                  value={config.businessType}
                  onChange={(e) => setConfig({ ...config, businessType: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 p-2 text-sm"
                >
                  <option value="Coffee Shop">☕ Coffee Shop</option>
                  <option value="Boutique Clothing Store">👗 Boutique Clothing</option>
                  <option value="Bakery">🥐 Bakery</option>
                  <option value="Tech Startup Office">💻 Tech Office</option>
                  <option value="Restaurant">🍽️ Restaurant</option>
                  <option value="Bookstore">📚 Bookstore</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Architectural Style</label>
                <select
                  value={config.architecturalStyle}
                  onChange={(e) => setConfig({ ...config, architecturalStyle: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 p-2 text-sm"
                >
                  <option value="Modern Industrial">Modern Industrial</option>
                  <option value="Minimalist Scandinavian">Minimalist Scandinavian</option>
                  <option value="Traditional Indian Heritage">Traditional Heritage</option>
                  <option value="Cyberpunk Neon">Cyberpunk / Neon</option>
                  <option value="Eco-Friendly Green">Eco-Friendly</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time of Day</label>
                <select
                  value={config.timeOfDay}
                  onChange={(e) => setConfig({ ...config, timeOfDay: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 p-2 text-sm"
                >
                  <option value="Sunny afternoon">☀️ Sunny Afternoon</option>
                  <option value="Golden hour sunset">🌅 Golden Hour</option>
                  <option value="Rainy evening">🌧️ Rainy Evening</option>
                  <option value="Night with street lights">🌙 Night</option>
                </select>
              </div>
            </div>

            {selectedLocation && (
              <div className="space-y-3 pt-4 border-t">
                <h3 className="text-sm font-semibold text-gray-900 uppercase">3D Street View</h3>
                <div className="w-full h-[400px] rounded-xl overflow-hidden shadow-lg border border-gray-200">
                  <StreetView3D location={selectedLocation} config={config} />
                </div>
                <p className="text-xs text-gray-500 text-center">
                  💡 This is a procedurally generated 3D scene based on your location and preferences
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
