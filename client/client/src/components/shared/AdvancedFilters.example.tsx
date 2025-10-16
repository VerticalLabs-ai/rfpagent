/**
 * Example usage of type-safe AdvancedFilters component
 *
 * This demonstrates how the new typed discriminated union approach
 * provides compile-time type safety for filter values.
 */

import { AdvancedFilters, FilterOption, FilterValue } from './AdvancedFilters';
import { useState } from 'react';

// Define the filter schema with type mapping
type RFPFilterSchema = {
  status: 'select';
  category: 'multiselect';
  budget: 'number';
  deadline: 'date';
  dateRange: 'daterange';
  searchText: 'text';
};

export function RFPFiltersExample() {
  // FilterValue is now properly typed based on the schema
  const [filters, setFilters] = useState<FilterValue<RFPFilterSchema>>({});

  // Define filter options
  const filterOptions: FilterOption[] = [
    {
      id: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'open', label: 'Open' },
        { value: 'closed', label: 'Closed' },
        { value: 'pending', label: 'Pending' },
      ],
    },
    {
      id: 'category',
      label: 'Categories',
      type: 'multiselect',
      options: [
        { value: 'it', label: 'IT Services' },
        { value: 'construction', label: 'Construction' },
        { value: 'consulting', label: 'Consulting' },
      ],
    },
    {
      id: 'budget',
      label: 'Minimum Budget',
      type: 'number',
      placeholder: 'Enter amount',
    },
    {
      id: 'deadline',
      label: 'Deadline',
      type: 'date',
    },
    {
      id: 'dateRange',
      label: 'Date Range',
      type: 'daterange',
    },
    {
      id: 'searchText',
      label: 'Search',
      type: 'text',
      placeholder: 'Search RFPs...',
    },
  ];

  // Type-safe filter handling
  const handleFilterChange = (newFilters: FilterValue<RFPFilterSchema>) => {
    setFilters(newFilters);

    // ✅ TypeScript knows exact types for each filter:
    // newFilters.status is string | undefined
    // newFilters.category is string[] | undefined
    // newFilters.budget is number | null | undefined
    // newFilters.deadline is string | undefined (ISO date)
    // newFilters.dateRange is [string | null, string | null] | undefined
    // newFilters.searchText is string | undefined

    // Type-safe access:
    if (newFilters.category) {
      // TypeScript knows this is string[]
      console.log('Selected categories:', newFilters.category.join(', '));
    }

    if (newFilters.budget) {
      // TypeScript knows this is number
      console.log('Budget filter:', newFilters.budget.toFixed(2));
    }

    if (newFilters.dateRange) {
      // TypeScript knows this is [string | null, string | null]
      const [from, to] = newFilters.dateRange;
      console.log('Date range:', from, 'to', to);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">RFP Filters</h2>
      <AdvancedFilters
        filters={filterOptions}
        value={filters}
        onChange={handleFilterChange}
        onReset={() => setFilters({})}
      />

      {/* Display active filters with type safety */}
      <div className="mt-4">
        <h3 className="text-sm font-medium mb-2">Active Filters:</h3>
        <pre className="text-xs bg-gray-100 p-2 rounded">
          {JSON.stringify(filters, null, 2)}
        </pre>
      </div>
    </div>
  );
}

/**
 * Benefits of the new type-safe approach:
 *
 * 1. ✅ No more `any` types - every filter value has a specific type
 * 2. ✅ Compile-time type checking - TypeScript catches type errors
 * 3. ✅ IntelliSense support - IDE shows correct types for each filter
 * 4. ✅ Discriminated unions - Each filter type has proper validation
 * 5. ✅ Generic types - FilterValue is generic over filter schema
 * 6. ✅ Type inference - updateFilter callback is properly typed
 * 7. ✅ Refactoring safety - Changes to filter types are caught at compile-time
 */
