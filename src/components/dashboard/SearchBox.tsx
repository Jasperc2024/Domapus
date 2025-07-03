import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SearchBoxProps {
  onSearch: (zipCode: string) => void;
}

export function SearchBox({ onSearch }: SearchBoxProps) {
  const [searchValue, setSearchValue] = useState("");

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
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-10 w-48"
            maxLength={5}
          />
        </div>
        <Button type="submit" variant="outline" size="sm">
          Search
        </Button>
      </form>
    </div>
  );
}