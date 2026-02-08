// UPDATE: This is the new category formatter that uses custom dropdown
// COPY this entire formatter code and replace the existing Category column definition in app.js around line 1720

{
  title: "Category",
  field: "coa_code",
  width: 220,
  minWidth: 180,
  widthGrow: 1,
  headerSort: true,
  headerHozAlign: "left",
  formatter: (cell) => {
    const currentVal = cell.getValue() || "";
    const currentCoa = currentVal ? window.RoboLedger.COA.get(currentVal) : null;
    const currentLabel = currentCoa ? currentCoa.name : "Uncategorized (9970)";
    const color = currentCoa ? "#3b82f6" : "#94a3b8";
    const rowId = cell.getRow().getIndex();
    
    // Generate unique ID for this cell's select
    const selectId = `coa-select-${rowId}`;
    
    // Group COA accounts by root_class (5 categories)
    const grouped = {
      'ASSET': [],
      'LIABILITY': [],
      'EQUITY': [],
      'REVENUE': [],
      'EXPENSE': []
    };
    
    window.RoboLedger.COA.getAll().forEach(cat => {
      const rootClass = cat.metadata?.root_class || 'EXPENSE';
      if (grouped[rootClass]) {
        grouped[rootClass].push(cat);
      }
    });
    
    // Build custom dropdown HTML with data-options attribute
    const optionsArray = [{value: '9970', label: 'Uncategorized (9970)', group: null}];
    Object.entries(grouped).forEach(([rootClass, accounts]) => {
      accounts.forEach(cat => {
        optionsArray.push({value: cat.account_code, label: cat.name, group: rootClass});
      });
    });
    
    // Escape JSON for HTML attribute
    const optionsJson = JSON.stringify(optionsArray).replace(/'/g, "&#x27;");
    
    return `<div class="custom-coa-dropdown" data-row-id="${rowId}" data-current-value="${currentVal || '9970'}" data-options='${optionsJson}'><div class="custom-coa-dropdown-trigger" style="color: ${color};"><span>${currentLabel}</span><span style="font-size: 10px; margin-left: 4px;">▼</span></div><div class="custom-coa-dropdown-menu"></div></div>`;
  },
  cellClick: function (e, cell) {
    // Setup dropdown when cell is clicked
    setTimeout(() => {
      const dropdown = cell.getElement().querySelector('.custom-coa-dropdown');
      if (dropdown) {
        window.initCustomDropdowns();
      }
    }, 0);
  }
}
