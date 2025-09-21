# Usage Enforcement Middleware

This document explains how to use the usage enforcement middleware to implement subscription-based usage limits for memory and file operations.

## Overview

The usage enforcement middleware provides several layers of protection:

1. **API Route Middleware** - Automatically checks limits and increments usage for API endpoints
2. **Server-side Functions** - Wraps server actions with usage limit checking
3. **Client-side Utilities** - Provides client-side checking for immediate UI feedback
4. **React Components** - Ready-to-use components with built-in usage enforcement

## API Route Integration

### Memory Operations

For memory-related API routes, use the `withMemoryLimitCheck` wrapper:

```typescript
// app/api/memories/route.ts
import { usageLimitMiddleware } from '@/lib/usage-limit-middleware';

export const POST = usageLimitMiddleware.withMemoryLimitCheck(
  async (request: NextRequest, userId: string): Promise<NextResponse> => {
    // Your memory creation logic here
    // Usage limits are automatically checked before this runs
    // Usage is automatically incremented after successful response
  }
);
```

### File Operations

For file-related API routes, use the `withFileLimitCheck` wrapper:

```typescript
// app/api/files/route.ts
import { usageLimitMiddleware } from '@/lib/usage-limit-middleware';

export const POST = usageLimitMiddleware.withFileLimitCheck(
  async (request: NextRequest, userId: string): Promise<NextResponse> => {
    // Your file upload logic here
    // Usage limits are automatically checked before this runs
    // Usage is automatically incremented after successful response
  }
);
```

### Batch Operations

For batch operations that might add multiple items, use manual checking:

```typescript
export async function PUT(request: NextRequest): Promise<NextResponse> {
  const userId = await usageLimitMiddleware.getUserIdFromRequest(request);
  const { items } = await request.json();
  
  // Check if adding all items would exceed limit
  const currentUsage = await usageTrackingService.getCurrentUsage(userId);
  const wouldExceedLimit = (currentUsage.memoryCount + items.length) > currentUsage.memoryLimit;

  if (wouldExceedLimit) {
    const upgradePrompt = await usageTrackingService.getUpgradePrompt(userId, 'memory');
    return usageLimitMiddleware.createUsageLimitResponse(upgradePrompt);
  }

  // Process items...
  
  // Increment usage for each item
  for (let i = 0; i < items.length; i++) {
    await usageLimitMiddleware.incrementUsageAfterOperation(userId, 'memory');
  }
}
```

## Server-side Function Integration

### Simple Operations

Use the `withUsageEnforcement` wrapper for server actions:

```typescript
import { withUsageEnforcement } from '@/lib/usage-limit-middleware';

export const createMemoryWithLimits = withUsageEnforcement(
  'memory',
  async (userId: string, content: string) => {
    return await addMemory(userId, content);
  }
);

// Usage
const result = await createMemoryWithLimits(userId, content);
if (!result.success && result.upgradePrompt) {
  // Handle upgrade prompt
}
```

### Complex Operations

Use the `enforceUsageLimit` function for more complex scenarios:

```typescript
import { enforceUsageLimit } from '@/lib/usage-limit-middleware';

export async function complexOperation(userId: string, data: any) {
  return enforceUsageLimit(userId, 'memory', async () => {
    // Your complex operation logic here
    // This will only run if user is within limits
    // Usage will be incremented after successful completion
    return await performComplexOperation(data);
  });
}
```

## Client-side Integration

### Pre-flight Checking

Check usage limits before making API calls:

```typescript
import { UsageLimitUtils } from '@/lib/usage-limit-middleware';

async function createMemory(content: string) {
  // Check limit before API call
  const limitCheck = await UsageLimitUtils.checkClientUsageLimit('memory');
  
  if (!limitCheck.allowed && limitCheck.upgradePrompt) {
    // Show upgrade prompt
    showUpgradeModal(limitCheck.upgradePrompt);
    return;
  }

  // Proceed with API call
  const response = await fetch('/api/memories', {
    method: 'POST',
    body: JSON.stringify({ content })
  });
}
```

### React Hook

Use the `useUsageLimitCheck` hook in React components:

```typescript
import { useUsageLimitCheck } from '@/lib/usage-limit-middleware';

function MemoryForm() {
  const { checkLimit, getUsageStats } = useUsageLimitCheck();

  const handleSubmit = async () => {
    const canProceed = await checkLimit('memory');
    if (!canProceed) {
      // Upgrade prompt is automatically shown
      return;
    }
    
    // Proceed with operation
  };
}
```

### Wrapper Functions

Use wrapper functions for consistent behavior:

