/**
 * Comprehensive Logging Service
 * Provides structured logging for webhook events, subscription changes, and system events
 * Requirements: 5.4, 4.4
 */

import { createServiceClient } from '@/lib/supabase/service';
import { format } from 'date-fns';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export enum LogCategory {
  WEBHOOK = 'webhook',
  SUBSCRIPTION = 'subscription',
  PAYMENT = 'payment',
  USAGE = 'usage',
  AUTH = 'auth',
  API = 'api',
  SYSTEM = 'system',
  SECURITY = 'security'
}

export interface LogContext {
  userId?: string;
  subscriptionId?: string;
  planId?: string;
  webhookEventId?: string;
  operation?: string;
  requestId?: string;
  userAgent?: string;
  ipAddress?: string;
  duration?: number; // in milliseconds
  metadata?: Record<string, any>;
  errorId?: string;
  previousPlan?: string;
  planName?: string;
  service?: string;
  ruleId?: string;
  alertId?: string;
}

export interface LogEntry {
  id: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  context: LogContext;
  timestamp: Date;
  source: string; // e.g., 'webhook-handler', 'subscription-service'
  tags?: string[];
}

export class LoggingService {
  private static instance: LoggingService;
  private logBuffer: LogEntry[] = [];
  private bufferSize = 100;
  private flushInterval = 30000; // 30 seconds
  private flushTimer?: NodeJS.Timeout;

  public static getInstance(): LoggingService {
    if (!LoggingService.instance) {
      LoggingService.instance = new LoggingService();
    }
    return LoggingService.instance;
  }

  constructor() {
    // Start periodic flush
    this.startPeriodicFlush();
  }

  /**
   * Log a webhook event
   */
  async logWebhookEvent(
    eventType: string,
    webhookId: string,
    status: 'received' | 'processing' | 'completed' | 'failed',
    message: string,
    context: LogContext = {}
  ): Promise<void> {
    const level = status === 'failed' ? LogLevel.ERROR : LogLevel.INFO;
    const tags = ['webhook', eventType, status];

    await this.log(level, LogCategory.WEBHOOK, message, {
      ...context,
      webhookEventId: webhookId,
      operation: `webhook_${eventType}`,
    }, 'webhook-handler', tags);
  }

  /**
   * Log subscription changes
   */
  async logSubscriptionChange(
    changeType: 'created' | 'updated' | 'cancelled' | 'expired' | 'resumed',
    subscriptionId: string,
    userId: string,
    planId: string,
    message: string,
    context: LogContext = {}
  ): Promise<void> {
    const level = changeType === 'expired' ? LogLevel.WARN : LogLevel.INFO;
    const tags = ['subscription', changeType];

    await this.log(level, LogCategory.SUBSCRIPTION, message, {
      ...context,
      userId,
      subscriptionId,
      planId,
      operation: `subscription_${changeType}`,
    }, 'subscription-service', tags);
  }

  /**
   * Log payment events
   */
  async logPaymentEvent(
    eventType: 'initiated' | 'completed' | 'failed' | 'refunded',
    subscriptionId: string,
    userId: string,
    amount?: number,
    currency?: string,
    message?: string,
    context: LogContext = {}
  ): Promise<void> {
    const level = eventType === 'failed' ? LogLevel.ERROR : LogLevel.INFO;
    const tags = ['payment', eventType];

    const logMessage = message || `Payment ${eventType}${amount ? ` for $${amount} ${currency || 'USD'}` : ''}`;

    await this.log(level, LogCategory.PAYMENT, logMessage, {
      ...context,
      userId,
      subscriptionId,
      operation: `payment_${eventType}`,
      metadata: {
        ...context.metadata,
        amount,
        currency,
      },
    }, 'payment-service', tags);
  }

