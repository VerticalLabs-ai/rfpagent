import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { Button, ButtonProps } from './button';

// LoadingSpinner
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({
  size = 'md',
  className,
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <div
      role="status"
      className={cn('animate-spin', sizeClasses[size], className)}
    >
      <Loader2 className="h-full w-full" />
      <span className="sr-only">Loading...</span>
    </div>
  );
}

// LoadingOverlay
interface LoadingOverlayProps {
  message?: string;
  className?: string;
}

export function LoadingOverlay({ message, className }: LoadingOverlayProps) {
  return (
    <div
      className={cn(
        'absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50',
        className
      )}
    >
      <div className="flex flex-col items-center gap-3">
        <LoadingSpinner size="lg" />
        {message && (
          <p className="text-sm text-muted-foreground animate-pulse">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

// LoadingSkeleton
interface LoadingSkeletonProps {
  variant: 'card' | 'table' | 'text' | 'avatar';
  rows?: number;
  className?: string;
}

export function LoadingSkeleton({
  variant,
  rows = 3,
  className,
}: LoadingSkeletonProps) {
  const Skeleton = ({ className: skeletonClass }: { className?: string }) => (
    <div className={cn('animate-pulse rounded-md bg-muted', skeletonClass)} />
  );

  if (variant === 'card') {
    return (
      <div
        data-testid="skeleton-card"
        className={cn('space-y-3 p-4', className)}
      >
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} data-testid="skeleton-row" className="flex gap-4 p-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/6" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'avatar') {
    return <Skeleton className={cn('h-10 w-10 rounded-full', className)} />;
  }

  // text variant
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-4', i === rows - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  );
}

// LoadingButton
interface LoadingButtonProps extends ButtonProps {
  isLoading?: boolean;
  loadingText?: string;
}

export function LoadingButton({
  isLoading,
  loadingText,
  children,
  disabled,
  className,
  ...props
}: LoadingButtonProps) {
  return (
    <Button
      disabled={isLoading || disabled}
      className={cn('relative', className)}
      {...props}
    >
      {isLoading && <LoadingSpinner size="sm" className="mr-2" />}
      {isLoading && loadingText ? loadingText : children}
    </Button>
  );
}

// Full page loading state
export function PageLoading({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex h-[50vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size="lg" />
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
