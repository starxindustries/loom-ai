#!/usr/bin/env node

/**
 * Legacy Migration Runner
 * This file is kept for backward compatibility
 * Use scripts/run-migrations.js for new migrations
 */

const { exec } = require('child_process');
const path = require('path');

console.log('⚠️  This migration runner is deprecated.');
console.log('   Please use: node scripts/run-migrations.js run');
console.log('');

// Run the new migration script
const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'run-migrations.js');
exec(`node ${scriptPath} run`, (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
  
  console.log(stdout);
  if (stderr) {
    console.error(stderr);
  }
});
