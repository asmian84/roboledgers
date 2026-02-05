import * as fs from 'fs';
import * as path from 'path';

/**
 * RoboLedgers: Parser Contamination Test
 * MANDATE: Sensors must never contain judgment or law.
 * This test ensures /src/parsers_raw/ remains a pure DMZ.
 */

const QUARANTINE_DIR = path.join(process.cwd(), 'src', 'parsers_raw');
const FORBIDDEN_KEYWORDS = [
    'ledger',
    'brain',
    'reconciliation',
    'coa',
    'txsig',
    'IngestionService',
    'CanonicalTransaction'
];

function testContamination() {
    console.log('--- ROBOLEDGERS PARSER CONTAMINATION TEST ---');

    if (!fs.existsSync(QUARANTINE_DIR)) {
        console.error(`ERROR: Quarantine directory not found at ${QUARANTINE_DIR}`);
        process.exit(1);
    }

    const files = getAllFiles(QUARANTINE_DIR).filter(f => f.endsWith('.js') || f.endsWith('.ts'));
    let failureCount = 0;

    files.forEach(file => {
        const relativePath = path.relative(process.cwd(), file);
        const content = fs.readFileSync(file, 'utf8');

        FORBIDDEN_KEYWORDS.forEach(keyword => {
            // Look for imports or direct mentions in the code
            const regex = new RegExp(`\\b${keyword}\\b`, 'i');
            if (regex.test(content)) {
                console.error(`[CONTAMINATION] File "${relativePath}" contains forbidden keyword: "${keyword}"`);
                failureCount++;
            }
        });
    });

    if (failureCount > 0) {
        console.error(`\nFAILED: Found ${failureCount} contamination instances in the quarantine zone.`);
        process.exit(1);
    } else {
        console.log('\nPASSED: Quarantine zone is pure. No contamination detected.');
    }
}

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
    const files = fs.readdirSync(dirPath);

    files.forEach((file) => {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
        } else {
            arrayOfFiles.push(fullPath);
        }
    });

    return arrayOfFiles;
}

testContamination();
