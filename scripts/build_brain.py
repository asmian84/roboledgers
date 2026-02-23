#!/usr/bin/env python3
"""
BUILD THE CATEGORIZATION BRAIN
===============================
Processes 79,049 human-categorized transactions from /Users/asmian/XLSX/
and generates a multi-layer categorization model for RoboLedger.

Output: src/data/categorization_brain.json

Layers:
1. EXACT_VENDORS — Normalized vendor name → account (highest confidence)
2. ENTITY_REGISTER — Named people/companies with roles (client, vendor, shareholder, subcontractor)
3. PATTERN_TEMPLATES — Generalized description patterns → account
4. KEYWORD_SIGNALS — Individual keyword → account weights
5. TRANSFER_PATTERNS — Inter-account transfer detection patterns
6. INDUSTRY_PROFILES — Account distribution fingerprints per client/industry
"""

import json
import re
import os
import sys
from collections import defaultdict, Counter
from pathlib import Path

INPUT_FILE = "/Users/asmian/RoboLedger - working copy 2/.claude/worktrees/hungry-villani/src/data/firm_categorizations.json"
OUTPUT_FILE = "/Users/asmian/RoboLedger - working copy 2/.claude/worktrees/hungry-villani/src/data/categorization_brain.json"

# ─── ACCOUNT TYPE MAPPING ──────────────────────────────────────────────────────
def get_account_type(code):
    """Map 4-digit COA code to account type."""
    n = int(code)
    if 1000 <= n <= 1999: return 'ASSET'
    if 2000 <= n <= 2999: return 'LIABILITY'
    if 3000 <= n <= 3999: return 'EQUITY'
    if 4000 <= n <= 4999: return 'REVENUE'
    if 5000 <= n <= 9999: return 'EXPENSE'
    return 'UNKNOWN'

# ─── NORMALIZATION ──────────────────────────────────────────────────────────────
NOISE_PATTERNS = [
    r'\d{4}[-/]\d{2}[-/]\d{2}',      # Dates
    r'\$[\d,]+\.?\d*',                 # Dollar amounts
    r'#\w+',                           # Reference numbers
    r'\b\d{8,}\b',                     # Long numbers (account numbers)
    r'\b\d{5,7}\b',                    # Medium numbers
    r'\*+\d+',                         # Masked card numbers (*4521)
    r'\bC\d{5}\b',                     # Shell station codes (C44131)
    r'\b[A-Z]{2}\s*$',                 # Province codes at end
    r'\bON\b|\bAB\b|\bBC\b|\bQC\b',   # Province codes inline
    r'\bCA\b',                         # Country code
    r'\b\d{3,4}\b(?!\d)',              # 3-4 digit numbers (store numbers)
]

STOP_WORDS = {
    'THE', 'AND', 'FOR', 'FROM', 'WITH', 'INC', 'LTD', 'CORP', 'LLC',
    'CO', 'COMPANY', 'LIMITED', 'CORPORATION', 'SERVICES', 'GROUP',
}

def normalize_vendor(desc):
    """Normalize a transaction description to a canonical vendor name."""
    if not desc:
        return None
    s = desc.upper().strip()

    # Remove noise
    for pattern in NOISE_PATTERNS:
        s = re.sub(pattern, '', s)

    # Clean whitespace
    s = re.sub(r'\s+', ' ', s).strip()

    # Remove trailing punctuation
    s = re.sub(r'[,.\-/\\]+$', '', s).strip()

    if len(s) < 2:
        return None
    return s

def extract_entity_name(desc):
    """Extract a person or company name from e-transfer descriptions."""
    desc_upper = desc.upper().strip()

    # Patterns that contain entity names
    patterns = [
        r'E-?TRANSFER\s*(?:-\s*)?(?:SENT|RECEIVED|AUTODEPOSIT|DEPOSIT|DEBIT)\s+(.+)',
        r'E\s+TRANSFER\s+(?:SENT|RECEIVED|AUTODEPOSIT)\s+(.+)',
        r'INTERAC\s+(?:E-?TRANSFER\s+)?(?:SENT|RECEIVED)\s*-?\s*(.+)',
        r'ONLINE\s+TRANSFER\s+SENT\s*-?\s*(.+)',
        r'E-?TRANSFER\s*-\s*(.+)',
        r'E\s+TRANSFER\s+(.+?)(?:\s+INC|\s+LTD|\s+CORP)?$',
    ]

    for pattern in patterns:
        match = re.search(pattern, desc_upper)
        if match:
            name = match.group(1).strip()
            # Clean up
            name = re.sub(r'\s+', ' ', name)
            name = re.sub(r'[,.\-]+$', '', name).strip()
            # Skip if too short or looks like a transaction type
            if len(name) >= 3 and not re.match(r'^(FEE|CANCEL|RETURN|REQUEST)', name):
                return name
    return None

