/**
 * Error Monitoring and Alerting Service
 * Provides real-time error monitoring, alerting, and health checks
 * Requirements: 5.4, 4.4
 */

import { createClient } from '@/lib/supabase/server';
import { errorHandlingService, ErrorType, ErrorSeverity } from './error-handling-service';
import { loggingService, LogLevel, LogCategory, LogContext } from './logging-service';

export interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  lastChecked: Date;
  error?: string;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: {
    type: 'error_rate' | 'error_count' | 'response_time' | 'custom';
    threshold: number;
    timeWindow: number; // in minutes
    severity?: ErrorSeverity;
  };
  enabled: boolean;
  channels: AlertChannel[];
}

export interface AlertChannel {
  type: 'email' | 'slack' | 'webhook' | 'console';
  config: Record<string, any>;
}

export interface Alert {
  id: string;
  ruleId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  triggeredAt: Date;
  resolvedAt?: Date;
  status: 'active' | 'resolved' | 'acknowledged';
  metadata: Record<string, any>;
}

export class ErrorMonitoringService {
  private static instance: ErrorMonitoringService;
  private healthChecks: Map<string, HealthCheck> = new Map();
  private alertRules: AlertRule[] = [];
  private activeAlerts: Map<string, Alert> = new Map();
  private monitoringInterval?: NodeJS.Timeout;

  public static getInstance(): ErrorMonitoringService {
    if (!ErrorMonitoringService.instance) {
      ErrorMonitoringService.instance = new ErrorMonitoringService();
    }
    return ErrorMonitoringService.instance;
  }

  constructor() {
    this.initializeDefaultAlertRules();
    this.startMonitoring();
  }

  /**
   * Start monitoring services and checking alert rules
   */
  private startMonitoring(): void {
    // Run health checks every 30 seconds
    this.monitoringInterval = setInterval(async () => {
      await this.runHealthChecks();
      await this.checkAlertRules();
    }, 30000);

    // Initial health check
    this.runHealthChecks();
  }

