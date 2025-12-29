// PMTiles Protocol handler for MapLibre GL
import { Protocol } from 'pmtiles';
import maplibregl from 'maplibre-gl';

let protocolAdded = false;

export function addPMTilesProtocol() {
  if (protocolAdded) return;
  
  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
  protocolAdded = true;
}

export function removePMTilesProtocol() {
  if (!protocolAdded) return;
  maplibregl.removeProtocol('pmtiles');
  protocolAdded = false;
}