def classify_entity_role(name, account, all_mappings_for_entity):
    """Determine the role of an entity based on which accounts they're associated with."""
    account_types = Counter()
    for acct in all_mappings_for_entity:
        account_types[get_account_type(acct)] += all_mappings_for_entity[acct]

    total = sum(account_types.values())
    if total == 0:
        return 'unknown'

    # Dominant type
    top_type, top_count = account_types.most_common(1)[0]
    ratio = top_count / total

    if top_type == 'REVENUE' and ratio > 0.6:
        return 'client'  # Sends money → revenue
    elif top_type == 'LIABILITY' and ratio > 0.5:
        return 'intercompany'  # Related company or shareholder
    elif top_type == 'EQUITY' and ratio > 0.5:
        return 'shareholder'
    elif top_type == 'EXPENSE' and ratio > 0.5:
        return 'vendor'  # We pay them → expense
    elif top_type == 'ASSET' and ratio > 0.5:
        return 'transfer'  # Money moving between accounts
    else:
        # Mixed — use the specific accounts
        accts = all_mappings_for_entity
        if any(a.startswith('52') or a.startswith('53') for a in accts):
            return 'subcontractor'  # COGS accounts
        if any(a.startswith('36') or a.startswith('31') for a in accts):
            return 'shareholder'
        return 'vendor'

def build_pattern_templates(vendor_rules):
    """Generalize specific vendor rules into reusable pattern templates."""
    templates = []

    # Group rules by their structural pattern
    pattern_groups = defaultdict(list)

    for rule in vendor_rules:
        desc = rule['pattern']

        # Detect structural type
        if re.match(r'^E-?TRANSFER.*(?:SENT|RECEIVED|AUTODEPOSIT)', desc, re.I):
            pattern_groups['etransfer'].append(rule)
        elif re.match(r'^(?:PAYMENT|PYMT)\s', desc, re.I):
            pattern_groups['payment'].append(rule)
        elif re.match(r'^(?:TRANSFER|TFR|XFER)\s', desc, re.I):
            pattern_groups['transfer'].append(rule)
        elif re.match(r'^(?:ONLINE|INTERNET)\s+(?:BANKING|TRANSFER|PAYMENT)', desc, re.I):
            pattern_groups['online_banking'].append(rule)
        elif re.match(r'^(?:SERVICE\s+CHARGE|MONTHLY\s+FEE|INTEREST)', desc, re.I):
            pattern_groups['bank_fee'].append(rule)
        elif re.match(r'^(?:INSURANCE|AUTO\s+INSURANCE)', desc, re.I):
            pattern_groups['insurance'].append(rule)
        elif re.match(r'^(?:BILL\s+PAYMENT|PRE.AUTH)', desc, re.I):
            pattern_groups['bill_payment'].append(rule)
        elif re.match(r'^(?:POS|PURCHASE|RETAIL)', desc, re.I):
            pattern_groups['pos_purchase'].append(rule)
        elif re.match(r'^(?:MISC\s+PAYMENT)', desc, re.I):
            pattern_groups['misc_payment'].append(rule)
        elif re.match(r'^(?:DIRECT\s+DEPOSIT|PAYROLL|SALARY)', desc, re.I):
            pattern_groups['payroll'].append(rule)
        elif re.match(r'^(?:WITHDRAWAL|ABM|ATM)', desc, re.I):
            pattern_groups['withdrawal'].append(rule)

    # Generate templates from each group
    for group_name, rules in pattern_groups.items():
        # Find dominant accounts
        account_votes = Counter()
        for r in rules:
            account_votes[r['account']] += r['occurrences']

        total_txns = sum(account_votes.values())
        top_accounts = account_votes.most_common(5)

        # Build template
        template = {
            'type': group_name,
            'rule_count': len(rules),
            'total_transactions': total_txns,
            'accounts': {acct: {'count': cnt, 'pct': round(cnt/total_txns*100, 1)}
                        for acct, cnt in top_accounts},
            'default_account': top_accounts[0][0] if top_accounts else None,
            'default_confidence': round(top_accounts[0][1] / total_txns, 3) if top_accounts else 0,
        }

        # Add sub-patterns for e-transfers
        if group_name == 'etransfer':
            sent_rules = [r for r in rules if 'SENT' in r['pattern'].upper()]
            recv_rules = [r for r in rules if 'RECEIVED' in r['pattern'].upper() or 'AUTODEPOSIT' in r['pattern'].upper()]

            sent_accounts = Counter()
            for r in sent_rules:
                sent_accounts[r['account']] += r['occurrences']

            recv_accounts = Counter()
            for r in recv_rules:
                recv_accounts[r['account']] += r['occurrences']

            template['sent_accounts'] = {a: c for a, c in sent_accounts.most_common(10)}
            template['received_accounts'] = {a: c for a, c in recv_accounts.most_common(10)}
            template['sent_default'] = sent_accounts.most_common(1)[0][0] if sent_accounts else None
            template['received_default'] = recv_accounts.most_common(1)[0][0] if recv_accounts else None

        templates.append(template)

    return templates

