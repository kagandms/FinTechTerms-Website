
const fs = require('fs');
const path = require('path');

const files = [
    'data/terms/fintech.ts',
    'data/terms/technology.ts',
    'data/terms/finance.ts'
];

// Helper to manually parse the files since they are TS files and we can't just require them in JS easily without compilation.
// We'll use regex to extract terms.
const extractTerms = (content, category) => {
    const terms = [];
    const regex = /createTerm\(\s*'([^']*)',\s*'([^']*)'/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        terms.push({
            id: match[1],
            term: match[2],
            category: category
        });
    }
    return terms;
};

const audit = () => {
    let allTerms = [];
    let idMap = new Map();
    let termMap = new Map();
    let errors = {
        duplicateIds: [],
        duplicateTerms: [],
        malformedIds: []
    };

    console.log('Starting Audit...\n');

    files.forEach(file => {
        const filePath = path.join(__dirname, '..', file);
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            const category = path.basename(file, '.ts');
            const fileTerms = extractTerms(content, category);

            console.log(`Loaded ${fileTerms.length} terms from ${file}`);
            allTerms = allTerms.concat(fileTerms);
        } else {
            console.error(`File not found: ${file}`);
        }
    });

    console.log(`\nTotal Terms Analyzed: ${allTerms.length}\n`);

    // Check for duplicates
    allTerms.forEach(t => {
        // ID Check
        if (idMap.has(t.id)) {
            errors.duplicateIds.push({
                id: t.id,
                existing: idMap.get(t.id),
                current: t
            });
        } else {
            idMap.set(t.id, t);
        }

        // Term Name Check (Case insensitive)
        const normalizedTerm = t.term.toLowerCase().trim();
        if (termMap.has(normalizedTerm)) {
            errors.duplicateTerms.push({
                term: t.term,
                existing: termMap.get(normalizedTerm),
                current: t
            });
        } else {
            termMap.set(normalizedTerm, t);
        }

        // Malformed ID Check
        if (!/^term_\d+$/.test(t.id)) {
            errors.malformedIds.push(t);
        }
    });

    // Report
    if (errors.duplicateIds.length > 0) {
        console.log('❌ DUPLICATE IDs FOUND:');
        errors.duplicateIds.forEach(e => {
            console.log(`   ID: ${e.id} | Found in ${e.existing.category} AND ${e.current.category}`);
        });
    } else {
        console.log('✅ No Duplicate IDs found.');
    }

    if (errors.duplicateTerms.length > 0) {
        console.log('\n❌ DUPLICATE TERMS FOUND (Potential conflicts):');
        // Filter out strict duplicates (same ID) to just show same name different ID
        const nameCollisions = errors.duplicateTerms.filter(e => e.existing.id !== e.current.id);

        if (nameCollisions.length > 0) {
            nameCollisions.forEach(e => {
                console.log(`   "${e.term}" (${e.current.id} in ${e.current.category}) conflicts with "${e.existing.term}" (${e.existing.id} in ${e.existing.category})`);
            });
        } else {
            console.log('   (Only exact duplicates which are already covered by ID check)');
        }
    } else {
        console.log('\n✅ No Duplicate Terms found.');
    }

    if (errors.malformedIds.length > 0) {
        console.log('\n❌ MALFORMED IDs FOUND:');
        errors.malformedIds.forEach(t => console.log(`   ${t.id} (${t.term})`));
    }

    console.log('\nAudit Complete.');
};

audit();
