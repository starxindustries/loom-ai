'use client';

import { useState, useEffect } from 'react';
import { FileMemoryCard } from './file-memory-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, RefreshCw, FileText, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

interface FileData {
  id: string;
  name: string;
  original_name: string;
  content_type: string;
  file_size: number;
  description?: string;
  keyword_hints?: string[];
  created_at: string;
}

interface FileMemoryGridProps {
  onDownload: (fileId: string) => Promise<void>;
  onDelete: (fileId: string) => Promise<void>;
}

export function FileMemoryGrid({ onDownload, onDelete }: FileMemoryGridProps) {
  const [files, setFiles] = useState<FileData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterType, setFilterType] = useState<string>('all');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const fetchFiles = async (params?: {
    search?: string;
    sortBy?: string;
    sortOrder?: string;
    filterType?: string;
    page?: number;
  }) => {
    try {
      setLoading(true);
      setError(null);
      
      const searchParams = new URLSearchParams();
      if (params?.search !== undefined) searchParams.set('search', params.search);
      if (params?.sortBy !== undefined) searchParams.set('sortBy', params.sortBy);
      if (params?.sortOrder !== undefined) searchParams.set('sortOrder', params.sortOrder);
      if (params?.filterType !== undefined) searchParams.set('filterType', params.filterType);
      if (params?.page !== undefined) searchParams.set('page', params.page.toString());
      searchParams.set('limit', pagination.limit.toString());
      
      const response = await fetch(`/api/encrypted-files?${searchParams.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }
      
      const data = await response.json();
      if (data.success) {
        setFiles(data.files || []);
        setPagination(data.pagination);
      } else {
        throw new Error(data.error || 'Failed to fetch files');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Fetch files error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  // Handle search with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchFiles({
        search: searchTerm,
        sortBy,
        sortOrder,
        filterType,
        page: 1,
      });
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, sortBy, sortOrder, filterType]);

  const handleSortChange = (newSortBy: 'name' | 'date' | 'size') => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  const handlePageChange = (newPage: number) => {
    fetchFiles({
      search: searchTerm,
      sortBy,
      sortOrder,
      filterType,
      page: newPage,
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-24" />
        </div>

        {/* Filters Skeleton */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-full sm:w-48" />
          <Skeleton className="h-10 w-full sm:w-48" />
        </div>

        {/* Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fetchFiles()}
            className="ml-2"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">File Memory</h2>
          <p className="text-muted-foreground">
            Your encrypted files stored securely
          </p>
        </div>
        <Button onClick={() => fetchFiles()} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search files by name, description, or keywords..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="image">Images</SelectItem>
            <SelectItem value="video">Videos</SelectItem>
            <SelectItem value="audio">Audio</SelectItem>
            <SelectItem value="text">Documents</SelectItem>
            <SelectItem value="application">Applications</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(value: 'name' | 'date' | 'size') => handleSortChange(value)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Date Created {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}</SelectItem>
            <SelectItem value="name">Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}</SelectItem>
            <SelectItem value="size">File Size {sortBy === 'size' && (sortOrder === 'asc' ? '↑' : '↓')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Files Grid */}
      {files.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {searchTerm || filterType !== 'all' ? 'No files found' : 'No files yet'}
          </h3>
          <p className="text-muted-foreground">
            {searchTerm || filterType !== 'all' 
              ? 'Try adjusting your search or filter criteria'
              : 'Your encrypted files will appear here once uploaded'
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {files.map((file) => (
            <FileMemoryCard
              key={file.id}
              file={file}
              onDownload={onDownload}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
          >
            Next
          </Button>
        </div>
      )}

      {/* Stats */}
      {pagination.total > 0 && (
        <div className="text-sm text-muted-foreground">
          Showing {files.length} of {pagination.total} files
        </div>
      )}
    </div>
  );
}
