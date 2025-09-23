/**
 * Comprehensive Error Handling and Logging Service
 * Provides centralized error handling, logging, and user-friendly error messages
 * Requirements: 5.4, 4.4
 */

import { createServiceClient } from '@/lib/supabase/service';
import { format } from 'date-fns';

export enum ErrorType {
  // Subscription related errors
  SUBSCRIPTION_CREATION_FAILED = 'subscription_creation_failed',
  SUBSCRIPTION_UPDATE_FAILED = 'subscription_update_failed',
  SUBSCRIPTION_CANCELLATION_FAILED = 'subscription_cancellation_failed',
  SUBSCRIPTION_RETRIEVAL_FAILED = 'subscription_retrieval_failed',
  
  // Payment related errors
  PAYMENT_PROCESSING_FAILED = 'payment_processing_failed',
  PAYMENT_METHOD_INVALID = 'payment_method_invalid',
  PAYMENT_DECLINED = 'payment_declined',
  PAYMENT_RETRY_FAILED = 'payment_retry_failed',
  
  // Webhook related errors
  WEBHOOK_VERIFICATION_FAILED = 'webhook_verification_failed',
  WEBHOOK_PROCESSING_FAILED = 'webhook_processing_failed',
  WEBHOOK_DUPLICATE_EVENT = 'webhook_duplicate_event',
  
  // Usage tracking errors
  USAGE_LIMIT_EXCEEDED = 'usage_limit_exceeded',
  USAGE_TRACKING_FAILED = 'usage_tracking_failed',
  USAGE_RESET_FAILED = 'usage_reset_failed',
  
  // Database errors
  DATABASE_CONNECTION_FAILED = 'database_connection_failed',
  DATABASE_QUERY_FAILED = 'database_query_failed',
  DATABASE_TRANSACTION_FAILED = 'database_transaction_failed',
  
  // Authentication errors
  AUTHENTICATION_FAILED = 'authentication_failed',
  AUTHORIZATION_FAILED = 'authorization_failed',
  SESSION_EXPIRED = 'session_expired',
  
  // External service errors
  LEMONSQUEEZY_API_ERROR = 'lemonsqueezy_api_error',
  LEMONSQUEEZY_WEBHOOK_ERROR = 'lemonsqueezy_webhook_error',
  NOTIFICATION_SERVICE_ERROR = 'notification_service_error',
  
  // General errors
  VALIDATION_ERROR = 'validation_error',
  NETWORK_ERROR = 'network_error',
  TIMEOUT_ERROR = 'timeout_error',
  UNKNOWN_ERROR = 'unknown_error'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorContext {
  userId?: string;
  subscriptionId?: string;
  planId?: string;
  webhookEventId?: string;
  operation?: string;
  metadata?: Record<string, any>;
  timestamp?: Date;
  userAgent?: string;
  ipAddress?: string;
  requestId?: string;
  duration?: number;
  errorId?: string;
}

export interface ErrorLog {
  id: string;
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  context: ErrorContext;
  stackTrace?: string;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserFriendlyError {
  title: string;
  message: string;
  action?: string;
  actionUrl?: string;
  canRetry: boolean;
  supportContact?: boolean;
}

export class ErrorHandlingService {
  private static instance: ErrorHandlingService;
  
  public static getInstance(): ErrorHandlingService {
    if (!ErrorHandlingService.instance) {
      ErrorHandlingService.instance = new ErrorHandlingService();
    }
    return ErrorHandlingService.instance;
  }

