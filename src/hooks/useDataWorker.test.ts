import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDataWorker } from '@/hooks/useDataWorker'; // Correctly uses the path alias

// We can mock the worker to test the hook's behavior in isolation
// This is an advanced pattern, but shows the principle.
vi.mock('@/workers/data-processor.ts?worker', () => {
  // A mock worker class that we can control in our tests
  class MockWorker {
    onmessage: (event: any) => void = () => {};
    onerror: (event: any) => void = () => {};
    postMessage(data: any) {
      // Simulate a successful response
      this.onmessage({ data: { id: data.id, type: 'DATA_PROCESSED', data: { success: true } } });
    }
    terminate() {}
  }
  return { default: MockWorker };
});

describe('useDataWorker Hook', () => {
  it('should initialize with a loading state', () => {
    const { result } = renderHook(() => useDataWorker());
    expect(result.current.isLoading).toBe(true);
    expect(typeof result.current.processData).toBe('function');
  });

  it('should resolve a promise when the worker sends a success message', async () => {
    const { result } = renderHook(() => useDataWorker());
    
    let response;
    // `act` is used to wrap state updates in tests
    await act(async () => {
      response = await result.current.processData({ type: 'TEST' });
    });

    expect(response).toEqual({ success: true });
    expect(result.current.isLoading).toBe(false);
  });
});