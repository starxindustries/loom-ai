-- =====================================================================
-- Generate DDL SQL File for Supabase Database
-- =====================================================================
-- This query generates CREATE statements for all database objects
-- Copy the output and save as .sql file to recreate your database
-- =====================================================================

WITH 
-- Generate CREATE TABLE statements
table_ddl AS (
  SELECT 
    1 as order_priority,
    t.table_schema,
    t.table_name as object_name,
    'CREATE TABLE ' || t.table_schema || '.' || t.table_name || ' (' || chr(10) ||
    string_agg(
      '  ' || c.column_name || ' ' || 
      CASE 
        WHEN c.data_type = 'character varying' THEN 'VARCHAR(' || COALESCE(c.character_maximum_length::text, '255') || ')'
        WHEN c.data_type = 'character' THEN 'CHAR(' || COALESCE(c.character_maximum_length::text, '1') || ')'
        WHEN c.data_type = 'numeric' THEN 'NUMERIC(' || COALESCE(c.numeric_precision::text, '10') || ',' || COALESCE(c.numeric_scale::text, '0') || ')'
        WHEN c.data_type = 'integer' THEN 'INTEGER'
        WHEN c.data_type = 'bigint' THEN 'BIGINT'
        WHEN c.data_type = 'smallint' THEN 'SMALLINT'
        WHEN c.data_type = 'boolean' THEN 'BOOLEAN'
        WHEN c.data_type = 'text' THEN 'TEXT'
        WHEN c.data_type = 'timestamp without time zone' THEN 'TIMESTAMP'
        WHEN c.data_type = 'timestamp with time zone' THEN 'TIMESTAMPTZ'
        WHEN c.data_type = 'date' THEN 'DATE'
        WHEN c.data_type = 'time without time zone' THEN 'TIME'
        WHEN c.data_type = 'uuid' THEN 'UUID'
        WHEN c.data_type = 'json' THEN 'JSON'
        WHEN c.data_type = 'jsonb' THEN 'JSONB'
        ELSE UPPER(c.data_type)
      END ||
      CASE WHEN c.is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
      CASE WHEN c.column_default IS NOT NULL THEN ' DEFAULT ' || c.column_default ELSE '' END,
      ',' || chr(10)
      ORDER BY c.ordinal_position
    ) || chr(10) || ');' || chr(10) as ddl_statement
  FROM information_schema.tables t
  JOIN information_schema.columns c ON t.table_name = c.table_name 
    AND t.table_schema = c.table_schema
  WHERE t.table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
    AND t.table_type = 'BASE TABLE'
  GROUP BY t.table_schema, t.table_name
),

-- Generate CREATE INDEX statements
index_ddl AS (
  SELECT 
    2 as order_priority,
    schemaname as table_schema,
    indexname as object_name,
    indexdef || ';' || chr(10) as ddl_statement
  FROM pg_indexes 
  WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
    AND indexname NOT LIKE '%_pkey'  -- Exclude primary key indexes (handled by constraints)
),

-- Generate RLS ENABLE statements and POLICIES
rls_ddl AS (
  SELECT 
    3 as order_priority,
    schemaname as table_schema,
    'RLS_' || tablename as object_name,
    'ALTER TABLE ' || schemaname || '.' || tablename || ' ENABLE ROW LEVEL SECURITY;' || chr(10) ||
    'CREATE POLICY ' || policyname || ' ON ' || schemaname || '.' || tablename || 
    ' FOR ' || cmd ||
    CASE WHEN array_length(roles, 1) > 0 THEN ' TO ' || array_to_string(roles, ', ') ELSE '' END ||
    CASE WHEN qual IS NOT NULL THEN ' USING (' || qual || ')' ELSE '' END ||
    CASE WHEN with_check IS NOT NULL THEN ' WITH CHECK (' || with_check || ')' ELSE '' END ||
    ';' || chr(10) as ddl_statement
  FROM pg_policies
  WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
),

-- Generate CREATE FUNCTION statements
function_ddl AS (
  SELECT 
    4 as order_priority,
    n.nspname as table_schema,
    p.proname as object_name,
    'CREATE OR REPLACE FUNCTION ' || n.nspname || '.' || p.proname || 
    '(' || COALESCE(oidvectortypes(p.proargtypes), '') || ')' || chr(10) ||
    'RETURNS ' || format_type(p.prorettype, NULL) || chr(10) ||
    'LANGUAGE ' || l.lanname || chr(10) ||
    CASE WHEN p.provolatile = 'i' THEN 'IMMUTABLE' || chr(10)
         WHEN p.provolatile = 's' THEN 'STABLE' || chr(10)
         ELSE 'VOLATILE' || chr(10) END ||
    'AS $function$' || chr(10) ||
    COALESCE(p.prosrc, '-- Binary function body not available') || chr(10) ||
    '$function$;' || chr(10) as ddl_statement
  FROM pg_proc p
  LEFT JOIN pg_namespace n ON p.pronamespace = n.oid
  LEFT JOIN pg_language l ON p.prolang = l.oid
  WHERE n.nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
    AND n.nspname IS NOT NULL
),

-- Generate CREATE TRIGGER statements
trigger_ddl AS (
  SELECT 
    5 as order_priority,
    n.nspname as table_schema,
    t.tgname as object_name,
    pg_get_triggerdef(t.oid) || ';' || chr(10) as ddl_statement
  FROM pg_trigger t
  JOIN pg_class c ON t.tgrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
    AND t.tgisinternal = false
)

-- Combine all DDL statements
SELECT 
  '-- =====================================================' || chr(10) ||
  '-- Generated DDL for Database: ' || current_database() || chr(10) ||
  '-- Generated on: ' || current_timestamp || chr(10) ||
  '-- =====================================================' || chr(10) || chr(10) ||
  
  '-- Tables' || chr(10) ||
  string_agg(
    CASE WHEN order_priority = 1 THEN ddl_statement ELSE '' END, 
    '' ORDER BY table_schema, object_name
  ) || chr(10) ||
  
  '-- Indexes' || chr(10) ||
  string_agg(
    CASE WHEN order_priority = 2 THEN ddl_statement ELSE '' END, 
    '' ORDER BY table_schema, object_name
  ) || chr(10) ||
  
  '-- Row Level Security' || chr(10) ||
  string_agg(
    CASE WHEN order_priority = 3 THEN ddl_statement ELSE '' END, 
    '' ORDER BY table_schema, object_name
  ) || chr(10) ||
  
  '-- Functions' || chr(10) ||
  string_agg(
    CASE WHEN order_priority = 4 THEN ddl_statement ELSE '' END, 
    '' ORDER BY table_schema, object_name
  ) || chr(10) ||
  
  '-- Triggers' || chr(10) ||
  string_agg(
    CASE WHEN order_priority = 5 THEN ddl_statement ELSE '' END, 
    '' ORDER BY table_schema, object_name
  ) || chr(10) ||
  
  '-- End of DDL' || chr(10) as complete_ddl

FROM (
  SELECT * FROM table_ddl
  UNION ALL
  SELECT * FROM index_ddl
  UNION ALL  
  SELECT * FROM rls_ddl
  UNION ALL
  SELECT * FROM function_ddl
  UNION ALL
  SELECT * FROM trigger_ddl
) all_ddl;

-- =====================================================================
-- Instructions:
-- 1. Execute this query in your Supabase SQL editor
-- 2. Copy the result from the 'complete_ddl' column 
-- 3. Save it as 'database_structure.sql' file
-- 4. You can now use this file to recreate your database structure
-- =====================================================================