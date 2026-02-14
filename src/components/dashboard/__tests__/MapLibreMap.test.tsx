import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MapLibreMap } from "../MapLibreMap";
import maplibregl from "maplibre-gl";

vi.mock("maplibre-gl", () => {
  let lastMap: any = null;

  class MockMap {
    handlers: Record<string, Function[]> = {};

    constructor() {
      lastMap = this;
      setTimeout(() => {
        this.emit("load");
      }, 0);
    }

    on(event: string, cb: Function) {
      if (!this.handlers[event]) this.handlers[event] = [];
      this.handlers[event].push(cb);
    }

    once(event: string, cb: Function) {
      const onceHandler = (payload?: unknown) => {
        cb(payload);
        this.handlers[event] = (this.handlers[event] || []).filter(h => h !== onceHandler);
      };
      this.on(event, onceHandler);
    }

    emit(event: string, payload?: unknown) {
      (this.handlers[event] || []).forEach(cb => cb(payload));
    }

    addControl() {}
    getCenter() { return { lat: 0, lng: 0 }; }
    getBounds() { return { toArray: () => [[-1, -1], [1, 1]] as [[number, number], [number, number]] }; }
    getZoom() { return 5; }
    resize() {}
    remove() {}
    isStyleLoaded() { return true; }
    loaded() { return true; }
    getSource() { return null; }
    getLayer() { return null; }
    getStyle() { return { layers: [] as any[] }; }
  }

  class MockPopup {
    setLngLat() { return this; }
    setHTML() { return this; }
    addTo() { return this; }
    remove() {}
  }

  const mockModule = {
    Map: MockMap,
    Popup: MockPopup,
    AttributionControl: class {},
    NavigationControl: class {},
    __getLastMap: () => lastMap,
  };

  return { ...mockModule, default: mockModule };
});

const mockProcessData = vi.fn(async () => ({}) as any);

beforeEach(() => {
  vi.useFakeTimers();
  // Ensure container has size so map initializes
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 800 });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, value: 600 });

  (globalThis as any).ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
});


describe("MapLibreMap", () => {
  it("suppresses non-fatal decoding errors", async () => {
    render(
      <MapLibreMap
        selectedMetric="zhvi"
        onZipSelect={() => undefined}
        zipData={{}}
        colorScaleDomain={null}
        isLoading={false}
        processData={mockProcessData}
        customBuckets={null}
        onMapMove={() => undefined}
      />
    );

    // Trigger map load
    await act(async () => {
      vi.runAllTimers();
    });

    const lastMap = (maplibregl as any).__getLastMap();
    await act(async () => {
      lastMap.emit("error", { error: { message: "decoding failed" } });
    });

    expect(screen.queryByText("Map internal error. Try refreshing.")).toBeNull();
  });
});
