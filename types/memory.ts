export interface Memory {
  id: string;
  content: string;
  created_at: string;
  similarity?: number;
  rank?: number;
  ciphertext?: string;
  wrapped_dek?: string;
  dek_salt?: string;
  dek_iv?: string;
  data_iv?: string;
  kdf_algorithm?: string;
  kdf_iterations?: number;
  encryption_algorithm?: string;
  encrypted_keywords?: string[];
  keyword_hints?: string[];
  content_type?: string;
  content_length?: number;
  is_encrypted?: boolean;
  version?: number;
  updated_at?: string;
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

export interface MemoryListParams {
  user_id: string;
  page?: number;
  limit?: number;
  sort_by?: 'created_at' | 'updated_at';
  sort_order?: 'asc' | 'desc';
}

export interface MemoryListResult {
  memories: Memory[];
  total: number;
  page: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface DeleteMemoryResult {
  success: boolean;
  error?: string;
}
