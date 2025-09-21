import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { usageTrackingService } from '../../../../lib/usage-tracking-service';
import { ResourceType } from '../../../../types/subscription';

export async function POST(request: NextRequest) {
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

    // Parse request body
    const body = await request.json();
    const { resourceType } = body;
    
    if (!resourceType || !['memory', 'file'].includes(resourceType)) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid or missing resource type' },
        { status: 400 }
      );
    }

    // Increment usage
    await usageTrackingService.incrementUsage(user.id, resourceType as ResourceType);
    
    // Return updated usage stats
    const updatedUsage = await usageTrackingService.getCurrentUsage(user.id);
    
    return NextResponse.json({
      success: true,
      message: 'Usage incremented successfully',
      usage: updatedUsage
    });
  } catch (error) {
    console.error('Error incrementing usage:', error);
    return NextResponse.json(
      { 
        error: 'Internal Server Error', 
        message: 'Failed to increment usage' 
      },
      { status: 500 }
    );
  }
}