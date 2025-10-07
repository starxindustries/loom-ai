'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Calendar, Clock, AlertCircle, CheckCircle, Pause, Play, Trash2 } from 'lucide-react';
import { ScheduledTask } from '@/types/reminder';
import { CreateReminderDialog } from './create-reminder-dialog';
import { TaskCard } from './task-card';
import { TaskStatistics } from './task-statistics';
import { TaskLogs } from './task-logs';
import { toast } from 'sonner';

interface ReminderDashboardProps {
  className?: string;
}

export function ReminderDashboard({ className }: ReminderDashboardProps) {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  useEffect(() => {
    loadTasks();
    loadUpcomingTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const response = await fetch('/api/reminders');
      if (response.ok) {
        const result = await response.json();
        setTasks(result.data);
      }
    } catch (error) {
      console.error('Failed to load tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const loadUpcomingTasks = async () => {
    try {
      const response = await fetch('/api/reminders?upcoming=true');
      if (response.ok) {
        const result = await response.json();
        setUpcomingTasks(result.data);
      }
    } catch (error) {
      console.error('Failed to load upcoming tasks:', error);
    }
  };

  const handleTaskStatusChange = async (taskId: string, status: string) => {
    try {
      const response = await fetch(`/api/reminders/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });

      if (response.ok) {
        await loadTasks();
        await loadUpcomingTasks();
        toast.success('Task status updated');
      } else {
        throw new Error('Failed to update task');
      }
    } catch (error) {
      console.error('Failed to update task:', error);
      toast.error('Failed to update task');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const response = await fetch(`/api/reminders/${taskId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadTasks();
        await loadUpcomingTasks();
        toast.success('Task deleted');
      } else {
        throw new Error('Failed to delete task');
      }
    } catch (error) {
      console.error('Failed to delete task:', error);
      toast.error('Failed to delete task');
    }
  };

  const handleTaskCreated = () => {
    loadTasks();
    loadUpcomingTasks();
    setShowCreateDialog(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'paused':
        return <Pause className="h-4 w-4 text-yellow-500" />;
      case 'active':
        return <Play className="h-4 w-4 text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'active':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Reminders & Tasks</h1>
          <p className="text-muted-foreground">
            Manage your reminders and automated tasks
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Reminder
        </Button>
      </div>

      {/* Upcoming Tasks Quick View */}
      {upcomingTasks.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Upcoming Tasks
            </CardTitle>
            <CardDescription>
              Tasks scheduled for the next 7 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingTasks.slice(0, 3).map((task) => (
                <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(task.status)}
                    <div>
                      <p className="font-medium">{task.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(task.scheduled_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Badge className={getStatusColor(task.status)}>
                    {task.status}
                  </Badge>
                </div>
              ))}
              {upcomingTasks.length > 3 && (
                <Button 
                  variant="ghost" 
                  className="w-full"
                  onClick={() => setActiveTab('all')}
                >
                  View all {upcomingTasks.length} upcoming tasks
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="all">All Tasks</TabsTrigger>
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Active Tasks */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Active Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {tasks.filter(t => t.status === 'active').slice(0, 5).map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onStatusChange={handleTaskStatusChange}
                      onDelete={handleDeleteTask}
                      compact
                    />
                  ))}
                  {tasks.filter(t => t.status === 'active').length === 0 && (
                    <p className="text-muted-foreground text-sm">No active tasks</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Pending Tasks */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pending Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {tasks.filter(t => t.status === 'pending').slice(0, 5).map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onStatusChange={handleTaskStatusChange}
                      onDelete={handleDeleteTask}
                      compact
                    />
                  ))}
                  {tasks.filter(t => t.status === 'pending').length === 0 && (
                    <p className="text-muted-foreground text-sm">No pending tasks</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {tasks
                    .filter(t => t.status === 'completed' || t.status === 'failed')
                    .slice(0, 5)
                    .map((task) => (
                      <div key={task.id} className="flex items-center gap-2 text-sm">
                        {getStatusIcon(task.status)}
                        <span className="truncate">{task.title}</span>
                      </div>
                    ))}
                  {tasks.filter(t => t.status === 'completed' || t.status === 'failed').length === 0 && (
                    <p className="text-muted-foreground text-sm">No recent activity</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">All Tasks</h2>
            <div className="flex gap-2">
              <Badge variant="outline">
                {tasks.length} total
              </Badge>
            </div>
          </div>
          <div className="grid gap-4">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onStatusChange={handleTaskStatusChange}
                onDelete={handleDeleteTask}
              />
            ))}
            {tasks.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No tasks yet</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Create your first reminder or automated task to get started.
                  </p>
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Reminder
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="statistics">
          <TaskStatistics />
        </TabsContent>

        <TabsContent value="logs">
          <TaskLogs />
        </TabsContent>
      </Tabs>

      <CreateReminderDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onTaskCreated={handleTaskCreated}
      />
    </div>
  );
}

