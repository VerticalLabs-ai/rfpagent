# Frontend/UX Enhancements - Quick Reference

## Overview

This document provides a quick reference guide for all new frontend components, hooks, and utilities added to the RFP Agent platform.

---

## New Components

### 1. Real-Time Infrastructure

#### RealtimeProvider

**Location:** `/client/src/components/providers/RealtimeProvider.tsx`

```tsx
import {
  RealtimeProvider,
  useRealtime,
  LiveIndicator,
} from '@/components/providers/RealtimeProvider';

// Wrap your app
<RealtimeProvider showConnectionStatus={true}>
  <App />
</RealtimeProvider>;

// Use in components
function MyComponent() {
  const { isConnected, lastMessage, sendMessage } = useRealtime();
}
```

**Features:**

- Auto-reconnecting WebSocket
- Visual connection status
- Auto query invalidation
- Toast notifications for events

### 2. Skeleton Loaders

**Location:** `/client/src/components/shared/SkeletonLoaders.tsx`

```tsx
import {
  DashboardSkeleton,
  TableSkeleton,
  CardGridSkeleton,
  FormSkeleton,
  AgentMonitoringSkeleton,
  DetailPageSkeleton,
} from '@/components/shared/SkeletonLoaders';

<Suspense fallback={<DashboardSkeleton />}>
  <Dashboard />
</Suspense>;
```

**Available Loaders:**

- `DashboardSkeleton` - Full dashboard layout
- `TableSkeleton({ rows?: number })` - Customizable table
- `CardGridSkeleton({ count?: number })` - Card grids
- `FormSkeleton` - Form layouts
- `AgentMonitoringSkeleton` - Agent monitoring pages
- `DetailPageSkeleton` - Detail views with sidebar

### 3. Advanced Filters

**Location:** `/client/src/components/shared/AdvancedFilters.tsx`

```tsx
import { AdvancedFilters, SearchBar } from '@/components/shared/AdvancedFilters';

const filters = [
  { id: 'status', label: 'Status', type: 'select', options: [
    { value: 'active', label: 'Active' },
    { value: 'pending', label: 'Pending' }
  ]},
  { id: 'date', label: 'Date Range', type: 'daterange' },
  { id: 'category', label: 'Category', type: 'multiselect', options: [...] },
];

<AdvancedFilters
  filters={filters}
  value={filterValues}
  onChange={setFilterValues}
  onReset={handleReset}
/>

<SearchBar
  value={searchTerm}
  onChange={setSearchTerm}
  placeholder="Search RFPs..."
  debounceMs={300}
/>
```

**Filter Types:**

- `text` - Text input
- `select` - Single select dropdown
- `multiselect` - Multiple checkboxes
- `date` - Single date picker
- `daterange` - Start/end date pickers
- `number` - Number input

### 4. Bulk Operations

**Location:** `/client/src/components/shared/BulkOperations.tsx`

```tsx
import {
  BulkOperations,
  useBulkSelection,
  SelectableItem,
} from '@/components/shared/BulkOperations';

const { selectedItems, setSelectedItems, toggleItem } = useBulkSelection();

const actions = [
  {
    id: 'delete',
    label: 'Delete',
    icon: Trash,
    variant: 'destructive',
    requiresConfirmation: true,
  },
  {
    id: 'export',
    label: 'Export',
    icon: Download,
  },
];

<BulkOperations
  items={data}
  selectedItems={selectedItems}
  onSelectionChange={setSelectedItems}
  actions={actions}
  onAction={handleBulkAction}
/>;
```

---

## New Hooks

### 1. WebSocket Hook

**Location:** `/client/src/hooks/useWebSocket.ts`

```tsx
import { useWebSocket } from '@/hooks/useWebSocket';

const { status, isConnected, lastMessage, sendMessage } = useWebSocket({
  onMessage: msg => console.log(msg),
  onConnect: () => console.log('Connected'),
  onDisconnect: () => console.log('Disconnected'),
  reconnectAttempts: 5,
  autoInvalidateQueries: true,
});
```

### 2. Performance Monitoring

**Location:** `/client/src/hooks/usePerformance.ts`