  /**
   * Log an error with full context
   */
  async logError(
    type: ErrorType,
    error: Error | string,
    context: ErrorContext = {},
    severity: ErrorSeverity = ErrorSeverity.MEDIUM
  ): Promise<string> {
    try {
      const errorId = `err_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const errorMessage = error instanceof Error ? error.message : error;
      const stackTrace = error instanceof Error ? error.stack : undefined;
      
      const errorLog: Omit<ErrorLog, 'id' | 'createdAt' | 'updatedAt'> = {
        type,
        severity,
        message: errorMessage,
        userMessage: this.getUserFriendlyMessage(type, errorMessage),
        context: {
          ...context,
          timestamp: new Date(),
        },
        stackTrace,
        resolved: false,
      };

      // Log to console with appropriate level
      this.logToConsole(severity, errorLog, errorMessage, stackTrace);

      // Store in database
      await this.storeErrorLog(errorId, errorLog);

      // Send alerts for critical errors
      if (severity === ErrorSeverity.CRITICAL) {
        await this.sendCriticalErrorAlert(errorLog);
      }

      return errorId;
    } catch (logError) {
      console.error('Failed to log error:', logError);
      return 'log_failed';
    }
  }

  /**
   * Get user-friendly error message
   */
  getUserFriendlyError(type: ErrorType, originalMessage?: string): UserFriendlyError {
    const errorMap: Record<ErrorType, UserFriendlyError> = {
      [ErrorType.SUBSCRIPTION_CREATION_FAILED]: {
        title: 'Subscription Setup Failed',
        message: 'We encountered an issue setting up your subscription. Please try again or contact support if the problem persists.',
        action: 'Try Again',
        actionUrl: '/protected/billing?tab=plans',
        canRetry: true,
        supportContact: true,
      },
      [ErrorType.SUBSCRIPTION_UPDATE_FAILED]: {
        title: 'Subscription Update Failed',
        message: 'We couldn\'t update your subscription. Your current plan remains active.',
        action: 'View Subscription',
        actionUrl: '/protected/billing',
        canRetry: true,
        supportContact: true,
      },
      [ErrorType.SUBSCRIPTION_CANCELLATION_FAILED]: {
        title: 'Cancellation Failed',
        message: 'We couldn\'t cancel your subscription at this time. Please try again or contact support.',
        action: 'Try Again',
        actionUrl: '/protected/billing',
        canRetry: true,
        supportContact: true,
      },
      [ErrorType.PAYMENT_PROCESSING_FAILED]: {
        title: 'Payment Processing Error',
        message: 'There was an issue processing your payment. Please check your payment method and try again.',
        action: 'Update Payment Method',
        actionUrl: '/protected/billing?tab=payment-method',
        canRetry: true,
        supportContact: false,
      },
      [ErrorType.PAYMENT_DECLINED]: {
        title: 'Payment Declined',
        message: 'Your payment was declined. Please check your payment method or try a different card.',
        action: 'Update Payment Method',
        actionUrl: '/protected/billing?tab=payment-method',
        canRetry: true,
        supportContact: false,
      },
      [ErrorType.USAGE_LIMIT_EXCEEDED]: {
        title: 'Usage Limit Reached',
        message: 'You\'ve reached your plan\'s usage limit. Upgrade your plan to continue using this feature.',
        action: 'Upgrade Plan',
        actionUrl: '/protected/billing?tab=plans',
        canRetry: false,
        supportContact: false,
      },
      [ErrorType.AUTHENTICATION_FAILED]: {
        title: 'Authentication Required',
        message: 'Please log in to continue. Your session may have expired.',
        action: 'Log In',
        actionUrl: '/auth/login',
        canRetry: true,
        supportContact: false,
      },
      [ErrorType.WEBHOOK_PROCESSING_FAILED]: {
        title: 'System Update Delayed',
        message: 'We\'re experiencing a delay in processing your subscription updates. Changes should appear shortly.',
        action: 'Refresh Page',
        actionUrl: undefined,
        canRetry: true,
        supportContact: true,
      },
      [ErrorType.DATABASE_CONNECTION_FAILED]: {
        title: 'Service Temporarily Unavailable',
        message: 'We\'re experiencing technical difficulties. Please try again in a few minutes.',
        action: 'Try Again',
        actionUrl: undefined,
        canRetry: true,
        supportContact: true,
      },
      [ErrorType.LEMONSQUEEZY_API_ERROR]: {
        title: 'Payment Service Unavailable',
        message: 'Our payment processor is temporarily unavailable. Please try again later.',
        action: 'Try Again',
        actionUrl: undefined,
        canRetry: true,
        supportContact: true,
      },
      [ErrorType.VALIDATION_ERROR]: {
        title: 'Invalid Information',
        message: originalMessage || 'Please check your information and try again.',
        action: 'Fix Information',
        actionUrl: undefined,
        canRetry: true,
        supportContact: false,
      },
      [ErrorType.NETWORK_ERROR]: {
        title: 'Connection Problem',
        message: 'Please check your internet connection and try again.',
        action: 'Try Again',
        actionUrl: undefined,
        canRetry: true,
        supportContact: false,
      },
      [ErrorType.UNKNOWN_ERROR]: {
        title: 'Something Went Wrong',
        message: 'An unexpected error occurred. Please try again or contact support if the problem persists.',
        action: 'Try Again',
        actionUrl: undefined,
        canRetry: true,
        supportContact: true,
      },
    };

    return errorMap[type] || errorMap[ErrorType.UNKNOWN_ERROR];
  }

  /**
   * Create a standardized API error response
   */
  createApiErrorResponse(
    type: ErrorType,
    error: Error | string,
    context: ErrorContext = {},
    statusCode: number = 500
  ) {
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const userFriendlyError = this.getUserFriendlyError(type);
    
    // Log the error
    this.logError(type, error, context, this.getSeverityFromStatusCode(statusCode));

    return {
      error: userFriendlyError.title,
      message: userFriendlyError.message,
      errorId,
      type,
      canRetry: userFriendlyError.canRetry,
      action: userFriendlyError.action,
      actionUrl: userFriendlyError.actionUrl,
      supportContact: userFriendlyError.supportContact,
    };
  }

  /**
   * Wrap API route handlers with error handling
   */
  withErrorHandling<T extends any[], R>(
    handler: (...args: T) => Promise<R>,
    context: Partial<ErrorContext> = {}
  ) {
    return async (...args: T): Promise<R> => {
      try {
        return await handler(...args);
      } catch (error) {
        const errorType = this.determineErrorType(error);
        const errorId = await this.logError(errorType, error, context);
        
        // Re-throw with additional context
        const enhancedError = new Error(
          `[${errorId}] ${error instanceof Error ? error.message : String(error)}`
        );
        enhancedError.stack = error instanceof Error ? error.stack : undefined;
        throw enhancedError;
      }
    };
  }

  /**
   * Get error statistics for monitoring
   */
  async getErrorStatistics(
    startDate?: Date,
    endDate?: Date,
    severity?: ErrorSeverity
  ): Promise<{
    totalErrors: number;
    errorsByType: Record<ErrorType, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
    recentErrors: ErrorLog[];
  }> {
    try {
      const supabase = createServiceClient();
      
      let query = supabase
        .from('error_logs')
        .select('*');

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }
      if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
      }
      if (severity) {
        query = query.eq('severity', severity);
      }

      const { data: errors, error } = await query.order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch error statistics: ${error.message}`);
      }

