import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, Lightbulb } from 'lucide-react';
import { useState } from 'react';

interface SearchExamplesProps {
  onSelectExample: (query: string) => void;
  className?: string;
}

const EXAMPLE_SEARCHES = [
  {
    query: 'IT services contracts in Texas',
    description: 'Find technology opportunities in a specific state',
  },
  {
    query: 'SDVOSB construction opportunities over $500k',
    description: 'Small business set-asides with value filtering',
  },
  {
    query: 'Healthcare consulting due next month',
    description: 'Filter by industry and deadline',
  },
  {
    query: 'DoD cybersecurity NAICS 541512',
    description: 'Agency and NAICS code combination',
  },
  {
    query: '8(a) professional services California',
    description: 'Set-aside type with location filter',
  },
  {
    query: 'Software development federal contracts under $1M',
    description: 'Keyword search with value range',
  },
];

export function SearchExamples({
  onSelectExample,
  className,
}: SearchExamplesProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <Lightbulb className="h-4 w-4" />
          <span>Search examples</span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {EXAMPLE_SEARCHES.map((example, index) => (
            <button
              key={index}
              onClick={() => onSelectExample(example.query)}
              className="text-left p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors group"
            >
              <p className="text-sm font-medium text-foreground group-hover:text-primary mb-1">
                "{example.query}"
              </p>
              <p className="text-xs text-muted-foreground">
                {example.description}
              </p>
            </button>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
