import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { addMemory } from '@/lib/memory';

export type EncryptedFileMeta = {
  wrapped_dek: string;
  dek_salt: string;
  dek_iv: string;
  data_iv: string;
  kdf_algorithm: string;
  kdf_iterations: number;
  encryption_algorithm: string;
};

export class EncryptedFileService {
  static async storeEncryptedFile(
    params: {
      userId: string;
      file: File;
      encryptedPayloadBase64: string;
      encryption: EncryptedFileMeta;
      name?: string;
      description?: string;
      keywordHints?: string[];
    },
    options?: { supabase?: SupabaseClient }
  ): Promise<{ success: boolean; fileId?: string; error?: string }> {
    const supabase = options?.supabase ?? (await createClient());
    const bucket = 'user-files';

    try {
      // Ensure we run with the authenticated user's context; RLS requires auth.uid() = user_id
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        return { success: false, error: 'Not authenticated for file insert' };
      }
      const sessionUserId = authData.user.id;

      const buffer = Buffer.from(params.encryptedPayloadBase64, 'base64');
      const storagePath = `${sessionUserId}/${Date.now()}-${params.file.name}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(storagePath, buffer, {
          contentType: params.file.type || 'application/octet-stream',
          upsert: false,
        });
      console.log({uploadError})
      if (uploadError) {
        return { success: false, error: uploadError.message };
      }

      const { data: dbRec, error: dbErr } = await supabase
        .from('encrypted_user_files')
        .insert({
          user_id: sessionUserId,
          name: params.name || params.file.name,
          original_name: params.file.name,
          content_type: params.file.type || 'application/octet-stream',
          file_size: params.file.size,
          storage_bucket: bucket,
          storage_path: storagePath,
          wrapped_dek: params.encryption.wrapped_dek,
          dek_salt: params.encryption.dek_salt,
          dek_iv: params.encryption.dek_iv,
          data_iv: params.encryption.data_iv,
          kdf_algorithm: params.encryption.kdf_algorithm,
          kdf_iterations: params.encryption.kdf_iterations,
          encryption_algorithm: params.encryption.encryption_algorithm,
          keyword_hints: params.keywordHints || null,
          description: params.description || null,
        })
        .select('id')
        .single();
      console.log({dbRec, dbErr})
      if (dbErr) {
        await supabase.storage.from(bucket).remove([storagePath]);
        return { success: false, error: dbErr.message };
      }

      const memoryContent = `File stored: ${params.name || params.file.name}. Type: ${params.file.type}. Description: ${params.description || 'N/A'}.`;
      await addMemory(sessionUserId, memoryContent, false);

      return { success: true, fileId: dbRec.id };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Unknown error' };
    }
  }

  static async getEncryptedFile(
    userId: string,
    fileId: string
  ): Promise<{
    success: boolean;
    filename?: string;
    mimeType?: string;
    encryptedPayloadBase64?: string;
    encryption?: EncryptedFileMeta;
    error?: string;
  }> {
    const supabase = await createClient();

    const { data: record, error: recErr } = await supabase
      .from('encrypted_user_files')
      .select('*')
      .eq('id', fileId)
      .eq('user_id', userId)
      .single();

    if (recErr || !record) {
      return { success: false, error: recErr?.message || 'Not found' };
    }

    const { data: downloadedBlob, error: downloadError } = await supabase.storage
      .from(record.storage_bucket)
      .download(record.storage_path);

    if (downloadError || !downloadedBlob) {
      return { success: false, error: downloadError?.message || 'Download failed' };
    }

    // In Node/Next.js runtimes, Supabase returns a Blob with arrayBuffer() available
    const arrayBuf = await (downloadedBlob as any).arrayBuffer();
    
    const b64 = Buffer.from(arrayBuf).toString('base64');

    const encryption: EncryptedFileMeta = {
      wrapped_dek: record.wrapped_dek,
      dek_salt: record.dek_salt,
      dek_iv: record.dek_iv,
      data_iv: record.data_iv,
      kdf_algorithm: record.kdf_algorithm,
      kdf_iterations: record.kdf_iterations,
      encryption_algorithm: record.encryption_algorithm,
    };

    return {
      success: true,
      filename: record.original_name,
      mimeType: record.content_type,
      encryptedPayloadBase64: b64,
      encryption,
    };
  }
}


