import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { usageTrackingService } from '../../../../lib/usage-tracking-service';

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

    // Reset usage counters
    await usageTrackingService.resetUsage(user.id);
    
    // Return updated usage stats
    const updatedUsage = await usageTrackingService.getCurrentUsage(user.id);
    
    return NextResponse.json({
      success: true,
      message: 'Usage reset successfully',
      usage: updatedUsage
    });
  } catch (error) {
    console.error('Error resetting usage:', error);
    return NextResponse.json(
      { 
        error: 'Internal Server Error', 
        message: 'Failed to reset usage' 
      },
      { status: 500 }
    );
  }
}