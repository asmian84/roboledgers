#!/usr/bin/env python3
"""
Batch update all credit card parsers to add balance extraction
Adds: const { openingBalance, closingBalance, statementPeriod } = this.extractBalances(statementText);
Returns: { transactions, metadata, openingBalance, closingBalance, statementPeriod }
"""

import re
import os

# List of parsers to update (excluding AmexParser and RBCVisaParser - already done)
parsers_to_update = [
    'RBCMastercardParser.js',
    'BMOVisaParser.js',
    'BMOMastercardParser.js',
    'BMOCreditCardParser.js',
    'TDVisaParser.js',
    'ScotiaVisaParser.js',
    'ScotiaMastercardParser.js',
    'ScotiaCreditCardParser.js',
    'ScotiaAmexParser.js',
    'CIBCVisaParser.js'
]

base_dir = '../src/parsers_raw'

for parser_file in parsers_to_update:
    filepath = os.path.join(base_dir, parser_file)
    
    if not os.path.exists(filepath):
        print(f"❌ {parser_file}: FILE NOT FOUND")
        continue
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check if already updated
    if 'closingBalance' in content and 'statementPeriod' in content:
        print(f"✅ {parser_file}: ALREADY UPDATED")
        continue
    
    # Find the parse() method
    parse_match = re.search(r'(async parse\(statementText[^)]*\)[^{]*{)', content, re.DOTALL)
    if not parse_match:
        print(f"⚠️  {parser_file}: NO parse() METHOD FOUND")
        continue
    
    # Find where we define transactions = []
    transactions_match = re.search(r'(const transactions = \[\];)', content)
    if transactions_match:
        # Add balance extraction right before transactions array
        insert_pos = transactions_match.start()
        extraction_code = '        // Extract balances using base helper\n        const { openingBalance, closingBalance, statementPeriod } = this.extractBalances(statementText);\n\n        '
        content = content[:insert_pos] + extraction_code + content[insert_pos:]
    
    # Find return statement and update it
    # Pattern: return { transactions, metadata ... };
    return_match = re.search(r'return \{ transactions, metadata(?::)? ([^}]+)\};', content)
    if return_match:
        # Replace with version that includes balances
        old_return = return_match.group(0)
        new_return = 'return { transactions, metadata' + (': ' + return_match.group(1) if return_match.group(1).strip() else '') + ', openingBalance, closingBalance, statementPeriod };'
        content = content.replace(old_return, new_return, 1)
    
    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"✅ {parser_file}: UPDATED")

print("\n✅ Batch update complete!")
