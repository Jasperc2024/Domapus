import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]); 

  return debouncedValue;
};

interface SearchBoxProps {
  onSearch: (zipCode: string) => void;
}

export function SearchBox({ onSearch }: SearchBoxProps) {
  const [searchValue, setSearchValue] = useState("");

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "");
    setSearchValue(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      onSearch(searchValue.trim()); // flyTo triggered ONLY here
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center space-x-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-dashboard-text-secondary" />
        <Input
          type="text"
          pattern="[0-9]*"
          inputMode="numeric"
          placeholder="Enter ZIP code..."
          value={searchValue}
          onChange={handleInputChange}
          className="pl-10 w-48"
          maxLength={5}
          aria-label="Search for ZIP code"
        />
      </div>
      <Button type="submit" variant="outline" size="sm" aria-label="Search">
        Search
      </Button>
    </form>
  );
}
