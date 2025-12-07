import { useState, useCallback, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  Sparkles,
  X,
  Loader2,
  Filter,
  Calendar,
  DollarSign,
  MapPin,
  Building2,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

interface SearchFilters {
  keywords?: string[];
  naicsCodes?: string[];
  setAsideTypes?: string[];
  states?: string[];
  agencies?: string[];
  deadlineAfter?: string;
  deadlineBefore?: string;
  minValue?: number;
  maxValue?: number;
}

interface ParseResult {
  filters: SearchFilters;
  explanation: string;
  suggestions?: string[];
  confidence: number;
}

interface SearchResult {
  rfps: any[];
  totalCount: number;
  appliedFilters: SearchFilters;
  explanation: string;
  suggestions?: string[];
}

interface NaturalLanguageSearchBarProps {
  onSearchResults: (results: SearchResult | null) => void;
  onClear: () => void;
  className?: string;
  placeholder?: string;
}

export function NaturalLanguageSearchBar({
  onSearchResults,
  onClear,
  className,
  placeholder = 'Search RFPs... Try "IT contracts in Texas" or "SDVOSB construction opportunities"',
}: NaturalLanguageSearchBarProps) {
  const [query, setQuery] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Mutation for parsing query (preview)
  const parseMutation = useMutation({
    mutationFn: async (q: string) => {
      const response = await apiRequest('POST', '/api/rfps/search/parse', {
        query: q,
      });
      return response.json();
    },
    onSuccess: data => {
      if (data.success) {
        setParseResult(data.data);
        setShowPreview(true);
      }
    },
  });

  // Mutation for executing search
  const searchMutation = useMutation({
    mutationFn: async (q: string) => {
      const response = await apiRequest('POST', '/api/rfps/search/natural', {
        query: q,
        limit: 50,
        offset: 0,
      });
      return response.json();
    },
    onSuccess: data => {
      if (data.success) {
        onSearchResults(data.data);
        setShowPreview(false);
      }
    },
  });

  // Debounced parse on typing
  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (value.length >= 5) {
      debounceRef.current = setTimeout(() => {
        parseMutation.mutate(value);
      }, 500);
    } else {
      setShowPreview(false);
      setParseResult(null);
    }
  }, []);

  // Handle search submission
  const handleSearch = useCallback(() => {
    if (query.length >= 3) {
      searchMutation.mutate(query);
    }
  }, [query]);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSearch();
      }
      if (e.key === 'Escape') {
        setShowPreview(false);
      }
    },
    [handleSearch]
  );

  // Clear search
  const handleClear = useCallback(() => {
    setQuery('');
    setShowPreview(false);
    setParseResult(null);
    onClear();
    inputRef.current?.focus();
  }, [onClear]);

  // Click outside to close preview
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.search-container')) {
        setShowPreview(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const isLoading = parseMutation.isPending || searchMutation.isPending;

  return (
    <div className={cn('search-container relative', className)}>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" />
          <Search className="h-4 w-4 text-muted-foreground" />
        </div>
        <Input
          ref={inputRef}
          value={query}
          onChange={e => handleQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() =>
            query.length >= 5 && parseResult && setShowPreview(true)
          }
          placeholder={placeholder}
          className="pl-14 pr-24 h-12 text-base"
          data-testid="nl-search-input"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleClear}
              data-testid="nl-search-clear"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <Button
            onClick={handleSearch}
            disabled={query.length < 3 || isLoading}
            size="sm"
            className="h-8"
            data-testid="nl-search-button"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Search'
            )}
          </Button>
        </div>
      </div>

      {/* Parse Preview Dropdown */}
      {showPreview && parseResult && (
        <Card className="absolute top-full left-0 right-0 mt-2 z-50 shadow-lg">
          <CardContent className="p-4">
            {/* Explanation */}
            <p className="text-sm text-muted-foreground mb-3">
              {parseResult.explanation}
            </p>

            {/* Applied Filters Preview */}
            <div className="flex flex-wrap gap-2 mb-3">
              {parseResult.filters.keywords?.map(kw => (
                <Badge key={kw} variant="secondary">
                  <Search className="h-3 w-3 mr-1" />
                  {kw}
                </Badge>
              ))}
              {parseResult.filters.states?.map(state => (
                <Badge
                  key={state}
                  variant="outline"
                  className="bg-blue-50 dark:bg-blue-950"
                >
                  <MapPin className="h-3 w-3 mr-1" />
                  {state}
                </Badge>
              ))}
              {parseResult.filters.setAsideTypes?.map(type => (
                <Badge
                  key={type}
                  variant="outline"
                  className="bg-green-50 dark:bg-green-950"
                >
                  <Building2 className="h-3 w-3 mr-1" />
                  {type}
                </Badge>
              ))}
              {parseResult.filters.naicsCodes?.map(code => (
                <Badge
                  key={code}
                  variant="outline"
                  className="bg-purple-50 dark:bg-purple-950"
                >
                  <Filter className="h-3 w-3 mr-1" />
                  NAICS {code}
                </Badge>
              ))}
              {(parseResult.filters.deadlineAfter ||
                parseResult.filters.deadlineBefore) && (
                <Badge
                  variant="outline"
                  className="bg-orange-50 dark:bg-orange-950"
                >
                  <Calendar className="h-3 w-3 mr-1" />
                  {parseResult.filters.deadlineAfter &&
                    `After ${parseResult.filters.deadlineAfter}`}
                  {parseResult.filters.deadlineAfter &&
                    parseResult.filters.deadlineBefore &&
                    ' - '}
                  {parseResult.filters.deadlineBefore &&
                    `Before ${parseResult.filters.deadlineBefore}`}
                </Badge>
              )}
              {(parseResult.filters.minValue !== undefined ||
                parseResult.filters.maxValue !== undefined) && (
                <Badge
                  variant="outline"
                  className="bg-yellow-50 dark:bg-yellow-950"
                >
                  <DollarSign className="h-3 w-3 mr-1" />
                  {parseResult.filters.minValue !== undefined &&
                    `$${(parseResult.filters.minValue / 1000).toFixed(0)}k`}
                  {parseResult.filters.minValue !== undefined &&
                    parseResult.filters.maxValue !== undefined &&
                    ' - '}
                  {parseResult.filters.maxValue !== undefined &&
                    `$${(parseResult.filters.maxValue / 1000).toFixed(0)}k`}
                </Badge>
              )}
            </div>

            {/* Confidence indicator */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Confidence: {Math.round(parseResult.confidence * 100)}%
              </span>
              <Button
                size="sm"
                variant="default"
                onClick={handleSearch}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Search Now
              </Button>
            </div>

            {/* Suggestions */}
            {parseResult.suggestions && parseResult.suggestions.length > 0 && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs text-muted-foreground mb-2">
                  Related searches:
                </p>
                <div className="flex flex-wrap gap-2">
                  {parseResult.suggestions.map((suggestion, i) => (
                    <Button
                      key={i}
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => {
                        setQuery(suggestion);
                        parseMutation.mutate(suggestion);
                      }}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function NaturalLanguageSearchBarSkeleton() {
  return <Skeleton className="h-12 w-full" />;
}
