/**
 * Date Utilities
 * Centralized date formatting and manipulation functions using date-fns
 */

import { 
  format, 
  formatDistanceToNow, 
  isAfter, 
  isBefore, 
  addDays, 
  subDays,
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  startOfDay,
  endOfDay,
  parseISO
} from 'date-fns';

/**
 * Format a date for display in the UI
 */
export const formatDate = (date: Date | string, formatString: string = 'MMMM d, yyyy'): string => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, formatString);
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid Date';
  }
};

/**
 * Format a date for display with time
 */
export const formatDateTime = (date: Date | string): string => {
  return formatDate(date, 'MMMM d, yyyy \'at\' h:mm a');
};

/**
 * Format a date for display with time (short format)
 */
export const formatDateTimeShort = (date: Date | string): string => {
  return formatDate(date, 'MMM d, yyyy h:mm a');
};

/**
 * Get relative time (e.g., "2 hours ago", "in 3 days")
 */
export const getRelativeTime = (date: Date | string): string => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return formatDistanceToNow(dateObj, { addSuffix: true });
  } catch (error) {
    console.error('Error getting relative time:', error);
    return 'Unknown time';
  }
};

/**
 * Check if a date is in the future
 */
export const isFuture = (date: Date | string): boolean => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return isAfter(dateObj, new Date());
  } catch (error) {
    console.error('Error checking if date is future:', error);
    return false;
  }
};

/**
 * Check if a date is in the past
 */
export const isPast = (date: Date | string): boolean => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return isBefore(dateObj, new Date());
  } catch (error) {
    console.error('Error checking if date is past:', error);
    return false;
  }
};

/**
 * Get days remaining until a date
 */
export const getDaysRemaining = (date: Date | string): number => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    const days = differenceInDays(dateObj, new Date());
    return Math.max(0, days);
  } catch (error) {
    console.error('Error calculating days remaining:', error);
    return 0;
  }
};

/**
 * Get hours remaining until a date
 */
export const getHoursRemaining = (date: Date | string): number => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    const hours = differenceInHours(dateObj, new Date());
    return Math.max(0, hours);
  } catch (error) {
    console.error('Error calculating hours remaining:', error);
    return 0;
  }
};

/**
 * Get minutes remaining until a date
 */
export const getMinutesRemaining = (date: Date | string): number => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    const minutes = differenceInMinutes(dateObj, new Date());
    return Math.max(0, minutes);
  } catch (error) {
    console.error('Error calculating minutes remaining:', error);
    return 0;
  }
};

/**
 * Add days to a date
 */
export const addDaysToDate = (date: Date | string, days: number): Date => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return addDays(dateObj, days);
  } catch (error) {
    console.error('Error adding days to date:', error);
    return new Date();
  }
};

/**
 * Subtract days from a date
 */
export const subtractDaysFromDate = (date: Date | string, days: number): Date => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return subDays(dateObj, days);
  } catch (error) {
    console.error('Error subtracting days from date:', error);
    return new Date();
  }
};

/**
 * Get start of day for a date
 */
export const getStartOfDay = (date: Date | string): Date => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return startOfDay(dateObj);
  } catch (error) {
    console.error('Error getting start of day:', error);
    return new Date();
  }
};

/**
 * Get end of day for a date
 */
export const getEndOfDay = (date: Date | string): Date => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return endOfDay(dateObj);
  } catch (error) {
    console.error('Error getting end of day:', error);
    return new Date();
  }
};

/**
 * Format subscription period dates
 */
export const formatSubscriptionPeriod = (startDate: Date | string, endDate: Date | string): string => {
  const start = formatDate(startDate, 'MMM d');
  const end = formatDate(endDate, 'MMM d, yyyy');
  return `${start} - ${end}`;
};

/**
 * Format billing date with relative time
 */
export const formatBillingDate = (date: Date | string): string => {
  const formatted = formatDate(date, 'MMMM d, yyyy');
  const relative = getRelativeTime(date);
  return `${formatted} (${relative})`;
};

/**
 * Check if a subscription is in grace period (cancelled but not expired)
 */
export const isInGracePeriod = (cancelledAt: Date | string, periodEnd: Date | string): boolean => {
  try {
    const now = new Date();
    const cancelled = typeof cancelledAt === 'string' ? parseISO(cancelledAt) : cancelledAt;
    const end = typeof periodEnd === 'string' ? parseISO(periodEnd) : periodEnd;
    
    return isAfter(end, now) && isPast(cancelled);
  } catch (error) {
    console.error('Error checking grace period:', error);
    return false;
  }
};

/**
 * Get subscription status based on dates
 */
export const getSubscriptionStatusFromDates = (
  startDate: Date | string,
  endDate: Date | string,
  cancelledAt?: Date | string
): 'active' | 'cancelled' | 'expired' | 'future' => {
  try {
    const now = new Date();
    const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
    const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;
    
    if (isBefore(end, now)) {
      return 'expired';
    }
    
    if (isAfter(start, now)) {
      return 'future';
    }
    
    if (cancelledAt) {
      const cancelled = typeof cancelledAt === 'string' ? parseISO(cancelledAt) : cancelledAt;
      if (isPast(cancelled)) {
        return 'cancelled';
      }
    }
    
    return 'active';
  } catch (error) {
    console.error('Error getting subscription status from dates:', error);
    return 'expired';
  }
};
