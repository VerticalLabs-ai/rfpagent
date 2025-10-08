/**
 * Performance monitoring utilities for tracking and optimizing frontend performance
 */

export interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
}

export interface VitalsMetrics {
  FCP?: PerformanceMetric; // First Contentful Paint
  LCP?: PerformanceMetric; // Largest Contentful Paint
  FID?: PerformanceMetric; // First Input Delay
  CLS?: PerformanceMetric; // Cumulative Layout Shift
  TTFB?: PerformanceMetric; // Time to First Byte
  INP?: PerformanceMetric; // Interaction to Next Paint
}

// Performance thresholds based on Web Vitals
const THRESHOLDS = {
  FCP: { good: 1800, poor: 3000 },
  LCP: { good: 2500, poor: 4000 },
  FID: { good: 100, poor: 300 },
  CLS: { good: 0.1, poor: 0.25 },
  TTFB: { good: 800, poor: 1800 },
  INP: { good: 200, poor: 500 },
};

function getRating(
  name: keyof typeof THRESHOLDS,
  value: number
): 'good' | 'needs-improvement' | 'poor' {
  const threshold = THRESHOLDS[name];
  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
}

/**
 * Track Core Web Vitals
 */
export function trackWebVitals(onMetric: (metric: PerformanceMetric) => void) {
  if (typeof window === 'undefined' || !window.performance) return;

  // FCP - First Contentful Paint
  const fcpEntry = performance.getEntriesByName(
    'first-contentful-paint'
  )[0] as PerformanceEntry;
  if (fcpEntry) {
    onMetric({
      name: 'FCP',
      value: fcpEntry.startTime,
      rating: getRating('FCP', fcpEntry.startTime),
      timestamp: Date.now(),
    });
  }

  // LCP - Largest Contentful Paint
  const observer = new PerformanceObserver(list => {
    const entries = list.getEntries();
    const lastEntry = entries[entries.length - 1] as any;
    if (lastEntry) {
      onMetric({
        name: 'LCP',
        value: lastEntry.renderTime || lastEntry.loadTime,
        rating: getRating('LCP', lastEntry.renderTime || lastEntry.loadTime),
        timestamp: Date.now(),
      });
    }
  });

  try {
    observer.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) {
    console.warn('LCP observation not supported');
  }

  // CLS - Cumulative Layout Shift
  let clsValue = 0;
  const clsObserver = new PerformanceObserver(list => {
    for (const entry of list.getEntries() as any[]) {
      if (!entry.hadRecentInput) {
        clsValue += entry.value;
      }
    }
    onMetric({
      name: 'CLS',
      value: clsValue,
      rating: getRating('CLS', clsValue),
      timestamp: Date.now(),
    });
  });

  try {
    clsObserver.observe({ type: 'layout-shift', buffered: true });
  } catch (e) {
    console.warn('CLS observation not supported');
  }

  // TTFB - Time to First Byte
  const navigationEntry = performance.getEntriesByType(
    'navigation'
  )[0] as PerformanceNavigationTiming;
  if (navigationEntry) {
    const ttfb = navigationEntry.responseStart - navigationEntry.requestStart;
    onMetric({
      name: 'TTFB',
      value: ttfb,
      rating: getRating('TTFB', ttfb),
      timestamp: Date.now(),
    });
  }

  // FID - First Input Delay
  const fidObserver = new PerformanceObserver(list => {
    const firstInput = list.getEntries()[0] as any;
    if (firstInput) {
      const fid = firstInput.processingStart - firstInput.startTime;
      onMetric({
        name: 'FID',
        value: fid,
        rating: getRating('FID', fid),
        timestamp: Date.now(),
      });
      fidObserver.disconnect();
    }
  });

  try {
    fidObserver.observe({ type: 'first-input', buffered: true });
  } catch (e) {
    console.warn('FID observation not supported');
  }
}

/**
 * Measure component render time
 */
export function measureRender(componentName: string, callback: () => void) {
  const startTime = performance.now();
  callback();
  const endTime = performance.now();
  const duration = endTime - startTime;

  if (process.env.NODE_ENV === 'development') {
    console.log(
      `[Performance] ${componentName} rendered in ${duration.toFixed(2)}ms`
    );
  }

  return duration;
}

/**
 * Track bundle size and resource loading
 */
