import { toast } from 'sonner';
import { ToastNotification } from '../types/reminder';

export class ToastService {
  /**
   * Show a toast notification
   */
  show(notification: ToastNotification): void {
    const { type, title, message, action, duration = 5000 } = notification;

    const toastOptions = {
      duration,
      action: action ? {
        label: action.label,
        onClick: () => {
          if (action.url.startsWith('http')) {
            window.open(action.url, '_blank');
          } else {
            window.location.href = action.url;
          }
        }
      } : undefined
    };

    switch (type) {
      case 'success':
        toast.success(title, {
          description: message,
          ...toastOptions
        });
        break;
      case 'error':
        toast.error(title, {
          description: message,
          ...toastOptions
        });
        break;
      case 'warning':
        toast.warning(title, {
          description: message,
          ...toastOptions
        });
        break;
      case 'info':
      default:
        toast.info(title, {
          description: message,
          ...toastOptions
        });
        break;
    }
  }

  /**
   * Show missing integration toast
   */
  showMissingIntegration(providerName: string, providerSlug: string): void {
    const authTypeMessages: Record<string, string> = {
      gmail: 'Please connect your Gmail account in Settings → Integrations to send emails.',
      google_calendar: 'Please connect your Google Calendar in Settings → Integrations to create events.',
      airtable: 'Please add your Airtable API key in Settings → Integrations to manage records.',
      notion: 'Please connect your Notion account in Settings → Integrations to create pages.',
      slack: 'Please connect your Slack workspace in Settings → Integrations to send messages.',
      webhook: 'Please configure your webhook URL in Settings → Integrations to send requests.'
    };

    const message = authTypeMessages[providerSlug] || 
      `Please connect your ${providerName} account in Settings → Integrations before I can perform actions with ${providerName}.`;

    this.show({
      type: 'warning',
      title: 'Integration Required',
      message,
      action: {
        label: 'Go to Settings',
        url: '/protected/settings?tab=integrations'
      },
      duration: 8000
    });
  }

  /**
   * Show task creation success toast
   */
  showTaskCreated(taskTitle: string, taskType: 'reminder' | 'action' | 'recurring'): void {
    const typeLabels = {
      reminder: 'Reminder',
      action: 'Task',
      recurring: 'Recurring Task'
    };

    this.show({
      type: 'success',
      title: `${typeLabels[taskType]} Created`,
      message: `"${taskTitle}" has been scheduled successfully.`,
      action: {
        label: 'View Tasks',
        url: '/protected/remainder'
      }
    });
  }

  /**
   * Show task execution result toast
   */
  showTaskResult(taskTitle: string, success: boolean, error?: string): void {
    if (success) {
      this.show({
        type: 'success',
        title: 'Task Completed',
        message: `"${taskTitle}" executed successfully.`
      });
    } else {
      this.show({
        type: 'error',
        title: 'Task Failed',
        message: error || `"${taskTitle}" failed to execute.`,
        action: {
          label: 'View Logs',
          url: '/protected/remainder?tab=logs'
        }
      });
    }
  }

  /**
   * Show integration connection success toast
   */
  showIntegrationConnected(providerName: string): void {
    this.show({
      type: 'success',
      title: 'Integration Connected',
      message: `${providerName} has been connected successfully. You can now create automated tasks.`,
      action: {
        label: 'Create Task',
        url: '/protected/remainder?action=create'
      }
    });
  }

  /**
   * Show integration error toast
   */
  showIntegrationError(providerName: string, error: string): void {
    this.show({
      type: 'error',
      title: 'Integration Error',
      message: `Failed to connect ${providerName}: ${error}`,
      action: {
        label: 'Try Again',
        url: '/protected/settings?tab=integrations'
      },
      duration: 10000
    });
  }

  /**
   * Show validation error toast
   */
  showValidationError(message: string): void {
    this.show({
      type: 'error',
      title: 'Validation Error',
      message,
      duration: 6000
    });
  }

  /**
   * Show upcoming reminder toast
   */
  showUpcomingReminder(title: string, timeUntil: string): void {
    this.show({
      type: 'info',
      title: 'Upcoming Reminder',
      message: `"${title}" is scheduled in ${timeUntil}.`,
      action: {
        label: 'View Details',
        url: '/protected/remainder'
      },
      duration: 7000
    });
  }

  /**
   * Show task status change toast
   */
  showTaskStatusChange(taskTitle: string, status: string): void {
    const statusMessages = {
      paused: 'has been paused',
      active: 'has been resumed',
      cancelled: 'has been cancelled',
      completed: 'has been completed'
    };

    const message = statusMessages[status as keyof typeof statusMessages] || `status changed to ${status}`;

    this.show({
      type: 'info',
      title: 'Task Updated',
      message: `"${taskTitle}" ${message}.`
    });
  }
}

// Export singleton instance
export const toastService = new ToastService();

