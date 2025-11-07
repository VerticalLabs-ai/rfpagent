import {
  calculatePerformanceScore,
  getMemoryUsage,
  trackResourceTiming,
  trackWebVitals,
  type PerformanceMetric,
  type VitalsMetrics,
} from '@/lib/performance';
import { useEffect, useState } from 'react';

export function usePerformanceMonitoring() {
  const [metrics, setMetrics] = useState<VitalsMetrics>({});
  const [memoryUsage, setMemoryUsage] =
    useState<ReturnType<typeof getMemoryUsage>>(null);
  const [resourceSizes, setResourceSizes] = useState<ReturnType<
    typeof trackResourceTiming
  > | null>(null);
  const [performanceScore, setPerformanceScore] = useState<number>(0);

  useEffect(() => {
    // Track Web Vitals
    trackWebVitals((metric: PerformanceMetric) => {
      setMetrics(prev => ({
        ...prev,
        [metric.name]: metric,
      }));
    });

    // Track resource sizes
    if (typeof window !== 'undefined') {
      const sizes = trackResourceTiming();
      requestAnimationFrame(() => {
        setResourceSizes(sizes);
      });
    }

    // Update memory usage periodically
    const memoryInterval = setInterval(() => {
      const usage = getMemoryUsage();
      setMemoryUsage(usage);
    }, 5000);

    return () => clearInterval(memoryInterval);
  }, []);

  useEffect(() => {
    // Calculate performance score when metrics update
    if (Object.keys(metrics).length > 0) {
      const score = calculatePerformanceScore(metrics);
      requestAnimationFrame(() => {
        setPerformanceScore(score);
      });
    }
  }, [metrics]);

  return {
    metrics,
    memoryUsage,
    resourceSizes,
    performanceScore,
  };
}

export function useComponentPerformance(componentName: string) {
  const [renderCount, setRenderCount] = useState(0);
  const [renderTimes, setRenderTimes] = useState<number[]>([]);

  useEffect(() => {
    const startTime = performance.now();

    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;

      setRenderCount(prev => prev + 1);
      setRenderTimes(prev => [...prev.slice(-9), duration]);

      if (process.env.NODE_ENV === 'development') {
        console.log(
          `[${componentName}] Render #${renderCount + 1}: ${duration.toFixed(2)}ms`
        );
      }
    };
  });

  const avgRenderTime =
    renderTimes.length > 0
      ? renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length
      : 0;

  return {
    renderCount,
    renderTimes,
    avgRenderTime,
    lastRenderTime: renderTimes[renderTimes.length - 1] || 0,
  };
}

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [effectiveType, setEffectiveType] = useState<string>('4g');
  const [downlink, setDownlink] = useState<number>(10);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Get network information if available
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      requestAnimationFrame(() => {
        setEffectiveType(connection.effectiveType || '4g');
        setDownlink(connection.downlink || 10);
      });

      const handleConnectionChange = () => {
        setEffectiveType(connection.effectiveType || '4g');
        setDownlink(connection.downlink || 10);
      };

      connection.addEventListener('change', handleConnectionChange);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        connection.removeEventListener('change', handleConnectionChange);
      };
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isOnline,
    effectiveType,
    downlink,
    isSlow:
      effectiveType === 'slow-2g' || effectiveType === '2g' || downlink < 1,
  };
}

export function useLongTask(threshold = 50) {
  const [longTasks, setLongTasks] = useState<number[]>([]);

  useEffect(() => {
    if (typeof PerformanceObserver === 'undefined') return;

    const observer = new PerformanceObserver(list => {
      const entries = list.getEntries();
      entries.forEach(entry => {
        if (entry.duration > threshold) {
          setLongTasks(prev => [...prev.slice(-9), entry.duration]);
          console.warn(`Long task detected: ${entry.duration.toFixed(2)}ms`);
        }
      });
    });

    try {
      observer.observe({ type: 'longtask', buffered: true });
    } catch (e) {
      console.warn('Long task observation not supported');
    }

    return () => observer.disconnect();
  }, [threshold]);

  return {
    longTasks,
    count: longTasks.length,
    avgDuration:
      longTasks.length > 0
        ? longTasks.reduce((a, b) => a + b, 0) / longTasks.length
        : 0,
  };
}
