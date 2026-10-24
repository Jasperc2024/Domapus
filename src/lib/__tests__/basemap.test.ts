import { describe, expect, it } from "vitest";
import type { LayerSpecification, StyleSpecification } from "maplibre-gl";
import { withoutTransportation } from "../basemap";

const line = (id: string, sourceLayer: string): LayerSpecification => ({
  id, type: "line", source: "carto", "source-layer": sourceLayer, minzoom: 12,
});

describe("basemap transportation policy", () => {
  it("removes current and legacy roads, labels, bridges, tunnels and path areas", () => {
    const style: StyleSpecification = {
      version: 8, sources: {}, layers: [
        line("current", "roads"), line("legacy", "transportation"),
        line("shields", "transportation_name"), line("road_path_areas", "landuse"),
        ...["bridge", "tunnel", "rail", "aeroway", "roadname"].map(id => line(`${id}-test`, "other")),
        line("waterway", "waterway"), line("boundary_state", "boundary"),
        line("zips-border", "us_zip_codes"),
        { id: "place_city", type: "symbol", source: "carto", "source-layer": "place" },
        { id: "background", type: "background" },
      ],
    };
    const original = structuredClone(style);
    const filtered = withoutTransportation(undefined, style);
    expect(filtered.layers.map(layer => layer.id)).toEqual([
      "waterway", "boundary_state", "zips-border", "place_city", "background",
    ]);
    expect(style).toEqual(original);
    expect(filtered.sources).toBe(style.sources);
    expect(withoutTransportation(style, filtered)).toEqual(filtered);
  });
});