export function trackResourceTiming(): {
  js: number;
  css: number;
  images: number;
  fonts: number;
  total: number;
} {
  const resources = performance.getEntriesByType(
    'resource'
  ) as PerformanceResourceTiming[];

  const sizes = {
    js: 0,
    css: 0,
    images: 0,
    fonts: 0,
    total: 0,
  };

  resources.forEach(resource => {
    const size = resource.transferSize || 0;
    sizes.total += size;

    if (resource.name.endsWith('.js')) {
      sizes.js += size;
    } else if (resource.name.endsWith('.css')) {
      sizes.css += size;
    } else if (resource.name.match(/\.(png|jpg|jpeg|gif|svg|webp)$/)) {
      sizes.images += size;
    } else if (resource.name.match(/\.(woff|woff2|ttf|otf)$/)) {
      sizes.fonts += size;
    }
  });

  return sizes;
}

/**
 * Memory usage monitoring
 */
export function getMemoryUsage(): {
  used: number;
  total: number;
  limit: number;
  percentage: number;
} | null {
  if ('memory' in performance && (performance as any).memory) {
    const memory = (performance as any).memory;
    return {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      limit: memory.jsHeapSizeLimit,
      percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
    };
  }
  return null;
}

/**
 * Report performance metrics to analytics
 */
export function reportMetrics(metrics: VitalsMetrics) {
  if (process.env.NODE_ENV === 'production') {
    // In production, send to analytics service
    console.log('[Performance Metrics]', metrics);
    // Example: Send to analytics
    // analytics.track('web_vitals', metrics);
  } else {
    // In development, log to console
    console.table(
      Object.entries(metrics).map(([name, metric]) => ({
        Metric: name,
        Value: `${metric?.value.toFixed(2)}ms`,
        Rating: metric?.rating,
      }))
    );
  }
}

/**
 * Create a performance mark
 */
export function mark(name: string) {
  if (typeof performance !== 'undefined' && performance.mark) {
    performance.mark(name);
  }
}

/**
 * Measure time between two marks
 */
export function measure(
  name: string,
  startMark: string,
  endMark: string
): number | null {
  if (typeof performance !== 'undefined' && performance.measure) {
    try {
      performance.measure(name, startMark, endMark);
      const measures = performance.getEntriesByName(name, 'measure');
      return measures[measures.length - 1]?.duration || null;
    } catch (e) {
      console.warn(`Failed to measure ${name}:`, e);
      return null;
    }
  }
  return null;
}

/**
 * Clear performance marks and measures
 */
export function clearMarks(name?: string) {
  if (typeof performance !== 'undefined') {
    if (name) {
      performance.clearMarks(name);
      performance.clearMeasures(name);
    } else {
      performance.clearMarks();
      performance.clearMeasures();
    }
  }
}

/**
 * Hook to track component mount/unmount performance
 */
export function usePerformanceTracking(componentName: string) {
  if (typeof window === 'undefined') return;

  const mountMark = `${componentName}-mount`;
  const unmountMark = `${componentName}-unmount`;

  // Mark on mount
  mark(mountMark);

  return () => {
    // Mark on unmount
    mark(unmountMark);
    const duration = measure(
      `${componentName}-lifetime`,
      mountMark,
      unmountMark
    );
    if (duration && process.env.NODE_ENV === 'development') {
      console.log(
        `[Performance] ${componentName} lifetime: ${duration.toFixed(2)}ms`
      );
    }
    clearMarks(componentName);
  };
}

/**
 * Calculate Lighthouse-style performance score
 */
export function calculatePerformanceScore(metrics: VitalsMetrics): number {
  const weights = {
    FCP: 0.1,
    LCP: 0.25,
    FID: 0.1,
    CLS: 0.15,
    TTFB: 0.1,
    INP: 0.3,
  };

  let score = 0;
  let totalWeight = 0;

  Object.entries(weights).forEach(([key, weight]) => {
    const metric = metrics[key as keyof VitalsMetrics];
    if (metric) {
      const metricScore =
        metric.rating === 'good'
          ? 100
          : metric.rating === 'needs-improvement'
            ? 50
            : 0;
      score += metricScore * weight;
      totalWeight += weight;
    }
  });

  return totalWeight > 0 ? Math.round(score / totalWeight) : 0;
}
