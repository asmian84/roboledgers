# 🚨 DO NOT BREAK - MVP PROTECTION GUIDE

## Current MVP State
- **Tag:** `mvp-2026-02-05`
- **Commit:** `9a69023` (with MVP_STATUS.md)
- **Status:** ✅ PRODUCTION READY - Transaction grid fully functional

## What's Working
✅ Grid displays 221 transactions  
✅ Account switching (ALL / CHQ1)  
✅ REF# input and dynamic generation  
✅ Metadata display (INST/TRANSIT/ACCOUNT)  
✅ Running balance calculation  
✅ PDF/CSV source file audit drawer  
✅ Proper 1400px layout with header/action/switcher bars  
✅ Date formatting (ISO format)  
✅ Amount display (Debit/Credit)  

## What's Broken (Known Issues)
⚠️ Description formatting (2-line split not perfect)  
⚠️ Date removal in descriptions (still shows dates)  
⚠️ Grid may not handle very large widths  

## CRITICAL RULE: BRANCH BEFORE MODIFYING

```bash
# ❌ NEVER DO THIS:
git checkout master
git modify src/ui/enterprise/app.js
git commit

# ✅ DO THIS INSTEAD:
git checkout -b feature/fix-descriptions
# Make changes...
# Test in browser
# git commit
# When ready: git merge master (AFTER testing!)
```

## If You Break It

Revert to MVP:
```bash
git reset --hard mvp-2026-02-05
# or
git checkout mvp-2026-02-05 -- src/ui/enterprise/app.js
```

## Critical Files (PROTECTED)
- `src/ui/enterprise/app.js` - DO NOT TOUCH layout code
- `src/ui/enterprise/ledger.core.js` - DO NOT TOUCH persistence
- `index.html` - DO NOT TOUCH structure

## Safe to Modify
- Description formatter (lines 1280-1330 in app.js)
- Column styling
- Search logic
- Balance calculation

---

**READ MVP_STATUS.md BEFORE MAKING ANY CHANGES**
