
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Basic .env parser since we want to avoid extra deps if possible
function loadEnv() {
    try {
        const envPath = path.resolve(process.cwd(), '.env.local');
        const envFile = fs.readFileSync(envPath, 'utf8');
        const env = {};
        envFile.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^["']|["']$/g, ''); // Remove quotes
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
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Helper to parse terms from file content (regex based to avoid TS compilation issues)
function parseTerms(filePath, category) {
    const content = fs.readFileSync(filePath, 'utf8');
    const terms = [];

    // Regex: createTerm('id', 'en', 'ru', 'tr', 'Category', 'defEn'...)
    // This is brittle with complex multiline strings.
    // Better approach: Since we have the files locally and they are JS/TS-like,
    // we can try to evaluate them if we mock 'createTerm'.
    // But they are TS files ("data/terms/finance.ts").
    // Evaluation might fail on "import { Term } from ...".

    // Let's allow node to require them by first transpiling or using a simplified regex parser 
    // that assumes the structure we just generated.

    // Our generator structure:
    // createTerm('id', 'Term', 'Ru', 'Tr', 'Category',
    //    'DefEn',
    //    'DefRu',
    //    ...
    // )

    // Let's try a robust regex or simple state machine.

    const chunks = content.split('createTerm(');
    for (let i = 1; i < chunks.length; i++) {
        const chunk = chunks[i];
        // We need to parse arguments.
        // Naive args parser: split by "', '" might fail if commas in text.
        // We can parse single quoted strings.

        const args = [];
        let currentString = '';
        let inString = false;
        let p = 0;

        while (p < chunk.length) {
            const char = chunk[p];
            if (char === "'") {
                // simple escape check for \' ?
                if (inString && chunk[p - 1] === '\\') {
                    currentString += "'";
                } else {
                    if (inString) {
                        // End of string
                        args.push(currentString);
                        currentString = '';
                    } else {
                        // Start of string
                    }
                    inString = !inString;
                }
            } else if (inString) {
                currentString += char;
            } else if (char === ')') {
                // End of function call?
                break;
            }
            p++;
        }

        if (args.length >= 5) {
            // Mapping based on createTerm signature:
            // id, en, ru, tr, category, defEn, defRu, defTr, exEn, exRu, exTr, phonEn?, phonRu?, phonTr?

            terms.push({
                id: args[0],
                term_en: args[1],
                term_ru: args[2],
                term_tr: args[3],
                category: args[4],
                definition_en: args[5],
                definition_ru: args[6],
                definition_tr: args[7],
                example_sentence_en: args[8],
                example_sentence_ru: args[9],
                example_sentence_tr: args[10],
                phonetic_en: args[11] || null,
                phonetic_ru: args[12] || null,
                phonetic_tr: args[13] || null,
                // Remove SRS fields as they are not in the 'terms' table
                updated_at: new Date().toISOString()
            });
        }
    }
    return terms;
}

async function sync() {
    console.log('Starting Supabase Sync...');

    const files = [
        { path: 'data/terms/finance.ts', category: 'Finance' },
        { path: 'data/terms/fintech.ts', category: 'Fintech' },
        { path: 'data/terms/technology.ts', category: 'Technology' }
    ];

    let allTerms = [];
    files.forEach(f => {
        const t = parseTerms(f.path, f.category);
        console.log(`Parsed ${t.length} terms from ${f.path}`);
        allTerms = [...allTerms, ...t];
    });

    console.log(`Total terms to sync: ${allTerms.length}`);

    // Batch Insert (upsert)
    const BATCH_SIZE = 50;
    for (let i = 0; i < allTerms.length; i += BATCH_SIZE) {
        const batch = allTerms.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('terms').upsert(batch, { onConflict: 'id' });

        if (error) {
            console.error(`Error syncing batch ${i}-${i + BATCH_SIZE}:`, error.message);
        } else {
            console.log(`Synced batch ${i}-${i + BATCH_SIZE}`);
        }
    }

    console.log('Sync complete.');
}

sync();
