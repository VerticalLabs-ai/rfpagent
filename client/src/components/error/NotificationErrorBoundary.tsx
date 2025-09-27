import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
}

export class NotificationErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('NotificationErrorBoundary caught an error:', error);

    this.props.onError?.(error, errorInfo);

    // Auto-reset after a short delay for non-critical notification errors
    setTimeout(() => {
      this.setState({ hasError: false });
    }, 5000);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Silent fallback for notifications - they're not critical to app function
      return null;
    }

    return this.props.children;
  }
}