
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MapLibreMap } from '../../components/dashboard/MapLibreMap';
import React from 'react';

describe('MapLibreMap Component', () => {
  const defaultProps = {
    selectedMetric: 'median-sale-price',
    onZipSelect: vi.fn(),
    zipData: { '90210': { zipCode: '90210' } } as any,
    colorScaleDomain: [100000, 500000] as [number, number],
    isLoading: false,
    progress: { phase: 'Idle' },
    processData: vi.fn().mockResolvedValue({ type: 'FeatureCollection', features: [] }),
  };

  it('should render the map container div without crashing', () => {
    // Add role="application" to the map container div for this test
    render(<MapLibreMap {...defaultProps} />);
    expect(screen.getByRole('application')).toBeInTheDocument();
  });

  it('should display the loading overlay when isLoading is true', () => {
    // Add role="status" to the loading overlay div for this test
    render(<MapLibreMap {...defaultProps} isLoading={true} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should NOT display the loading overlay when isLoading is false', () => {
    render(<MapLibreMap {...defaultProps} isLoading={false} />);
    // `queryByRole` returns null if not found, which is what we expect
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});