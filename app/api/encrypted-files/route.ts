import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { EncryptedFileService } from '@/lib/encrypted-file-service';
import { usageLimitMiddleware } from '@/lib/usage-limit-middleware';

// GET: list or fetch single by id
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const res = await EncryptedFileService.getEncryptedFile(user.id, id);
      if (!res.success) {
        return NextResponse.json({ error: res.error || 'Not found' }, { status: 404 });
      }
      // Map to frontend-expected payload shape
      return NextResponse.json({
        success: true,
        fileData: res.encryptedPayloadBase64,
        encryption: res.encryption,
        filename: res.filename,
        mimeType: res.mimeType,
      });
    }

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'date';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const filterType = searchParams.get('filterType') || 'all';
    
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('encrypted_user_files')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id);

    // Apply search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,original_name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Apply type filter
    if (filterType !== 'all') {
      query = query.like('content_type', `${filterType}%`);
    }

    // Apply sorting
    const sortColumn = sortBy === 'name' ? 'name' : 
                      sortBy === 'size' ? 'file_size' : 
                      'created_at';
    const ascending = sortOrder === 'asc';
    
    query = query.order(sortColumn, { ascending });

    const { data, error, count } = await query.range(from, to);

    if (error) {
      console.log({error})
      return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      files: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
      filters: {
        search,
        sortBy,
        sortOrder,
        filterType,
      },
    });
  } catch (e) {
    console.log({e})
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

// POST: upload an already encrypted file blob + encryption metadata, create memory
export const POST = usageLimitMiddleware.withFileLimitCheck(
  async (request: NextRequest, userId: string): Promise<NextResponse> => {
    try {
      const supabase = await createClient();
      const formData = await request.formData();
      const file = formData.get('file') as File | null; // used for name/type/size only
      const payload = formData.get('payload') as string | null; // base64 ciphertext
      const meta = formData.get('encryption') as string | null; // JSON of EncryptedFileMeta
      const name = (formData.get('name') as string) || undefined;
      const description = (formData.get('description') as string) || undefined;
      const keywordHints = (formData.get('keyword_hints') as string) || undefined; // CSV

      if (!file || !payload || !meta) {
        console.log({file, payload, meta})
        return NextResponse.json({ error: 'file, payload, encryption are required' }, { status: 400 });
      }

      let encryption;
      try {
        encryption = JSON.parse(meta);
      } catch {
        console.log({meta})
        return NextResponse.json({ error: 'Invalid encryption metadata' }, { status: 400 });
      }

      const res = await EncryptedFileService.storeEncryptedFile({
        userId,
        file,
        encryptedPayloadBase64: payload,
        encryption,
        name,
        description,
        keywordHints: keywordHints ? keywordHints.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      }, { supabase });

      if (!res.success) {
        console.log({res})
        return NextResponse.json({ error: res.error || 'Upload failed' }, { status: 500 });
      }

      return NextResponse.json({ success: true, fileId: res.fileId });
    } catch (e) {
      console.log({e})
      return NextResponse.json({ error: 'Failed to upload' }, { status: 500 });
    }
  }
);


