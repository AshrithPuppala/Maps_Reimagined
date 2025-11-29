


// ----------------------------------------------------
// Initialize the map
// ----------------------------------------------------
const map = L.map('map').setView([28.6139, 77.2090], 10);

// Add base tiles
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);


// ----------------------------------------------------
// Layer Groups for controls
// ----------------------------------------------------
const delhiAreaLayer = L.layerGroup();
const delhiPincodeLayer = L.layerGroup();
const delhiCityLayer = L.layerGroup();
const delhiPointsLayer = L.layerGroup();


// ----------------------------------------------------
// 1. Delhi Area Polygons
// ----------------------------------------------------
fetch("delhi_area.geojson")
  .then(res => res.json())
  .then(data => {
    L.geoJSON(data, {
      style: {
        color: "#ff7800",
        weight: 2,
        fillOpacity: 0.2
      },
      onEachFeature: (feature, layer) => {
        const name = feature.properties?.name || "Unknown Area";
        layer.bindPopup(`<b>Area:</b> ${name}`);
      }
    }).addTo(delhiAreaLayer);
  });


// ----------------------------------------------------
// 2. Delhi Pincode Polygons
// ----------------------------------------------------
fetch("delhi_pincode.geojson")
  .then(res => res.json())
  .then(data => {
    L.geoJSON(data, {
      style: {
        color: "blue",
        weight: 1,
        fillOpacity: 0.15
      },
      onEachFeature: (feature, layer) => {
        const pincode = feature.properties?.pincode || "N/A";
        layer.bindPopup(`<b>Pincode:</b> ${pincode}`);
      }
    }).addTo(delhiPincodeLayer);
  });


// ----------------------------------------------------
// 3. Delhi City Boundary
// ----------------------------------------------------
fetch("delhi_city.geojson")
  .then(res => res.json())
  .then(data => {
    L.geoJSON(data, {
      style: {
        color: "red",
        weight: 3,
        fillOpacity: 0.05
      }
    }).addTo(delhiCityLayer);
  });


// ----------------------------------------------------
// 4. Categorical Points (GeoJSON Points Layer)
// ----------------------------------------------------
fetch("delhi_points.geojson")
  .then(res => res.json())
  .then(data => {
    L.geoJSON(data, {
      pointToLayer: (feature, latlng) => {
        return L.circleMarker(latlng, {
          radius: 6,
          fillOpacity: 0.9
        });
      },
      onEachFeature: (feature, layer) => {
        const p = feature.properties || {};
        layer.bindPopup(
          `<b>Category:</b> ${p.category || "Unknown"}<br>
           <b>Name:</b> ${p.name || "N/A"}`
        );
      }
    }).addTo(delhiPointsLayer);
  });


// ----------------------------------------------------
// Add Layers to Map by Default
// ----------------------------------------------------
delhiAreaLayer.addTo(map);
delhiPincodeLayer.addTo(map);
delhiCityLayer.addTo(map);
delhiPointsLayer.addTo(map);


// ----------------------------------------------------
// Layer Control (Show/Hide Layers)
// ----------------------------------------------------
L.control.layers(
  null,
  {
    "Delhi Areas": delhiAreaLayer,
    "Delhi Pincodes": delhiPincodeLayer,
    "Delhi City Boundary": delhiCityLayer,
    "Categorical Points": delhiPointsLayer
  }
).addTo(map);
