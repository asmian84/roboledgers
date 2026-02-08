/**
 * Quick Fix for Grid Bleeding
 * Paste this into browser console to apply emergency fixes
 */

function fixGridBleeding() {
  console.log('🔧 Applying grid bleeding fixes...\n');
  
  const fixes = [];
  
  // Fix 1: Container overflow
  const gridContainer = document.querySelector('.grid-container-wall');
  if (gridContainer) {
    gridContainer.style.overflow = 'hidden';
    gridContainer.style.maxWidth = '1400px';
    gridContainer.style.width = '100%';
    gridContainer.style.boxSizing = 'border-box';
    fixes.push('✓ Grid container overflow');
  }
  
  // Fix 2: Grid div
  const txnGrid = document.getElementById('txnGrid');
  if (txnGrid) {
    txnGrid.style.overflow = 'hidden';
    txnGrid.style.width = '100%';
    txnGrid.style.boxSizing = 'border-box';
    fixes.push('✓ Grid div overflow');
  }
  
  // Fix 3: Tabulator wrapper
  const tabulator = document.querySelector('.tabulator');
  if (tabulator) {
    tabulator.style.width = '100%';
    tabulator.style.maxWidth = '100%';
    tabulator.style.overflow = 'hidden';
    tabulator.style.boxSizing = 'border-box';
    fixes.push('✓ Tabulator wrapper');
  }
  
  // Fix 4: Table holder
  const tableHolder = document.querySelector('.tabulator-tableholder');
  if (tableHolder) {
    tableHolder.style.overflowX = 'auto';
    tableHolder.style.maxWidth = '100%';
    fixes.push('✓ Table holder');
  }
  
  // Fix 5: Force Tabulator redraw
  if (window.txnTable) {
    try {
      window.txnTable.redraw(true);
      fixes.push('✓ Tabulator redraw');
    } catch (e) {
      console.warn('Could not redraw table:', e.message);
    }
  }
  
  // Fix 6: Parent containers
  const mainWrapper = document.querySelector('.stage');
  if (mainWrapper) {
    mainWrapper.style.overflow = 'hidden';
    fixes.push('✓ Main stage overflow');
  }
  
  console.log('Applied fixes:');
  fixes.forEach(f => console.log(`  ${f}`));
  
  console.log('\n✅ Fixes applied. Check if bleeding stopped.');
  
  // Run debug after fixes
  setTimeout(() => {
    if (window.debugGridLayout) {
      console.log('\n📊 Running diagnostic...');
      window.debugGridLayout();
    }
  }, 100);
}

fixGridBleeding();
window.fixGridBleeding = fixGridBleeding;
console.log('\n💡 Run fixGridBleeding() anytime to reapply fixes');
