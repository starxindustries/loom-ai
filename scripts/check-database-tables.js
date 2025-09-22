/**
 * Script to check what tables exist in the database
 * This will help identify if there's a 'users' table that shouldn't exist
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });
config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTables() {
  try {
    console.log('🔍 Checking database tables...\n');

    // Check public schema tables
    const { data: publicTables, error: publicError } = await supabase
      .from('information_schema.tables')
      .select('table_name, table_schema')
      .eq('table_schema', 'public')
      .order('table_name');

    if (publicError) {
      console.error('❌ Error fetching public tables:', publicError);
    } else {
      console.log('📋 Public schema tables:');
      publicTables.forEach(table => {
        console.log(`   - ${table.table_name}`);
      });
    }

    // Check auth schema tables
    const { data: authTables, error: authError } = await supabase
      .from('information_schema.tables')
      .select('table_name, table_schema')
      .eq('table_schema', 'auth')
      .order('table_name');

    if (authError) {
      console.error('❌ Error fetching auth tables:', authError);
    } else {
      console.log('\n🔐 Auth schema tables:');
      authTables.forEach(table => {
        console.log(`   - ${table.table_name}`);
      });
    }

    // Check if there's a 'users' table in public schema
    const { data: usersTable, error: usersError } = await supabase
      .from('information_schema.tables')
      .select('table_name, table_schema')
      .eq('table_schema', 'public')
      .eq('table_name', 'users');

    if (usersError) {
      console.error('❌ Error checking for users table:', usersError);
    } else if (usersTable && usersTable.length > 0) {
      console.log('\n⚠️  WARNING: Found a "users" table in public schema!');
      console.log('   This table should not exist. It should be "auth.users" instead.');
      console.log('   This might be causing the permission error.');
    } else {
      console.log('\n✅ No "users" table found in public schema (this is correct)');
    }

    // Check RLS policies
    console.log('\n🔒 Checking RLS policies...');
    const { data: policies, error: policiesError } = await supabase
      .from('pg_policies')
      .select('schemaname, tablename, policyname, permissive, roles, cmd, qual')
      .order('schemaname, tablename, policyname');

    if (policiesError) {
      console.error('❌ Error fetching RLS policies:', policiesError);
    } else {
      console.log('📋 RLS Policies:');
      policies.forEach(policy => {
        console.log(`   - ${policy.schemaname}.${policy.tablename}: ${policy.policyname} (${policy.cmd})`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkTables();
