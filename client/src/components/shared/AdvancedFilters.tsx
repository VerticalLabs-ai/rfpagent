import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import {
  Calendar as CalendarIcon,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Discriminated union for filter value types
export type FilterValueMap = {
  text: string;
  select: string;
  multiselect: string[];
  date: string; // ISO date string
  daterange: [string | null, string | null]; // [from, to] ISO date strings
  number: number | null;
};

// Generic filter option type that enforces correct value types
export type FilterOption<
  T extends keyof FilterValueMap = keyof FilterValueMap,
> = {
  id: string;
  label: string;
  placeholder?: string;
} & (
  | {
      type: 'text';
    }
  | {
      type: 'select';
      options: { value: string; label: string }[];
    }
  | {
      type: 'multiselect';
      options: { value: string; label: string }[];
    }
  | {
      type: 'date';
    }
  | {
      type: 'daterange';
    }
  | {
      type: 'number';
    }
);

// Type-safe filter value map
export type FilterValue<
  T extends Record<string, keyof FilterValueMap> = Record<
    string,
    keyof FilterValueMap
  >,
> = {
  [K in keyof T]?: FilterValueMap[T[K]];
};

interface AdvancedFiltersProps<
  T extends Record<string, keyof FilterValueMap> = Record<
    string,
    keyof FilterValueMap
  >,
> {
  filters: FilterOption[];
  value: FilterValue<T>;
  onChange: (value: FilterValue<T>) => void;
  onReset?: () => void;
  className?: string;
}

export function AdvancedFilters<
  T extends Record<string, keyof FilterValueMap> = Record<
    string,
    keyof FilterValueMap
  >,
>({
  filters,
  value,
  onChange,
  onReset,
  className = '',
}: AdvancedFiltersProps<T>) {
  const [isOpen, setIsOpen] = useState(false);

  const activeFilterCount = useMemo(() => {
    return Object.keys(value).filter(key => {
      const val = value[key];
      if (Array.isArray(val)) return val.length > 0;
      if (typeof val === 'string') return val.trim() !== '';
      return val !== null && val !== undefined;
    }).length;
  }, [value]);

  const updateFilter = useCallback(
    <K extends keyof T>(filterId: K, newValue: FilterValueMap[T[K]]) => {
      onChange({
        ...value,
        [filterId]: newValue,
      } as FilterValue<T>);
    },
    [value, onChange]
  );

  const removeFilter = useCallback(
    <K extends keyof T>(filterId: K) => {
      const newValue = { ...value };
      delete newValue[filterId];
      onChange(newValue as FilterValue<T>);
    },
    [value, onChange]
  );

  const handleReset = useCallback(() => {
    onChange({});
    onReset?.();
  }, [onChange, onReset]);

  const renderFilterControl = (filter: FilterOption) => {
    const currentValue = value[filter.id as keyof T];

    switch (filter.type) {
      case 'text': {
        const textValue = (currentValue as string) || '';
        return (
          <Input
            placeholder={
              filter.placeholder || `Enter ${filter.label.toLowerCase()}`
            }
            value={textValue}
            onChange={e =>
              updateFilter(
                filter.id as keyof T,
                e.target.value as FilterValueMap[T[keyof T]]
              )
            }
            className="w-full"
          />
        );
      }

      case 'select': {
        const selectValue = (currentValue as string) || '';
        return (
          <Select
            value={selectValue}
            onValueChange={val =>
              updateFilter(
                filter.id as keyof T,
                val as FilterValueMap[T[keyof T]]
              )
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={
                  filter.placeholder || `Select ${filter.label.toLowerCase()}`
                }
              />
            </SelectTrigger>
            <SelectContent>
              {'options' in filter &&
                filter.options?.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        );
      }

      case 'multiselect': {
        const selectedValues = Array.isArray(currentValue)
          ? (currentValue as string[])
          : [];
        return (
          <div className="space-y-2">
            {'options' in filter &&
              filter.options?.map(option => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${filter.id}-${option.value}`}
                    checked={selectedValues.includes(option.value)}
                    onCheckedChange={checked => {
                      if (checked) {
                        updateFilter(
                          filter.id as keyof T,
                          [
                            ...selectedValues,
                            option.value,
                          ] as FilterValueMap[T[keyof T]]
                        );
                      } else {
                        updateFilter(
                          filter.id as keyof T,
                          selectedValues.filter(
                            v => v !== option.value
                          ) as FilterValueMap[T[keyof T]]
                        );
                      }
                    }}
                  />
                  <label
                    htmlFor={`${filter.id}-${option.value}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {option.label}
                  </label>
                </div>
              ))}
          </div>
        );
      }

      case 'date': {
        const dateValue = currentValue as string | undefined;
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateValue ? (
                  format(new Date(dateValue), 'PPP')
                ) : (
                  <span>Pick a date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={dateValue ? new Date(dateValue) : undefined}
                onSelect={date =>
                  updateFilter(
                    filter.id as keyof T,
                    (date?.toISOString() ?? '') as FilterValueMap[T[keyof T]]
                  )
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
        );
      }

      case 'daterange': {
        const [from, to] = Array.isArray(currentValue)
          ? (currentValue as [string | null, string | null])
          : [null, null];
        return (
          <div className="space-y-2">
            <Label className="text-xs">From</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {from ? (
                    format(new Date(from), 'PP')
                  ) : (
                    <span>Start date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={from ? new Date(from) : undefined}
                  onSelect={date =>
                    updateFilter(
                      filter.id as keyof T,
                      [
                        date?.toISOString() ?? null,
                        to,
                      ] as FilterValueMap[T[keyof T]]
                    )
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Label className="text-xs">To</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {to ? format(new Date(to), 'PP') : <span>End date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={to ? new Date(to) : undefined}
                  onSelect={date =>
                    updateFilter(
                      filter.id as keyof T,
                      [
                        from,
                        date?.toISOString() ?? null,
                      ] as FilterValueMap[T[keyof T]]
                    )
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        );
      }

      case 'number': {
        const numberValue = (currentValue as number | null) ?? '';
        return (
          <Input
            type="number"
            placeholder={
              filter.placeholder || `Enter ${filter.label.toLowerCase()}`
            }
            value={numberValue}
            onChange={e =>
              updateFilter(
                filter.id as keyof T,
                (e.target.value
                  ? Number(e.target.value)
                  : null) as FilterValueMap[T[keyof T]]
              )
            }
            className="w-full"
          />
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 rounded-full px-1.5 py-0.5 text-xs"
              >
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0" align="start">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">Advanced Filters</h3>
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  className="h-7 text-xs"
                >
                  Reset All
                </Button>
              )}
            </div>
            <Separator className="mb-4" />
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {filters.map(filter => (
                <div key={filter.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">
                      {filter.label}
                    </Label>
                    {value[filter.id] && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFilter(filter.id)}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  {renderFilterControl(filter)}
                </div>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Active Filter Tags */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(value).map(([key, val]) => {
            if (!val || (Array.isArray(val) && val.length === 0)) return null;
            const filter = filters.find(f => f.id === key);
            if (!filter) return null;

            let displayValue = val;
            if (Array.isArray(val)) {
              if (filter.type === 'daterange') {
                displayValue = val
                  .filter(Boolean)
                  .map(d => format(new Date(d), 'PP'))
                  .join(' - ');
              } else {
                displayValue = val.join(', ');
              }
            } else if (filter.type === 'date') {
              displayValue = format(new Date(val), 'PP');
            }

            return (
              <Badge
                key={key}
                variant="secondary"
                className="gap-1 pr-1 cursor-pointer hover:bg-secondary/80"
                onClick={() => removeFilter(key)}
              >
                {filter.label}: {String(displayValue)}
                <X className="h-3 w-3" />
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  debounceMs?: number;
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
  debounceMs = 300,
}: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const debouncedOnChange = useMemo(() => {
    return (val: string) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => onChange(val), debounceMs);
    };
  }, [onChange, debounceMs]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
      }
    };
  }, []);

  const handleChange = (newValue: string) => {
    setLocalValue(newValue);
    debouncedOnChange(newValue);
  };

  const handleClear = () => {
    setLocalValue('');
    onChange('');
  };

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        value={localValue}
        onChange={e => handleChange(e.target.value)}
        placeholder={placeholder}
        className="pl-10 pr-10"
      />
      {localValue && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
