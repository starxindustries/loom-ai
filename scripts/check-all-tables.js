/**
 * Script to check all tables in the database using raw SQL
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });
config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAllTables() {
  try {
    console.log('🔍 Checking all tables in the database...\n');

    // Query all tables using raw SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname IN ('public', 'auth') 
        ORDER BY schemaname, tablename;
      `
    });

    if (error) {
      console.log('❌ Error querying tables:', error.message);
      
      // Try alternative approach - check if there's a users table by trying to query it
      console.log('\n🔍 Trying to query users table directly...');
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .limit(1);

      if (usersError) {
        console.log('❌ Error accessing users table:', usersError.message);
        console.log('   Code:', usersError.code);
        
        if (usersError.message.includes('permission denied')) {
          console.log('\n⚠️  FOUND THE ISSUE!');
          console.log('   There IS a "users" table in the database, but the application');
          console.log('   doesn\'t have permission to access it.');
          console.log('   This table should not exist - it should be "auth.users" instead.');
        }
      } else {
        console.log('⚠️  Found users table with data:', usersData);
      }
    } else {
      console.log('📋 Tables found:');
      data.forEach(table => {
        if (table.tablename === 'users') {
          console.log(`   ⚠️  ${table.schemaname}.${table.tablename} - THIS SHOULD NOT EXIST!`);
        } else {
          console.log(`   ✅ ${table.schemaname}.${table.tablename}`);
        }
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAllTables();

