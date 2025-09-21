/**
 * File operations with usage limit enforcement
 * This demonstrates how to integrate usage limits with file operations
 */

import { enforceUsageLimit, withUsageEnforcement, ClientUsageEnforcement } from './usage-limit-middleware';
import { UpgradePrompt } from '../types/subscription';

/**
 * Simulated file storage function (replace with your actual implementation)
 */
async function storeFile(userId: string, file: File, metadata?: any): Promise<{
  success: boolean;
  fileId?: string;
  fileUrl?: string;
  error?: string;
}> {
  // This is a placeholder - replace with your actual file storage logic
  try {
    // Simulate file storage
    const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const fileUrl = `https://example.com/files/${fileId}`;
    
    // In a real implementation, you would:
    // 1. Upload to cloud storage (S3, Supabase Storage, etc.)
    // 2. Store metadata in database
    // 3. Return the file information
    
    return {
      success: true,
      fileId,
      fileUrl
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Upload a single file with usage limit enforcement
 */
export const uploadFileWithLimits = withUsageEnforcement(
  'file',
  async (userId: string, file: File, metadata?: any) => {
    return await storeFile(userId, file, metadata);
  }
);

/**
 * Upload multiple files with usage limit enforcement
 */
export async function uploadMultipleFilesWithLimits(
  userId: string, 
  files: File[], 
  metadata?: any[]
): Promise<{ 
  success: boolean; 
  data?: any[]; 
  upgradePrompt?: UpgradePrompt; 
  error?: string 
}> {
  try {
    const { usageTrackingService } = await import('./usage-tracking-service');
    const { usageLimitMiddleware } = await import('./usage-limit-middleware');
    
    // Check if adding all files would exceed the limit
    const currentUsage = await usageTrackingService.getCurrentUsage(userId);
    
    if ((currentUsage.fileCount + files.length) > currentUsage.fileLimit) {
      const upgradePrompt = await usageTrackingService.getUpgradePrompt(userId, 'file');
      return {
        success: false,
        upgradePrompt
      };
    }

    // Process files one by one
    const results = [];
    let uploadedCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileMetadata = metadata?.[i];
      
      const result = await storeFile(userId, file, fileMetadata);
      results.push(result);
      
      if (result.success) {
        uploadedCount++;
      }
    }

    // Increment usage for all successfully uploaded files
    for (let i = 0; i < uploadedCount; i++) {
      await usageLimitMiddleware.incrementUsageAfterOperation(userId, 'file');
    }

    return {
      success: true,
      data: results
    };
  } catch (error) {
    console.error('Error in multiple file upload:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Process file with usage checking (e.g., for file analysis, conversion, etc.)
 */
export async function processFileWithLimits(
  userId: string,
  fileId: string,
  processingType: 'analyze' | 'convert' | 'extract'
): Promise<{ 
  success: boolean; 
  data?: any; 
  upgradePrompt?: UpgradePrompt; 
  error?: string 
}> {
  return enforceUsageLimit(userId, 'file', async () => {
    // Simulate file processing
    switch (processingType) {
      case 'analyze':
        return { analysis: 'File analysis results', fileId };
      case 'convert':
        return { convertedFileId: `converted_${fileId}`, originalFileId: fileId };
      case 'extract':
        return { extractedText: 'Extracted text content', fileId };
      default:
        throw new Error('Unknown processing type');
    }
  });
}

/**
 * Client-side file upload with usage checking
 */
export async function uploadFileClientSide(
  file: File,
  onUpgradeNeeded?: (prompt: UpgradePrompt) => void
): Promise<boolean> {
  return ClientUsageEnforcement.checkBeforeOperation(
    'file',
    async () => {
      // Create form data for file upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', file.name);

      // Make API call to upload file
      const response = await fetch('/api/files', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 429) {
          // Usage limit exceeded - this will be handled by the middleware
          const errorData = await response.json();
          throw new Error(errorData.message || 'Usage limit exceeded');
        }
        throw new Error('Failed to upload file');
      }
    },
    onUpgradeNeeded
  );
}

/**
 * Client-side multiple file upload with usage checking
 */
export async function uploadMultipleFilesClientSide(
  files: FileList | File[],
  onUpgradeNeeded?: (prompt: UpgradePrompt) => void,
  onProgress?: (uploaded: number, total: number) => void
): Promise<{ success: boolean; results: any[] }> {
  const fileArray = Array.from(files);
  const results = [];
  let uploadedCount = 0;

  for (let i = 0; i < fileArray.length; i++) {
    const file = fileArray[i];
    
    const success = await uploadFileClientSide(file, onUpgradeNeeded);
    results.push({ file: file.name, success });
    
    if (success) {
      uploadedCount++;
    }
    
    // Report progress
    if (onProgress) {
      onProgress(i + 1, fileArray.length);
    }
    
    // If upload failed due to limits, stop processing remaining files
    if (!success) {
      break;
    }
  }

  return {
    success: uploadedCount > 0,
    results
  };
}

/**
 * Wrapper for drag-and-drop file operations
 */
export class FileDropHandler {
  private onUpgradeNeeded?: (prompt: UpgradePrompt) => void;
  private onProgress?: (uploaded: number, total: number) => void;

  constructor(
    onUpgradeNeeded?: (prompt: UpgradePrompt) => void,
    onProgress?: (uploaded: number, total: number) => void
  ) {
    this.onUpgradeNeeded = onUpgradeNeeded;
    this.onProgress = onProgress;
  }

  /**
   * Handle dropped files with usage limit checking
   */
  async handleDrop(event: DragEvent): Promise<{ success: boolean; results: any[] }> {
    event.preventDefault();
    
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) {
      return { success: false, results: [] };
    }

    return uploadMultipleFilesClientSide(files, this.onUpgradeNeeded, this.onProgress);
  }

  /**
   * Handle file input change with usage limit checking
   */
  async handleFileInput(event: Event): Promise<{ success: boolean; results: any[] }> {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    
    if (!files || files.length === 0) {
      return { success: false, results: [] };
    }

    return uploadMultipleFilesClientSide(files, this.onUpgradeNeeded, this.onProgress);
  }
}