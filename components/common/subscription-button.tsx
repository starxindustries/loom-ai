'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface SubscriptionButtonProps {
  planSlug: string;
  planName: string;
  price: number;
  variant?: 'default' | 'outline' | 'destructive' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  children?: React.ReactNode;
  showIcon?: boolean;
  disabled?: boolean;
}

export function SubscriptionButton({
  planSlug,
  price,
  variant = 'default',
  size = 'default',
  className = '',
  children,
  showIcon = false,
  disabled = false
}: SubscriptionButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubscribe = async () => {
    if (disabled || isLoading) return;

    try {
      setIsLoading(true);

      // Check if user is authenticated
      const authResponse = await fetch('/api/auth/me');
      if (!authResponse.ok) {
        // User not authenticated, redirect to login with return URL
        const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
        router.push(`/auth/login?returnUrl=${returnUrl}`);
        return;
      }

      // Create checkout session
      const response = await fetch('/api/subscriptions/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planSlug, // Use planSlug instead of planId for landing page
          successUrl: `${window.location.origin}/protected/billing?success=true&plan=${planSlug}`,
          cancelUrl: `${window.location.origin}/?cancelled=true&plan=${planSlug}`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create checkout session');
      }

      const { checkoutUrl } = await response.json();
      
      // Redirect to LemonSqueezy checkout
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error('Subscription error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to start subscription process';
      
      toast.error('Subscription Error', {
        description: errorMessage,
        action: {
          label: 'Try Again',
          onClick: () => handleSubscribe(),
        },
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getButtonText = () => {
    if (isLoading) return 'Processing...';
    if (price === 0) return 'Get Started Free';
    return `Subscribe - $${price}/month`;
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={`${className} ${isLoading ? 'opacity-75' : ''}`}
      onClick={handleSubscribe}
      disabled={disabled || isLoading}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Processing...
        </>
      ) : (
        <>
          {showIcon && <Zap className="mr-2 h-4 w-4" />}
          {children || getButtonText()}
        </>
      )}
    </Button>
  );
}