      const errorsByType = errors.reduce((acc, error) => {
        acc[error.type] = (acc[error.type] || 0) + 1;
        return acc;
      }, {} as Record<ErrorType, number>);

      const errorsBySeverity = errors.reduce((acc, error) => {
        acc[error.severity] = (acc[error.severity] || 0) + 1;
        return acc;
      }, {} as Record<ErrorSeverity, number>);

      return {
        totalErrors: errors.length,
        errorsByType,
        errorsBySeverity,
        recentErrors: errors.slice(0, 10),
      };
    } catch (error) {
      console.error('Failed to get error statistics:', error);
      return {
        totalErrors: 0,
        errorsByType: {} as Record<ErrorType, number>,
        errorsBySeverity: {} as Record<ErrorSeverity, number>,
        recentErrors: [],
      };
    }
  }

  /**
   * Mark an error as resolved
   */
  async resolveError(errorId: string, resolvedBy: string): Promise<void> {
    try {
      const supabase = createServiceClient();
      const { error } = await supabase
        .from('error_logs')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: resolvedBy,
          updated_at: new Date().toISOString(),
        })
        .eq('id', errorId);

      if (error) {
        throw new Error(`Failed to resolve error: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed to resolve error:', error);
    }
  }

  // Private helper methods
  private getUserFriendlyMessage(type: ErrorType, originalMessage: string): string {
    const userFriendlyError = this.getUserFriendlyError(type, originalMessage);
    return userFriendlyError.message;
  }

  private logToConsole(
    severity: ErrorSeverity,
    errorLog: Omit<ErrorLog, 'id' | 'createdAt' | 'updatedAt'>,
    message: string,
    stackTrace?: string
  ): void {
    const logMessage = `[${errorLog.type}] ${message}`;
    const contextStr = JSON.stringify(errorLog.context, null, 2);

    switch (severity) {
      case ErrorSeverity.CRITICAL:
        console.error(`🚨 CRITICAL: ${logMessage}`, { context: errorLog.context, stack: stackTrace });
        break;
      case ErrorSeverity.HIGH:
        console.error(`🔴 HIGH: ${logMessage}`, { context: errorLog.context, stack: stackTrace });
        break;
      case ErrorSeverity.MEDIUM:
        console.warn(`🟡 MEDIUM: ${logMessage}`, { context: errorLog.context });
        break;
      case ErrorSeverity.LOW:
        console.info(`🔵 LOW: ${logMessage}`, { context: errorLog.context });
        break;
    }
  }

  private async storeErrorLog(
    errorId: string,
    errorLog: Omit<ErrorLog, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<void> {
    try {
      const supabase = await createClient();
      const { error } = await supabase
        .from('error_logs')
        .insert({
          id: errorId,
          ...errorLog,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Failed to store error log:', error);
      }
    } catch (error) {
      console.error('Failed to store error log:', error);
    }
  }

  private async sendCriticalErrorAlert(errorLog: Omit<ErrorLog, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    // In a production environment, this would send alerts to monitoring services
    // like Sentry, DataDog, PagerDuty, etc.
    console.error('🚨 CRITICAL ERROR ALERT:', {
      type: errorLog.type,
      message: errorLog.message,
      context: errorLog.context,
      timestamp: errorLog.context.timestamp,
    });
  }

  private determineErrorType(error: Error | string): ErrorType {
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : error.toLowerCase();

    if (errorMessage.includes('subscription') && errorMessage.includes('create')) {
      return ErrorType.SUBSCRIPTION_CREATION_FAILED;
    }
    if (errorMessage.includes('subscription') && errorMessage.includes('update')) {
      return ErrorType.SUBSCRIPTION_UPDATE_FAILED;
    }
    if (errorMessage.includes('subscription') && errorMessage.includes('cancel')) {
      return ErrorType.SUBSCRIPTION_CANCELLATION_FAILED;
    }
    if (errorMessage.includes('payment') && errorMessage.includes('declined')) {
      return ErrorType.PAYMENT_DECLINED;
    }
    if (errorMessage.includes('payment') && errorMessage.includes('process')) {
      return ErrorType.PAYMENT_PROCESSING_FAILED;
    }
    if (errorMessage.includes('webhook')) {
      return ErrorType.WEBHOOK_PROCESSING_FAILED;
    }
    if (errorMessage.includes('usage') && errorMessage.includes('limit')) {
      return ErrorType.USAGE_LIMIT_EXCEEDED;
    }
    if (errorMessage.includes('database') || errorMessage.includes('connection')) {
      return ErrorType.DATABASE_CONNECTION_FAILED;
    }
    if (errorMessage.includes('auth') || errorMessage.includes('unauthorized')) {
      return ErrorType.AUTHENTICATION_FAILED;
    }
    if (errorMessage.includes('lemonsqueezy')) {
      return ErrorType.LEMONSQUEEZY_API_ERROR;
    }
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return ErrorType.NETWORK_ERROR;
    }
    if (errorMessage.includes('timeout')) {
      return ErrorType.TIMEOUT_ERROR;
    }
    if (errorMessage.includes('validation')) {
      return ErrorType.VALIDATION_ERROR;
    }

    return ErrorType.UNKNOWN_ERROR;
  }

  private getSeverityFromStatusCode(statusCode: number): ErrorSeverity {
    if (statusCode >= 500) return ErrorSeverity.HIGH;
    if (statusCode >= 400) return ErrorSeverity.MEDIUM;
    return ErrorSeverity.LOW;
  }
}

export const errorHandlingService = ErrorHandlingService.getInstance();
