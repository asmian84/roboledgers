/**
 * Custom Dropdown Manager for COA Selection
 * Replaces native select to ensure downward opening behavior
 */
(function() {
  window.initCustomDropdowns = function() {
    // Close all dropdowns when clicking outside
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.custom-coa-dropdown')) {
        document.querySelectorAll('.custom-coa-dropdown-menu.active').forEach(function(menu) {
          menu.classList.remove('active');
          const parent = menu.closest('.custom-coa-dropdown');
          if (parent) parent.classList.remove('open');
        });
      }
    });

    // Setup each dropdown when rendered
    const observer = new MutationObserver(function() {
      document.querySelectorAll('.custom-coa-dropdown:not([data-initialized])').forEach(function(dropdown) {
        try {
          dropdown.setAttribute('data-initialized', '1');
          setupDropdown(dropdown);
        } catch (err) {
          console.error('[DROPDOWN] init error', err);
        }
      });
    });

    observer.observe(document.getElementById('txnGrid') || document.body, {
      childList: true,
      subtree: true
    });

    // Initial setup for existing dropdowns
    document.querySelectorAll('.custom-coa-dropdown').forEach(setupDropdown);
  };

  function setupDropdown(dropdown) {
    let rowId, trigger, menu, optionsData, currentValue;

    try {
      trigger = dropdown.querySelector('.custom-coa-dropdown-trigger');
      menu = dropdown.querySelector('.custom-coa-dropdown-menu');
      optionsData = JSON.parse(dropdown.getAttribute('data-options') || '[]');
      rowId = dropdown.getAttribute('data-row-id');
      currentValue = dropdown.getAttribute('data-current-value') || '9970';

      // Fallback: derive row index from DOM if attribute missing
      if (!rowId) {
        const rowEl = dropdown.closest('.tabulator-row');
        if (rowEl) {
          const allRows = Array.from(document.querySelectorAll('#txnGrid .tabulator-row'));
          rowId = String(allRows.indexOf(rowEl));
        }
      }

      if (!trigger || !menu) return;

      console.debug('[DROPDOWN] setupDropdown row:', rowId, 'currentValue:', currentValue);

      // Build menu HTML
      let menuHtml = '';
      let currentGroup = null;

      optionsData.forEach(function(opt) {
        if (opt.group !== currentGroup) {
          if (currentGroup !== null) menuHtml += '</div>';
          currentGroup = opt.group;
          if (currentGroup) {
            menuHtml += '<div class="custom-coa-dropdown-group"><div class="custom-coa-dropdown-group-label">' + currentGroup + '</div>';
          } else {
            menuHtml += '<div class="custom-coa-dropdown-group">';
          }
        }

        const isSelected = opt.value === currentValue;
        const selectedClass = isSelected ? 'selected' : '';
        const selectedStyle = isSelected ? 'color: #0284c7;' : '';
        menuHtml += '<div class="custom-coa-dropdown-option ' + selectedClass + '" data-value="' + opt.value + '" data-group="' + (opt.group || 'DEFAULT') + '" style="' + selectedStyle + '">' + opt.label + '</div>';
      });

      if (currentGroup !== null) menuHtml += '</div>';
      menu.innerHTML = menuHtml;

      dropdown.setAttribute('data-row-id', rowId || '');
    } catch (err) {
      console.error('[DROPDOWN] setupDropdown failed:', err);
    }

    // Attach listeners once per dropdown
    if (dropdown.getAttribute('data-listener') !== '1') {
      const triggerEl = dropdown.querySelector('.custom-coa-dropdown-trigger');
      const menuEl = dropdown.querySelector('.custom-coa-dropdown-menu');
      if (!triggerEl || !menuEl) return;

      console.debug('[DROPDOWN] attaching listeners to row', rowId);

      // Handle trigger click
      triggerEl.addEventListener('click', function(e) {
        e.stopPropagation();
        const isActive = menuEl.classList.contains('active');

        // Close all other dropdowns
        document.querySelectorAll('.custom-coa-dropdown-menu.active').forEach(function(m) {
          if (m !== menuEl) {
            m.classList.remove('active');
            const parent = m.closest('.custom-coa-dropdown');
            if (parent) parent.classList.remove('open');
          }
        });

        if (!isActive) {
          const triggerRect = triggerEl.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          const menuHeight = Math.max(menuEl.scrollHeight || 0, 240);
          const spaceBelow = viewportHeight - triggerRect.bottom;
          const margin = 20;
          const required = Math.max(0, (menuHeight + margin) - spaceBelow);

          console.debug('[DROPDOWN] trigger click row', rowId, 'menuHeight', menuHeight, 'spaceBelow', spaceBelow, 'required', required);

          if (required > 0) {
            window.scrollBy({ top: required, behavior: 'smooth' });
            setTimeout(function() {
              menuEl.classList.add('active');
              dropdown.classList.add('open');
              positionMenu(dropdown, menuEl);
              console.debug('[DROPDOWN] opened after scroll row', rowId);
            }, 260);
          } else {
            menuEl.classList.add('active');
            dropdown.classList.add('open');
            positionMenu(dropdown, menuEl);
            console.debug('[DROPDOWN] opened row', rowId);
          }
        } else {
          menuEl.classList.remove('active');
          dropdown.classList.remove('open');
          console.debug('[DROPDOWN] closed row', rowId);
        }
      });

      // Keyboard handler
      triggerEl.addEventListener('keydown', function(ev) {
        if (ev.key === 'Escape') {
          menuEl.classList.remove('active');
          dropdown.classList.remove('open');
        }
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          triggerEl.click();
        }
      });

      dropdown.setAttribute('data-listener', '1');
    }

    // Handle option selection
    const optionsContainer = dropdown.querySelector('.custom-coa-dropdown-menu');
    const triggerHandle = dropdown.querySelector('.custom-coa-dropdown-trigger');
    if (optionsContainer && triggerHandle) {
      optionsContainer.querySelectorAll('.custom-coa-dropdown-option').forEach(function(option) {
        option.addEventListener('click', function(e) {
          e.stopPropagation();
          const value = option.getAttribute('data-value');
          const label = option.textContent;

          console.debug('[DROPDOWN] option clicked', value, 'row', rowId);

          // Update trigger text
          const tspan = triggerHandle.querySelector('span:first-child');
          if (tspan) tspan.textContent = label;

          // Remove previous selection
          optionsContainer.querySelectorAll('.custom-coa-dropdown-option').forEach(function(opt) {
            opt.classList.remove('selected');
            opt.style.color = '';
          });

          // Mark as selected
          option.classList.add('selected');
          option.style.color = '#0284c7';

          // Close menu
          optionsContainer.classList.remove('active');
          dropdown.classList.remove('open');

          // Trigger change event
          const changeEvent = new CustomEvent('customCategoryChange', {
            detail: { rowId: rowId, value: value, label: label }
          });
          dropdown.dispatchEvent(changeEvent);

          // Update ledger
          const row = window.txnTable.getRowFromPosition(rowId, true);
          if (row) {
            const rowData = row.getData();
            const coa = window.RoboLedger.COA.get(value);
            rowData.coa_code = value;
            rowData.category_name = coa ? coa.name : 'UNCATEGORIZED';
            rowData.category_code = value;

            if (window.RoboLedger.Brain && window.RoboLedger.Brain.categorize) {
              window.RoboLedger.Brain.categorize(rowData);
            }

            rowData.status = 'CONFIRMED';
            window.RoboLedger.Ledger.save();
            row.update(rowData);
            window.txnTable.redraw(true);

            console.log('[CATEGORIZE] Row ' + rowId + ' -> ' + value);
          }
        });
      });
    }
  }

  function positionMenu(dropdown, menu) {
    const trigger = dropdown.querySelector('.custom-coa-dropdown-trigger');
    const triggerRect = trigger.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const menuHeight = menu.offsetHeight || 300;

    // Position below trigger
    const top = triggerRect.bottom + 6;
    menu.style.top = top + 'px';
    menu.style.bottom = 'auto';

    // Clamp max-height if overflowing
    const availableBelow = viewportHeight - top - 12;
    if (menuHeight > availableBelow) {
      menu.style.maxHeight = availableBelow + 'px';
      menu.style.overflowY = 'auto';
    } else {
      menu.style.maxHeight = '';
    }

    // Clamp horizontal position
    const viewportWidth = window.innerWidth;
    const menuWidth = menu.offsetWidth || 240;
    let left = triggerRect.left;
    if (left + menuWidth + 8 > viewportWidth) {
      left = Math.max(8, viewportWidth - menuWidth - 8);
    }
    if (left < 8) left = 8;

    menu.style.left = left + 'px';
  }

  // Initialize when ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initCustomDropdowns);
  } else {
    window.initCustomDropdowns();
  }
})();
