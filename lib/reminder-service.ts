import { createClient } from './supabase/client';
import { integrationService, createIntegrationService, IntegrationService } from './integration-service';
import { taskSchedulerService, createTaskSchedulerService, TaskSchedulerService } from './task-scheduler';
import { 
  ScheduledTask, 
  CreateReminderRequest, 
  CreateTaskRequest,
  TaskExecutionLog,
  ReminderTemplate,
  TemplateContext,
  ToastNotification
} from '../types/reminder';
import { SupabaseClient } from '@supabase/supabase-js';

export class ReminderService {
  private supabase: SupabaseClient;
  private integrationService: IntegrationService;
  private taskSchedulerService: TaskSchedulerService;

  constructor(supabaseClient?: SupabaseClient) {
    this.supabase = supabaseClient || createClient();
    this.integrationService = supabaseClient ? createIntegrationService(supabaseClient) : integrationService;
    this.taskSchedulerService = supabaseClient ? createTaskSchedulerService(supabaseClient) : taskSchedulerService;
  }

  /**
   * Create a new reminder
   */
  async createReminder(
    userId: string, 
    request: CreateReminderRequest
  ): Promise<{ task: ScheduledTask | null; error?: string; toast?: ToastNotification }> {
    try {
      // Validate integration if required
      if (request.integration_slug && request.action_type !== 'notification') {
        // console.log(userId,request.integration_slug,request.action_type)
        const validation = await this.integrationService.validateIntegrationForAction(
          userId,
          request.integration_slug,
          request.action_type || 'unknown'
        );

        if (!validation.valid) {
          return {
            task: null,
            error: validation.error,
            toast: validation.toast
          };
        }
      }
      // Get integration ID if needed
      let integrationId: string | undefined;
      if (request.integration_slug) {
        const integration = await this.integrationService.getUserIntegrationByProvider(
          userId,
          request.integration_slug
        );
        integrationId = integration?.id;
      }
      // Calculate next execution time
      const scheduledAt = new Date(request.scheduled_at);
      const nextExecutionAt = request.task_type === 'recurring' ? scheduledAt : null;

      const taskData: Partial<ScheduledTask> = {
        user_id: userId,
        title: request.title,
        description: request.description,
        task_type: request.task_type,
        scheduled_at: request.scheduled_at,
        timezone: request.timezone || 'UTC',
        recurrence_rule: request.recurrence_rule,
        recurrence_end_date: request.recurrence_end_date,
        action_type: request.action_type || 'notification',
        integration_id: integrationId,
        action_config: request.action_config || {},
        encrypted_payload: request.encrypted_payload,
        status: 'pending',
        next_execution_at: nextExecutionAt?.toISOString(),
        execution_count: 0,
        priority: request.priority || 'medium',
        tags: request.tags || [],
        metadata: {},
        retry_count: 0,
        max_retries: 3
      };

      const { data, error } = await this.supabase
        .from('scheduled_tasks')
        .insert(taskData)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create reminder: ${error.message}`);
      }

      // Schedule the task for execution
      const schedulingResult = await this.taskSchedulerService.scheduleTask(data.id);
      if (!schedulingResult.success) {
        console.warn(`Task created but scheduling failed for task ${data.id}:`, schedulingResult.error);
        // Don't fail the creation, just log the warning
        // The task can be manually executed or rescheduled later
      }

      return { task: data };
    } catch (error) {
      return {
        task: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create a new automated task
   */
  async createTask(
    userId: string, 
    request: CreateTaskRequest
  ): Promise<{ task: ScheduledTask | null; error?: string; toast?: ToastNotification }> {
    return this.createReminder(userId, request);
  }

  /**
   * Get user's scheduled tasks
   */
  async getUserTasks(
    userId: string,
    options: {
      status?: string[];
      task_type?: string[];
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<ScheduledTask[]> {
    let query = this.supabase
      .from('scheduled_tasks')
      .select(`
        *,
        integration:user_integrations(
          id,
          connection_name,
          provider:integration_providers(name, slug, logo_url)
        )
      `)
      .eq('user_id', userId);

    if (options.status?.length) {
      query = query.in('status', options.status);
    }

    if (options.task_type?.length) {
      query = query.in('task_type', options.task_type);
    }

    query = query
      .order('scheduled_at', { ascending: true })
      .limit(options.limit || 50);

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch tasks: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get upcoming tasks (next 7 days)
   */
  async getUpcomingTasks(userId: string): Promise<ScheduledTask[]> {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const { data, error } = await this.supabase
      .from('scheduled_tasks')
      .select(`
        *,
        integration:user_integrations(
          connection_name,
          provider:integration_providers(name, slug, logo_url)
        )
      `)
      .eq('user_id', userId)
      .in('status', ['pending', 'active'])
      .gte('scheduled_at', now.toISOString())
      .lte('scheduled_at', nextWeek.toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(20);

    if (error) {
      throw new Error(`Failed to fetch upcoming tasks: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Update task status
   */
  async updateTaskStatus(
    userId: string,
    taskId: string,
    status: ScheduledTask['status'],
    error?: string
  ): Promise<void> {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (error) {
      updateData.last_error = error;
      updateData.failed_at = new Date().toISOString();
    }

    const { error: dbError } = await this.supabase
      .from('scheduled_tasks')
      .update(updateData)
      .eq('id', taskId)
      .eq('user_id', userId);

    if (dbError) {
      throw new Error(`Failed to update task: ${dbError.message}`);
    }
  }

  /**
   * Delete a task
   */
  async deleteTask(userId: string, taskId: string): Promise<void> {
    const { error } = await this.supabase
      .from('scheduled_tasks')
      .delete()
      .eq('id', taskId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to delete task: ${error.message}`);
    }
  }

  /**
   * Get task execution logs
   */
  async getTaskLogs(
    userId: string,
    taskId?: string,
    limit: number = 50
  ): Promise<TaskExecutionLog[]> {
    let query = this.supabase
      .from('task_execution_logs')
      .select(`
        *,
        task:scheduled_tasks(title, task_type)
      `)
      .eq('user_id', userId);

    if (taskId) {
      query = query.eq('task_id', taskId);
    }

    query = query
      .order('executed_at', { ascending: false })
      .limit(limit);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch task logs: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get reminder templates
   */
  async getReminderTemplates(
    userId: string,
    category?: string
  ): Promise<ReminderTemplate[]> {
    let query = this.supabase
      .from('reminder_templates')
      .select('*')
      .or(`is_system_template.eq.true,user_id.eq.${userId}`)
      .eq('is_active', true);

    if (category) {
      query = query.eq('category', category);
    }

    query = query.order('usage_count', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch templates: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Create reminder from template
   */
  async createReminderFromTemplate(
    userId: string,
    templateId: string,
    context: TemplateContext,
    scheduledAt: string,
    timezone?: string
  ): Promise<{ task: ScheduledTask | null; error?: string }> {
    try {
      // Get template
      const { data: template, error: templateError } = await this.supabase
        .from('reminder_templates')
        .select('*')
        .eq('id', templateId)
        .or(`is_system_template.eq.true,user_id.eq.${userId}`)
        .single();

      if (templateError) {
        throw new Error(`Template not found: ${templateError.message}`);
      }

      // Replace template placeholders
      const title = this.replacePlaceholders(template.title_template, context);
      const description = template.description_template 
        ? this.replacePlaceholders(template.description_template, context)
        : undefined;

      // Create reminder
      const request: CreateReminderRequest = {
        title,
        description,
        scheduled_at: scheduledAt,
        timezone: timezone || 'UTC',
        task_type: 'reminder',
        action_type: template.default_action_type || 'notification',
        action_config: template.default_action_config,
        priority: 'medium'
      };

      const result = await this.createReminder(userId, request);

      // Update template usage count
      if (result.task) {
        await this.supabase
          .from('reminder_templates')
          .update({ usage_count: template.usage_count + 1 })
          .eq('id', templateId);
      }

      return result;
    } catch (error) {
      return {
        task: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Replace placeholders in template strings
   */
  private replacePlaceholders(template: string, context: TemplateContext): string {
    let result = template;
    
    Object.entries(context).forEach(([key, value]) => {
      const placeholder = `{${key}}`;
      result = result.replace(new RegExp(placeholder, 'g'), String(value || ''));
    });

    return result;
  }

  /**
   * Pause/Resume task
   */
  async toggleTaskStatus(
    userId: string,
    taskId: string,
    pause: boolean
  ): Promise<void> {
    const newStatus = pause ? 'paused' : 'active';
    await this.updateTaskStatus(userId, taskId, newStatus);
  }

  /**
   * Get task statistics
   */
  async getTaskStatistics(userId: string): Promise<{
    total: number;
    pending: number;
    active: number;
    completed: number;
    failed: number;
    by_type: Record<string, number>;
    by_priority: Record<string, number>;
  }> {
    const { data, error } = await this.supabase
      .from('scheduled_tasks')
      .select('status, task_type, priority')
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to fetch statistics: ${error.message}`);
    }

    const stats = {
      total: data.length,
      pending: 0,
      active: 0,
      completed: 0,
      failed: 0,
      by_type: {} as Record<string, number>,
      by_priority: {} as Record<string, number>
    };

    data.forEach(task => {
      // Count by status
      if (task.status in stats) {
        (stats as any)[task.status]++;
      }

      // Count by type
      stats.by_type[task.task_type] = (stats.by_type[task.task_type] || 0) + 1;

      // Count by priority
      stats.by_priority[task.priority] = (stats.by_priority[task.priority] || 0) + 1;
    });

    return stats;
  }
}

// Export singleton instance for client-side usage
export const reminderService = new ReminderService();

// Factory function for server-side usage with authenticated client
export function createReminderService(supabaseClient: SupabaseClient): ReminderService {
  return new ReminderService(supabaseClient);
}