def build_transfer_patterns(vendor_rules):
    """Extract inter-account transfer detection patterns."""
    transfer_indicators = []

    # Keywords that indicate inter-account transfers
    transfer_keywords = [
        'PAYMENT ATB', 'PAYMENT VISA', 'PAYMENT RBC', 'PAYMENT TD',
        'PAYMENT CIBC', 'PAYMENT AMEX', 'PAYMENT MASTERCARD',
        'VISA ROYAL BNK', 'TRANSFER TO CHEQ', 'TRANSFER FROM CHEQ',
        'INTERNET TRANSFER TO', 'INTERNET TRANSFER FROM',
        'ONLINE TRANSFER TF', 'TRANSFER TO CAD ACCT',
        'BILL PAYMENT', 'TRANSFER CC', 'MB TRANSFER',
        'DEPOSIT TRANSFER FROM', 'WITHDRAWAL TRANSFER TO',
    ]

    # Accounts commonly used for transfers
    transfer_accounts = Counter()
    for rule in vendor_rules:
        desc = rule['pattern'].upper()
        for kw in transfer_keywords:
            if kw in desc:
                transfer_indicators.append({
                    'pattern': rule['pattern'],
                    'account': rule['account'],
                    'occurrences': rule['occurrences'],
                    'confidence': rule['confidence'],
                    'keyword': kw,
                })
                transfer_accounts[rule['account']] += rule['occurrences']
                break

    return {
        'indicators': transfer_indicators,
        'common_accounts': dict(transfer_accounts.most_common(20)),
        'keywords': transfer_keywords,
    }

def build_industry_profiles(raw_mappings_by_source):
    """Detect industry profiles from account distribution per source file."""
    profiles = {}

    # Industry fingerprints — which accounts dominate tells you the industry
    INDUSTRY_FINGERPRINTS = {
        'property_management': {'4001', '4900', '4003', '7300', '8720', '6800'},
        'automotive_fleet': {'5335', '5336', '5350', '5351', '7400', '8400'},
        'construction': {'5100', '5200', '5300', '5310', '5325', '8800'},
        'professional_services': {'4000', '4020', '6100', '6400', '6800', '6900'},
        'hospitality': {'4001', '4003', '6415', '8100', '8450'},
        'trucking': {'5335', '5350', '5360', '7400', '8400', '8500'},
        'retail': {'4000', '4001', '5100', '8450', '8600'},
        'general': set(),
    }

    for source, mappings in raw_mappings_by_source.items():
        account_dist = Counter(m['account'] for m in mappings)
        total = sum(account_dist.values())
        if total < 20:
            continue

        # Score against each industry fingerprint
        scores = {}
        for industry, fingerprint_accounts in INDUSTRY_FINGERPRINTS.items():
            if not fingerprint_accounts:
                continue
            matching = sum(account_dist.get(a, 0) for a in fingerprint_accounts)
            scores[industry] = matching / total if total > 0 else 0

        # Pick best match
        if scores:
            best_industry = max(scores, key=scores.get)
            best_score = scores[best_industry]
        else:
            best_industry = 'general'
            best_score = 0

        profiles[source] = {
            'detected_industry': best_industry if best_score > 0.1 else 'general',
            'industry_score': round(best_score, 3),
            'transaction_count': total,
            'top_accounts': dict(account_dist.most_common(10)),
        }

    # Aggregate industry-level account distributions
    industry_aggregates = defaultdict(lambda: Counter())
    for source, profile in profiles.items():
        ind = profile['detected_industry']
        for acct, count in profile['top_accounts'].items():
            industry_aggregates[ind][acct] += count

    # Build industry bias weights
    industry_weights = {}
    for industry, acct_dist in industry_aggregates.items():
        total = sum(acct_dist.values())
        industry_weights[industry] = {
            'total_transactions': total,
            'source_count': sum(1 for p in profiles.values() if p['detected_industry'] == industry),
            'account_weights': {
                acct: round(count / total, 4)
                for acct, count in acct_dist.most_common(30)
            }
        }

    return {
        'source_profiles': profiles,
        'industry_weights': industry_weights,
    }


