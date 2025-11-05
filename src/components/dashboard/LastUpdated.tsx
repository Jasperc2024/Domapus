import { Calendar } from "lucide-react";

interface LastUpdatedProps {
  lastUpdated?: string;
}

export function LastUpdated({ lastUpdated }: LastUpdatedProps) {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "July 1, 2025"; // Default date if no lastUpdated provided
    
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return "July 1, 2025"; // Fallback if date parsing fails
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Calendar className="h-3 w-3 text-dashboard-text-secondary" />
      <span className="text-xs text-dashboard-text-secondary whitespace-nowrap">
        {formatDate(lastUpdated || "")}
      </span>
    </div>
  );
}