
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Basic .env parser
function loadEnv() {
    try {
        const envPath = path.resolve(process.cwd(), '.env.local');
        const envFile = fs.readFileSync(envPath, 'utf8');
        const env = {};
        envFile.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^["']|["']$/g, '');
                env[key] = value;
            }
        });
        return env;
    } catch (e) {
        console.error('Could not load .env.local');
        return {};
    }
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function getLocalIds() {
    const files = [
        'data/terms/finance.ts',
        'data/terms/fintech.ts',
        'data/terms/technology.ts'
    ];

    const ids = new Set();

    files.forEach(file => {
        const content = fs.readFileSync(file, 'utf8');
        const regex = /createTerm\(\s*'([^']+)'/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
            ids.add(match[1]);
        }
    });

    return ids;
}

async function prune() {
    console.log('Fetching all terms from Supabase...');

    // Fetch all IDs from Supabase
    // We need pagination if > 1000, supabase limit defaults to 1000.

    let allDbIds = [];
    let from = 0;
    const PAGE_SIZE = 1000;

    while (true) {
        const { data, error } = await supabase
            .from('terms')
            .select('id')
            .range(from, from + PAGE_SIZE - 1);

        if (error) {
            console.error('Error fetching IDs:', error);
            process.exit(1);
        }

        if (data.length === 0) break;

        data.forEach(row => allDbIds.push(row.id));
        from += PAGE_SIZE;

        if (data.length < PAGE_SIZE) break;
    }

    console.log(`Found ${allDbIds.length} terms in Supabase.`);

    const localIds = getLocalIds();
    console.log(`Found ${localIds.size} terms locally.`);

    const toDelete = allDbIds.filter(id => !localIds.has(id));

    if (toDelete.length === 0) {
        console.log('No terms to delete. Database is clean.');
        return;
    }

    console.log(`Found ${toDelete.length} terms to delete (orphaned).`);
    console.log('Deleting...');

    // Delete in batches
    const BATCH_SIZE = 50;
    for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
        const batch = toDelete.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
            .from('terms')
            .delete()
            .in('id', batch);

        if (error) {
            console.error('Error deleting batch:', error);
        } else {
            console.log(`Deleted batch ${i}-${Math.min(i + BATCH_SIZE, toDelete.length)}`);
        }
    }

    console.log('Pruning complete.');
}

prune();
