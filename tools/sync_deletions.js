
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('Missing env vars (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY).');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// 1. Read Local Terms
const files = [
    'data/terms/fintech.ts',
    'data/terms/technology.ts',
    'data/terms/finance.ts'
];

const termRegex = /createTerm\(\s*'([^']*)'/g;
const localIds = new Set();

files.forEach(file => {
    const content = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    let match;
    while ((match = termRegex.exec(content)) !== null) {
        localIds.add(match[1]);
    }
});

console.log(`Local Terms Count: ${localIds.size}`);

const run = async () => {
    // 2. Fetch All Supabase Terms
    // We need to paginate because limit is 1000
    let allDbTerms = [];
    let from = 0;
    const limit = 1000;

    while (true) {
        const { data, error } = await supabase
            .from('terms')
            .select('id')
            .range(from, from + limit - 1);

        if (error) {
            console.error('Error fetching terms:', error);
            return;
        }

        allDbTerms = allDbTerms.concat(data);
        if (data.length < limit) break;
        from += limit;
    }

    console.log(`DB Terms Count: ${allDbTerms.length}`);

    // 3. Find Orphans
    const termsToDelete = allDbTerms.filter(t => !localIds.has(t.id)).map(t => t.id);

    console.log(`Found ${termsToDelete.length} terms to delete from DB.`);

    if (termsToDelete.length > 0) {
        // Delete in batches
        const batchSize = 100;
        for (let i = 0; i < termsToDelete.length; i += batchSize) {
            const batch = termsToDelete.slice(i, i + batchSize);
            const { error } = await supabase
                .from('terms')
                .delete()
                .in('id', batch);

            if (error) {
                console.error('Error deleting batch:', error);
            } else {
                console.log(`Deleted batch ${i}-${i + batch.length}`);
            }
        }
    }

    console.log('Sync Deletions Complete.');
};

run();
