import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { usageTrackingService } from '../../../../lib/usage-tracking-service';
import { ResourceType } from '../../../../types/subscription';

export async function GET(request: NextRequest) {
    try {
        // Get user from authentication
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized', message: 'User not authenticated' },
                { status: 401 }
            );
        }

        // Get resource type from query parameters
        const { searchParams } = new URL(request.url);
        const resourceType = searchParams.get('type') as ResourceType;

        if (!resourceType || !['memory', 'file'].includes(resourceType)) {
            return NextResponse.json(
                { error: 'Bad Request', message: 'Invalid or missing resource type' },
                { status: 400 }
            );
        }

        // Check usage limit
        const canProceed = await usageTrackingService.checkUsageLimit(user.id, resourceType);

        if (!canProceed) {
            const upgradePrompt = await usageTrackingService.getUpgradePrompt(user.id, resourceType);
            return NextResponse.json(
                {
                    error: 'Usage limit exceeded',
                    message: upgradePrompt.message,
                    code: 'USAGE_LIMIT_EXCEEDED',
                    details: {
                        title: upgradePrompt.title,
                        resourceType: upgradePrompt.resourceType,
                        currentUsage: upgradePrompt.currentUsage,
                        limit: upgradePrompt.limit,
                        suggestedPlans: upgradePrompt.suggestedPlans.map(plan => ({
                            id: plan.id,
                            name: plan.name,
                            priceMonthly: plan.priceMonthly,
                            memoryLimit: plan.memoryLimit,
                            fileLimit: plan.fileLimit
                        }))
                    }
                },
                { status: 429 }
            );
        }

        return NextResponse.json({ allowed: true });
    } catch (error) {
        console.error('Error checking usage limit:', error);
        return NextResponse.json(
            {
                error: 'Internal Server Error',
                message: 'Failed to check usage limit'
            },
            { status: 500 }
        );
    }
}