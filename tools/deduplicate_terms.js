
const fs = require('fs');
const path = require('path');

const files = [
    'data/terms/fintech.ts',
    'data/terms/technology.ts',
    'data/terms/finance.ts'
];

// Regex to match a full createTerm call
const termRegex = /createTerm\(\s*'([^']*)',\s*'([^']*)'[\s\S]*?\),/g;

const run = () => {
    let termMap = new Map(); // termName -> { id, file, fullMatch }
    let duplicatesToRemove = []; // List of { file, exactMatchString }

    // 1. First Pass: Identify all terms and find duplicates (preferring lower IDs)
    files.forEach(file => {
        const filePath = path.join(__dirname, '..', file);
        if (!fs.existsSync(filePath)) return;

        const content = fs.readFileSync(filePath, 'utf8');
        let match;

        // We need to loop manually to catch them all
        while ((match = termRegex.exec(content)) !== null) {
            const id = match[1];
            const term = match[2].toLowerCase().trim();
            const fullMatch = match[0];

            // Extract numeric part of ID for comparison
            const idNum = parseInt(id.split('_')[1] || '999999');

            if (termMap.has(term)) {
                const existing = termMap.get(term);
                const existingIdNum = parseInt(existing.id.split('_')[1] || '999999');

                console.log(`Conflict: "${term}" (New: ${id}, Old: ${existing.id})`);

                if (idNum > existingIdNum) {
                    // New one is greater (newer), remove NEW
                    duplicatesToRemove.push({ file, id, term });
                } else {
                    // New one is smaller (actually older but read later?), remove OLD
                    // This is trickier if across files. 
                    // To be safe, we usually assume the "original" files had lower IDs. 
                    // Let's strictly delete the HIGHER ID number.

                    // Note: We can't easily retroactively delete from "existing" if we already processed it in the previous file loop
                    // but we can add it to the list if we store file path in map.
                    duplicatesToRemove.push({ file: existing.file, id: existing.id, term });

                    // Update map to keep the lower one as the "canon"
                    termMap.set(term, { id, file, fullMatch });
                }
            } else {
                termMap.set(term, { id, file, fullMatch });
            }
        }
    });

    console.log(`\nFound ${duplicatesToRemove.length} duplicates to remove.`);

    // 2. Second Pass: Perform Deletion
    // We group by file to read/write once per file
    const fileGroups = {};
    duplicatesToRemove.forEach(d => {
        if (!fileGroups[d.file]) fileGroups[d.file] = [];
        fileGroups[d.file].push(d.id);
    });

    for (const [relativePath, idsToRemove] of Object.entries(fileGroups)) {
        const filePath = path.join(__dirname, '..', relativePath);
        let content = fs.readFileSync(filePath, 'utf8');
        let originalLength = content.length;

        idsToRemove.forEach(id => {
            // Regex to match the specific term entry by ID
            // createTerm('term_5022', ... ),
            const specificRegex = new RegExp(`\\s*createTerm\\(\\s*'${id}'[\\s\\S]*?\\),`, 'g');
            content = content.replace(specificRegex, '');
        });

        // Also clean up any double commas or empty lines left behind if needed, 
        // strictly speaking the regex includes the trailing comma so it should be fine mostly.

        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${relativePath}: Removed ${idsToRemove.length} terms.`);
    }

    console.log('Deduplication Complete.');
};

run();
