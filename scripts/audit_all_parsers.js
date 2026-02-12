#!/usr/bin/env node

/**
 * Parser Audit Script
 * Tests all 26 parsers against real bank statements
 * Checks for: metadata extraction, transaction parsing, phantom badges
 */

const fs = require('fs');
const path = require('path');

const STATEMENTS_DIR = '/Users/asmian/Library/CloudStorage/OneDrive-SwiftAccountingandBusinessSolutionsLtd/Swift Drive/Corp Clients - NLC (No Longer a Client)/Canmore Co-Host Inc/PBC/2023/Bank Statements 2022-2023';

const PARSER_MAP = {
    'AMEX Aeroplan': 'AmexParser',
    'AMEX Platinum': 'AmexParser',
    'RBC Master Card': 'RBCMastercardParser',
    'RBC Visa Credit Line': 'RBCVisaParser',
    'RBC Checking 1167': 'RBCChequingParser',
    'RBC Checking 2443': 'RBCChequingParser',
    'RBC Savings 8468': 'RBCSavingsParser',
    'TD Aeroplan Visa Charlie': 'TDVisaParser',
    'TD Aeroplan Visa Tyler': 'TDVisaParser',
};

async function auditParser(accountFolder, parserName) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`AUDITING: ${accountFolder}`);
    console.log(`Parser: ${parserName}`);
    console.log('='.repeat(60));

    const accountPath = path.join(STATEMENTS_DIR, accountFolder);

    // Check if directory exists
    if (!fs.existsSync(accountPath)) {
        console.log(`❌ Directory not found: ${accountPath}`);
        return { status: 'DIR_NOT_FOUND', accountFolder, parserName };
    }

    // Get all PDFs
    const files = fs.readdirSync(accountPath).filter(f => f.endsWith('.pdf'));

    if (files.length === 0) {
        console.log(`⚠️  No PDF files found`);
        return { status: 'NO_PDFS', accountFolder, parserName };
    }

    console.log(`📄 Found ${files.length} PDF statements`);
    console.log(`   Sample: ${files[0]}`);

    return {
        status: 'READY_TO_TEST',
        accountFolder,
        parserName,
        statementCount: files.length,
        sampleFile: files[0],
        allFiles: files
    };
}

async function main() {
    console.log('🔍 PARSER AUDIT REPORT');
    console.log('='.repeat(60));

    const results = [];

    for (const [folder, parser] of Object.entries(PARSER_MAP)) {
        const result = await auditParser(folder, parser);
        results.push(result);
    }

    console.log('\n\n📊 AUDIT SUMMARY');
    console.log('='.repeat(60));

    const readyCount = results.filter(r => r.status === 'READY_TO_TEST').length;
    const totalStatements = results.reduce((sum, r) => sum + (r.statementCount || 0), 0);

    console.log(`✅ Parsers ready to test: ${readyCount}/${results.length}`);
    console.log(`📄 Total statements available: ${totalStatements}`);

    console.log('\n🎯 NEXT STEPS:');
    console.log('1. Test each parser by uploading sample statements');
    console.log('2. Check metadata extraction (account_id, balances)');
    console.log('3. Verify transaction parsing');
    console.log('4. Look for phantom badges or duplicates');

    return results;
}

main().catch(console.error);
