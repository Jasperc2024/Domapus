import { Github, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MetricSelector, MetricType } from "./MetricSelector";
import { SearchBox } from "./SearchBox";
import { LastUpdated } from "./LastUpdated";

interface TopBarProps {
  selectedMetric: MetricType;
  onMetricChange: (metric: MetricType) => void;
  onSearch: (zipCode: string) => void;
  lastUpdated: string;
}

export function TopBar({ selectedMetric, onMetricChange, onSearch, lastUpdated }: TopBarProps) {
  return (
    <div className="flex items-center justify-between p-4 bg-dashboard-panel border-b border-dashboard-border">
      <div className="flex items-center space-x-4">
        <h1 className="text-2xl font-bold text-dashboard-text-primary">
          U.S. Housing Market Dashboard
        </h1>
        <MetricSelector 
          selectedMetric={selectedMetric}
          onMetricChange={onMetricChange}
        />
      </div>
      
      <div className="flex items-center space-x-4">
        <SearchBox onSearch={onSearch} />
        <LastUpdated lastUpdated={lastUpdated} />
        
        {/* GitHub Button */}
        <Button 
          variant="outline" 
          size="sm"
          asChild
          className="hidden sm:flex"
        >
          <a 
            href="https://github.com/Jasperc2024/Domapus" 
            target="_blank" 
            rel="noopener noreferrer"
            aria-label="View project on GitHub"
            className="flex items-center space-x-2"
          >
            <Github className="h-4 w-4" aria-hidden="true" />
            <span>GitHub</span>
          </a>
        </Button>

        {/* Sponsor Button */}
        <Button 
          variant="default" 
          size="sm"
          asChild
          className="hidden sm:flex bg-pink-600 hover:bg-pink-700 text-white"
        >
          <a 
            href="https://buymeacoffee.com/JasperC" 
            target="_blank" 
            rel="noopener noreferrer"
            aria-label="Support this project by sponsoring"
            className="flex items-center space-x-2"
          >
            <Heart className="h-4 w-4" aria-hidden="true" />
            <span>Sponsor</span>
          </a>
        </Button>
      </div>
    </div>
  );
}