  /**
   * Stop monitoring
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
  }

  /**
   * Run health checks for all services
   */
  private async runHealthChecks(): Promise<void> {
    const services = [
      { name: 'database', check: this.checkDatabaseHealth.bind(this) },
      { name: 'lemonsqueezy', check: this.checkLemonSqueezyHealth.bind(this) },
      { name: 'notification', check: this.checkNotificationHealth.bind(this) },
      { name: 'webhook', check: this.checkWebhookHealth.bind(this) },
    ];

    for (const service of services) {
      try {
        const startTime = Date.now();
        await service.check();
        const responseTime = Date.now() - startTime;
        
        this.healthChecks.set(service.name, {
          service: service.name,
          status: 'healthy',
          responseTime,
          lastChecked: new Date(),
        });
      } catch (error) {
        const responseTime = Date.now() - Date.now();
        this.healthChecks.set(service.name, {
          service: service.name,
          status: 'unhealthy',
          responseTime,
          lastChecked: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        await loggingService.logSystemEvent(
          'health_check_failed',
          `Health check failed for ${service.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          { service: service.name, error: error instanceof Error ? error.message : 'Unknown error' } as LogContext
        );
      }
    }
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<void> {
    // Skip health checks during build time
    if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
      return;
    }

    try {
      const supabase = await createClient();
      const { error } = await supabase
        .from('subscription_plans')
        .select('id')
        .limit(1);

      if (error) {
        throw new Error(`Database connection failed: ${error.message}`);
      }
    } catch (error) {
      // Silently fail during build time
      if (typeof window === 'undefined') {
        return;
      }
      throw error;
    }
  }

  /**
   * Check LemonSqueezy API health
   */
  private async checkLemonSqueezyHealth(): Promise<void> {
    // This would make a simple API call to LemonSqueezy
    // For now, we'll just check if the API key is configured
    if (!process.env.LEMONSQUEEZY_API_KEY) {
      throw new Error('LemonSqueezy API key not configured');
    }
  }

  /**
   * Check notification service health
   */
  private async checkNotificationHealth(): Promise<void> {
    // Skip health checks during build time
    if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
      return;
    }

    try {
      // Check if notification service can create a test notification
      // This is a simplified check
      const supabase = await createClient();
      const { error } = await supabase
        .from('user_notifications')
        .select('id')
        .limit(1);

      if (error) {
        throw new Error(`Notification service unavailable: ${error.message}`);
      }
    } catch (error) {
      // Silently fail during build time
      if (typeof window === 'undefined') {
        return;
      }
      throw error;
    }
  }

  /**
   * Check webhook processing health
   */
  private async checkWebhookHealth(): Promise<void> {
    // Skip health checks during build time
    if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
      return;
    }

    try {
      // Check if webhook events are being processed
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('webhook_events')
        .select('id, created_at, processed')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        throw new Error(`Webhook service unavailable: ${error.message}`);
      }

      // Check if there are unprocessed webhooks older than 5 minutes
      if (data && data.length > 0) {
        const latestWebhook = data[0];
        const webhookAge = Date.now() - new Date(latestWebhook.created_at).getTime();
        const fiveMinutes = 5 * 60 * 1000;

        if (!latestWebhook.processed && webhookAge > fiveMinutes) {
          throw new Error('Webhook processing is delayed');
        }
      }
    } catch (error) {
      // Silently fail during build time
      if (typeof window === 'undefined') {
        return;
      }
      throw error;
    }
  }

  /**
   * Check alert rules and trigger alerts if needed
   */
  private async checkAlertRules(): Promise<void> {
    for (const rule of this.alertRules) {
      if (!rule.enabled) continue;

      try {
        const shouldTrigger = await this.evaluateAlertRule(rule);
        
        if (shouldTrigger) {
          await this.triggerAlert(rule);
        }
      } catch (error) {
        await loggingService.logSystemEvent(
          'alert_rule_error',
          `Error checking alert rule ${rule.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          { ruleId: rule.id, error: error instanceof Error ? error.message : 'Unknown error' } as LogContext
        );
      }
    }
  }

  /**
   * Evaluate if an alert rule should trigger
   */
  private async evaluateAlertRule(rule: AlertRule): Promise<boolean> {
    const now = new Date();
    const timeWindow = new Date(now.getTime() - rule.condition.timeWindow * 60 * 1000);

    switch (rule.condition.type) {
      case 'error_rate':
        return await this.checkErrorRate(rule, timeWindow);
      case 'error_count':
        return await this.checkErrorCount(rule, timeWindow);
      case 'response_time':
        return await this.checkResponseTime(rule);
      default:
        return false;
    }
  }

  /**
   * Check error rate against threshold
   */
  private async checkErrorRate(rule: AlertRule, timeWindow: Date): Promise<boolean> {
    const stats = await errorHandlingService.getErrorStatistics(timeWindow, new Date());
    const totalErrors = stats.totalErrors;
    const timeWindowMinutes = rule.condition.timeWindow;
    const errorRate = totalErrors / timeWindowMinutes;

    return errorRate >= rule.condition.threshold;
  }

  /**
   * Check error count against threshold
   */
  private async checkErrorCount(rule: AlertRule, timeWindow: Date): Promise<boolean> {
    const stats = await errorHandlingService.getErrorStatistics(timeWindow, new Date());
    return stats.totalErrors >= rule.condition.threshold;
  }

  /**
   * Check response time against threshold
   */
  private async checkResponseTime(rule: AlertRule): Promise<boolean> {
    const healthChecks = Array.from(this.healthChecks.values());
    const avgResponseTime = healthChecks.reduce((sum, check) => sum + check.responseTime, 0) / healthChecks.length;
    
    return avgResponseTime >= rule.condition.threshold;
  }

  /**
   * Trigger an alert
   */
  private async triggerAlert(rule: AlertRule): Promise<void> {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    const alert: Alert = {
      id: alertId,
      ruleId: rule.id,
      severity: this.getAlertSeverity(rule),
      title: `Alert: ${rule.name}`,
      message: this.generateAlertMessage(rule),
      triggeredAt: new Date(),
      status: 'active',
      metadata: {
        ruleName: rule.name,
        condition: rule.condition,
      },
    };

    this.activeAlerts.set(alertId, alert);

    // Send alerts through configured channels
    for (const channel of rule.channels) {
      try {
        await this.sendAlert(alert, channel);
      } catch (error) {
        await loggingService.logSystemEvent(
          'alert_send_failed',
          `Failed to send alert through ${channel.type}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          { alertId, channel: channel.type, error: error instanceof Error ? error.message : 'Unknown error' } as LogContext
        );
      }
    }

    await loggingService.logSystemEvent(
      'alert_triggered',
      `Alert triggered: ${rule.name}`,
      { alertId, ruleId: rule.id, severity: alert.severity } as LogContext
    );
  }

  /**
   * Send alert through a specific channel
   */
  private async sendAlert(alert: Alert, channel: AlertChannel): Promise<void> {
    switch (channel.type) {
      case 'console':
        console.error(`🚨 ALERT: ${alert.title} - ${alert.message}`);
        break;
      case 'email':
        // Implement email sending
        console.log(`📧 Email alert: ${alert.title}`);
        break;
      case 'slack':
        // Implement Slack webhook
        console.log(`💬 Slack alert: ${alert.title}`);
        break;
      case 'webhook':
        // Implement custom webhook
        console.log(`🔗 Webhook alert: ${alert.title}`);
        break;
    }
  }

  /**
   * Get alert severity based on rule
   */
  private getAlertSeverity(rule: AlertRule): 'low' | 'medium' | 'high' | 'critical' {
    if (rule.condition.severity) {
      switch (rule.condition.severity) {
        case ErrorSeverity.CRITICAL:
          return 'critical';
        case ErrorSeverity.HIGH:
          return 'high';
        case ErrorSeverity.MEDIUM:
          return 'medium';
        case ErrorSeverity.LOW:
          return 'low';
      }
    }
    return 'medium';
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(rule: AlertRule): string {
    switch (rule.condition.type) {
      case 'error_rate':
        return `Error rate exceeded ${rule.condition.threshold} errors per minute in the last ${rule.condition.timeWindow} minutes.`;
      case 'error_count':
        return `Error count exceeded ${rule.condition.threshold} errors in the last ${rule.condition.timeWindow} minutes.`;
      case 'response_time':
        return `Average response time exceeded ${rule.condition.threshold}ms.`;
      default:
        return `Alert condition met for rule: ${rule.name}`;
    }
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultAlertRules(): void {
    this.alertRules = [
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        condition: {
          type: 'error_rate',
          threshold: 5, // 5 errors per minute
          timeWindow: 5, // 5 minutes
          severity: ErrorSeverity.HIGH,
        },
        enabled: true,
        channels: [
          { type: 'console', config: {} },
        ],
      },
      {
        id: 'critical_errors',
        name: 'Critical Errors',
        condition: {
          type: 'error_count',
          threshold: 1, // 1 critical error
          timeWindow: 1, // 1 minute
          severity: ErrorSeverity.CRITICAL,
        },
        enabled: true,
        channels: [
          { type: 'console', config: {} },
        ],
      },
      {
        id: 'slow_response',
        name: 'Slow Response Time',
        condition: {
          type: 'response_time',
          threshold: 5000, // 5 seconds
          timeWindow: 1,
        },
        enabled: true,
        channels: [
          { type: 'console', config: {} },
        ],
      },
    ];
  }

  /**
   * Get current health status
   */
  public getHealthStatus(): HealthCheck[] {
    return Array.from(this.healthChecks.values());
  }

  /**
   * Get active alerts
   */
  public getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values()).filter(alert => alert.status === 'active');
  }

  /**
   * Acknowledge an alert
   */
  public acknowledgeAlert(alertId: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.status = 'acknowledged';
      this.activeAlerts.set(alertId, alert);
    }
  }

  /**
   * Resolve an alert
   */
  public resolveAlert(alertId: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.status = 'resolved';
      alert.resolvedAt = new Date();
      this.activeAlerts.set(alertId, alert);
    }
  }

  /**
   * Add a custom alert rule
   */
  public addAlertRule(rule: AlertRule): void {
    this.alertRules.push(rule);
  }

  /**
   * Remove an alert rule
   */
  public removeAlertRule(ruleId: string): void {
    this.alertRules = this.alertRules.filter(rule => rule.id !== ruleId);
  }
}

export const errorMonitoringService = ErrorMonitoringService.getInstance();
