import { useState, useCallback } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SearchBoxProps {
  onSearch: (zipCode: string, trigger: number) => void;
}

export function SearchBox({ onSearch }: SearchBoxProps) {
  const [searchValue, setSearchValue] = useState("");
  const [searchTrigger, setSearchTrigger] = useState(0);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "");
    setSearchValue(value);
  };

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      // Increment trigger to force flyTo even if same ZIP
      const newTrigger = searchTrigger + 1;
      setSearchTrigger(newTrigger);
      onSearch(searchValue.trim(), newTrigger);
    }
  }, [searchValue, searchTrigger, onSearch]);

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 w-full min-w-0">
      <div className="relative flex-1 min-w-[9rem] max-w-[24rem]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dashboard-text-secondary" />
        <Input
          type="text"
          pattern="[0-9]*"
          inputMode="numeric"
          placeholder="Enter ZIP code..."
          value={searchValue}
          onChange={handleInputChange}
          className="pl-10 w-full"
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
