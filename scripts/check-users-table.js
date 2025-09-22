/**
 * Script to check if there's a 'users' table that shouldn't exist
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

async function checkUsersTable() {
  try {
    console.log('🔍 Checking for users table...\n');

    // Try to query the users table directly
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .limit(1);

    if (error) {
      if (error.code === 'PGRST116') {
        console.log('✅ No "users" table found in public schema (this is correct)');
      } else if (error.message.includes('permission denied')) {
        console.log('⚠️  Found a "users" table but permission denied - this might be the issue!');
        console.log('   Error:', error.message);
      } else {
        console.log('❌ Error querying users table:', error.message);
      }
    } else {
      console.log('⚠️  WARNING: Found a "users" table in public schema!');
      console.log('   This table should not exist. It should be "auth.users" instead.');
      console.log('   Data found:', data);
    }

    // Try to query auth.users (this should work)
    console.log('\n🔍 Checking auth.users table...');
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.log('❌ Error querying auth.users:', authError.message);
    } else {
      console.log('✅ auth.users table is accessible');
      console.log(`   Found ${authUsers.users.length} users`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkUsersTable();
