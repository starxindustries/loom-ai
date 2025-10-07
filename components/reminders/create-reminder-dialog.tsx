'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, Repeat, Zap, Bell, Plus, X } from 'lucide-react';
import { CreateReminderRequest, ReminderTemplate, IntegrationProvider, DynamicActionConfig } from '@/types/reminder';
import { toast } from 'sonner';
import { toastService } from '@/lib/toast-service';
import { DynamicActionConfig as DynamicActionConfigComponent } from './dynamic-action-config';

interface CreateReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated: () => void;
}

export function CreateReminderDialog({ open, onOpenChange, onTaskCreated }: CreateReminderDialogProps) {
  const [activeTab, setActiveTab] = useState('basic');
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<ReminderTemplate[]>([]);
  const [providers, setProviders] = useState<IntegrationProvider[]>([]);
  const [availableActions, setAvailableActions] = useState<string[]>([]);
  const [actionConfig, setActionConfig] = useState<DynamicActionConfig>({});
  const [configErrors, setConfigErrors] = useState<Record<string, string>>({});
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  const [formData, setFormData] = useState<CreateReminderRequest>({
    title: '',
    description: '',
    scheduled_at: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    task_type: 'reminder',
    priority: 'medium',
    tags: []
  });

  useEffect(() => {
    if (open) {
      loadTemplates();
      loadProviders();
    }
  }, [open]);

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/reminders/templates');
      if (response.ok) {
        const result = await response.json();
        setTemplates(result.data);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const loadProviders = async () => {
    try {
      const response = await fetch('/api/integrations?type=providers');
      if (response.ok) {
        const result = await response.json();
        setProviders(result.data);
      }
    } catch (error) {
      console.error('Failed to load providers:', error);
    }
  };

  const loadAvailableActions = async (integrationSlug: string) => {
    try {
      const selectedProvider = providers.find(p => p.slug === integrationSlug);
      if (selectedProvider && selectedProvider.supported_actions) {
        setAvailableActions(selectedProvider.supported_actions);
        // Reset action_type and config when integration changes
        setFormData(prev => ({ ...prev, action_type: undefined }));
        setActionConfig({});
        setConfigErrors({});
      } else {
        setAvailableActions([]);
      }
    } catch (error) {
      console.error('Failed to load actions:', error);
      setAvailableActions([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const requestData = {
        ...formData,
        tags: tags,
        action_config: actionConfig
      };

      const response = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      const result = await response.json();

      if (response.ok) {
        toastService.showTaskCreated(formData.title, formData.task_type);
        onTaskCreated();
        resetForm();
      } else {
        if (result.toast) {
          toastService.show(result.toast);
        } else {
          toast.error(result.error || 'Failed to create reminder');
        }
      }
    } catch (error) {
      console.error('Failed to create reminder:', error);
      toast.error('Failed to create reminder');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      scheduled_at: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      task_type: 'reminder',
      priority: 'medium',
      tags: []
    });
    setTags([]);
    setNewTag('');
    setAvailableActions([]);
    setActionConfig({});
    setConfigErrors({});
    setActiveTab('basic');
  };

  const handleTemplateSelect = (template: ReminderTemplate) => {
    setFormData(prev => ({
      ...prev,
      title: template.title_template,
      description: template.description_template || '',
      action_type: template.default_action_type || 'notification',
      action_config: template.default_action_config
    }));
    setActiveTab('basic');
  };

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5); // Minimum 5 minutes from now
    return now.toISOString().slice(0, 16);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Reminder</DialogTitle>
          <DialogDescription>
            Set up a new reminder or automated task
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="space-y-4">
            <div className="grid gap-3">
              {templates.map((template) => (
                <Card 
                  key={template.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleTemplateSelect(template)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      {template.category && (
                        <Badge variant="outline">{template.category}</Badge>
                      )}
                    </div>
                    {template.description && (
                      <CardDescription className="text-sm">
                        {template.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm font-medium">{template.title_template}</p>
                    {template.description_template && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {template.description_template}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
              {templates.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No templates available
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="basic" className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter reminder title"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="scheduled_at">Scheduled Time *</Label>
                  <Input
                    id="scheduled_at"
                    type="datetime-local"
                    value={formData.scheduled_at}
                    onChange={(e) => setFormData(prev => ({ ...prev, scheduled_at: e.target.value }))}
                    min={getMinDateTime()}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="task_type">Type</Label>
                  <Select
                    value={formData.task_type}
                    onValueChange={(value: any) => setFormData(prev => ({ ...prev, task_type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reminder">
                        <div className="flex items-center gap-2">
                          <Bell className="h-4 w-4" />
                          Reminder
                        </div>
                      </SelectItem>
                      <SelectItem value="action">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4" />
                          Action
                        </div>
                      </SelectItem>
                      <SelectItem value="recurring">
                        <div className="flex items-center gap-2">
                          <Repeat className="h-4 w-4" />
                          Recurring
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value: any) => setFormData(prev => ({ ...prev, priority: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                      {tag}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => removeTag(tag)}
                      />
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Add tag"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  />
                  <Button type="button" variant="outline" onClick={addTag}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4">
            <div className="space-y-4">
              {formData.task_type === 'recurring' && (
                <div className="space-y-2">
                  <Label htmlFor="recurrence_rule">Recurrence Rule (RRULE)</Label>
                  <Input
                    id="recurrence_rule"
                    value={formData.recurrence_rule || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, recurrence_rule: e.target.value }))}
                    placeholder="e.g., FREQ=DAILY;INTERVAL=1"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use RRULE format for recurring tasks
                  </p>
                </div>
              )}

              {(formData.task_type === 'action' || formData.task_type === 'recurring') && (
                <div className="space-y-2">
                  <Label htmlFor="integration_slug">Integration</Label>
                  <Select
                    value={formData.integration_slug}
                    onValueChange={(value) => {
                      setFormData(prev => ({ ...prev, integration_slug: value }));
                      if (value) {
                        loadAvailableActions(value);
                      } else {
                        setAvailableActions([]);
                        setFormData(prev => ({ ...prev, action_type: undefined }));
                        setActionConfig({});
                        setConfigErrors({});
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select integration" />
                    </SelectTrigger>
                    <SelectContent>
                      {providers.length === 0 ? (
                        <SelectItem value="" disabled>
                          No integrations available
                        </SelectItem>
                      ) : (
                        providers.map((provider) => (
                          <SelectItem key={provider.id} value={provider.slug}>
                            {provider.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {providers.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No integrations configured yet
                    </p>
                  )}
                </div>
              )}

              {formData.integration_slug && availableActions.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="action_type">Action</Label>
                  <Select
                    value={formData.action_type}
                    onValueChange={(value) => {
                      setFormData(prev => ({ ...prev, action_type: value }));
                      // Reset config when action type changes
                      setActionConfig({});
                      setConfigErrors({});
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select action to perform" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableActions.map((action) => (
                        <SelectItem key={action} value={action}>
                          <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4" />
                            {action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Choose what action to perform when this reminder triggers
                  </p>
                </div>
              )}

              {formData.integration_slug && formData.action_type && (
                <DynamicActionConfigComponent
                  providerSlug={formData.integration_slug}
                  actionType={formData.action_type}
                  config={actionConfig}
                  onChange={setActionConfig}
                  errors={configErrors}
                />
              )}

              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  value={formData.timezone}
                  onChange={(e) => setFormData(prev => ({ ...prev, timezone: e.target.value }))}
                  placeholder="UTC"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || !formData.title || !formData.scheduled_at}
          >
            {loading ? 'Creating...' : 'Create Reminder'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
