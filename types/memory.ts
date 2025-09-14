export interface Memory {
  id: string;
  content: string;
  created_at: string;
  similarity?: number;
  rank?: number;
}

export interface MemorySearchParams {
  user_id: string;
  query: string;
  threshold?: number;
  limit?: number;
}

export interface MemorySearchResult {
  memories: Memory[];
  total: number;
  search_method: 'vector' | 'text';
}
