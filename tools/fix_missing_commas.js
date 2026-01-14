
const fs = require('fs');

const files = [
    'data/terms/finance.ts',
    'data/terms/fintech.ts',
    'data/terms/technology.ts'
];

function processFile(filePath) {
    const fullPath = filePath;
    if (!fs.existsSync(fullPath)) return;

    let content = fs.readFileSync(fullPath, 'utf8');

    // Insert comma between ) and createTerm if missing
    // Regex: look for ) followed by whitespace followed by createTerm
    content = content.replace(/\)(\s+createTerm\()/g, '),$1');

    fs.writeFileSync(fullPath, content);
    console.log(`Fixed missing commas in ${filePath}`);
}

files.forEach(processFile);
