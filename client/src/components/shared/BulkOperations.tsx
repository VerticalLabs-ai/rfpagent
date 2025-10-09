import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { ChevronDown, Loader2, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

export interface BulkAction {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: 'default' | 'destructive';
  requiresConfirmation?: boolean;
  confirmationTitle?: string;
  confirmationDescription?: string;
}

interface BulkOperationsProps<T extends { id: string }> {
  items: T[];
  selectedItems: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
  actions: BulkAction[];
  onAction: (actionId: string, selectedIds: string[]) => Promise<void>;
  getItemLabel?: (item: T) => string;
  className?: string;
}

export function BulkOperations<T extends { id: string }>({
  items,
  selectedItems,
  onSelectionChange,
  actions,
  onAction,
  getItemLabel = item => item.id,
  className = '',
}: BulkOperationsProps<T>) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmAction, setConfirmAction] = useState<BulkAction | null>(null);
  const { toast } = useToast();

  const allSelected = useMemo(
    () => items.length > 0 && items.every(item => selectedItems.has(item.id)),
    [items, selectedItems]
  );

  const someSelected = useMemo(
    () => selectedItems.size > 0 && !allSelected,
    [selectedItems, allSelected]
  );

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(items.map(item => item.id)));
    }
  }, [allSelected, items, onSelectionChange]);

  const executeAction = useCallback(
    async (action: BulkAction) => {
      if (selectedItems.size === 0) {
        toast({
          title: 'No Items Selected',
          description: 'Please select at least one item to perform this action',
          variant: 'destructive',
        });
        return;
      }

      setIsProcessing(true);
      setConfirmAction(null);

      try {
        await onAction(action.id, Array.from(selectedItems));

        toast({
          title: 'Success',
          description: `${action.label} completed for ${selectedItems.size} item(s)`,
        });

        onSelectionChange(new Set());
      } catch (error) {
        toast({
          title: 'Error',
          description:
            error instanceof Error
              ? error.message
              : `Failed to ${action.label.toLowerCase()}`,
          variant: 'destructive',
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [selectedItems, onAction, toast, onSelectionChange]
  );

  const handleActionClick = useCallback(
    (action: BulkAction) => {
      if (action.requiresConfirmation) {
        setConfirmAction(action);
      } else {
        executeAction(action);
      }
    },
    [executeAction]
  );

  return (
    <>
      <div className={`flex items-center gap-3 ${className}`}>
        {/* Select All Checkbox */}
        <div className="flex items-center gap-2">
          <Checkbox
            checked={allSelected}
            onCheckedChange={handleSelectAll}
            aria-label="Select all items"
            className={someSelected ? 'data-[state=checked]:bg-primary/50' : ''}
          />
          {selectedItems.size > 0 && (
            <span className="text-sm text-muted-foreground">
              {selectedItems.size} selected
            </span>
          )}
        </div>

        {/* Bulk Actions Dropdown */}
        {selectedItems.size > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={isProcessing}
                className="gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Bulk Actions
                    <ChevronDown className="h-4 w-4" />
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {actions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <div key={action.id}>
                    {index > 0 && action.variant === 'destructive' && (
                      <DropdownMenuSeparator />
                    )}
                    <DropdownMenuItem
                      onClick={() => handleActionClick(action)}
                      className={
                        action.variant === 'destructive'
                          ? 'text-destructive focus:text-destructive'
                          : ''
                      }
                    >
                      {Icon && <Icon className="mr-2 h-4 w-4" />}
                      {action.label}
                    </DropdownMenuItem>
                  </div>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Clear Selection */}
        {selectedItems.size > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelectionChange(new Set())}
            className="gap-1 text-muted-foreground"
          >
            <X className="h-4 w-4" />
            Clear
          </Button>
        )}

        {/* Selected Items Preview */}
        {selectedItems.size > 0 && selectedItems.size <= 3 && (
          <div className="flex items-center gap-1 flex-wrap">
            {Array.from(selectedItems)
              .slice(0, 3)
              .map(id => {
                const item = items.find(i => i.id === id);
                if (!item) return null;
                return (
                  <Badge
                    key={id}
                    variant="secondary"
                    className="gap-1 pr-1 cursor-pointer"
                    onClick={() => {
                      const newSelected = new Set(selectedItems);
                      newSelected.delete(id);
                      onSelectionChange(newSelected);
                    }}
                  >
                    {getItemLabel(item)}
                    <X className="h-3 w-3" />
                  </Badge>
                );
              })}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {confirmAction && (
        <AlertDialog
          open={!!confirmAction}
          onOpenChange={() => setConfirmAction(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmAction.confirmationTitle ||
                  `Confirm ${confirmAction.label}`}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmAction.confirmationDescription ||
                  `Are you sure you want to ${confirmAction.label.toLowerCase()} ${selectedItems.size} item(s)? This action cannot be undone.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => executeAction(confirmAction)}
                className={
                  confirmAction.variant === 'destructive'
                    ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                    : ''
                }
              >
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

interface SelectableItemProps {
  id: string;
  selected: boolean;
  onSelectionChange: (selected: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

export function SelectableItem({
  id,
  selected,
  onSelectionChange,
  children,
  className = '',
}: SelectableItemProps) {
  return (
    <div
      className={`group relative transition-all ${
        selected ? 'ring-2 ring-primary ring-offset-2' : ''
      } ${className}`}
    >
      <div className="absolute top-2 left-2 z-10">
        <Checkbox
          checked={selected}
          onCheckedChange={checked => onSelectionChange(checked as boolean)}
          className="bg-background border-2 shadow-sm"
          onClick={e => e.stopPropagation()}
        />
      </div>
      {children}
    </div>
  );
}

export function useBulkSelection<T extends { id: string }>(
  initialItems: T[] = []
) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const toggleItem = useCallback((id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((items: T[]) => {
    setSelectedItems(new Set(items.map(item => item.id)));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedItems(new Set());
  }, []);

  const isSelected = useCallback(
    (id: string) => selectedItems.has(id),
    [selectedItems]
  );

  return {
    selectedItems,
    setSelectedItems,
    toggleItem,
    selectAll,
    clearSelection,
    isSelected,
    selectedCount: selectedItems.size,
  };
}
