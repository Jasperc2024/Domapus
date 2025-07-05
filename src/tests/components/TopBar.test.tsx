import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TopBar } from '../../components/dashboard/TopBar';

// Mock the child components
vi.mock('../../components/dashboard/MetricSelector', () => ({
  MetricSelector: ({ selectedMetric, onMetricChange }: any) => (
    <div data-testid="metric-selector">
      <button onClick={() => onMetricChange('median-list-price')}>
        Change Metric
      </button>
      <span>{selectedMetric}</span>
    </div>
  ),
}));

vi.mock('../../components/dashboard/SearchBox', () => ({
  SearchBox: ({ onSearch }: any) => (
    <div data-testid="search-box">
      <button onClick={() => onSearch('12345')}>Search</button>
    </div>
  ),
}));

vi.mock('../../components/dashboard/LastUpdated', () => ({
  LastUpdated: ({ lastUpdated }: any) => (
    <div data-testid="last-updated">{lastUpdated}</div>
  ),
}));

describe('TopBar', () => {
  const defaultProps = {
    selectedMetric: 'median-sale-price' as const,
    onMetricChange: vi.fn(),
    onSearch: vi.fn(),
    lastUpdated: '2024-01-01',
  };

  it('renders the main title', () => {
    render(<TopBar {...defaultProps} />);
    expect(screen.getByText('U.S. Housing Market Dashboard')).toBeInTheDocument();
  });

  it('renders child components', () => {
    render(<TopBar {...defaultProps} />);
    expect(screen.getByTestId('metric-selector')).toBeInTheDocument();
    expect(screen.getByTestId('search-box')).toBeInTheDocument();
    expect(screen.getByTestId('last-updated')).toBeInTheDocument();
  });

  it('renders GitHub link with proper accessibility attributes', () => {
    render(<TopBar {...defaultProps} />);
    const githubLink = screen.getByLabelText('View project on GitHub');
    expect(githubLink).toBeInTheDocument();
    expect(githubLink).toHaveAttribute('href', 'https://github.com/Jasperc2024/Domapus');
    expect(githubLink).toHaveAttribute('target', '_blank');
    expect(githubLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders sponsor link with proper accessibility attributes', () => {
    render(<TopBar {...defaultProps} />);
    const sponsorLink = screen.getByLabelText('Support this project by sponsoring');
    expect(sponsorLink).toBeInTheDocument();
    expect(sponsorLink).toHaveAttribute('target', '_blank');
    expect(sponsorLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('calls onMetricChange when metric is changed', () => {
    render(<TopBar {...defaultProps} />);
    fireEvent.click(screen.getByText('Change Metric'));
    expect(defaultProps.onMetricChange).toHaveBeenCalledWith('median-list-price');
  });

  it('calls onSearch when search is triggered', () => {
    render(<TopBar {...defaultProps} />);
    fireEvent.click(screen.getByText('Search'));
    expect(defaultProps.onSearch).toHaveBeenCalledWith('12345');
  });

  it('displays the last updated date', () => {
    render(<TopBar {...defaultProps} />);
    expect(screen.getByText('2024-01-01')).toBeInTheDocument();
  });
});