import { createClient } from './supabase/client';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Task Scheduler Service
 * 
 * Handles scheduling and managing task execution using pg_cron
 */
export class TaskSchedulerService {
  private supabase: SupabaseClient;

  constructor(supabaseClient?: SupabaseClient) {
    this.supabase = supabaseClient || createClient();
  }

  /**
   * Schedule a task for execution
   */
  async scheduleTask(taskId: string): Promise<{
    success: boolean;
    jobId?: number;
    error?: string;
  }> {
    try {
      const { data, error } = await this.supabase
        .rpc('schedule_task_execution', { task_uuid: taskId });

      if (error) {
        console.error('Failed to schedule task:', error);
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        jobId: data
      };
    } catch (error) {
      console.error('Error scheduling task:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown scheduling error'
      };
    }
  }

  /**
   * Cancel a scheduled task
   */
  async cancelTask(taskId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const { data, error } = await this.supabase
        .rpc('cancel_scheduled_task', { task_uuid: taskId });

      if (error) {
        console.error('Failed to cancel task:', error);
        return {
          success: false,
          error: error.message
        };
      }

      return { success: true };
    } catch (error) {
      console.error('Error canceling task:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown cancellation error'
      };
    }
  }

  /**
   * Get task execution status and logs
   */
  async getTaskExecutionLogs(taskId: string): Promise<{
    success: boolean;
    logs?: any[];
    error?: string;
  }> {
    try {
      const { data, error } = await this.supabase
        .from('task_execution_logs')
        .select('*')
        .eq('task_id', taskId)
        .order('started_at', { ascending: false });

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        logs: data || []
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get upcoming tasks that need to be executed
   */
  async getUpcomingTasks(userId?: string): Promise<{
    success: boolean;
    tasks?: any[];
    error?: string;
  }> {
    try {
      let query = this.supabase
        .from('scheduled_tasks')
        .select(`
          *,
          integration:user_integrations(
            *,
            provider:integration_providers(*)
          )
        `)
        .in('status', ['pending', 'active'])
        .not('next_execution_at', 'is', null)
        .lte('next_execution_at', new Date().toISOString())
        .order('next_execution_at');

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        tasks: data || []
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Manually execute a task (for testing or immediate execution)
   */
  async executeTaskNow(taskId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const { error } = await this.supabase
        .rpc('execute_scheduled_task', { task_uuid: taskId });

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown execution error'
      };
    }
  }

  /**
   * Check if pg_cron is available and working
   */
  async checkSchedulerHealth(): Promise<{
    available: boolean;
    error?: string;
  }> {
    try {
      // Try to query pg_cron jobs to see if it's available
      const { error } = await this.supabase
        .from('cron.job')
        .select('jobid')
        .limit(1);

      if (error) {
        // If we get a permission error or table doesn't exist, pg_cron might not be set up
        return {
          available: false,
          error: 'pg_cron extension not available or not properly configured'
        };
      }

      return { available: true };
    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error checking scheduler'
      };
    }
  }

  /**
   * Clean up completed one-time tasks
   */
  async cleanupCompletedTasks(): Promise<{
    success: boolean;
    deletedCount?: number;
    error?: string;
  }> {
    try {
      // Get completed one-time tasks older than 24 hours
      const { data: tasksToCleanup, error: selectError } = await this.supabase
        .from('scheduled_tasks')
        .select('id, cron_job_id')
        .eq('status', 'completed')
        .is('recurrence_rule', null)
        .lt('last_executed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (selectError) {
        return {
          success: false,
          error: selectError.message
        };
      }

      if (!tasksToCleanup || tasksToCleanup.length === 0) {
        return {
          success: true,
          deletedCount: 0
        };
      }

      // Cancel any remaining cron jobs
      for (const task of tasksToCleanup) {
        if (task.cron_job_id) {
          await this.cancelTask(task.id);
        }
      }

      // Delete the tasks
      const { error: deleteError } = await this.supabase
        .from('scheduled_tasks')
        .delete()
        .in('id', tasksToCleanup.map(t => t.id));

      if (deleteError) {
        return {
          success: false,
          error: deleteError.message
        };
      }

      return {
        success: true,
        deletedCount: tasksToCleanup.length
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown cleanup error'
      };
    }
  }
}

// Export singleton instance for client-side usage
export const taskSchedulerService = new TaskSchedulerService();

// Factory function for server-side usage with authenticated client
export function createTaskSchedulerService(supabaseClient: SupabaseClient): TaskSchedulerService {
  return new TaskSchedulerService(supabaseClient);
}
