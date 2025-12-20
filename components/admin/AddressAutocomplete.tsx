import React, { useEffect, useState, useRef } from 'react';
import { Search } from 'lucide-react';
import { cn, debounce } from '@/lib/utils';
import { searchAddresses, AddressSearchResult } from '@/lib/geocoding';

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (address: string, lat: number, lng: number) => void;
  placeholder?: string;
  className?: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'הקלד כתובת...',
  className,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AddressSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search function
  const debouncedSearch = useRef(
    debounce(async (query: string) => {
      if (!query || query.length < 3) {
        setSuggestions([]);
        setIsOpen(false);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const results = await searchAddresses(query);
      setSuggestions(results);
      setIsOpen(results.length > 0);
      setIsLoading(false);
    }, 500)
  ).current;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    debouncedSearch(newValue);
  };

  const handleSelect = (item: AddressSearchResult) => {
    // Check if user entered a house number that isn't in the suggestion
    const userValue = value.trim();
    const suggestionValue = item.display_name.trim();
    
    // Extract potential house number from user input (middle or trailing digits)
    // Matches "Street 20" or "Street 20a" or "Street 20/4" or "Street 20 City"
    const numberMatch = userValue.match(/\s(\d+[a-zA-Zא-ת]?(?:\/\d+)?)(?:\s|$|,)/);
    
    let finalAddress = suggestionValue;
    
    if (numberMatch) {
      const number = numberMatch[1];
      // If suggestion doesn't already contain this number (word boundary check)
      // We check if the number exists as a distinct word to avoid matching "120" with "20"
      const numberRegex = new RegExp(`\\b${number}\\b`);
      
      if (!numberRegex.test(suggestionValue)) {
        // Append number to the end if not present
        // Format: "Street, HouseNumber, City" or "Street HouseNumber, City"
        // But suggestionValue is typically "Street, City"
        // We want "Street HouseNumber, City"
        const parts = suggestionValue.split(',');
        if (parts.length > 1) {
           const street = parts[0].trim();
           const city = parts.slice(1).join(',').trim();
           finalAddress = `${street} ${number}, ${city}`;
        } else {
           finalAddress = `${suggestionValue} ${number}`;
        }
      }
    }

    onSelect(finalAddress, item.lat, item.lng);
    setSuggestions([]);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div className="relative">
        <input
          type="text"
          className={cn(
            "w-full rounded-md border border-gray-300 px-3 py-2 pl-10 text-right text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
            className
          )}
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          dir="rtl"
        />
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          {suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.lat}-${suggestion.lng}-${index}`}
              className="flex w-full items-center px-4 py-2 text-right text-sm hover:bg-gray-100 text-gray-900"
              onClick={() => handleSelect(suggestion)}
              type="button"
            >
              <div className="flex flex-col items-start w-full">
                <span className="font-medium text-right w-full truncate">
                  {suggestion.display_name}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
      
      {isLoading && isOpen && suggestions.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white p-2 shadow-lg">
          <p className="text-center text-xs text-gray-500">מחפש כתובת...</p>
        </div>
      )}
    </div>
  );
}

