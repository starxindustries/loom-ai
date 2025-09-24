'use client';

import { useState, useEffect } from 'react';
import { UpgradePrompt } from '@/types/subscription';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { 
  AlertTriangle, 
  Zap, 
  Check, 
  ExternalLink,
} from 'lucide-react';

interface UpgradePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  upgradePrompt: UpgradePrompt | null;
  onUpgrade: (planId: string) => void;
}

export function UpgradePromptModal({ 
  isOpen, 
  onClose, 
  upgradePrompt, 
  onUpgrade 
}: UpgradePromptModalProps) {
  const [isUpgrading, setIsUpgrading] = useState<string | null>(null);

  const handleUpgrade = async (planId: string) => {
    try {
      setIsUpgrading(planId);
      await onUpgrade(planId);
    } catch (error) {
      console.error('Upgrade error:', error);
    } finally {
      setIsUpgrading(null);
    }
  };

  if (!upgradePrompt) return null;

  const getResourceIcon = (resourceType: string) => {
    switch (resourceType) {
      case 'memory':
        return '🧠';
      case 'file':
        return '📁';
      default:
        return '📊';
    }
  };

  const getResourceName = (resourceType: string) => {
    switch (resourceType) {
      case 'memory':
        return 'Memory Records';
      case 'file':
        return 'File Records';
      default:
        return 'Resources';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-full">
              <AlertTriangle className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">
                {upgradePrompt.title}
              </DialogTitle>
              <DialogDescription className="text-base">
                You&apos;ve reached your usage limit for {getResourceName(upgradePrompt.resourceType)}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {upgradePrompt.message}
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{getResourceIcon(upgradePrompt.resourceType)}</span>
                <span className="font-medium">{getResourceName(upgradePrompt.resourceType)}</span>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Current Usage</div>
                <div className="font-bold text-lg">
                  {upgradePrompt.currentUsage.toLocaleString()} / {upgradePrompt.limit.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min((upgradePrompt.currentUsage / upgradePrompt.limit) * 100, 100)}%` }}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Upgrade to Continue</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {upgradePrompt.suggestedPlans.map((plan) => (
                <Card key={plan.id} className="relative hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                      <Badge variant="outline">
                        ${plan.priceMonthly}/month
                      </Badge>
                    </div>
                    <CardDescription>
                      Perfect for {plan.name.toLowerCase()} users
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-600" />
                        <span>
                          {plan.memoryLimit === -1 ? 'Unlimited' : plan.memoryLimit.toLocaleString()} memory records
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-600" />
                        <span>
                          {plan.fileLimit === -1 ? 'Unlimited' : plan.fileLimit.toLocaleString()} file records
                        </span>
                      </div>
                    </div>

                    <Button
                      className="w-full"
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={isUpgrading === plan.id}
                    >
                      {isUpgrading === plan.id ? (
                        <>
                          <Zap className="h-4 w-4 animate-spin mr-2" />
                          Upgrading...
                        </>
                      ) : (
                        <>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Upgrade to {plan.name}
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Maybe Later
            </Button>
            <div className="text-sm text-muted-foreground">
              You can upgrade anytime from your billing page
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Hook for managing upgrade prompts
export function useUpgradePrompt() {
  const [upgradePrompt, setUpgradePrompt] = useState<UpgradePrompt | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleUsageLimitExceeded = (event: CustomEvent) => {
      setUpgradePrompt(event.detail);
      setIsOpen(true);
    };

    const onUsageLimitExceeded = (event: Event) => {
      handleUsageLimitExceeded(event as CustomEvent);
    };

    window.addEventListener('usage-limit-exceeded', onUsageLimitExceeded);

    return () => {
      window.removeEventListener('usage-limit-exceeded', onUsageLimitExceeded);
    };
  }, []);

  const closeModal = () => {
    setIsOpen(false);
    setUpgradePrompt(null);
  };

  const handleUpgrade = async (planId: string) => {
    try {
      // Redirect to billing page with the specific plan selected
      window.location.href = `/protected/billing?upgrade=${planId}`;
    } catch (error) {
      console.error('Upgrade error:', error);
    }
  };

  return {
    upgradePrompt,
    isOpen,
    closeModal,
    handleUpgrade
  };
}
