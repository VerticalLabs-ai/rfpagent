/**
 * Accessibility utilities for WCAG 2.1 AA compliance
 */

/**
 * Calculate contrast ratio between two colors
 * @param color1 Hex color (e.g., "#ffffff")
 * @param color2 Hex color (e.g., "#000000")
 * @returns Contrast ratio (1-21)
 */
export function getContrastRatio(color1: string, color2: string): number {
  const l1 = getLuminance(color1);
  const l2 = getLuminance(color2);
  const brightest = Math.max(l1, l2);
  const darkest = Math.min(l1, l2);
  return (brightest + 0.05) / (darkest + 0.05);
}

/**
 * Get relative luminance of a color
 */
function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;

  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(val => {
    const sRGB = val / 255;
    return sRGB <= 0.03928
      ? sRGB / 12.92
      : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Check if contrast ratio meets WCAG AA standards
 * @param ratio Contrast ratio
 * @param isLargeText Whether text is large (18pt+ or 14pt+ bold)
 * @returns Whether it meets AA standards
 */
export function meetsWCAG_AA(ratio: number, isLargeText = false): boolean {
  return isLargeText ? ratio >= 3 : ratio >= 4.5;
}

/**
 * Check if contrast ratio meets WCAG AAA standards
 */
export function meetsWCAG_AAA(ratio: number, isLargeText = false): boolean {
  return isLargeText ? ratio >= 4.5 : ratio >= 7;
}

/**
 * Generate ARIA label for screen readers
 */
export function generateAriaLabel(element: {
  type: string;
  label?: string;
  value?: string | number;
  status?: string;
  additional?: string;
}): string {
  const parts = [element.type];

  if (element.label) parts.push(element.label);
  if (element.value !== undefined) parts.push(String(element.value));
  if (element.status) parts.push(element.status);
  if (element.additional) parts.push(element.additional);

  return parts.join(', ');
}

/**
 * Trap focus within a modal or dialog
 */
export function trapFocus(element: HTMLElement) {
  const focusableElements = element.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );

  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  const handleTabKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable?.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable?.focus();
      }
    }
  };

  const handleEscapeKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      element.dispatchEvent(new CustomEvent('close-modal'));
    }
  };

  element.addEventListener('keydown', handleTabKey);
  element.addEventListener('keydown', handleEscapeKey);

  // Focus first element
  firstFocusable?.focus();

  return () => {
    element.removeEventListener('keydown', handleTabKey);
    element.removeEventListener('keydown', handleEscapeKey);
  };
}

/**
 * Announce message to screen readers
 */
export function announceToScreenReader(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
) {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Get accessible name for an element
 */
export function getAccessibleName(element: HTMLElement): string {
  // Check aria-label
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;

  // Check aria-labelledby
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelElement = document.getElementById(labelledBy);
    if (labelElement) return labelElement.textContent || '';
  }

  // Check associated label
  if (element instanceof HTMLInputElement) {
    const labels = element.labels;
    if (labels && labels.length > 0) {
      return labels[0].textContent || '';
    }
  }

  // Check title
  const title = element.getAttribute('title');
  if (title) return title;

  // Check placeholder (last resort)
  if (element instanceof HTMLInputElement) {
    return element.placeholder || '';
  }

  return element.textContent || '';
}

/**
 * Check if an element is keyboard accessible
 */
export function isKeyboardAccessible(element: HTMLElement): boolean {
  const tabIndex = element.getAttribute('tabindex');
  if (tabIndex !== null && parseInt(tabIndex) < 0) return false;

  const interactiveElements = ['button', 'a', 'input', 'select', 'textarea'];
  if (interactiveElements.includes(element.tagName.toLowerCase())) {
    return !element.hasAttribute('disabled');
  }

  const role = element.getAttribute('role');
  const interactiveRoles = [
    'button',
    'link',
    'checkbox',
    'radio',
    'tab',
    'menuitem',
  ];
  if (role && interactiveRoles.includes(role)) {
    return true;
  }

  return false;
}

/**
 * Ensure minimum touch target size (48x48px for WCAG 2.1)
 */
export function validateTouchTargetSize(element: HTMLElement): {
  valid: boolean;
  width: number;
  height: number;
  minSize: number;
} {
  const rect = element.getBoundingClientRect();
  const minSize = 48; // WCAG 2.1 Level AAA minimum

  return {
    valid: rect.width >= minSize && rect.height >= minSize,
    width: rect.width,
    height: rect.height,
    minSize,
  };
}

/**
 * Generate skip link for keyboard navigation
 */
export function createSkipLink(
  targetId: string,
  label = 'Skip to main content'
): HTMLAnchorElement {
  const skipLink = document.createElement('a');
  skipLink.href = `#${targetId}`;
  skipLink.textContent = label;
  skipLink.className =
    'sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:p-4 focus:bg-primary focus:text-primary-foreground';

  return skipLink;
}

/**
 * Validate form field accessibility
 */
export function validateFieldAccessibility(
  field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
): {
  hasLabel: boolean;
  hasError: boolean;
  hasDescription: boolean;
  isRequired: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const hasLabel = !!getAccessibleName(field);
  const hasError =
    !!field.getAttribute('aria-invalid') ||
    !!field.getAttribute('aria-errormessage');
  const hasDescription = !!field.getAttribute('aria-describedby');
  const isRequired =
    field.hasAttribute('required') ||
    field.getAttribute('aria-required') === 'true';

  if (!hasLabel) {
    errors.push('Field missing accessible label');
  }

  if (isRequired && !field.getAttribute('aria-required')) {
    errors.push('Required field should have aria-required="true"');
  }

  if (field.validity && !field.validity.valid && !hasError) {
    errors.push('Invalid field should have aria-invalid="true"');
  }

  return {
    hasLabel,
    hasError,
    hasDescription,
    isRequired,
    errors,
  };
}

/**
 * Create live region for dynamic content
 */
export function createLiveRegion(
  priority: 'polite' | 'assertive' = 'polite'
): HTMLDivElement {
  const liveRegion = document.createElement('div');
  liveRegion.setAttribute('role', 'status');
  liveRegion.setAttribute('aria-live', priority);
  liveRegion.setAttribute('aria-atomic', 'true');
  liveRegion.className = 'sr-only';

  return liveRegion;
}

/**
 * Check if reduced motion is preferred
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Check if high contrast mode is enabled
 */
export function prefersHighContrast(): boolean {
  return window.matchMedia('(prefers-contrast: high)').matches;
}

/**
 * Check if dark mode is preferred
 */
export function prefersDarkMode(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}
