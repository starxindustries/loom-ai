'use client';

import { MemoryFlowTabs } from '@/components/memories/memory-flow-tabs';
import { useMemories } from '@/hooks/use-memories';

export default function MemoryManagement() {
  const {
    memories,
    loading,
    searchTerm,
    setSearchTerm,
    handleSearch,
    handleClearSearch,
    handlePageChange,
    handleRefresh,
    handleDelete,
  } = useMemories();

  return (
    <div className="container mx-auto py-8 px-4">
      <MemoryFlowTabs
        memories={memories}
        loading={loading}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onSearch={handleSearch}
        onClearSearch={handleClearSearch}
        onRefresh={handleRefresh}
        onPageChange={handlePageChange}
        onDelete={handleDelete}
      />
    </div>
  );
}
