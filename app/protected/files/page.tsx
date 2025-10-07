
'use client';

import { FileMemoryGrid } from '@/components/common/file-memory-grid';
import { toast } from 'sonner';

export default function FilesPage() {
  const handleDownload = async (fileId: string) => {
    try {
      const response = await fetch(`/api/encrypted-files?id=${fileId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch file');
      }
      
      const { fileData, encryption, filename, mimeType } = await response.json();
      
      if (!fileData || !encryption) {
        throw new Error('Invalid file data received');
      }

      // Create a blob from the base64 data
      const binaryString = atob(fileData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mimeType || 'application/octet-stream' });
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'encrypted-file';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Download error:', error);
      throw error;
    }
  };

  const handleDelete = async (fileId: string) => {
    try {
      const response = await fetch(`/api/encrypted-files/${fileId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete file');
      }
      
      // Refresh the file list by triggering a page reload or state update
      window.location.reload();
      
    } catch (error) {
      console.error('Delete error:', error);
      throw error;
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <FileMemoryGrid 
        onDownload={handleDownload}
        onDelete={handleDelete}
      />
    </div>
  );
}
