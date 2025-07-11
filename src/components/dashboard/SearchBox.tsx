import { useState, useCallback } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Debounce function for search
const useDebounce = (callback: Function, delay: number) => {
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout>();

  const debouncedCallback = useCallback((...args: any[]) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    const newTimer = setTimeout(() => {
      callback(...args);
    }, delay);
    
    setDebounceTimer(newTimer);
  }, [callback, delay, debounceTimer]);

  return debouncedCallback;
};

interface SearchBoxProps {
  onSearch: (zipCode: string) => void;
}

export function SearchBox({ onSearch }: SearchBoxProps) {
  const [searchValue, setSearchValue] = useState("");

  // Debounced search function
  const debouncedSearch = useDebounce((value: string) => {
    if (value.trim() && value.length >= 3) {
      onSearch(value.trim());
    }
  }, 300);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    
    // Trigger debounced search on input change
    debouncedSearch(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      onSearch(searchValue.trim());
    }
  };

  return (
    <div className="bg-dashboard-panel border border-dashboard-border rounded-lg p-3 shadow-sm">
      <form onSubmit={handleSubmit} className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-dashboard-text-secondary" />
          <Input
            type="text"
            placeholder="Enter ZIP code..."
            value={searchValue}
            onChange={handleInputChange}
            className="pl-10 w-48"
            maxLength={5}
            aria-label="Search for ZIP code"
          />
        </div>
        <Button type="submit" variant="outline" size="sm" aria-label="Search for ZIP code">
          Search
        </Button>
      </form>
    </div>
  );
}