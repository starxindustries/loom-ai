'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight, RefreshCw, Search, Brain } from 'lucide-react';
import { MemoryCard } from './memory-card';
import { MemoriesSkeleton } from './memories-skeleton';
import { Memory, MemoryListResult } from '@/types/memory';

interface MemoriesDashboardProps {
  memories: MemoryListResult;
  loading: boolean;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onSearch: () => void;
  onClearSearch: () => void;
  onRefresh: () => void;
  onPageChange: (page: number) => void;
  onDelete: (id: string) => void;
}

export function MemoriesDashboard({
  memories,
  loading,
  searchTerm,
  onSearchChange,
  onSearch,
  onClearSearch,
  onRefresh,
  onPageChange,
  onDelete,
}: MemoriesDashboardProps) {
  if (loading) {
    return <MemoriesSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Memories</h1>
          <p className="text-muted-foreground">
            {memories.total} memories found
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search keywords..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 w-64"
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      {/* Memories List */}
      {memories.memories.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="text-center py-16">
              <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <Brain className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {searchTerm ? "No memories found" : "No memories yet"}
              </h3>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                {searchTerm
                  ? "Try adjusting your search terms or clear the search to see all memories."
                  : "Start creating memories by having conversations with your AI assistant."}
              </p>
              {searchTerm && (
                <Button
                  variant="outline"
                  onClick={onClearSearch}
                  className="gap-2"
                >
                  <Search className="h-4 w-4" />
                  Clear Search
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {memories.memories.map((memory) => (
            <MemoryCard
              key={memory.id}
              memory={memory}
              onDelete={onDelete}
            />
          ))}

          {/* Pagination */}
          {memories.total_pages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(memories.page - 1)}
                disabled={!memories.has_prev || loading}
                className="gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <div className="flex items-center gap-1 px-4">
                <span className="text-sm text-muted-foreground">
                  Page {memories.page} of {memories.total_pages}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(memories.page + 1)}
                disabled={!memories.has_next || loading}
                className="gap-2"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
