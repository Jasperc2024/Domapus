import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock #1: Fixes `window.matchMedia is not a function` for the use-mobile hook
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
});

// Mock #2: Fixes `ResizeObserver is not defined` for the MapLibreMap component
const ResizeObserverMock = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
vi.stubGlobal('ResizeObserver', ResizeObserverMock);

// Mock #3: Fixes the MapLibre import crash
// We tell Vitest that anytime a file imports 'maplibre-gl', it should get this fake object instead.
vi.mock('maplibre-gl', () => ({
  default: {
    Map: vi.fn(() => ({
      on: vi.fn((event, callback) => {
        // Automatically simulate the 'load' event to prevent hangs
        if (event === 'load') {
          callback();
        }
      }),
      remove: vi.fn(),
      resize: vi.fn(),
    })),
  },
}));