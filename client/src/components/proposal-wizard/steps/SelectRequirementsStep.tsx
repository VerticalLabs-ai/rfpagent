import { useState, useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, CheckSquare, Square } from 'lucide-react';
import { useWizard } from '../context';
import { cn } from '@/lib/utils';

const CATEGORY_COLORS: Record<string, string> = {
  mandatory: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  preferred:
    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  optional: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
};

export function SelectRequirementsStep() {
  const { state, dispatch } = useWizard();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const groupedRequirements = useMemo(() => {
    const filtered = state.requirements.filter(req => {
      const matchesSearch =
        req.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.section.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        !filterCategory || req.category === filterCategory;
      return matchesSearch && matchesCategory;
    });

    // Group by section
    const groups: Record<string, typeof filtered> = {};
    filtered.forEach(req => {
      const section = req.section || 'General';
      if (!groups[section]) groups[section] = [];
      groups[section].push(req);
    });
    return groups;
  }, [state.requirements, searchQuery, filterCategory]);

  const selectedCount = state.requirements.filter(r => r.selected).length;
  const allSelected =
    state.requirements.length > 0 &&
    selectedCount === state.requirements.length;

  const handleToggleAll = () => {
    dispatch({ type: 'TOGGLE_ALL_REQUIREMENTS', payload: !allSelected });
  };

  const handleToggleRequirement = (id: string) => {
    dispatch({ type: 'TOGGLE_REQUIREMENT', payload: id });
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">
            Select Requirements to Address
          </h2>
          <p className="text-sm text-muted-foreground">
            {selectedCount} of {state.requirements.length} requirements selected
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleToggleAll}
          className="gap-2"
        >
          {allSelected ? (
            <Square className="w-4 h-4" />
          ) : (
            <CheckSquare className="w-4 h-4" />
          )}
          {allSelected ? 'Deselect All' : 'Select All'}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search requirements..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={filterCategory === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterCategory(null)}
          >
            All
          </Button>
          <Button
            variant={filterCategory === 'mandatory' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterCategory('mandatory')}
          >
            Mandatory
          </Button>
          <Button
            variant={filterCategory === 'preferred' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterCategory('preferred')}
          >
            Preferred
          </Button>
        </div>
      </div>

      {/* Requirements List */}
      <ScrollArea className="h-[400px] border rounded-lg">
        <div className="p-4 space-y-6">
          {Object.entries(groupedRequirements).map(
            ([section, requirements]) => (
              <div key={section}>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  {section}
                </h3>
                <div className="space-y-2">
                  {requirements.map(req => (
                    <div
                      key={req.id}
                      className={cn(
                        'flex items-start gap-3 p-3 border rounded-lg transition-colors cursor-pointer',
                        req.selected
                          ? 'bg-primary/5 border-primary/30'
                          : 'hover:bg-accent'
                      )}
                      onClick={() => handleToggleRequirement(req.id)}
                    >
                      <Checkbox
                        checked={req.selected}
                        onCheckedChange={() => handleToggleRequirement(req.id)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{req.text}</p>
                      </div>
                      <Badge
                        className={cn(
                          'shrink-0',
                          CATEGORY_COLORS[req.category]
                        )}
                      >
                        {req.category}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}

          {Object.keys(groupedRequirements).length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No requirements match your filters</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