```typescript
import { ClientUsageEnforcement } from '@/lib/usage-limit-middleware';

const createMemoryWithCheck = ClientUsageEnforcement.withUsageCheck(
  'memory',
  async (content: string) => {
    const response = await fetch('/api/memories', {
      method: 'POST',
      body: JSON.stringify({ content })
    });
    return response.json();
  },
  (upgradePrompt) => {
    // Custom upgrade prompt handler
    showCustomUpgradeModal(upgradePrompt);
  }
);
```

## Error Handling

### API Responses

When usage limits are exceeded, the middleware returns a standardized error response:

```json
{
  "error": "Usage limit exceeded",
  "message": "You've reached your limit of 20 memory records. Upgrade your plan to continue.",
  "code": "USAGE_LIMIT_EXCEEDED",
  "details": {
    "title": "Memory Limit Reached",
    "resourceType": "memory",
    "currentUsage": 20,
    "limit": 20,
    "suggestedPlans": [...]
  }
}
```

### Client-side Handling

Handle usage limit errors in your client code:

```typescript
try {
  const response = await fetch('/api/memories', { ... });
  
  if (response.status === 429) {
    const errorData = await response.json();
    if (errorData.code === 'USAGE_LIMIT_EXCEEDED') {
      showUpgradePrompt(errorData.details);
      return;
    }
  }
} catch (error) {
  // Handle other errors
}
```

## Usage Statistics

### Display Current Usage

Show users their current usage statistics:

```typescript
import { UsageLimitUtils } from '@/lib/usage-limit-middleware';

async function displayUsageStats() {
  const stats = await UsageLimitUtils.getCurrentUsageStats();
  
  if (stats) {
    console.log(`Memory: ${stats.memoryCount}/${stats.memoryLimit} (${stats.memoryPercentage}%)`);
    console.log(`Files: ${stats.fileCount}/${stats.fileLimit} (${stats.filePercentage}%)`);
  }
}
```

### Usage Warnings

Warn users when they're approaching limits:

```typescript
function checkUsageWarnings(stats: any) {
  if (stats.memoryPercentage >= 90) {
    showWarning('You\'re approaching your memory limit');
  }
  
  if (stats.filePercentage >= 90) {
    showWarning('You\'re approaching your file limit');
  }
}
```

## Custom Event Handling

The middleware dispatches custom events for usage limit exceeded:

```typescript
// Listen for usage limit events
window.addEventListener('usage-limit-exceeded', (event) => {
  const upgradePrompt = event.detail;
  showUpgradeModal(upgradePrompt);
});
```

## Best Practices

1. **Always check limits client-side first** for immediate feedback
2. **Use server-side enforcement** as the authoritative check
3. **Handle upgrade prompts gracefully** with clear messaging
4. **Show usage statistics** to help users understand their limits
5. **Provide clear upgrade paths** when limits are exceeded
6. **Log usage events** for analytics and debugging
7. **Test edge cases** like concurrent operations and batch uploads

## Testing

### Unit Tests

Test usage enforcement functions:

```typescript
import { enforceUsageLimit } from '@/lib/usage-limit-middleware';

test('should enforce memory limits', async () => {
  const result = await enforceUsageLimit('user-id', 'memory', async () => {
    return { success: true };
  });
  
  expect(result.success).toBe(true);
});
```

### Integration Tests

Test API routes with usage limits:

```typescript
test('should return 429 when memory limit exceeded', async () => {
  // Set up user with max usage
  await setUserUsage('user-id', { memory: 20, file: 2 });
  
  const response = await request(app)
    .post('/api/memories')
    .send({ content: 'test memory' });
    
  expect(response.status).toBe(429);
  expect(response.body.code).toBe('USAGE_LIMIT_EXCEEDED');
});
```

## Configuration

### Environment Variables

Set up required environment variables:

```env
# Supabase configuration for usage tracking
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Database Setup

Ensure the required tables exist:

- `subscription_plans` - Plan definitions and limits
- `user_subscriptions` - User subscription status
- `usage_tracking` - Current usage counters
- `webhook_events` - Webhook event logs

## Troubleshooting

### Common Issues

1. **Usage not incrementing**: Check that the API route returns a 2xx status code
2. **Limits not enforced**: Verify user has a subscription record
3. **Client-side checks failing**: Ensure the `/api/usage/check` endpoint is working
4. **Upgrade prompts not showing**: Check that suggested plans are configured

### Debug Logging

Enable debug logging to troubleshoot issues:

```typescript
// Add to your middleware
console.log('Usage check result:', limitCheck);
console.log('Current usage:', currentUsage);
console.log('User subscription:', subscription);
```