```tsx
import {
  usePerformanceMonitoring,
  useComponentPerformance,
  useNetworkStatus,
  useLongTask,
} from '@/hooks/usePerformance';

// Monitor Web Vitals
const { metrics, performanceScore, memoryUsage, resourceSizes } =
  usePerformanceMonitoring();

// Track component performance
const { renderCount, avgRenderTime } = useComponentPerformance('MyComponent');

// Network status
const { isOnline, effectiveType, isSlow } = useNetworkStatus();

// Detect long tasks
const { longTasks, count, avgDuration } = useLongTask(50);
```

### 3. Touch Gestures

**Location:** `/client/src/hooks/useGestures.ts`

```tsx
import {
  useSwipe,
  useLongPress,
  usePinchZoom,
  useDoubleTap,
  useTouchDevice,
  usePullToRefresh,
} from '@/hooks/useGestures';

// Swipe detection
useSwipe({
  onSwipeLeft: gesture => console.log('Swiped left'),
  onSwipeRight: gesture => console.log('Swiped right'),
  threshold: 50,
});

// Long press
const { handlers, isLongPress } = useLongPress({
  onLongPress: () => console.log('Long pressed'),
  delay: 500,
});

// Pull to refresh
const { isPulling, isRefreshing, pullDistance, progress } = usePullToRefresh({
  onRefresh: async () => {
    await fetchData();
  },
  threshold: 80,
});
```

---

## Utility Libraries

### 1. Performance Utilities

**Location:** `/client/src/lib/performance.ts`

```tsx
import {
  trackWebVitals,
  getMemoryUsage,
  trackResourceTiming,
  calculatePerformanceScore,
  mark,
  measure,
  clearMarks,
} from '@/lib/performance';

// Track Web Vitals
trackWebVitals(metric => {
  console.log(metric.name, metric.value, metric.rating);
});

// Performance marks
mark('operation-start');
// ... do work
mark('operation-end');
const duration = measure('operation', 'operation-start', 'operation-end');

// Get memory usage
const memory = getMemoryUsage();
console.log(`Used: ${memory.used} / ${memory.limit}`);
```

### 2. Accessibility Utilities

**Location:** `/client/src/lib/accessibility.ts`

```tsx
import {
  getContrastRatio,
  meetsWCAG_AA,
  trapFocus,
  announceToScreenReader,
  validateFieldAccessibility,
  prefersReducedMotion,
  prefersDarkMode,
} from '@/lib/accessibility';

// Check contrast
const ratio = getContrastRatio('#ffffff', '#000000');
const isAccessible = meetsWCAG_AA(ratio);

// Announce to screen readers
announceToScreenReader('RFP saved successfully', 'polite');

// Trap focus in modal
const cleanup = trapFocus(modalElement);

// Check user preferences
if (prefersReducedMotion()) {
  // Disable animations
}

if (prefersDarkMode()) {
  // Use dark theme
}
```

---

## Implementation Checklist

### For New Pages

- [ ] Wrap with ErrorBoundary
- [ ] Add Suspense with appropriate skeleton
- [ ] Implement loading states
- [ ] Add accessibility attributes (ARIA labels, roles)
- [ ] Ensure keyboard navigation
- [ ] Test on mobile devices
- [ ] Add performance tracking
- [ ] Implement error handling

### For New Components

- [ ] TypeScript types defined
- [ ] Accessible (WCAG 2.1 AA)
- [ ] Keyboard navigable
- [ ] Touch-friendly (48x48px min)
- [ ] Loading states
- [ ] Error states
- [ ] Empty states
- [ ] Responsive design
- [ ] Performance optimized

### For Forms

- [ ] All fields have labels
- [ ] Required fields marked with aria-required
- [ ] Error messages with aria-invalid
- [ ] Focus management
- [ ] Validation feedback
- [ ] Loading states on submit
- [ ] Success/error feedback

---

## Code Examples

### Enhanced Dashboard Pattern

```tsx
import { useState } from 'react';
import { usePerformanceMonitoring } from '@/hooks/usePerformance';
import { LiveIndicator } from '@/components/providers/RealtimeProvider';
import { DashboardSkeleton } from '@/components/shared/SkeletonLoaders';

export default function Dashboard() {
  const { performanceScore } = usePerformanceMonitoring();

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-3">
          Dashboard
          <LiveIndicator />
        </h1>
        {performanceScore > 0 && <Badge>{performanceScore} Performance</Badge>}
      </div>
      {/* Content */}
    </div>
  );
}
```

### Lazy-Loaded Page

