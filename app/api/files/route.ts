// File upload API with usage limit enforcement
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { usageLimitMiddleware } from "@/lib/usage-limit-middleware";

// GET - List user's files
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

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

    // Get user's files from storage or database
    // This is a placeholder - in a real implementation you'd query your files table
    const { data: files, error } = await supabase
      .from('user_files')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) {
      console.error("Error fetching files:", error);
      return NextResponse.json(
        { error: "Failed to fetch files" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      files: files || [],
      pagination: {
        page,
        limit,
        total: files?.length || 0
      }
    });
  } catch (error) {
    console.error("File list error:", error);
    return NextResponse.json(
      { error: "Failed to list files" },
      { status: 500 }
    );
  }
}

// POST - Upload new file with usage limit enforcement
export const POST = usageLimitMiddleware.withFileLimitCheck(
  async (request: NextRequest, userId: string): Promise<NextResponse> => {
    try {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      const name = formData.get('name') as string;
      const description = formData.get('description') as string;

      if (!file) {
        return NextResponse.json(
          { error: "File is required" },
          { status: 400 }
        );
      }

      // Validate file size (e.g., max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        return NextResponse.json(
          { error: "File size exceeds 10MB limit" },
          { status: 400 }
        );
      }

      // Validate file type (basic validation)
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'text/plain', 'text/csv',
        'application/json', 'application/xml'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json(
          { error: "File type not supported" },
          { status: 400 }
        );
      }

      const supabase = await createClient();

      // Convert file to buffer for storage
      const buffer = Buffer.from(await file.arrayBuffer());
      const fileName = `${userId}/${Date.now()}-${file.name}`;

      // Upload to Supabase Storage (if configured) or store metadata
      // This is a placeholder - in a real implementation you'd upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('user-files')
        .upload(fileName, buffer, {
          contentType: file.type,
          upsert: false
        });

      let fileUrl = null;
      if (!uploadError && uploadData) {
        // Get public URL
        const { data: urlData } = supabase.storage
          .from('user-files')
          .getPublicUrl(fileName);
        fileUrl = urlData.publicUrl;
      }

      // Store file metadata in database
      const { data: fileRecord, error: dbError } = await supabase
        .from('user_files')
        .insert({
          user_id: userId,
          name: name || file.name,
          original_name: file.name,
          file_type: file.type,
          file_size: file.size,
          file_path: fileName,
          file_url: fileUrl,
          description: description || null,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (dbError) {
        console.error("Database error:", dbError);
        // If database insert fails, try to clean up uploaded file
        if (!uploadError) {
          await supabase.storage.from('user-files').remove([fileName]);
        }
        return NextResponse.json(
          { error: "Failed to save file metadata" },
          { status: 500 }
        );
      }

      // The middleware will automatically increment usage after successful response
      return NextResponse.json({
        success: true,
        fileId: fileRecord.id,
        fileName: fileRecord.name,
        fileUrl: fileRecord.file_url,
        message: "File uploaded successfully",
      });
    } catch (error) {
      console.error("File upload error:", error);
      return NextResponse.json(
        { error: "Failed to upload file" },
        { status: 500 }
      );
    }
  }
);

// DELETE - Delete a file
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("id");

    if (!fileId) {
      return NextResponse.json(
        { error: "File ID is required" },
        { status: 400 }
      );
    }

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

    // Get file record to verify ownership and get file path
    const { data: fileRecord, error: fetchError } = await supabase
      .from('user_files')
      .select('*')
      .eq('id', fileId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !fileRecord) {
      return NextResponse.json(
        { error: "File not found or access denied" },
        { status: 404 }
      );
    }

    // Delete from storage if file path exists
    if (fileRecord.file_path) {
      const { error: storageError } = await supabase.storage
        .from('user-files')
        .remove([fileRecord.file_path]);
      
      if (storageError) {
        console.warn("Failed to delete file from storage:", storageError);
        // Continue with database deletion even if storage deletion fails
      }
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('user_files')
      .delete()
      .eq('id', fileId)
      .eq('user_id', user.id);

    if (deleteError) {
      return NextResponse.json(
        { error: "Failed to delete file" },
        { status: 500 }
      );
    }

    // Decrement usage count (optional - depends on business logic)
    // You might want to keep the count for billing purposes
    // await usageLimitMiddleware.decrementUsage(user.id, 'file');

    return NextResponse.json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error) {
    console.error("Delete file error:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}