  /**
   * Log usage tracking events
   */
  async logUsageEvent(
    eventType: 'incremented' | 'limit_reached' | 'reset' | 'upgrade_prompted',
    userId: string,
    resourceType: 'memory' | 'file',
    currentCount: number,
    limit: number,
    message?: string,
    context: LogContext = {}
  ): Promise<void> {
    const level = eventType === 'limit_reached' ? LogLevel.WARN : LogLevel.INFO;
    const tags = ['usage', resourceType, eventType];

    const logMessage = message || `Usage ${eventType}: ${currentCount}/${limit} ${resourceType}`;

    await this.log(level, LogCategory.USAGE, logMessage, {
      ...context,
      userId,
      operation: `usage_${eventType}`,
      metadata: {
        ...context.metadata,
        resourceType,
        currentCount,
        limit,
      },
    }, 'usage-service', tags);
  }

  /**
   * Log API requests
   */
  async logApiRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    userId?: string,
    context: LogContext = {}
  ): Promise<void> {
    const level = statusCode >= 500 ? LogLevel.ERROR : 
                  statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
    const tags = ['api', method.toLowerCase(), statusCode.toString()];

    const message = `${method} ${path} - ${statusCode} (${duration}ms)`;

    await this.log(level, LogCategory.API, message, {
      ...context,
      userId,
      operation: 'api_request',
      duration,
      metadata: {
        ...context.metadata,
        method,
        path,
        statusCode,
      },
    }, 'api-middleware', tags);
  }

  /**
   * Log authentication events
   */
  async logAuthEvent(
    eventType: 'login' | 'logout' | 'session_expired' | 'password_reset' | 'signup',
    userId: string,
    success: boolean,
    message?: string,
    context: LogContext = {}
  ): Promise<void> {
    const level = success ? LogLevel.INFO : LogLevel.WARN;
    const tags = ['auth', eventType, success ? 'success' : 'failure'];

    const logMessage = message || `Authentication ${eventType} ${success ? 'successful' : 'failed'}`;

    await this.log(level, LogCategory.AUTH, logMessage, {
      ...context,
      userId,
      operation: `auth_${eventType}`,
      metadata: {
        ...context.metadata,
        success,
      },
    }, 'auth-service', tags);
  }

  /**
   * Log security events
   */
  async logSecurityEvent(
    eventType: 'suspicious_activity' | 'rate_limit_exceeded' | 'unauthorized_access' | 'data_breach',
    userId?: string,
    message?: string,
    context: LogContext = {}
  ): Promise<void> {
    const level = LogLevel.CRITICAL;
    const tags = ['security', eventType];

    await this.log(level, LogCategory.SECURITY, message, {
      ...context,
      userId,
      operation: `security_${eventType}`,
    }, 'security-service', tags);
  }

  /**
   * Log system events
   */
  async logSystemEvent(
    eventType: 'startup' | 'shutdown' | 'maintenance' | 'error' | 'performance' | 'notification_sent' | 'health_check_failed' | 'alert_triggered' | 'alert_rule_error' | 'alert_send_failed' | 'checkout_initiated',
    message: string,
    context: LogContext = {}
  ): Promise<void> {
    const level = eventType === 'error' ? LogLevel.ERROR : LogLevel.INFO;
    const tags = ['system', eventType];

    await this.log(level, LogCategory.SYSTEM, message, {
      ...context,
      operation: `system_${eventType}`,
    }, 'system-service', tags);
  }

  /**
   * Generic log method
   */
  async log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    context: LogContext = {},
    source: string = 'unknown',
    tags: string[] = []
  ): Promise<void> {
    const logEntry: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      level,
      category,
      message,
      context: {
        ...context,
      },
      timestamp: new Date(),
      source,
      tags,
    };

    // Add to buffer
    this.logBuffer.push(logEntry);

    // Log to console
    this.logToConsole(logEntry);

    // Flush if buffer is full
    if (this.logBuffer.length >= this.bufferSize) {
      await this.flush();
    }
  }

  /**
   * Flush logs to database
   */
  async flush(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    try {
      const supabase = createServiceClient();
      const logsToStore = this.logBuffer.map(log => ({
        id: log.id,
        level: log.level,
        category: log.category,
        message: log.message,
        context: log.context,
        source: log.source,
        tags: log.tags,
        created_at: log.timestamp.toISOString(),
      }));

      const { error } = await supabase
        .from('system_logs')
        .insert(logsToStore);

      if (error) {
        console.error('Failed to store logs:', error);
      } else {
        console.log(`Flushed ${this.logBuffer.length} logs to database`);
      }

      // Clear buffer
      this.logBuffer = [];
    } catch (error) {
      console.error('Failed to flush logs:', error);
    }
  }

  /**
   * Get logs with filtering
   */
  async getLogs(
    filters: {
      level?: LogLevel;
      category?: LogCategory;
      source?: string;
      userId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    } = {}
  ): Promise<LogEntry[]> {
    try {
      const supabase = createServiceClient();
      let query = supabase
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters.level) {
        query = query.eq('level', filters.level);
      }
      if (filters.category) {
        query = query.eq('category', filters.category);
      }
      if (filters.source) {
        query = query.eq('source', filters.source);
      }
      if (filters.userId) {
        query = query.eq('context->>userId', filters.userId);
      }
      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate.toISOString());
      }
      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate.toISOString());
      }
      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch logs: ${error.message}`);
      }

      return data.map(log => ({
        id: log.id,
        level: log.level,
        category: log.category,
        message: log.message,
        context: log.context,
        timestamp: new Date(log.created_at),
        source: log.source,
        tags: log.tags || [],
      }));
    } catch (error) {
      console.error('Failed to get logs:', error);
      return [];
    }
  }

  /**
   * Get log statistics
   */
  async getLogStatistics(
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalLogs: number;
    logsByLevel: Record<LogLevel, number>;
    logsByCategory: Record<LogCategory, number>;
    logsBySource: Record<string, number>;
    recentErrors: LogEntry[];
  }> {
    try {
      const logs = await this.getLogs({ startDate, endDate });

      const logsByLevel = logs.reduce((acc, log) => {
        acc[log.level] = (acc[log.level] || 0) + 1;
        return acc;
      }, {} as Record<LogLevel, number>);

      const logsByCategory = logs.reduce((acc, log) => {
        acc[log.category] = (acc[log.category] || 0) + 1;
        return acc;
      }, {} as Record<LogCategory, number>);

      const logsBySource = logs.reduce((acc, log) => {
        acc[log.source] = (acc[log.source] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const recentErrors = logs
        .filter(log => log.level === LogLevel.ERROR || log.level === LogLevel.CRITICAL)
        .slice(0, 10);

      return {
        totalLogs: logs.length,
        logsByLevel,
        logsByCategory,
        logsBySource,
        recentErrors,
      };
    } catch (error) {
      console.error('Failed to get log statistics:', error);
      return {
        totalLogs: 0,
        logsByLevel: {} as Record<LogLevel, number>,
        logsByCategory: {} as Record<LogCategory, number>,
        logsBySource: {} as Record<string, number>,
        recentErrors: [],
      };
    }
  }

  // Private methods
  private logToConsole(logEntry: LogEntry): void {
    const timestamp = format(logEntry.timestamp, 'yyyy-MM-dd HH:mm:ss');
    const contextStr = JSON.stringify(logEntry.context, null, 2);
    const tagsStr = logEntry.tags.length > 0 ? ` [${logEntry.tags.join(', ')}]` : '';

    const logMessage = `[${timestamp}] [${logEntry.level.toUpperCase()}] [${logEntry.category}] [${logEntry.source}]${tagsStr} ${logEntry.message}`;

    switch (logEntry.level) {
      case LogLevel.CRITICAL:
        console.error(`🚨 ${logMessage}`, { context: logEntry.context });
        break;
      case LogLevel.ERROR:
        console.error(`🔴 ${logMessage}`, { context: logEntry.context });
        break;
      case LogLevel.WARN:
        console.warn(`🟡 ${logMessage}`, { context: logEntry.context });
        break;
      case LogLevel.INFO:
        console.info(`🔵 ${logMessage}`, { context: logEntry.context });
        break;
      case LogLevel.DEBUG:
        console.debug(`🟢 ${logMessage}`, { context: logEntry.context });
        break;
    }
  }

  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(error => {
        console.error('Failed to flush logs:', error);
      });
    }, this.flushInterval);
  }

  public destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    // Flush remaining logs
    this.flush().catch(error => {
      console.error('Failed to flush logs on destroy:', error);
    });
  }
}

export const loggingService = LoggingService.getInstance();
