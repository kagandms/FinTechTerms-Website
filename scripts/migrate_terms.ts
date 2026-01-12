
import { createClient } from '@supabase/supabase-js';
import { mockTerms } from '../data/mockData';
import * as fs from 'fs';
import * as path from 'path';

// Read env vars from .env.local manually to avoid dotenv dependency issues
const envPath = path.resolve(__dirname, '../.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');

const getEnvParam = (key: string): string => {
    const match = envFile.match(new RegExp(`^${key}=(.*)$`, 'm'));
    if (!match || !match[1]) throw new Error(`Missing ${key} in .env.local`);
    return match[1].trim();
};

const SUPABASE_URL = getEnvParam('NEXT_PUBLIC_SUPABASE_URL');
const SERVICE_KEY = getEnvParam('SUPABASE_SERVICE_ROLE_KEY');

// Initialize Supabase Admin Client (Service Role)
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function migrate() {
    console.log(`Starting migration of ${mockTerms.length} terms...`);

    const records = mockTerms.map(term => ({
        id: term.id,
        term_en: term.term_en,
        term_ru: term.term_ru,
        term_tr: term.term_tr,
        phonetic_en: term.phonetic_en || null,
        phonetic_ru: term.phonetic_ru || null,
        phonetic_tr: term.phonetic_tr || null,
        category: term.category,
        definition_en: term.definition_en,
        definition_ru: term.definition_ru,
        definition_tr: term.definition_tr,
        example_sentence_en: term.example_sentence_en,
        example_sentence_ru: term.example_sentence_ru,
        example_sentence_tr: term.example_sentence_tr,
    }));

    const { error } = await supabase
        .from('terms')
        .upsert(records, { onConflict: 'id' });

    if (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } else {
        console.log('Successfully migrated terms to Supabase!');
    }
}

migrate();
