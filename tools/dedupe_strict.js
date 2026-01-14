
const fs = require('fs');

const files = [
    'data/terms/finance.ts',
    'data/terms/fintech.ts',
    'data/terms/technology.ts'
];

const seenTerms = new Map(); // term_en -> { fileName, id }

function processFile(filePath) {
    const fullPath = filePath;
    let content = fs.readFileSync(fullPath, 'utf8');

    // Split by createTerm to handle each block
    // We assume standard formatting: createTerm('id', 'Term', ...)

    // We will rebuild the content
    const header = content.split('export const')[0] + `export const ${filePath.includes('finance') ? 'financeTerms' : filePath.includes('fintech') ? 'fintechTerms' : 'technologyTerms'}: Term[] = [\n`;

    let newTermList = [];

    // Regex to match createTerm blocks
    // Matches: createTerm( ... );
    // We use a regex that captures the English term (2nd argument)
    // createTerm('term_id', 'English Term',
    const regex = /createTerm\(\s*'([^']+)',\s*'([^']+)'/g;

    let match;
    let validTerms = [];

    // We need to iterate over the content and identify blocks.
    // Simpler approach: split by "createTerm(" and process each chunk.

    const chunks = content.split('createTerm(');
    // Chunk 0 is header (or previous part).

    let finalContent = chunks[0];

    for (let i = 1; i < chunks.length; i++) {
        const chunk = chunks[i];

        // Extract ID and English term
        // format: 'term_id', 'English Term', ...
        const argsMatch = chunk.match(/^\s*'([^']+)',\s*'([^']+)'/);

        if (argsMatch) {
            const id = argsMatch[1];
            const enTerm = argsMatch[2].trim().toLowerCase(); // Normalize

            if (seenTerms.has(enTerm)) {
                const existing = seenTerms.get(enTerm);
                console.log(`Duplicate found: "${argsMatch[2]}" (${id}) in ${filePath}. Already exists in ${existing.fileName} (${existing.id}). REMOVING.`);
                // Do not add this chunk
                // But we must be careful about the closing characters of the array if this was the last item.
                // The chunk usually ends with ")," or ");" or just matches until next createTerm.
                // Actually, split removes the delimiter. So we just skip appending "createTerm(" + chunk.
            } else {
                seenTerms.set(enTerm, { fileName: filePath, id });
                finalContent += 'createTerm(' + chunk;
            }
        } else {
            // Something weird, just append it back to be safe?
            console.log(`Could not parse term in ${filePath} chunk ${i}`);
            finalContent += 'createTerm(' + chunk;
        }
    }

    // Fix any potential formatting issues at the end (e.g. if last item was removed, we might have a trailing comma problem or missing bracket if not handled by split)
    // The chunks usually include the trailing syntax.
    // If we remove the last chunk, we might lose the closing "];".
    // Wait, the "];" is typically part of the last chunk.
    // If the last term is a duplicate and removed, we lose the "];".
    // We need to ensure the file ends with "];".

    if (!finalContent.trim().endsWith('];')) {
        // If we removed the last chunk, we might need to close the array.
        // Or if the last chunk contained extraneous newlines.

        // Let's check if the last kept chunk has the closing bracket.
        // Actually, if we remove a chunk that had "];", we lose it.
        // We should detect if the removed chunk had the closing "];" and append it to `finalContent`.
    }

    // A safer way: parsing completely line by line might be better but split is okay if we handle the footer.
    // Let's rely on the fix_format user tool to fix brackets if needed?
    // Or just append "];" if missing.

    // Check if original content ended with "];"
    if (content.trim().endsWith('];') && !finalContent.trim().endsWith('];')) {
        // We likely removed the last term which held the closing bracket.
        // We should strip the partial trailing comma from the current end and add "];"
        finalContent = finalContent.trimEnd();
        if (finalContent.endsWith(',')) {
            finalContent = finalContent.slice(0, -1);
        }
        finalContent += '\n];\n';
    }

    fs.writeFileSync(fullPath, finalContent);
}

files.forEach(processFile);
