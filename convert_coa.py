import openpyxl

# Read Excel
wb = openpyxl.load_workbook('/Users/asmian/XLSX/coa full.xlsx')
ws = wb.active

# Map Type to root/class
def get_account_class(code, name, account_type):
    code_int = int(code)
    
    # Assets (1000-1999)
    if 1000 <= code_int <= 1999:
        if 'bank' in name.lower() or 'account' in name.lower():
            return {'root': 'ASSET', 'class': 'CASH_LIQ'}
        elif 'invest' in name.lower():
            return {'root': 'ASSET', 'class': 'INVEST_ST'}
        elif 'receivable' in name.lower():
            return {'root': 'ASSET', 'class': 'AR_TRADE'}
        elif 'prepaid' in name.lower():
            return {'root': 'ASSET', 'class': 'PREPAID'}
        elif 'accum' in name.lower():
            return {'root': 'ASSET', 'class': 'PPE_CONTRA'}
        else:
            return {'root': 'ASSET', 'class': 'PPE'}
    
    # Liabilities (2000-2999)
    elif 2000 <= code_int <= 2999:
        if 'payable' in name.lower():
            return {'root': 'LIABILITY', 'class': 'AP_TRADE'}
        elif 'gst' in name.lower() or 'tax' in name.lower():
            return {'root': 'LIABILITY', 'class': 'TAX_SALES'}
        elif 'loan' in name.lower() or 'mortgage' in name.lower():
            return {'root': 'LIABILITY', 'class': 'DEBT_LT'}
        else:
            return {'root': 'LIABILITY', 'class': 'ACCRUED'}
    
    # Equity (3000-3999)
    elif 3000 <= code_int <= 3999:
        if 'share' in name.lower() or 'capital' in name.lower():
            return {'root': 'EQUITY', 'class': 'EQUITY_CAP'}
        elif 'dividend' in name.lower():
            return {'root': 'EQUITY', 'class': 'EQUITY_DRAW'}
        elif 'retained' in name.lower():
            return {'root': 'EQUITY', 'class': 'EQUITY_RE'}
        else:
            return {'root': 'EQUITY', 'class': 'EQUITY_CONTRIB'}
    
    # Revenue (4000-4999)
    elif 4000 <= code_int <= 4999:
        return {'root': 'REVENUE', 'class': 'REV_OP'}
    
    # Expenses (5000-9999)
    else:
        if 5000 <= code_int <= 5999:
            return {'root': 'EXPENSE', 'class': 'COGS'}
        elif 'amort' in name.lower() or 'deprec' in name.lower():
            return {'root': 'EXPENSE', 'class': 'EXP_NON_CASH'}
        else:
            return {'root': 'EXPENSE', 'class': 'EXP_OP_G_A'}

# Generate JS array
js_entries = []
for row in ws.iter_rows(min_row=2, values_only=True):  # Skip header
    if row[0] is None:
        break
    
    code = str(row[0]).strip()
    name = row[1].strip()
    account_type = row[2] if row[2] else ''
    
    class_info = get_account_class(code, name, account_type)
    
    js_entry = f"        {{ code: '{code}', name: '{name}', class: '{class_info['class']}', root: '{class_info['root']}', balance: 0 }}"
    js_entries.append(js_entry)

# Output
print('    const COA_DEFAULTS = [')
print(',\n'.join(js_entries))
print('    ];')
