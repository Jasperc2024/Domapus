import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
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
    const { getByText } = render(<TopBar {...defaultProps} />);
    expect(getByText('U.S. Housing Market Dashboard')).toBeInTheDocument();
  });

  it('renders child components', () => {
    const { getByTestId } = render(<TopBar {...defaultProps} />);
    expect(getByTestId('metric-selector')).toBeInTheDocument();
    expect(getByTestId('search-box')).toBeInTheDocument();
    expect(getByTestId('last-updated')).toBeInTheDocument();
  });

  it('renders GitHub link with proper accessibility attributes', () => {
    const { getByLabelText } = render(<TopBar {...defaultProps} />);
    const githubLink = getByLabelText('View project on GitHub');
    expect(githubLink).toBeInTheDocument();
    expect(githubLink).toHaveAttribute('href', 'https://github.com/Jasperc2024/Domapus');
    expect(githubLink).toHaveAttribute('target', '_blank');
    expect(githubLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders sponsor link with proper accessibility attributes', () => {
    const { getByLabelText } = render(<TopBar {...defaultProps} />);
    const sponsorLink = getByLabelText('Support this project by sponsoring');
    expect(sponsorLink).toBeInTheDocument();
    expect(sponsorLink).toHaveAttribute('target', '_blank');
    expect(sponsorLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('displays the last updated date', () => {
    const { getByText } = render(<TopBar {...defaultProps} />);
    expect(getByText('2024-01-01')).toBeInTheDocument();
  });
});