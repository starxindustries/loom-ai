'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Download, FileText, Calendar, HardDrive } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface FileMemoryCardProps {
  file: {
    id: string;
    name: string;
    original_name: string;
    content_type: string;
    file_size: number;
    description?: string;
    keyword_hints?: string[];
    created_at: string;
  };
  onDelete: (fileId: string) => Promise<void>;
  onDownload: (fileId: string) => Promise<void>;
}

export function FileMemoryCard({ file, onDelete, onDownload }: FileMemoryCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(file.id);
      toast.success('File deleted successfully');
    } catch (error) {
      toast.error('Failed to delete file');
      console.error('Delete error:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await onDownload(file.id);
      toast.success('File download started');
    } catch (error) {
      toast.error('Failed to download file');
      console.error('Download error:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Card className="w-full max-w-md hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-blue-500" />
            <CardTitle className="text-lg truncate" title={file.name}>
              {file.name}
            </CardTitle>
          </div>
          <Badge variant="secondary" className="text-xs">
            {file.content_type.split('/')[1]?.toUpperCase() || 'FILE'}
          </Badge>
        </div>
        <CardDescription className="text-sm text-muted-foreground">
          {file.original_name}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {file.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {file.description}
          </p>
        )}

        <div className="flex items-center space-x-4 text-xs text-muted-foreground">
          <div className="flex items-center space-x-1">
            <HardDrive className="h-3 w-3" />
            <span>{formatFileSize(file.file_size)}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Calendar className="h-3 w-3" />
            <span>{formatDate(file.created_at)}</span>
          </div>
        </div>

        {file.keyword_hints && file.keyword_hints.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {file.keyword_hints.slice(0, 3).map((hint, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {hint}
              </Badge>
            ))}
            {file.keyword_hints.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{file.keyword_hints.length - 3} more
              </Badge>
            )}
          </div>
        )}

        <div className="flex space-x-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex-1"
          >
            <Download className="h-4 w-4 mr-2" />
            {isDownloading ? 'Downloading...' : 'Download'}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={isDeleting}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete File</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{file.name}"? This action cannot be undone.
                  The file will be permanently removed from your encrypted storage.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-red-600 hover:bg-red-700"
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
