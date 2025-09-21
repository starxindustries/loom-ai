"use client";

import { useState, useEffect } from "react";
import { AppSidebar } from "../example/components/app-sidebar";
import { SiteHeader } from "../example/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Search, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Memory, MemoryListResult } from "@/types/memory";

interface MemoryCardProps {
  memory: Memory;
  onDelete: (id: string) => void;
}

function MemoryCard({ memory, onDelete }: MemoryCardProps) {
  const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) return 'Unknown';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  const formatKeywords = (keywords: string[] | undefined | null) => {
    if (!keywords || keywords.length === 0) return 'No keywords';
    return keywords.join(' - ');
  };

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg transition-colors shadow-xl">
      <div className="flex-1">
        <span className="text-sm font-medium">
          {formatKeywords(memory.keyword_hints)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {memory.is_encrypted && (
          <Badge variant="secondary" className="text-xs">
            Encrypted
          </Badge>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive border hover:cursor-pointer">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Memory</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this memory? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDelete(memory.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

export default function MemoryManagement() {
  const [memories, setMemories] = useState<MemoryListResult>({
    memories: [],
    total: 0,
    page: 1,
    total_pages: 0,
    has_next: false,
    has_prev: false,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchMemories = async (page: number = 1, search?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        sort_by: 'created_at',
        sort_order: 'desc',
      });

      if (search && search.trim()) {
        params.set('query', search.trim());
      }

      const response = await fetch(`/api/memories?${params}`);
      if (response.ok) {
        const data = await response.json();
        setMemories(data);
      } else {
        toast.error("Failed to fetch memories");
      }
    } catch (error) {
      console.error("Fetch memories error:", error);
      toast.error("Failed to fetch memories");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (memoryId: string) => {
    try {
      const response = await fetch(`/api/memories?id=${memoryId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success("Memory deleted successfully");
        fetchMemories(memories.page);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to delete memory");
      }
    } catch (error) {
      console.error("Delete memory error:", error);
      toast.error("Failed to delete memory");
    }
  };

  const handleSearch = () => {
    fetchMemories(1, searchTerm);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    fetchMemories(1, "");
  };

  useEffect(() => {
    fetchMemories();
  }, []);

  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
            <div className="flex flex-col gap-4">
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
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-64"
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchMemories(memories.page)}
                    disabled={loading}
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>

              {/* Memories List */}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-8 w-8 animate-spin" />
                  <span className="ml-2">Loading memories...</span>
                </div>
              ) : memories.memories.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">
                        {searchTerm ? 'No memories found matching your search.' : 'No memories found.'}
                      </p>
                      {searchTerm && (
                        <Button variant="outline" onClick={handleClearSearch} className="mt-4">
                          Clear Search
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {memories.memories.map((memory) => (
                    <MemoryCard
                      key={memory.id}
                      memory={memory}
                      onDelete={handleDelete}
                    />
                  ))}

                  {/* Simple Pagination */}
                  {memories.total_pages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchMemories(memories.page - 1)}
                        disabled={!memories.has_prev || loading}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground px-4">
                        Page {memories.page} of {memories.total_pages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchMemories(memories.page + 1)}
                        disabled={!memories.has_next || loading}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
