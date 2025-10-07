'use client';

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Info, X, Plus } from 'lucide-react';
import { ActionFieldDefinition, DynamicActionConfig } from '@/types/reminder';

interface DynamicActionConfigProps {
  providerSlug: string;
  actionType: string;
  config: DynamicActionConfig;
  onChange: (config: DynamicActionConfig) => void;
  errors?: Record<string, string>;
}

export function DynamicActionConfig({
  providerSlug,
  actionType,
  config,
  onChange,
  errors = {}
}: DynamicActionConfigProps) {
  const [fieldDefinitions, setFieldDefinitions] = useState<ActionFieldDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (providerSlug && actionType) {
      loadFieldDefinitions();
    }
  }, [providerSlug, actionType]);

  const loadFieldDefinitions = async () => {
    setLoading(true);
    setLoadError(null);
    
    try {
      const response = await fetch(
        `/api/actions/fields?provider=${providerSlug}&action=${actionType}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to load field definitions');
      }
      
      const result = await response.json();
      setFieldDefinitions(result.data || []);
    } catch (error) {
      console.error('Error loading field definitions:', error);
      setLoadError(error instanceof Error ? error.message : 'Failed to load configuration fields');
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (fieldKey: string, value: any) => {
    const newConfig = { ...config, [fieldKey]: value };
    onChange(newConfig);
  };

  const handleMultiSelectChange = (fieldKey: string, value: string, checked: boolean) => {
    const currentValues = config[fieldKey] || [];
    let newValues;
    
    if (checked) {
      newValues = [...currentValues, value];
    } else {
      newValues = currentValues.filter((v: string) => v !== value);
    }
    
    handleFieldChange(fieldKey, newValues);
  };

  const renderField = (field: ActionFieldDefinition) => {
    const value = config[field.field_key];
    const hasError = errors[field.field_key];
    const fieldId = `field-${field.field_key}`;

    const baseProps = {
      id: fieldId,
      placeholder: field.placeholder || undefined,
    };

    switch (field.field_type) {
      case 'text':
      case 'email':
      case 'url':
      case 'password':
        return (
          <Input
            {...baseProps}
            type={field.field_type === 'password' ? 'password' : field.field_type === 'email' ? 'email' : 'text'}
            value={value || ''}
            onChange={(e) => handleFieldChange(field.field_key, e.target.value)}
            className={hasError ? 'border-destructive' : ''}
          />
        );

      case 'number':
        return (
          <Input
            {...baseProps}
            type="number"
            value={value || ''}
            onChange={(e) => handleFieldChange(field.field_key, e.target.value ? Number(e.target.value) : '')}
            className={hasError ? 'border-destructive' : ''}
          />
        );

      case 'textarea':
        return (
          <Textarea
            {...baseProps}
            value={value || ''}
            onChange={(e) => handleFieldChange(field.field_key, e.target.value)}
            rows={4}
            className={hasError ? 'border-destructive' : ''}
          />
        );

      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <Switch
              id={fieldId}
              checked={Boolean(value)}
              onCheckedChange={(checked) => handleFieldChange(field.field_key, checked)}
            />
            <Label htmlFor={fieldId} className="text-sm font-normal">
              {field.field_description || 'Enable this option'}
            </Label>
          </div>
        );

      case 'select':
        return (
          <Select
            value={value || ''}
            onValueChange={(newValue) => handleFieldChange(field.field_key, newValue)}
          >
            <SelectTrigger className={hasError ? 'border-destructive' : ''}>
              <SelectValue placeholder={field.placeholder || `Select ${field.field_label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {field.field_options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'multiselect':
        const selectedValues = value || [];
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {selectedValues.map((selectedValue: string) => (
                <Badge key={selectedValue} variant="secondary" className="flex items-center gap-1">
                  {selectedValue}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => handleMultiSelectChange(field.field_key, selectedValue, false)}
                  />
                </Badge>
              ))}
            </div>
            <Select
              onValueChange={(newValue) => {
                if (!selectedValues.includes(newValue)) {
                  handleMultiSelectChange(field.field_key, newValue, true);
                }
              }}
            >
              <SelectTrigger className={hasError ? 'border-destructive' : ''}>
                <SelectValue placeholder={`Add ${field.field_label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {field.field_options
                  .filter(option => !selectedValues.includes(option))
                  .map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'json':
        return (
          <div className="space-y-2">
            <Textarea
              {...baseProps}
              value={typeof value === 'string' ? value : JSON.stringify(value || {}, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  handleFieldChange(field.field_key, parsed);
                } catch {
                  // Keep as string if invalid JSON
                  handleFieldChange(field.field_key, e.target.value);
                }
              }}
              rows={6}
              className={`font-mono text-sm ${hasError ? 'border-destructive' : ''}`}
            />
            <p className="text-xs text-muted-foreground">
              Enter valid JSON format
            </p>
          </div>
        );

      default:
        return (
          <Input
            {...baseProps}
            value={value || ''}
            onChange={(e) => handleFieldChange(field.field_key, e.target.value)}
            className={hasError ? 'border-destructive' : ''}
          />
        );
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Loading configuration fields...</span>
        </CardContent>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Alert variant="destructive">
        <Info className="h-4 w-4" />
        <AlertDescription>
          {loadError}
          <Button 
            variant="outline" 
            size="sm" 
            className="ml-2" 
            onClick={loadFieldDefinitions}
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (fieldDefinitions.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No configuration fields defined for this action.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Action Configuration</CardTitle>
        <CardDescription>
          Configure the parameters for this action. Required fields are marked with an asterisk (*).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {fieldDefinitions.map((field) => (
          <div key={field.field_key} className="space-y-2">
            <Label htmlFor={`field-${field.field_key}`} className="text-sm font-medium">
              {field.field_label}
              {field.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
            
            {renderField(field)}
            
            {field.field_description && field.field_type !== 'boolean' && (
              <p className="text-xs text-muted-foreground">
                {field.field_description}
              </p>
            )}
            
            {errors[field.field_key] && (
              <p className="text-xs text-destructive">
                {errors[field.field_key]}
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// Preview component to show the current configuration
interface ActionConfigPreviewProps {
  config: DynamicActionConfig;
  fieldDefinitions: ActionFieldDefinition[];
}

export function ActionConfigPreview({ config, fieldDefinitions }: ActionConfigPreviewProps) {
  if (Object.keys(config).length === 0) {
    return null;
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-sm">Configuration Preview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {Object.entries(config).map(([key, value]) => {
            const field = fieldDefinitions.find(f => f.field_key === key);
            const label = field?.field_label || key;
            
            if (value === undefined || value === null || value === '') {
              return null;
            }

            return (
              <div key={key} className="flex justify-between items-start text-sm">
                <span className="font-medium text-muted-foreground">{label}:</span>
                <span className="text-right max-w-[200px] truncate">
                  {field?.is_sensitive ? '••••••••' : 
                   typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
