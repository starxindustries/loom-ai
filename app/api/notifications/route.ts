import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notificationService } from "@/lib/notification-service";

/**
 * GET - Get user's notifications
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");
    const unreadOnly = searchParams.get("unread_only") === "true";

    const notifications = await notificationService.getUserNotifications(user.id, limit);

    // Filter by read status if requested
    const filteredNotifications = unreadOnly 
      ? notifications.filter(n => !n.read)
      : notifications;

    return NextResponse.json({
      success: true,
      notifications: filteredNotifications,
      unreadCount: notifications.filter(n => !n.read).length
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    return NextResponse.json(
      { 
        error: "Failed to get notifications",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Mark notification as read
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { notificationId, markAllAsRead } = body;

    if (markAllAsRead) {
      await notificationService.markAllNotificationsAsRead(user.id);
      return NextResponse.json({
        success: true,
        message: "All notifications marked as read"
      });
    }

    if (!notificationId) {
      return NextResponse.json(
        { error: "Notification ID is required" },
        { status: 400 }
      );
    }

    await notificationService.markNotificationAsRead(notificationId, user.id);

    return NextResponse.json({
      success: true,
      message: "Notification marked as read"
    });
  } catch (error) {
    console.error("Mark notification as read error:", error);
    return NextResponse.json(
      { 
        error: "Failed to mark notification as read",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
