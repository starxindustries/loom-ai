-- RPC function to match memories based on user query using vector similarity
-- This function uses vector similarity search to find relevant memories
-- Note: This function expects the query_text to be a pre-generated embedding vector
CREATE OR REPLACE FUNCTION match_memories(
  user_id_param UUID,
  query_embedding VECTOR,
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.content,
    m.created_at,
    (1 - (m.embedding <=> query_embedding)) as similarity
  FROM memories m
  WHERE m.user_id = user_id_param
    AND m.embedding IS NOT NULL
    AND (1 - (m.embedding <=> query_embedding)) > match_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Alternative function that works with text search if embeddings are not available
CREATE OR REPLACE FUNCTION match_memories_text(
  user_id_param UUID,
  query_text TEXT,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  rank REAL
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.content,
    m.created_at,
    ts_rank(to_tsvector('english', m.content), plainto_tsquery('english', query_text)) as rank
  FROM memories m
  WHERE m.user_id = user_id_param
    AND to_tsvector('english', m.content) @@ plainto_tsquery('english', query_text)
  ORDER BY rank DESC
  LIMIT match_count;
END;
$$;

-- RPC function to store a new memory with embedding
CREATE OR REPLACE FUNCTION store_memory(
  user_id_param UUID,
  content_param TEXT,
  embedding_param VECTOR DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
DECLARE
  new_memory_id UUID;
BEGIN
  -- Insert the new memory
  INSERT INTO memories (user_id, content, embedding)
  VALUES (user_id_param, content_param, embedding_param)
  RETURNING memories.id INTO new_memory_id;
  
  -- Return the created memory
  RETURN QUERY
  SELECT 
    m.id,
    m.content,
    m.created_at
  FROM memories m
  WHERE m.id = new_memory_id;
END;
$$;

-- RPC function to store multiple memories in batch
CREATE OR REPLACE FUNCTION store_memories_batch(
  user_id_param UUID,
  memories_data JSONB
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
DECLARE
  memory_item JSONB;
  new_memory_id UUID;
BEGIN
  -- Loop through each memory in the batch
  FOR memory_item IN SELECT * FROM jsonb_array_elements(memories_data)
  LOOP
    -- Insert each memory
    INSERT INTO memories (user_id, content, embedding)
    VALUES (
      user_id_param,
      memory_item->>'content',
      CASE 
        WHEN memory_item->>'embedding' IS NOT NULL 
        THEN (memory_item->>'embedding')::vector
        ELSE NULL
      END
    )
    RETURNING memories.id INTO new_memory_id;
    
    -- Return the created memory
    RETURN QUERY
    SELECT 
      m.id,
      m.content,
      m.created_at
    FROM memories m
    WHERE m.id = new_memory_id;
  END LOOP;
END;
$$;

-- RPC function to update memory embedding (useful for batch processing)
CREATE OR REPLACE FUNCTION update_memory_embedding(
  memory_id_param UUID,
  embedding_param VECTOR
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE memories 
  SET embedding = embedding_param
  WHERE id = memory_id_param;
  
  RETURN FOUND;
END;
$$;
