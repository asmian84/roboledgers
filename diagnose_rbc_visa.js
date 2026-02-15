// RBC Visa Date Diagnosis Script
// Run this in the console after uploading an RBC Visa PDF to see what's happening

// Get a sample transaction from VISA1
const visa1Txns = window.RoboLedger.Ledger.getAll().filter(t => t.account_id.includes('VISA'));
console.log('=== RBC VISA DATE DIAGNOSIS ===');
console.log('Total VISA transactions:', visa1Txns.length);

// Show first 10 transactions with dates
visa1Txns.slice(0, 10).forEach((tx, i) => {
    console.log(`\n Transaction ${i + 1}:`);
    console.log('  Date:', tx.date_iso || tx.date);
    console.log('  Description:', tx.description);
    console.log('  Raw Text:', tx.rawText?.substring(0, 100));
    console.log('  Audit:', tx.audit);
});

// Check if dates are all 1900-01-01
const badDates = visa1Txns.filter(t => (t.date_iso || t.date) === '1900-01-01');
console.log(`\n⚠️ Transactions with bad dates (1900-01-01): ${badDates.length} / ${visa1Txns.length}`);

if (badDates.length > 0) {
    console.log('\nSample bad date transaction:');
    console.log(badDates[0]);
}
