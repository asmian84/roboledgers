/**
 * Batch update all credit card parsers to use extractBalances() helper
 * Run this to check which parsers need updating
 */

const fs = require('fs');
const path = require('path');

const parsersDir = path.join(__dirname, '../src/parsers_raw');
const creditCardParsers = [
    'BMOCreditCardParser.js',
    'BMOVisaParser.js',
    'BMOMastercardParser.js',
    'RBCVisaParser.js',
    'RBCMastercardParser.js',
    'TDVisaParser.js',
    'ScotiaVisaParser.js',
    'ScotiaMastercardParser.js',
    'ScotiaCreditCardParser.js',
    'ScotiaAmexParser.js',
    'CIBCVisaParser.js'
];

creditCardParsers.forEach(filename => {
    const filepath = path.join(parsersDir, filename);
    if (fs.existsSync(filepath)) {
        const content = fs.readFileSync(filepath, 'utf8');

        // Check if parse() returns balances
        const hasBalanceReturn = content.includes('closingBalance') && content.includes('statementPeriod');

        console.log(`${filename}: ${hasBalanceReturn ? '✅ UPDATED' : '❌ NEEDS UPDATE'}`);

        if (!hasBalanceReturn) {
            // Check if parse method exists
            const parseMethodMatch = content.match(/async parse\(statementText[^)]*\)/);
            if (parseMethodMatch) {
                console.log(`  → Found parse() method, needs balance extraction`);
            }
        }
    } else {
        console.log(`${filename}: ⚠️  FILE NOT FOUND`);
    }
});

console.log('\n\nPattern to add:');
console.log('const { openingBalance, closingBalance, statementPeriod } = this.extractBalances(statementText);');
console.log('return { transactions, metadata, openingBalance, closingBalance, statementPeriod };');
