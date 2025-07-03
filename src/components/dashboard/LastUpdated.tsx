import { Calendar } from "lucide-react";

export function LastUpdated() {
  const lastUpdatedDate = new Date("2024-06-28");
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="flex items-center space-x-2 bg-dashboard-panel border border-dashboard-border rounded-lg px-3 py-2 shadow-sm">
      <Calendar className="h-4 w-4 text-dashboard-text-secondary" />
      <span className="text-sm text-dashboard-text-secondary">
        Updated: {formatDate(lastUpdatedDate)}
      </span>
    </div>
  );
}