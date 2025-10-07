#!/usr/bin/env node

/**
 * Environment Variables Checker for OAuth Integration
 * Run this script to verify your OAuth setup
 */

console.log('🔍 Checking OAuth Environment Variables...\n');

const requiredVars = {
  'NEXT_PUBLIC_APP_URL': 'Your app URL (e.g., http://localhost:3000)',
  'GOOGLE_INTEGRATION_CLIENT_ID': 'Google Integration OAuth Client ID',
  'GOOGLE_INTEGRATION_SECRET': 'Google Integration OAuth Client Secret',
  'SLACK_CLIENT_ID': 'Slack OAuth Client ID (optional)',
  'SLACK_CLIENT_SECRET': 'Slack OAuth Client Secret (optional)',
  'NOTION_CLIENT_ID': 'Notion OAuth Client ID (optional)',
  'NOTION_CLIENT_SECRET': 'Notion OAuth Client Secret (optional)'
};

const optionalVars = ['SLACK_CLIENT_ID', 'SLACK_CLIENT_SECRET', 'NOTION_CLIENT_ID', 'NOTION_CLIENT_SECRET'];

let hasErrors = false;
let hasWarnings = false;

console.log('📋 Environment Variables Status:\n');

Object.entries(requiredVars).forEach(([key, description]) => {
  const value = process.env[key];
  const isOptional = optionalVars.includes(key);
  
  if (!value) {
    if (isOptional) {
      console.log(`⚠️  ${key}: Not set (${description}) - Optional`);
      hasWarnings = true;
    } else {
      console.log(`❌ ${key}: Missing (${description}) - Required`);
      hasErrors = true;
    }
  } else {
    // Mask sensitive values
    const displayValue = key.includes('SECRET') ? 
      `${value.substring(0, 8)}...` : 
      value.length > 50 ? `${value.substring(0, 50)}...` : value;
    console.log(`✅ ${key}: ${displayValue}`);
  }
});

console.log('\n🔧 OAuth Redirect URIs to configure in your OAuth apps:');
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
console.log(`   ${baseUrl}/api/auth/oauth/callback`);

if (hasErrors) {
  console.log('\n❌ Setup incomplete! Please add the missing required environment variables to your .env.local file.');
  console.log('\n📝 Example .env.local:');
  console.log('NEXT_PUBLIC_APP_URL=http://localhost:3000');
  console.log('GOOGLE_INTEGRATION_CLIENT_ID=your_google_integration_client_id');
  console.log('GOOGLE_INTEGRATION_SECRET=your_google_integration_secret');
  process.exit(1);
} else if (hasWarnings) {
  console.log('\n⚠️  Basic setup complete! Add optional providers as needed.');
} else {
  console.log('\n🎉 All environment variables configured correctly!');
}

console.log('\n📚 For setup instructions, see: docs/oauth-setup.md');
