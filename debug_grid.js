/**
 * Grid Layout Debug Tool
 * Paste this into browser console to diagnose grid bleeding
 */

function debugGridLayout() {
  console.log('=== GRID LAYOUT DEBUG ===\n');
  
  // 1. Find all containers
  const stage = document.getElementById('app-stage');
  const gridContainer = document.querySelector('.grid-container-wall');
  const txnGrid = document.getElementById('txnGrid');
  const tabulatorDiv = document.querySelector('.tabulator');
  
  const containers = [
    { name: 'app-stage', el: stage },
    { name: 'grid-container-wall', el: gridContainer },
    { name: 'txnGrid', el: txnGrid },
    { name: 'tabulator', el: tabulatorDiv }
  ];
  
  containers.forEach(({ name, el }) => {
    if (!el) {
      console.log(`❌ ${name}: NOT FOUND`);
      return;
    }
    
    const computed = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    
    console.log(`\n📦 ${name}:`);
    console.log(`  Width: ${rect.width}px (clientWidth: ${el.clientWidth}px)`);
    console.log(`  Height: ${rect.height}px`);
    console.log(`  Box-sizing: ${computed.boxSizing}`);
    console.log(`  Display: ${computed.display}`);
    console.log(`  Overflow-x: ${computed.overflowX}`);
    console.log(`  Overflow-y: ${computed.overflowY}`);
    console.log(`  Max-width: ${computed.maxWidth}`);
    console.log(`  Padding: ${computed.paddingLeft} ${computed.paddingRight}`);
    console.log(`  Margin: ${computed.marginLeft} ${computed.marginRight}`);
    console.log(`  Position: left=${rect.left}px, right=${rect.right}px`);
    console.log(`  Viewport width: ${window.innerWidth}px`);
    console.log(`  Bleeding right: ${rect.right > window.innerWidth ? 'YES ⚠️' : 'NO ✓'}`);
  });
  
  // 2. Check Tabulator table element
  const table = document.querySelector('.tabulator-tableholder');
  if (table) {
    const tableRect = table.getBoundingClientRect();
    const tableComputed = window.getComputedStyle(table);
    console.log(`\n📊 tabulator-tableholder:`);
    console.log(`  Width: ${tableRect.width}px`);
    console.log(`  Overflow-x: ${tableComputed.overflowX}`);
    console.log(`  Overflow-y: ${tableComputed.overflowY}`);
  }
  
  // 3. Check columns total width
  if (window.txnTable) {
    const columns = window.txnTable.getColumns();
    const totalWidth = columns.reduce((sum, col) => sum + col.getWidth(), 0);
    console.log(`\n📏 Tabulator columns:`);
    console.log(`  Total columns: ${columns.length}`);
    console.log(`  Total width: ${totalWidth}px`);
    console.log(`  Container width: ${txnGrid?.clientWidth || 0}px`);
    console.log(`  Layout mode: ${window.txnTable.options.layout}`);
    
    columns.forEach(col => {
      console.log(`    - ${col.getField()}: ${col.getWidth()}px`);
    });
  }
  
  // 4. Visual highlight
  console.log('\n🎨 Highlighting containers (red border)...');
  [gridContainer, txnGrid, tabulatorDiv].forEach(el => {
    if (el) {
      el.style.border = '3px solid red';
      setTimeout(() => { el.style.border = ''; }, 3000);
    }
  });
  
  console.log('\n=== DEBUG COMPLETE ===');
  
  return {
    stage,
    gridContainer,
    txnGrid,
    tabulatorDiv,
    bleeding: tabulatorDiv ? tabulatorDiv.getBoundingClientRect().right > window.innerWidth : false
  };
}

// Auto-run
debugGridLayout();

// Also expose for manual re-run
window.debugGridLayout = debugGridLayout;
console.log('\n💡 Run debugGridLayout() anytime to re-check');
