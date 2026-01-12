
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read env from .env.local
const envPath = path.resolve(__dirname, '../.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');

const getEnvParam = (key) => {
    const match = envFile.match(new RegExp(`^${key}=(.*)$`, 'm'));
    return match ? match[1].trim() : null;
};

const SUPABASE_URL = getEnvParam('NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_ANON_KEY = getEnvParam('NEXT_PUBLIC_SUPABASE_ANON_KEY');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
    console.log('Fetching terms with ANON key...');
    const { data, error } = await supabase.from('terms').select('*').limit(5);

    if (error) {
        console.error('Error fetching terms:', error);
    } else {
        console.log(`Success! Fetched ${data.length} terms.`);
        if (data.length > 0) {
            console.log('Sample:', data[0].term_en);
        } else {
            console.log('Warning: No terms found in table.');
        }
    }
}

check();
