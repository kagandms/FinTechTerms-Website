
const fs = require('fs');
const path = require('path');

const filePath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(__dirname, '../data/terms/fintech.ts');

console.log(`Fixing commas in: ${filePath}`);

try {
    let content = fs.readFileSync(filePath, 'utf8');

    // Replace double commas with single comma, accounting for whitespace/newlines
    // Looking for: , followed by optional whitespace/newlines, followed by ,
    const fixedContent = content.replace(/,\s*,/g, ',');

    // Also fix potential start of array issue: [ followed by ,
    const fixedContent2 = fixedContent.replace(/\[\s*,/g, '[');

    if (content !== fixedContent2) {
        fs.writeFileSync(filePath, fixedContent2);
        console.log('Fixed double commas in fintech.ts');
    } else {
        console.log('No double commas found.');
    }

} catch (err) {
    console.error('Error fixing commas:', err);
}
