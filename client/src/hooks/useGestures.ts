import { useEffect, useRef, useState, useCallback } from 'react';

interface TouchPoint {
  x: number;
  y: number;
  timestamp: number;
}

interface SwipeGesture {
  direction: 'left' | 'right' | 'up' | 'down';
  distance: number;
  duration: number;
  velocity: number;
}

interface UseSwipeOptions {
  onSwipeLeft?: (gesture: SwipeGesture) => void;
  onSwipeRight?: (gesture: SwipeGesture) => void;
  onSwipeUp?: (gesture: SwipeGesture) => void;
  onSwipeDown?: (gesture: SwipeGesture) => void;
  threshold?: number;
  velocityThreshold?: number;
}

export function useSwipe(options: UseSwipeOptions = {}) {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    threshold = 50,
    velocityThreshold = 0.3,
  } = options;

  const touchStart = useRef<TouchPoint | null>(null);
  const touchEnd = useRef<TouchPoint | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchEnd.current = null;
    touchStart.current = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
      timestamp: Date.now(),
    };
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    touchEnd.current = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
      timestamp: Date.now(),
    };
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchStart.current || !touchEnd.current) return;

    const deltaX = touchEnd.current.x - touchStart.current.x;
    const deltaY = touchEnd.current.y - touchStart.current.y;
    const duration = touchEnd.current.timestamp - touchStart.current.timestamp;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const distance = Math.sqrt(absX * absX + absY * absY);
    const velocity = distance / duration;

    if (velocity < velocityThreshold) return;

    const gesture: SwipeGesture = {
      direction:
        absX > absY
          ? deltaX > 0
            ? 'right'
            : 'left'
          : deltaY > 0
            ? 'down'
            : 'up',
      distance,
      duration,
      velocity,
    };

    if (absX > absY && absX > threshold) {
      // Horizontal swipe
      if (deltaX > 0) {
        onSwipeRight?.(gesture);
      } else {
        onSwipeLeft?.(gesture);
      }
    } else if (absY > absX && absY > threshold) {
      // Vertical swipe
      if (deltaY > 0) {
        onSwipeDown?.(gesture);
      } else {
        onSwipeUp?.(gesture);
      }
    }

    touchStart.current = null;
    touchEnd.current = null;
  }, [
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    threshold,
    velocityThreshold,
  ]);

  useEffect(() => {
    const element = document.body;

    element.addEventListener('touchstart', handleTouchStart);
    element.addEventListener('touchmove', handleTouchMove);
    element.addEventListener('touchend', handleTouchEnd);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);
}

interface UseLongPressOptions {
  onLongPress?: () => void;
  delay?: number;
}

export function useLongPress(options: UseLongPressOptions = {}) {
  const { onLongPress, delay = 500 } = options;

  const [isLongPress, setIsLongPress] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);

  const start = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      const target = e.currentTarget as HTMLElement;
      targetRef.current = target;

      timeoutRef.current = setTimeout(() => {
        setIsLongPress(true);
        onLongPress?.();

        // Add haptic feedback on mobile
        if ('vibrate' in navigator) {
          navigator.vibrate(50);
        }
      }, delay);
    },
    [onLongPress, delay]
  );

  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsLongPress(false);
  }, []);

  return {
    isLongPress,
    handlers: {
      onTouchStart: start,
      onTouchEnd: clear,
      onMouseDown: start,
      onMouseUp: clear,
      onMouseLeave: clear,
    },
  };
}

interface UsePinchZoomOptions {
  onZoom?: (scale: number) => void;
  minScale?: number;
  maxScale?: number;
}

export function usePinchZoom(options: UsePinchZoomOptions = {}) {
  const { onZoom, minScale = 0.5, maxScale = 3 } = options;

  const [scale, setScale] = useState(1);
  const lastDistanceRef = useRef<number | null>(null);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (e.touches.length !== 2) {
        lastDistanceRef.current = null;
        return;
      }

      e.preventDefault();

      const touch1 = e.touches[0];
      const touch2 = e.touches[1];

      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2)
      );

      if (lastDistanceRef.current !== null) {
        const delta = distance - lastDistanceRef.current;
        const scaleDelta = delta * 0.01;

        const newScale = Math.min(
          Math.max(scale + scaleDelta, minScale),
          maxScale
        );
        setScale(newScale);
        onZoom?.(newScale);
      }

      lastDistanceRef.current = distance;
    },
    [scale, onZoom, minScale, maxScale]
  );

  const handleTouchEnd = useCallback(() => {
    lastDistanceRef.current = null;
  }, []);

  useEffect(() => {
    const element = document.body;

    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd);

    return () => {
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchMove, handleTouchEnd]);

  return { scale, setScale };
}

export function useDoubleTap(onDoubleTap: () => void, delay = 300) {
  const lastTapRef = useRef<number>(0);

  const handleTap = useCallback(() => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    if (timeSinceLastTap < delay && timeSinceLastTap > 0) {
      onDoubleTap();
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  }, [onDoubleTap, delay]);

  return {
    onTouchEnd: handleTap,
    onClick: handleTap,
  };
}

/**
 * Hook to detect if device supports touch
 */
export function useTouchDevice() {
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    const checkTouch = () => {
      setIsTouchDevice(
        'ontouchstart' in window ||
          navigator.maxTouchPoints > 0 ||
          (navigator as any).msMaxTouchPoints > 0
      );
    };

    checkTouch();
    window.addEventListener('resize', checkTouch);

    return () => window.removeEventListener('resize', checkTouch);
  }, []);

  return isTouchDevice;
}

/**
 * Hook for pull-to-refresh functionality
 */
interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  resistance?: number;
}

export function usePullToRefresh(options: UsePullToRefreshOptions) {
  const { onRefresh, threshold = 80, resistance = 2.5 } = options;

  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);

  const startY = useRef(0);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (window.scrollY > 0 || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const distance = Math.max(0, (currentY - startY.current) / resistance);

      if (distance > 0) {
        e.preventDefault();
        setIsPulling(true);
        setPullDistance(distance);
      }
    },
    [isRefreshing, resistance]
  );

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
    setIsPulling(false);
    setPullDistance(0);
    startY.current = 0;
  }, [pullDistance, threshold, isRefreshing, onRefresh]);

  useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    isPulling,
    isRefreshing,
    pullDistance,
    progress: Math.min((pullDistance / threshold) * 100, 100),
  };
}
