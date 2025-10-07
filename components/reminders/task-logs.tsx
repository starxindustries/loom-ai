'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Search, 
  RefreshCw,
  Calendar,
  Timer,
  Activity
} from 'lucide-react';
import { TaskExecutionLog } from '@/types/reminder';

export function TaskLogs() {
  const [logs, setLogs] = useState<TaskExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/reminders/logs?limit=100');
      if (response.ok) {
        const result = await response.json();
        setLogs(result.data);
      }
    } catch (error) {
      console.error('Failed to load logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'skipped':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'partial':
        return <Activity className="h-4 w-4 text-orange-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'skipped':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'partial':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = searchTerm === '' || 
      (log.task as any)?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.error_message?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Task Execution Logs</CardTitle>
          <CardDescription>
            History of task executions and their results
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="skipped">Skipped</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={loadLogs}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-4">
            {filteredLogs.map((log) => (
              <Card key={log.id} className="border-l-4 border-l-transparent hover:border-l-primary/50">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {getStatusIcon(log.status)}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">
                            {(log.task as any)?.title || 'Unknown Task'}
                          </h4>
                          <Badge className={getStatusColor(log.status)}>
                            {log.status}
                          </Badge>
                          {(log.task as any)?.task_type && (
                            <Badge variant="outline">
                              {(log.task as any).task_type}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(log.executed_at)}
                          </div>
                          {log.execution_duration_ms && (
                            <div className="flex items-center gap-1">
                              <Timer className="h-3 w-3" />
                              {formatDuration(log.execution_duration_ms)}
                            </div>
                          )}
                          {log.error_code && (
                            <Badge variant="outline" className="text-xs">
                              {log.error_code}
                            </Badge>
                          )}
                        </div>

                        {log.error_message && (
                          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                            <div className="flex items-center gap-1 mb-1">
                              <AlertCircle className="h-3 w-3" />
                              <span className="font-medium">Error:</span>
                            </div>
                            <p>{log.error_message}</p>
                          </div>
                        )}

                        {log.result_data && Object.keys(log.result_data).length > 0 && (
                          <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm">
                            <div className="flex items-center gap-1 mb-1">
                              <CheckCircle className="h-3 w-3 text-green-600" />
                              <span className="font-medium text-green-700">Result:</span>
                            </div>
                            <pre className="text-xs text-green-700 whitespace-pre-wrap">
                              {JSON.stringify(log.result_data, null, 2)}
                            </pre>
                          </div>
                        )}

                        {log.integration_response && Object.keys(log.integration_response).length > 0 && (
                          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                            <div className="flex items-center gap-1 mb-1">
                              <Activity className="h-3 w-3 text-blue-600" />
                              <span className="font-medium text-blue-700">Integration Response:</span>
                            </div>
                            <pre className="text-xs text-blue-700 whitespace-pre-wrap">
                              {JSON.stringify(log.integration_response, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredLogs.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No logs found</h3>
                  <p className="text-muted-foreground text-center">
                    {searchTerm || statusFilter !== 'all' 
                      ? 'No logs match your current filters.'
                      : 'Task execution logs will appear here once tasks start running.'
                    }
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

