import { useState, useEffect } from 'react';
import { MemoryListResult } from '@/types/memory';
import { toast } from 'sonner';

export function useMemories() {
  const [memories, setMemories] = useState<MemoryListResult>({
    memories: [],
    total: 0,
    page: 1,
    total_pages: 0,
    has_next: false,
    has_prev: false,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchMemories = async (page: number = 1, search?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        sort_by: "created_at",
        sort_order: "desc",
      });

      if (search && search.trim()) {
        params.set("query", search.trim());
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
        method: "DELETE",
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

  const handlePageChange = (newPage: number) => {
    fetchMemories(newPage, searchTerm);
  };

  const handleRefresh = () => {
    fetchMemories(memories.page, searchTerm);
  };

  useEffect(() => {
    fetchMemories();
  }, []);

  return {
    memories,
    loading,
    searchTerm,
    setSearchTerm,
    handleSearch,
    handleClearSearch,
    handlePageChange,
    handleRefresh,
    handleDelete,
  };
}
