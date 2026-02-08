/**
 * Grid Alignment Debugger
 * Detects divides, misalignments, and structural issues in Tabulator grid
 * Paste this into browser console
 */

function debugGridAlignment() {
  console.log('🔍 GRID ALIGNMENT DIAGNOSTIC\n');
  console.log('═'.repeat(60));

  // 1. Check Tabulator Instance
  if (!window.txnTable) {
    console.error('❌ No Tabulator instance found (window.txnTable is undefined)');
    return;
  }
  console.log('✓ Tabulator instance found');

  // 2. Get Grid Elements
  const gridDiv = document.getElementById('txnGrid');
  const tabulator = document.querySelector('.tabulator');
  const header = document.querySelector('.tabulator-header');
  const tableHolder = document.querySelector('.tabulator-tableholder');
  const table = document.querySelector('.tabulator-table');

  if (!gridDiv || !tabulator || !header || !tableHolder) {
    console.error('❌ Missing grid elements');
    return;
  }

  // 3. Measure Container Widths
  console.log('\n📦 CONTAINER WIDTHS:');
  console.log('═'.repeat(60));
  
  const measurements = {
    gridDiv: { el: gridDiv, width: gridDiv.offsetWidth, scroll: gridDiv.scrollWidth },
    tabulator: { el: tabulator, width: tabulator.offsetWidth, scroll: tabulator.scrollWidth },
    header: { el: header, width: header.offsetWidth, scroll: header.scrollWidth },
    tableHolder: { el: tableHolder, width: tableHolder.offsetWidth, scroll: tableHolder.scrollWidth },
    table: table ? { el: table, width: table.offsetWidth, scroll: table.scrollWidth } : null
  };

  Object.entries(measurements).forEach(([name, data]) => {
    if (data) {
      const mismatch = data.width !== data.scroll ? ' ⚠️ MISMATCH' : '';
      console.log(`  ${name}:`);
      console.log(`    Visible: ${data.width}px`);
      console.log(`    Scroll: ${data.scroll}px${mismatch}`);
    }
  });

  // 4. Check Header vs Body Column Alignment
  console.log('\n📊 COLUMN ALIGNMENT:');
  console.log('═'.repeat(60));

  const headerCols = Array.from(document.querySelectorAll('.tabulator-header .tabulator-col'));
  const bodyCols = Array.from(document.querySelectorAll('.tabulator-table .tabulator-cell'));
  
  console.log(`  Header columns: ${headerCols.length}`);
  console.log(`  Body cells (first row): ${bodyCols.length}`);

  if (headerCols.length > 0 && bodyCols.length > 0) {
    console.log('\n  Column Width Comparison:');
    headerCols.forEach((col, i) => {
      const headerWidth = col.offsetWidth;
      const bodyCell = document.querySelector(`.tabulator-row:first-child .tabulator-cell:nth-child(${i + 1})`);
      const bodyWidth = bodyCell ? bodyCell.offsetWidth : 'N/A';
      const match = headerWidth === bodyWidth ? '✓' : '❌ MISALIGNED';
      console.log(`    Col ${i + 1}: Header=${headerWidth}px, Body=${bodyWidth}px ${match}`);
    });
  }

  // 5. Check for Visual Dividers
  console.log('\n🔍 VISUAL ISSUES:');
  console.log('═'.repeat(60));

  const issues = [];

  // Check for gaps
  const headerRect = header.getBoundingClientRect();
  const tableHolderRect = tableHolder.getBoundingClientRect();
  const gap = tableHolderRect.top - headerRect.bottom;
  if (gap > 2) {
    issues.push(`⚠️ GAP between header and body: ${gap}px`);
  }

  // Check for overflow
  if (header.scrollWidth > header.offsetWidth) {
    issues.push(`⚠️ Header overflowing: ${header.scrollWidth - header.offsetWidth}px wider`);
  }
  if (tableHolder.scrollWidth > tableHolder.offsetWidth) {
    issues.push(`⚠️ Table body overflowing: ${tableHolder.scrollWidth - tableHolder.offsetWidth}px wider`);
  }

  // Check for mismatched table layout
  const headerTable = document.querySelector('.tabulator-header .tabulator-headers');
  const bodyTable = document.querySelector('.tabulator-table');
  if (headerTable && bodyTable) {
    const headerTableWidth = headerTable.offsetWidth;
    const bodyTableWidth = bodyTable.offsetWidth;
    if (Math.abs(headerTableWidth - bodyTableWidth) > 5) {
      issues.push(`❌ DIVIDE DETECTED: Header table=${headerTableWidth}px, Body table=${bodyTableWidth}px`);
    }
  }

  // Check for border issues
  const headerBorder = window.getComputedStyle(header).borderBottomWidth;
  const tableHolderBorder = window.getComputedStyle(tableHolder).borderTopWidth;
  if (parseInt(headerBorder) > 3 || parseInt(tableHolderBorder) > 3) {
    issues.push(`⚠️ Thick border creating divide: header=${headerBorder}, body=${tableHolderBorder}`);
  }

  if (issues.length === 0) {
    console.log('  ✓ No obvious visual issues detected');
  } else {
    issues.forEach(issue => console.log(`  ${issue}`));
  }

  // 6. Check CSS Issues
  console.log('\n🎨 CSS PROPERTIES:');
  console.log('═'.repeat(60));

  const tabulatorStyles = window.getComputedStyle(tabulator);
  const headerStyles = window.getComputedStyle(header);
  const tableHolderStyles = window.getComputedStyle(tableHolder);

  console.log('  Tabulator:');
  console.log(`    display: ${tabulatorStyles.display}`);
  console.log(`    width: ${tabulatorStyles.width}`);
  console.log(`    overflow: ${tabulatorStyles.overflow}`);

  console.log('  Header:');
  console.log(`    display: ${headerStyles.display}`);
  console.log(`    width: ${headerStyles.width}`);
  console.log(`    overflow-x: ${headerStyles.overflowX}`);

  console.log('  Table Holder:');
  console.log(`    display: ${tableHolderStyles.display}`);
  console.log(`    width: ${tableHolderStyles.width}`);
  console.log(`    overflow-x: ${tableHolderStyles.overflowX}`);

  // 7. Highlight the divide visually
  console.log('\n🎯 VISUAL MARKERS:');
  console.log('═'.repeat(60));
  console.log('  Adding red borders to help identify the divide...');

  // Remove existing markers
  document.querySelectorAll('.debug-marker').forEach(el => el.remove());

  // Add visual markers
  [header, tableHolder].forEach(el => {
    el.style.outline = '2px solid red';
    el.style.outlineOffset = '-2px';
  });

  // Add measurement overlay
  const overlay = document.createElement('div');
  overlay.className = 'debug-marker';
  overlay.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: rgba(0,0,0,0.9);
    color: white;
    padding: 16px;
    border-radius: 8px;
    font-family: monospace;
    font-size: 11px;
    z-index: 99999;
    max-width: 300px;
    line-height: 1.6;
  `;
  overlay.innerHTML = `
    <strong>Grid Debug Info:</strong><br>
    Header Width: ${header.offsetWidth}px<br>
    Body Width: ${tableHolder.offsetWidth}px<br>
    Gap: ${gap.toFixed(1)}px<br>
    <br>
    ${issues.length > 0 ? `<span style="color: #ff6b6b;">Issues: ${issues.length}</span>` : '<span style="color: #51cf66;">No issues</span>'}
    <br><br>
    <button onclick="document.querySelectorAll('.debug-marker').forEach(el => el.remove()); [document.querySelector('.tabulator-header'), document.querySelector('.tabulator-tableholder')].forEach(el => el.style.outline = '');" style="background: #fff; color: #000; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">Clear Markers</button>
  `;
  document.body.appendChild(overlay);

  console.log('  ✓ Red borders added to header and body');
  console.log('  ✓ Info overlay added (top-right corner)');

  console.log('\n' + '═'.repeat(60));
  console.log('✅ DIAGNOSTIC COMPLETE');
  console.log('   Check the console output and visual markers above');
}

// Auto-run
debugGridAlignment();

// Make available globally
window.debugGridAlignment = debugGridAlignment;

console.log('\n💡 Run debugGridAlignment() anytime to re-check');
