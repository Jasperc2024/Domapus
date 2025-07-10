
import L from 'leaflet';

// Fix for default markers in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export const createMap = (container: HTMLElement): L.Map => {
  const leafletMap = L.map(container, {
    center: [39.8283, -98.5795], // Default center: US center
    zoom: 5, // Default zoom: 5
    minZoom: 3, // Min zoom: 3
    maxZoom: 12, // Max zoom: 12
    scrollWheelZoom: true,
    dragging: true,
    zoomControl: true,
    maxBounds: [[-85, -180], [85, 180]],
    maxBoundsViscosity: 1.0,
    preferCanvas: true,
    worldCopyJump: false,
    zoomDelta: 0.5, // Smoother, slower zooming
    zoomSnap: 0.25, // Allow fractional zoom levels
    renderer: L.canvas({
      padding: 2, // Increased padding for better performance
      tolerance: 5, // Increased tolerance for smoother interactions
      pane: 'overlayPane'
    })
  });

  // Add Carto Positron tile layer with synchronous loading
  const tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 18,
    keepBuffer: 8, // Increased buffer to avoid blank spaces
    updateWhenZooming: true, // Load tiles while zooming  
    updateWhenIdle: false, // Don't wait for idle
    crossOrigin: true,
    detectRetina: true,
    pane: 'tilePane' // Ensure tiles are at bottom
  });
  
  tileLayer.addTo(leafletMap);

  return leafletMap;
};
