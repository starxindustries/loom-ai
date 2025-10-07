'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, Search, Network, Grid3X3, Brain } from 'lucide-react';
import MemoryFlowGlobal from './memory-flow-global';
import { MemoryFlowCards } from './memory-flow-cards';
import { MemoriesSkeleton } from './memories-skeleton';
import { Memory, MemoryListResult } from '@/types/memory';

interface MemoryFlowTabsProps {
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

export function MemoryFlowTabs({
  memories,
  loading,
  searchTerm,
  onSearchChange,
  onSearch,
  onClearSearch,
  onRefresh,
  onPageChange,
  onDelete,
}: MemoryFlowTabsProps) {
  const [activeTab, setActiveTab] = useState('global');

  if (loading) {
    return <MemoriesSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Memory Network</h1>
          <p className="text-muted-foreground">
            {memories.total} memories • Visualize connections and relationships
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="global" className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            Global Network
          </TabsTrigger>
          <TabsTrigger value="cards" className="flex items-center gap-2">
            <Grid3X3 className="h-4 w-4" />
            Card View
          </TabsTrigger>
        </TabsList>

        <TabsContent value="global" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5" />
                Global Memory Network
              </CardTitle>
              <CardDescription>
                Interactive visualization showing how your memories connect through shared keywords and concepts.
                The most recent memory is placed at the center with related memories arranged around it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {memories.memories.length === 0 ? (
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
              ) : (
                <MemoryFlowGlobal memories={memories.memories} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cards" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Grid3X3 className="h-5 w-5" />
                Memory Cards with Flow Diagrams
              </CardTitle>
              <CardDescription>
                Individual memory cards showing mini flow diagrams of keyword connections.
                Each card displays up to 4 related keywords connected to the central memory concept.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {memories.memories.length === 0 ? (
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
              ) : (
                <MemoryFlowCards memories={memories.memories} onDelete={onDelete} />
              )}
            </CardContent>
          </Card>

          {/* Pagination for Cards View */}
          {memories.total_pages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(memories.page - 1)}
                disabled={!memories.has_prev || loading}
                className="gap-2"
              >
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
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
