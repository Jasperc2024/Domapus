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
    center: [39.8283, -98.5795],
    zoom: 5,
    minZoom: 3,
    maxZoom: 12,
    scrollWheelZoom: true,
    dragging: true,
    zoomControl: true,
    maxBounds: [[-85, -180], [85, 180]],
    maxBoundsViscosity: 1.0,
    preferCanvas: true,
    worldCopyJump: false,
    zoomDelta: 0.5,
    zoomSnap: 0.25,
    renderer: L.canvas({
      padding: 2,
      tolerance: 5,
    }),
  });

  // 🟢 Create the custom pane for labels
  leafletMap.createPane('labelsPane');
  const labelsPane = leafletMap.getPane('labelsPane');
  if (labelsPane) {
    labelsPane.style.zIndex = '650'; // higher than tilePane (z-index: 200) and overlayPane (z-index: 400)
    labelsPane.style.pointerEvents = 'none'; // avoid blocking interactivity
  }

  // Base tile layer: Carto Positron without labels
  const baseTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
    attribution: '',
    subdomains: 'abcd',
    maxZoom: 18,
    keepBuffer: 8,
    updateWhenZooming: true,
    updateWhenIdle: false,
    crossOrigin: true,
    detectRetina: true,
    pane: 'tilePane',
  });

  baseTileLayer.addTo(leafletMap);

  // Labels layer: Carto Positron labels only (added later)
  const labelsLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 18,
    keepBuffer: 8,
    updateWhenZooming: true,
    updateWhenIdle: false,
    crossOrigin: true,
    detectRetina: true,
    pane: 'labelsPane',
  });

  // Save reference for later addition
  (leafletMap as any)._labelsLayer = labelsLayer;

  return leafletMap;
};