```tsx
// App.tsx
import { lazy, Suspense } from 'react';
import { DashboardSkeleton } from '@/components/shared/SkeletonLoaders';

const Dashboard = lazy(() => import('@/pages/dashboard'));

function App() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}
```

### Accessible Form Field

```tsx
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

<div>
  <Label htmlFor="email">
    Email <span className="text-destructive">*</span>
  </Label>
  <Input
    id="email"
    type="email"
    required
    aria-required="true"
    aria-invalid={!!errors.email}
    aria-describedby={errors.email ? 'email-error' : undefined}
  />
  {errors.email && (
    <p id="email-error" className="text-sm text-destructive" role="alert">
      {errors.email}
    </p>
  )}
</div>;
```

---

## Performance Best Practices

### 1. Code Splitting

```tsx
// Always lazy load routes
const Dashboard = lazy(() => import('@/pages/dashboard'));
const Settings = lazy(() => import('@/pages/settings'));

// Heavy components
const Chart = lazy(() => import('@/components/Chart'));
```

### 2. Memoization

```tsx
import { useMemo, useCallback } from 'react';

// Expensive computations
const filteredData = useMemo(() => {
  return data.filter(item => item.status === filter);
}, [data, filter]);

// Event handlers
const handleClick = useCallback(() => {
  doSomething();
}, []);
```

### 3. Virtual Lists

```tsx
// For large lists (100+ items), use virtual scrolling
import { useVirtualizer } from '@tanstack/react-virtual';

const rowVirtualizer = useVirtualizer({
  count: items.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 50,
});
```

---

## Testing Guidelines

### Accessibility Testing

```bash
# Run accessibility audit
npm run test:a11y

# Check color contrast
# Use browser DevTools Accessibility panel
```

### Performance Testing

```bash
# Build and analyze bundle
npm run build
npm run analyze

# Lighthouse audit
lighthouse http://localhost:3000 --view
```

### Mobile Testing

- Test on actual devices (iOS, Android)
- Use Chrome DevTools device emulation
- Test touch gestures
- Verify responsive breakpoints
- Check text readability

---

## Browser DevTools Tips

### Performance Profiler

1. Open Chrome DevTools
2. Go to Performance tab
3. Record page load
4. Analyze FCP, LCP, CLS

### Accessibility Inspector

1. Open DevTools
2. Go to Elements tab
3. Click Accessibility panel
4. Check ARIA tree
5. Verify contrast ratios

### Network Throttling

1. Open Network tab
2. Select "Slow 3G" or "Fast 3G"
3. Test loading states
4. Verify progressive enhancement

---

## Quick Commands

```bash
# Development
pnpm dev

# Type checking
pnpm check

# Build
pnpm build

# Lint
pnpm lint
pnpm lint:fix

# Format
pnpm format
pnpm format:check

# Tests
pnpm test
pnpm test:watch
pnpm test:coverage
```

---

## File Structure

```
client/src/
├── components/
│   ├── error/
│   │   ├── ErrorBoundary.tsx
│   │   └── ErrorFallback.tsx
│   ├── providers/
│   │   └── RealtimeProvider.tsx
│   ├── shared/
│   │   ├── SkeletonLoaders.tsx
│   │   ├── AdvancedFilters.tsx
│   │   ├── BulkOperations.tsx
│   │   ├── EmptyState.tsx
│   │   ├── LoadingCards.tsx
│   │   └── ...
│   └── ui/ (shadcn components)
├── hooks/
│   ├── useWebSocket.ts
│   ├── usePerformance.ts
│   ├── useGestures.ts
│   ├── use-toast.ts
│   └── use-mobile.tsx
├── lib/
│   ├── performance.ts
│   ├── accessibility.ts
│   ├── queryClient.ts
│   └── utils.ts
├── pages/ (all lazy-loaded)
│   ├── dashboard.tsx
│   ├── agent-monitoring.tsx
│   └── ...
├── types/
│   └── api.ts
└── App.tsx
```

---

## Support & Resources

- **Documentation:** See [UX_IMPROVEMENT_REPORT.md](./UX_IMPROVEMENT_REPORT.md)
- **Component Library:** Based on shadcn/ui
- **Icons:** lucide-react
- **Styling:** Tailwind CSS
- **State Management:** TanStack Query + Context
- **Type Safety:** TypeScript strict mode

---

**Last Updated:** October 2, 2025
**Version:** 1.0.0
