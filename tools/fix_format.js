
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

    // Remove intermediate ];
    // Replace ]; followed by anything until createTerm with comma?
    // Or just replace all ]; with , except the last one.

    // Safety check: preserve the LAST ];
    // We can replace ALL ]; with , and then append ]; at the very end.

    content = content.replace(/\];/g, ',');

    // Trim
    content = content.trimEnd();
    while (content.endsWith(',')) {
        content = content.slice(0, -1).trimEnd();
    }

    // Append ];
    content = content + '\n];\n';

    fs.writeFileSync(fullPath, content);
    console.log(`Fixed ${filePath}`);
}

files.forEach(processFile);
