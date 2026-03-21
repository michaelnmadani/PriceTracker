/**
 * table.js — Renders the product table with expandable per-URL rows.
 */

function renderTable(data) {
  const tbody = document.getElementById('product-tbody');
  const emptyState = document.getElementById('empty-state');
  const tableContainer = document.querySelector('.table-wrapper');

  if (data.length === 0) {
    tableContainer.classList.add('hidden');
    emptyState.classList.remove('hidden');
    return;
  }

  tableContainer.classList.remove('hidden');
  emptyState.classList.add('hidden');
  tbody.innerHTML = '';

  data.forEach(product => {
    const row = createProductRow(product);
    tbody.appendChild(row);
  });
}

function createProductRow(product) {
  const tr = document.createElement('tr');
  const urlCount = Object.keys(product.url_entries).length;
  const hasMultipleUrls = urlCount > 1;

  // Row classes
  if (product.at_target && product.alert_enabled) tr.classList.add('row-alert');
  if (!product.available && product.best_price != null) tr.classList.add('row-unavailable');

  // Name cell (with expand button if multiple URLs)
  const expandBtn = hasMultipleUrls
    ? `<button class="expand-btn" title="Show retailer breakdown">&#9654;</button> `
    : '';

  tr.innerHTML = `
    <td>${expandBtn}<strong>${escapeHtml(product.name)}</strong>
      ${product.category ? `<br><small style="color:var(--text-muted)">${escapeHtml(product.category)}</small>` : ''}
      ${product.best_source ? `<br><small style="color:var(--text-muted)">${escapeHtml(product.best_source)}</small>` : ''}
    </td>
    <td>
      <strong>${formatPrice(product.best_price)}</strong>
      ${product.at_all_time_low ? '<span class="badge badge-atl">ATL</span>' : ''}
    </td>
    <td>
      ${product.best_price != null
        ? (product.available
          ? '<span class="badge badge-available">In Stock</span>'
          : '<span class="badge badge-unavailable">Unavailable</span>')
        : '<span class="price-same">—</span>'
      }
    </td>
    <td>
      ${formatPrice(product.all_time_low)}
      ${product.all_time_low_date ? `<br><small style="color:var(--text-muted)">${product.all_time_low_date}</small>` : ''}
    </td>
    <td>${formatChange(product.price_change)}</td>
    <td>
      ${product.at_target && product.alert_enabled
        ? '<span class="badge badge-alert">ALERT</span>'
        : (product.target_price != null
          ? `<small style="color:var(--text-muted)">Target: ${formatPrice(product.target_price)}</small>`
          : '—')
      }
    </td>
    <td>
      <button class="btn btn-sm btn-secondary view-chart-btn" data-product-id="${product.id}">Chart</button>
      ${isDeviceAuthorized() ? `<button class="btn btn-sm btn-secondary edit-product-btn" data-product-id="${product.id}">Edit</button>` : ''}
    </td>
  `;

  // Expand/collapse sub-rows
  if (hasMultipleUrls) {
    const expandBtnEl = tr.querySelector('.expand-btn');
    let expanded = false;
    let subRows = [];

    expandBtnEl.addEventListener('click', () => {
      expanded = !expanded;
      expandBtnEl.innerHTML = expanded ? '&#9660;' : '&#9654;';

      if (expanded) {
        subRows = createSubRows(product);
        subRows.forEach(subRow => {
          tr.parentNode.insertBefore(subRow, tr.nextSibling);
        });
      } else {
        subRows.forEach(subRow => subRow.remove());
        subRows = [];
      }
    });
  }

  // Chart button
  tr.querySelector('.view-chart-btn').addEventListener('click', () => {
    showPriceChart(product);
  });

  // Edit button (only present for authorized users)
  const editBtn = tr.querySelector('.edit-product-btn');
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      openEditModal(product.id);
    });
  }

  return tr;
}

function createSubRows(product) {
  const rows = [];

  for (const [url, urlData] of Object.entries(product.url_entries)) {
    const tr = document.createElement('tr');
    tr.classList.add('sub-row');

    // Calculate per-URL price change
    let change = null;
    const history = urlData.history || [];
    if (history.length >= 2 && history[0].price != null && history[1].price != null) {
      change = history[0].price - history[1].price;
    }

    tr.innerHTML = `
      <td>
        <a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(urlData.label || 'Link')}</a>
      </td>
      <td>${formatPrice(urlData.current_price)}</td>
      <td>
        ${urlData.current_availability
          ? '<span class="badge badge-available">In Stock</span>'
          : '<span class="badge badge-unavailable">Unavailable</span>'
        }
      </td>
      <td>
        ${formatPrice(urlData.all_time_low)}
        ${urlData.all_time_low_date ? `<br><small>${urlData.all_time_low_date}</small>` : ''}
      </td>
      <td>${formatChange(change)}</td>
      <td colspan="2"></td>
    `;

    rows.push(tr);
  }

  return rows;
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
