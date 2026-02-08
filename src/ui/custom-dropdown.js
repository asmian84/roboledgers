/**
 * Custom Dropdown Manager for COA Selection
 */
(function () {
  window.initCustomDropdowns = function () {
    console.log('[DROPDOWN] Initializing custom dropdowns...');

    // Close dropdowns on outside click
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.custom-coa-dropdown')) {
        document.querySelectorAll('.custom-coa-dropdown-menu.active').forEach(function (menu) {
          menu.classList.remove('active');
          var parent = menu.closest('.custom-coa-dropdown');
          if (parent) parent.classList.remove('open');
        });
      }
    });

    // Setup mutations for new dropdowns
    var observer = new MutationObserver(function () {
      document.querySelectorAll('.custom-coa-dropdown:not([data-initialized])').forEach(function (dropdown) {
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

    // Initial setup
    document.querySelectorAll('.custom-coa-dropdown').forEach(setupDropdown);
  };

  function setupDropdown(dropdown) {
    var rowId = dropdown.getAttribute('data-row-id');
    var trigger = dropdown.querySelector('.custom-coa-dropdown-trigger');
    var menu = dropdown.querySelector('.custom-coa-dropdown-menu');
    var optionsData = JSON.parse(dropdown.getAttribute('data-options') || '[]');
    var currentValue = dropdown.getAttribute('data-current-value') || '9970';

    if (!trigger || !menu || !optionsData.length) return;

    console.debug('[DROPDOWN] Setup row:', rowId);

    // Build menu HTML
    var menuHtml = '';
    var currentGroup = null;

    optionsData.forEach(function (opt) {
      if (opt.group !== currentGroup) {
        if (currentGroup !== null) menuHtml += '</div>';
        currentGroup = opt.group;
        if (currentGroup) {
          menuHtml += '<div class="custom-coa-dropdown-group"><div class="custom-coa-dropdown-group-label">' + currentGroup + '</div>';
        } else {
          menuHtml += '<div class="custom-coa-dropdown-group">';
        }
      }
      var isSelected = opt.value === currentValue ? 'selected' : '';
      var selectedStyle = opt.value === currentValue ? 'color: #0284c7;' : '';
      menuHtml += '<div class="custom-coa-dropdown-option ' + isSelected + '" data-value="' + opt.value + '" data-group="' + (opt.group || 'DEFAULT') + '" style="' + selectedStyle + '">' + opt.label + '</div>';
    });

    if (currentGroup !== null) menuHtml += '</div>';
    menu.innerHTML = menuHtml;

    // Attach listeners
    if (dropdown.getAttribute('data-listener') !== '1') {
      var triggerEl = dropdown.querySelector('.custom-coa-dropdown-trigger');
      var menuEl = dropdown.querySelector('.custom-coa-dropdown-menu');
      if (!triggerEl || !menuEl) return;

      triggerEl.addEventListener('click', function (e) {
        e.stopPropagation();
        var isActive = menuEl.classList.contains('active');

        document.querySelectorAll('.custom-coa-dropdown-menu.active').forEach(function (m) {
          if (m !== menuEl) {
            m.classList.remove('active');
            var parent = m.closest('.custom-coa-dropdown');
            if (parent) parent.classList.remove('open');
          }
        });

        if (!isActive) {
          menuEl.classList.add('active');
          dropdown.classList.add('open');
          positionMenu(dropdown, menuEl);
        } else {
          menuEl.classList.remove('active');
          dropdown.classList.remove('open');
        }
      });

      triggerEl.addEventListener('keydown', function (ev) {
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

    // Option selection
    var optionsContainer = dropdown.querySelector('.custom-coa-dropdown-menu');
    var triggerHandle = dropdown.querySelector('.custom-coa-dropdown-trigger');
    if (optionsContainer && triggerHandle) {
      optionsContainer.querySelectorAll('.custom-coa-dropdown-option').forEach(function (option) {
        option.addEventListener('click', function (e) {
          e.stopPropagation();
          var value = option.getAttribute('data-value');
          var label = option.textContent;

          var tspan = triggerHandle.querySelector('span:first-child');
          if (tspan) tspan.textContent = label;

          optionsContainer.querySelectorAll('.custom-coa-dropdown-option').forEach(function (opt) {
            opt.classList.remove('selected');
            opt.style.color = '';
          });

          option.classList.add('selected');
          option.style.color = '#0284c7';

          optionsContainer.classList.remove('active');
          dropdown.classList.remove('open');

          var changeEvent = new CustomEvent('customCategoryChange', {
            detail: { rowId: rowId, value: value, label: label }
          });
          dropdown.dispatchEvent(changeEvent);

          if (window.txnTable && window.txnTable.getRowFromPosition) {
            var row = window.txnTable.getRowFromPosition(rowId, true);
            if (row) {
              var rowData = row.getData();
              var coa = window.RoboLedger.COA.get(value);
              rowData.coa_code = value;
              rowData.category_name = coa ? coa.name : 'UNCATEGORIZED';
              rowData.category_code = value;
              rowData.status = 'CONFIRMED';
              window.RoboLedger.Ledger.save();
              row.update(rowData);
              window.txnTable.redraw();
              console.log('[CATEGORIZE] Row ' + rowId + ' -> ' + value);
            }
          }
        });
      });
    }
  }

  function positionMenu(dropdown, menu) {
    var trigger = dropdown.querySelector('.custom-coa-dropdown-trigger');
    var triggerRect = trigger.getBoundingClientRect();
    var viewportHeight = window.innerHeight;
    var viewportWidth = window.innerWidth;
    var menuHeight = Math.min(menu.scrollHeight || 300, 320);
    var menuWidth = Math.max(triggerRect.width, 200);

    // Calculate available space above and below
    var spaceBelow = viewportHeight - triggerRect.bottom - 12;
    var spaceAbove = triggerRect.top - 12;

    // Smart positioning: prefer below, flip above if needed
    if (menuHeight <= spaceBelow) {
      // Open below (preferred)
      menu.style.top = (triggerRect.bottom + 4) + 'px';
      menu.style.bottom = 'auto';
      menu.style.maxHeight = Math.min(spaceBelow, 320) + 'px';
    } else if (menuHeight <= spaceAbove) {
      // Open above (fallback)
      menu.style.top = (triggerRect.top - menuHeight - 4) + 'px';
      menu.style.bottom = 'auto';
      menu.style.maxHeight = Math.min(spaceAbove, 320) + 'px';
    } else {
      // Constrain to available space (whichever is larger)
      if (spaceBelow >= spaceAbove) {
        menu.style.top = (triggerRect.bottom + 4) + 'px';
        menu.style.maxHeight = spaceBelow + 'px';
      } else {
        menu.style.top = '12px';
        menu.style.maxHeight = spaceAbove + 'px';
      }
      menu.style.bottom = 'auto';
    }
    menu.style.overflowY = 'auto';

    // Horizontal positioning - keep within viewport
    var left = triggerRect.left;
    if (left + menuWidth + 8 > viewportWidth) {
      left = Math.max(8, viewportWidth - menuWidth - 8);
    }
    if (left < 8) left = 8;

    menu.style.left = left + 'px';
    menu.style.width = menuWidth + 'px';
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initCustomDropdowns);
  } else {
    window.initCustomDropdowns();
  }
})();
