import { Calendar } from "lucide-react";

interface LastUpdatedProps {
  lastUpdated?: string;
}

export function LastUpdated({ lastUpdated }: LastUpdatedProps) {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "June 28, 2024";
    
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return "June 28, 2024";
    }
  };

  return (
    <div className="flex items-center space-x-2 bg-dashboard-panel border border-dashboard-border rounded-lg px-3 py-2 shadow-sm">
      <Calendar className="h-4 w-4 text-dashboard-text-secondary" />
      <span className="text-sm text-dashboard-text-secondary">
        Updated: {formatDate(lastUpdated || "")}
      </span>
    </div>
  );
}