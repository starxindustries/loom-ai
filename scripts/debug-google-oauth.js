#!/usr/bin/env node

/**
 * Google OAuth Configuration Debugger
 * This script helps identify issues with Google OAuth setup
 */

const https = require('https');
const { URL } = require('url');

const CLIENT_ID = '157090485742-k2jt10ggrahmur86oejs8efpj2elrbgt.apps.googleusercontent.com';
const REDIRECT_URI = 'http://localhost:3000/api/auth/oauth/callback';

console.log('🔍 Debugging Google OAuth Configuration...\n');

console.log('📋 Current Configuration:');
console.log(`Client ID: ${CLIENT_ID}`);
console.log(`Redirect URI: ${REDIRECT_URI}`);
console.log('Scope: https://www.googleapis.com/auth/gmail.send\n');

// Test 1: Check if client ID format is valid
console.log('🧪 Test 1: Client ID Format');
if (CLIENT_ID.match(/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/)) {
  console.log('✅ Client ID format looks valid');
} else {
  console.log('❌ Client ID format appears invalid');
}

// Test 2: Try a minimal OAuth URL
console.log('\n🧪 Test 2: Testing Minimal OAuth URL');
const minimalUrl = `https://accounts.google.com/oauth2/auth?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

console.log('Testing URL:', minimalUrl);

const testRequest = (url, description) => {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OAuth-Debug/1.0)'
      }
    };

    const req = https.request(options, (res) => {
      console.log(`${description}: ${res.statusCode} ${res.statusMessage}`);
      
      if (res.statusCode === 404) {
        console.log('❌ 404 Error - This suggests:');
        console.log('   • Client ID does not exist');
        console.log('   • Client ID is from wrong Google Cloud project');
        console.log('   • OAuth app has been deleted or disabled');
      } else if (res.statusCode === 400) {
        console.log('⚠️  400 Error - This suggests:');
        console.log('   • Redirect URI not configured');
        console.log('   • Invalid parameters');
      } else if (res.statusCode === 200 || res.statusCode === 302) {
        console.log('✅ OAuth endpoint is working');
      }
      
      resolve(res.statusCode);
    });

    req.on('error', (err) => {
      console.log(`❌ Network error: ${err.message}`);
      resolve(null);
    });

    req.setTimeout(10000, () => {
      console.log('❌ Request timeout');
      req.destroy();
      resolve(null);
    });

    req.end();
  });
};

// Test the minimal URL
testRequest(minimalUrl, 'Minimal OAuth URL').then((status) => {
  console.log('\n🔧 Troubleshooting Steps:');
  
  if (status === 404) {
    console.log('\n❌ 404 Error Detected - Follow these steps:');
    console.log('\n1. 📋 Verify Google Cloud Console Setup:');
    console.log('   • Go to https://console.cloud.google.com/');
    console.log('   • Make sure you\'re in the correct project');
    console.log('   • Go to APIs & Services → Credentials');
    console.log('   • Verify your OAuth 2.0 Client ID exists and matches:');
    console.log(`     ${CLIENT_ID}`);
    
    console.log('\n2. 🔍 Check OAuth Client Status:');
    console.log('   • In Credentials, click on your OAuth 2.0 Client ID');
    console.log('   • Make sure it\'s not disabled or deleted');
    console.log('   • Check the "Application type" (should be "Web application")');
    
    console.log('\n3. ✅ Verify Authorized Redirect URIs:');
    console.log('   • In your OAuth client settings, check "Authorized redirect URIs"');
    console.log('   • Make sure this EXACT URI is listed:');
    console.log(`     ${REDIRECT_URI}`);
    console.log('   • No trailing slashes, exact match required');
    
    console.log('\n4. 🚀 Check OAuth Consent Screen:');
    console.log('   • Go to APIs & Services → OAuth consent screen');
    console.log('   • Make sure it\'s configured and published');
    console.log('   • For testing, "External" user type is fine');
    
    console.log('\n5. 🔑 Enable Required APIs:');
    console.log('   • Go to APIs & Services → Library');
    console.log('   • Search for and enable "Gmail API"');
    console.log('   • Make sure it\'s enabled for your project');
    
  } else if (status === 400) {
    console.log('\n⚠️  400 Error - Check redirect URI configuration');
  } else if (status === 200 || status === 302) {
    console.log('\n✅ OAuth endpoint is working - the issue might be elsewhere');
  }
  
  console.log('\n📞 If issues persist:');
  console.log('   • Try creating a new OAuth 2.0 Client ID');
  console.log('   • Make sure you\'re using the correct Google account');
  console.log('   • Check Google Cloud Console billing is set up');
  console.log('   • Verify project quotas and limits');
});
