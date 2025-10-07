'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import {
  Plus,
  Trash2,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Key,
  Link as LinkIcon,
  Mail,
  Calendar,
  MessageSquare,
  Database,
  FileText,
  Webhook
} from 'lucide-react';
import { IntegrationProvider, UserIntegration } from '@/types/reminder';
import { toast } from 'sonner';
import { toastService } from '@/lib/toast-service';
import Image from 'next/image';

export function IntegrationsSection() {
  const [providers, setProviders] = useState<IntegrationProvider[]>([]);
  const [userIntegrations, setUserIntegrations] = useState<UserIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<IntegrationProvider | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [connectionName, setConnectionName] = useState('');
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    loadData();

    // Check for success/error messages from OAuth 2.0 callback
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const error = urlParams.get('error');

    if (success) {
      toast.success(success, {
        description: 'Your integration is now active and ready to use',
        duration: 5000
      });
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
      // Reload data to show the new connection with a small delay
      setTimeout(() => {
        console.log('Reloading data after successful OAuth...');
        loadData();
      }, 1000);
    }

    if (error) {
      toast.error('OAuth Connection Failed', {
        description: error,
        duration: 8000
      });
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [providersRes, integrationsRes] = await Promise.all([
        fetch('/api/integrations?type=providers'),
        fetch('/api/integrations')
      ]);

      if (providersRes.ok) {
        const providersResult = await providersRes.json();
        // console.log('Providers loaded:', providersResult);
        setProviders(providersResult.data || []);
      } else {
        console.error('Failed to load providers:', await providersRes.text());
      }

      if (integrationsRes.ok) {
        const integrationsResult = await integrationsRes.json();
        // console.log('User integrations loaded:', integrationsResult);
        setUserIntegrations(integrationsResult.data || []);
      } else {
        console.error('Failed to load user integrations:', await integrationsRes.text());
      }
    } catch (error) {
      console.error('Failed to load integrations:', error);
      toast.error('Failed to load integrations');
    } finally {
      setLoading(false);
    }
  };

  const getProviderIcon = (slug: string) => {
    switch (slug) {
      case 'gmail':
        return <Mail className="h-5 w-5" />;
      case 'google_calendar':
        return <Calendar className="h-5 w-5" />;
      case 'slack':
        return <MessageSquare className="h-5 w-5" />;
      case 'airtable':
        return <Database className="h-5 w-5" />;
      case 'notion':
        return <FileText className="h-5 w-5" />;
      case 'webhook':
        return <Webhook className="h-5 w-5" />;
      default:
        return <LinkIcon className="h-5 w-5" />;
    }
  };

  const isProviderConnected = (providerId: string) => {
    const isConnected = userIntegrations.some(integration =>
      integration.provider_id === providerId && integration.is_active
    );
    return isConnected;
  };

  const getUserIntegration = (providerId: string) => {
    return userIntegrations.find(integration =>
      integration.provider_id === providerId && integration.is_active
    );
  };

  const handleOAuthConnect = (provider: IntegrationProvider) => {
    // Show loading toast for OAuth 2.0 flow
    toast.loading(`Connecting to ${provider.name}...`, {
      description: 'You will be redirected to authorize the connection',
      duration: 3000
    });

    // Small delay to show the toast before redirect
    setTimeout(() => {
      // Redirect to OAuth 2.0 flow
      window.location.href = `/api/auth/oauth/${provider.slug}`;
    }, 500);
  };

  const handleApiKeyConnect = async () => {
    if (!selectedProvider || !apiKey.trim() || !connectionName.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setConnecting(true);
    try {
      const response = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_slug: selectedProvider.slug,
          connection_name: connectionName,
          api_key: apiKey
        })
      });

      if (response.ok) {
        toastService.showIntegrationConnected(selectedProvider.name);
        setShowAddDialog(false);
        setSelectedProvider(null);
        setApiKey('');
        setConnectionName('');
        await loadData();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to connect integration');
      }
    } catch (error) {
      console.error('Failed to connect integration:', error);
      toast.error('Failed to connect integration');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async (integrationId: string, providerName: string) => {
    try {
      const response = await fetch(`/api/integrations/${integrationId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success(`${providerName} disconnected successfully`);
        await loadData();
      } else {
        toast.error('Failed to disconnect integration');
      }
    } catch (error) {
      console.error('Failed to disconnect integration:', error);
      toast.error('Failed to disconnect integration');
    }
  };

  const openAddDialog = (provider: IntegrationProvider) => {
    setSelectedProvider(provider);
    setConnectionName(`My ${provider.name}`);
    setShowAddDialog(true);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  const oauthProviders = providers.filter(p => p.auth_type === 'oauth2');
  const apiKeyProviders = providers.filter(p => p.auth_type === 'api_key');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integrations</CardTitle>
        <CardDescription>
          Connect third-party services to enable automated tasks and reminders
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="oauth" className="space-y-6">
          <TabsList>
            <TabsTrigger value="oauth">OAuth Apps</TabsTrigger>
            <TabsTrigger value="apikey">API Keys</TabsTrigger>
            <TabsTrigger value="connected">Connected ({userIntegrations.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="oauth" className="space-y-4">
            <div className="grid gap-4">
              {oauthProviders.map((provider) => {
                const isConnected = isProviderConnected(provider.id);
                const integration = getUserIntegration(provider.id);

                return (
                  <div key={provider.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Image src={provider.logo_url || ''} alt={provider.name} width={40} height={40} />
                      <div>
                        <h3 className="font-medium">{provider.name}</h3>
                        <p className="text-sm text-muted-foreground">{provider.description}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {provider.supported_actions.map((action) => (
                            <Badge key={action} variant="outline" className="text-xs">
                              {action.replace('_', ' ')}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isConnected ? (
                        <>
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                            <CheckCircle className="h-3 w-3 mr-1 hover:bg-green-100" />
                            Connected
                          </Badge>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                Disconnect
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Disconnect {provider.name}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will remove access to {provider.name} and may affect existing automated tasks.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => integration && handleDisconnect(integration.id, provider.name)}
                                >
                                  Disconnect
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      ) : (
                        <Button onClick={() => handleOAuthConnect(provider)}>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Connect
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="apikey" className="space-y-4">
            <div className="grid gap-4">
              {apiKeyProviders.map((provider) => {
                const isConnected = isProviderConnected(provider.id);
                const integration = getUserIntegration(provider.id);

                return (
                  <div key={provider.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Image src={provider.logo_url || ''} alt={provider.name} width={40} height={40} />
                      <div>
                        <h3 className="font-medium">{provider.name}</h3>
                        <p className="text-sm text-muted-foreground">{provider.description}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {provider.supported_actions.map((action) => (
                            <Badge key={action} variant="outline" className="text-xs">
                              {action.replace('_', ' ')}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isConnected ? (
                        <>
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Connected
                          </Badge>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                Disconnect
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Disconnect {provider.name}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will remove access to {provider.name} and may affect existing automated tasks.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => integration && handleDisconnect(integration.id, provider.name)}
                                >
                                  Disconnect
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      ) : (
                        <Button onClick={() => openAddDialog(provider)}>
                          <Key className="h-4 w-4 mr-2" />
                          Add API Key
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="connected" className="space-y-4">
            {userIntegrations.length === 0 ? (
              <div className="text-center py-12">
                <LinkIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No integrations connected</h3>
                <p className="text-muted-foreground mb-4">
                  Connect your first integration to start automating tasks
                </p>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Integration
                </Button>
              </div>
            ) : (
              <div className="grid gap-4">
                {userIntegrations.map((integration) => {
                  const provider = providers.find(p => p.id === integration.provider_id);
                  if (!provider) return null;

                  return (
                    <div key={integration.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Image src={provider.logo_url || ''} alt={provider.name} width={40} height={40} />
                        <div>
                          <h3 className="font-medium">{integration.connection_name || provider.name}</h3>
                          <p className="text-sm text-muted-foreground">{provider.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {provider.auth_type === 'oauth2' ? 'OAuth' : 'API Key'}
                            </Badge>
                            {integration.last_used_at && (
                              <span className="text-xs text-muted-foreground">
                                Last used: {new Date(integration.last_used_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {integration.is_active ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Inactive
                          </Badge>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove Integration?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently remove "{integration.connection_name || provider.name}" and may affect existing automated tasks.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDisconnect(integration.id, provider.name)}
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Add API Key Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect {selectedProvider?.name}</DialogTitle>
              <DialogDescription>
                Enter your API key to connect {selectedProvider?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="connection_name">Connection Name</Label>
                <Input
                  id="connection_name"
                  value={connectionName}
                  onChange={(e) => setConnectionName(e.target.value)}
                  placeholder="e.g., My Airtable"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="api_key">API Key</Label>
                <Input
                  id="api_key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your API key"
                />
              </div>
              {selectedProvider?.documentation_url && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-sm text-blue-700">
                    Need help finding your API key?{' '}
                    <a
                      href={selectedProvider.documentation_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      View documentation
                    </a>
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleApiKeyConnect}
                disabled={connecting || !apiKey.trim() || !connectionName.trim()}
              >
                {connecting ? 'Connecting...' : 'Connect'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
