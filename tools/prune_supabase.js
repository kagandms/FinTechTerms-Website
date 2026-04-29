#!/usr/bin/env node

process.stderr.write([
    'tools/prune_supabase.js is disabled.',
    'Use the guarded release sync path instead:',
    '  node scripts/sync_repo_terms.js --dry-run --prune-extra',
    '  ALLOW_REMOTE_DESTRUCTIVE_SCRIPTS=1 node scripts/sync_repo_terms.js --prune-extra',
    '',
].join('\n'));

process.exit(1);
