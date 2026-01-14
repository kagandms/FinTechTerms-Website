
// Diagnostic script to check if data loads correctly
const { mockTerms } = require('./data/mockData');
const { terms } = require('./data/terms/index');

console.log('Mock Data Check:');
console.log('mockTerms length:', mockTerms ? mockTerms.length : 'undefined');
console.log('terms length:', terms ? terms.length : 'undefined');

if (mockTerms && mockTerms.length > 0) {
    console.log('First term:', mockTerms[0].term_en);
    console.log('Last term:', mockTerms[mockTerms.length - 1].term_en);
}