def main():
    print("Loading firm categorization data...")
    with open(INPUT_FILE) as f:
        data = json.load(f)

    vendor_rules = data['vendor_rules']
    high_conf = data['high_confidence_rules']
    keyword_rules = data['keyword_rules']
    raw_sample = data.get('raw_mappings_sample', [])

    print(f"  Vendor rules: {len(vendor_rules)}")
    print(f"  High-confidence rules: {len(high_conf)}")
    print(f"  Keyword rules: {len(keyword_rules)}")

    # ═══════════════════════════════════════════════════════════════════════════
    # LAYER 1: EXACT VENDOR MATCHES
    # ═══════════════════════════════════════════════════════════════════════════
    print("\n[Layer 1] Building exact vendor dictionary...")
    exact_vendors = {}
    for rule in vendor_rules:
        if rule['confidence'] >= 0.75 and rule['occurrences'] >= 2:
            normalized = normalize_vendor(rule['pattern'])
            if normalized and len(normalized) >= 3:
                existing = exact_vendors.get(normalized)
                if not existing or rule['occurrences'] > existing.get('n', 0):
                    exact_vendors[normalized] = {
                        'a': rule['account'],           # account code
                        'c': round(rule['confidence'], 2),  # confidence
                        'n': rule['occurrences'],       # occurrence count
                    }

    print(f"  Exact vendors: {len(exact_vendors)}")

    # ═══════════════════════════════════════════════════════════════════════════
    # LAYER 2: ENTITY REGISTER
    # ═══════════════════════════════════════════════════════════════════════════
    print("\n[Layer 2] Building entity register...")
    entity_accounts = defaultdict(lambda: Counter())  # entity_name → {account: count}

    for rule in vendor_rules:
        entity = extract_entity_name(rule['pattern'])
        if entity:
            entity_accounts[entity][rule['account']] += rule['occurrences']

    # Build register with roles
    entity_register = {}
    for entity, acct_votes in entity_accounts.items():
        total = sum(acct_votes.values())
        if total < 2:
            continue

        top_account = acct_votes.most_common(1)[0][0]
        role = classify_entity_role(entity, top_account, dict(acct_votes))

        entity_register[entity] = {
            'role': role,
            'default_account': top_account,
            'confidence': round(acct_votes[top_account] / total, 2),
            'total_interactions': total,
            'accounts': {a: c for a, c in acct_votes.most_common(3)},
        }

    print(f"  Entities registered: {len(entity_register)}")

    # Role breakdown
    role_counts = Counter(e['role'] for e in entity_register.values())
    for role, count in role_counts.most_common():
        print(f"    {role}: {count}")

    # ═══════════════════════════════════════════════════════════════════════════
    # LAYER 3: PATTERN TEMPLATES
    # ═══════════════════════════════════════════════════════════════════════════
    print("\n[Layer 3] Building pattern templates...")
    templates = build_pattern_templates(vendor_rules)
    print(f"  Pattern templates: {len(templates)}")
    for t in templates:
        print(f"    {t['type']}: {t['rule_count']} rules, {t['total_transactions']} txns → default {t['default_account']}")

    # ═══════════════════════════════════════════════════════════════════════════
    # LAYER 4: KEYWORD SIGNALS
    # ═══════════════════════════════════════════════════════════════════════════
    print("\n[Layer 4] Building keyword signals...")
    # Use the keyword rules from the extraction, but filter and weight
    keyword_signals = {}
    for rule in keyword_rules:
        kw = rule['keyword']
        if rule['confidence'] >= 0.6 and rule['total_occurrences'] >= 5:
            keyword_signals[kw] = {
                'a': rule['account'],
                'c': round(rule['confidence'], 2),
                'n': rule['total_occurrences'],
            }
    print(f"  Keyword signals: {len(keyword_signals)}")

    # ═══════════════════════════════════════════════════════════════════════════
    # LAYER 5: TRANSFER PATTERNS
    # ═══════════════════════════════════════════════════════════════════════════
    print("\n[Layer 5] Building transfer detection patterns...")
    transfer_data = build_transfer_patterns(vendor_rules)
    print(f"  Transfer indicators: {len(transfer_data['indicators'])}")
    print(f"  Common transfer accounts: {list(transfer_data['common_accounts'].keys())[:10]}")

    # ═══════════════════════════════════════════════════════════════════════════
    # LAYER 6: INDUSTRY PROFILES
    # ═══════════════════════════════════════════════════════════════════════════
    print("\n[Layer 6] Building industry profiles...")

    # Re-read from full extraction to get per-source data
    # Group raw mappings by source file
    raw_by_source = defaultdict(list)
    # We need to re-extract from the full firm_categorizations
    # For now, use the account_distribution and vendor rules to infer
    # We'll use vendor_rules grouped by source

    # Since we only have a sample, build industry profiles from account distribution
    acct_dist = data['account_distribution']
    total_txns = sum(acct_dist.values())

    # Build a single aggregate industry profile
    industry_data = {
        'aggregate': {
            'total_transactions': total_txns,
            'account_weights': {
                acct: round(int(count) / total_txns, 4)
                for acct, count in list(acct_dist.items())[:50]
            }
        }
    }

    print(f"  Industry profile built from {total_txns} transactions")

    # ═══════════════════════════════════════════════════════════════════════════
    # LAYER 7: ACCOUNT METADATA
    # ═══════════════════════════════════════════════════════════════════════════
    print("\n[Layer 7] Building account usage metadata...")
    account_meta = {}
    for acct, count in acct_dist.items():
        account_meta[acct] = {
            'usage_count': count,
            'usage_pct': round(count / total_txns * 100, 2),
            'type': get_account_type(acct),
        }
    print(f"  Account metadata: {len(account_meta)} accounts")

    # ═══════════════════════════════════════════════════════════════════════════
    # ASSEMBLE THE BRAIN
    # ═══════════════════════════════════════════════════════════════════════════
    brain = {
        '_meta': {
            'version': '1.0.0',
            'built_from': '79,049 manually categorized transactions',
            'source_files': data['metadata']['files_with_data'],
            'unique_accounts': data['metadata']['unique_accounts'],
            'generated_at': __import__('datetime').datetime.now().isoformat(),
            'layers': [
                'exact_vendors',
                'entity_register',
                'pattern_templates',
                'keyword_signals',
                'transfer_patterns',
                'industry_profiles',
                'account_metadata',
            ]
        },
        'exact_vendors': exact_vendors,
        'entity_register': entity_register,
        'pattern_templates': templates,
        'keyword_signals': keyword_signals,
        'transfer_patterns': transfer_data,
        'industry_profiles': industry_data,
        'account_metadata': account_meta,
    }

    # ═══════════════════════════════════════════════════════════════════════════
    # SAVE
    # ═══════════════════════════════════════════════════════════════════════════
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(brain, f, indent=2)

    file_size = os.path.getsize(OUTPUT_FILE) / 1024
    print(f"\n{'='*60}")
    print(f"BRAIN BUILT SUCCESSFULLY")
    print(f"{'='*60}")
    print(f"Output: {OUTPUT_FILE}")
    print(f"Size: {file_size:.1f} KB")
    print(f"\nLayer Summary:")
    print(f"  Layer 1 — Exact Vendors:     {len(exact_vendors):>6} entries")
    print(f"  Layer 2 — Entity Register:   {len(entity_register):>6} entities")
    print(f"  Layer 3 — Pattern Templates: {len(templates):>6} templates")
    print(f"  Layer 4 — Keyword Signals:   {len(keyword_signals):>6} keywords")
    print(f"  Layer 5 — Transfer Patterns: {len(transfer_data['indicators']):>6} indicators")
    print(f"  Layer 6 — Industry Profiles: {len(industry_data):>6} profiles")
    print(f"  Layer 7 — Account Metadata:  {len(account_meta):>6} accounts")

    # Quick stats
    print(f"\nEntity Role Breakdown:")
    for role, count in role_counts.most_common():
        entities_in_role = [e for e, v in entity_register.items() if v['role'] == role]
        print(f"  {role:>15}: {count:>4} entities")
        for e in entities_in_role[:3]:
            info = entity_register[e]
            print(f"                   → {e[:40]:<40} [{info['default_account']}] n={info['total_interactions']}")


if __name__ == '__main__':
    main()
