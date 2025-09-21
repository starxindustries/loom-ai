import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { usageTrackingService } from '../../../../lib/usage-tracking-service';

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

    // Get current usage stats
    const usageStats = await usageTrackingService.getCurrentUsage(user.id);
    
    return NextResponse.json(usageStats);
  } catch (error) {
    console.error('Error getting current usage:', error);
    return NextResponse.json(
      { 
        error: 'Internal Server Error', 
        message: 'Failed to get current usage' 
      },
      { status: 500 }
    );
  }
}