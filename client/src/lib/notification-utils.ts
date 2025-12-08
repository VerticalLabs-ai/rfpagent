/**
 * Notification Utilities
 *
 * Helper functions for identifying and categorizing notifications,
 * particularly for stall detection alerts.
 */

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  createdAt?: string;
  read?: boolean;
}

/**
 * Stall-related notification title patterns
 */
const STALL_NOTIFICATION_PATTERNS = [
  'Proposal Generation Retry',
  'Proposal Generation Failed',
  'Proposal Generation Cancelled',
  'Stall',
  'stalled',
];

/**
 * Check if a notification is related to proposal generation stalling
 */
export function isStallRelatedNotification(
  notification: Notification
): boolean {
  const title = notification.title?.toLowerCase() || '';
  const message = notification.message?.toLowerCase() || '';

  return STALL_NOTIFICATION_PATTERNS.some(
    pattern =>
      title.includes(pattern.toLowerCase()) ||
      message.includes(pattern.toLowerCase())
  );
}

/**
 * Check if a notification indicates a stall retry
 */
export function isStallRetryNotification(notification: Notification): boolean {
  return notification.title === 'Proposal Generation Retry';
}

/**
 * Check if a notification indicates a stall failure (manual intervention required)
 */
export function isStallFailureNotification(
  notification: Notification
): boolean {
  return notification.title === 'Proposal Generation Failed';
}

/**
 * Check if a notification indicates a cancelled generation
 */
export function isCancelledGenerationNotification(
  notification: Notification
): boolean {
  return notification.title === 'Proposal Generation Cancelled';
}

/**
 * Get the severity level for a stall-related notification
 * Returns: 'critical' | 'warning' | 'info' | null
 */
export function getStallNotificationSeverity(
  notification: Notification
): 'critical' | 'warning' | 'info' | null {
  if (!isStallRelatedNotification(notification)) {
    return null;
  }

  if (isStallFailureNotification(notification)) {
    return 'critical';
  }

  if (isStallRetryNotification(notification)) {
    return 'warning';
  }

  if (isCancelledGenerationNotification(notification)) {
    return 'info';
  }

  return 'warning';
}

/**
 * Filter notifications to only stall-related ones
 */
export function filterStallNotifications(
  notifications: Notification[]
): Notification[] {
  return notifications.filter(isStallRelatedNotification);
}

/**
 * Sort stall notifications by severity (critical first)
 */
export function sortStallNotificationsBySeverity(
  notifications: Notification[]
): Notification[] {
  const severityOrder = { critical: 0, warning: 1, info: 2 };

  return [...notifications].sort((a, b) => {
    const severityA = getStallNotificationSeverity(a);
    const severityB = getStallNotificationSeverity(b);

    if (severityA === null && severityB === null) return 0;
    if (severityA === null) return 1;
    if (severityB === null) return -1;

    return severityOrder[severityA] - severityOrder[severityB];
  });
}
