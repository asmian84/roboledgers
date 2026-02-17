#!/usr/bin/env python3
import sys

# Read the original file
with open('/Users/asmian/RoboLedger - working copy/src/ui/enterprise/ledger.core.js', 'r') as f:
    lines = f.readlines()

# Read the new COA
with open('/tmp/coa_js.txt', 'r') as f:
    new_coa = f.read()

# Find where to insert (should be around line 37)
output_lines = []
i = 0
while i < len(lines):
    # Look for the COA start marker
    if '// --- COA DATA (V5 PRE-SEED) ---' in lines[i]:
        output_lines.append(lines[i])  # Keep the comment
        i += 1
        # Skip the old COA_DEFAULTS until we find the closing ];
        while i < len(lines) and not ('];' in lines[i] and 'COA_DEFAULTS' in lines[i-5:i+1].__str__()):
            i += 1
        # Now insert the new COA
        output_lines.append(new_coa)
        # Skip the closing ]; of old COA (we already have it in new_coa)
        i += 1
    else:
        output_lines.append(lines[i])
        i += 1

# Write back
with open('/Users/asmian/RoboLedger - working copy/src/ui/enterprise/ledger.core.js', 'w') as f:
    f.writelines(output_lines)

print("✅ COA updated successfully!")
