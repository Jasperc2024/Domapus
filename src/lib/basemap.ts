import type { StyleSpecification } from "maplibre-gl";

export const BASEMAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

// Filter before MapLibre installs the style, including layers enabled only at high zoom.
export function withoutTransportation(
  _previous: StyleSpecification | undefined,
  next: StyleSpecification,
): StyleSpecification {
  return {
    ...next,
    layers: next.layers.filter(layer => {
      const sourceLayer = "source-layer" in layer ? layer["source-layer"] : undefined;
      return !["roads", "transportation", "transportation_name"].includes(sourceLayer ?? "") &&
        !/^(road|roadname|highway|motorway|bridge|tunnel|rail|railway|aeroway)(?:[_-]|$)/.test(layer.id);
    }),
  };
}
