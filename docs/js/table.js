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
    <td class="name-cell">${expandBtn}<strong>${escapeHtml(product.name)}</strong>
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
    <td class="sparkline-cell">${buildSparkline(product)}</td>
    <td>
      <button class="btn btn-sm btn-secondary view-chart-btn" data-product-id="${product.id}">Detail</button>
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
      <td colspan="3"></td>
    `;

    rows.push(tr);
  }

  return rows;
}

function buildSparkline(product) {
  // Collect history from best-source URL, fall back to any URL with history
  let history = [];
  const urlEntries = product.url_entries || {};

  for (const urlData of Object.values(urlEntries)) {
    if (urlData.label === product.best_source && urlData.history?.length > 0) {
      history = urlData.history;
      break;
    }
  }
  if (!history.length) {
    for (const urlData of Object.values(urlEntries)) {
      if (urlData.history?.length > 0) { history = urlData.history; break; }
    }
  }

  // Filter to last 90 days with valid prices, then sort oldest→newest
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  const points = history
    .filter(h => h.price != null && h.date >= cutoffStr)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));

  if (points.length < 2) {
    return '<span style="color:var(--text-muted);font-size:0.75rem">—</span>';
  }

  const W = 160, H = 42, PAD = 3;
  const prices = points.map(p => p.price);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP || 1;

  const toX = i => PAD + (i / (points.length - 1)) * (W - PAD * 2);
  const toY = p => H - PAD - ((p - minP) / range) * (H - PAD * 2 - 2);

  const coords = points.map((p, i) => `${toX(i).toFixed(1)},${toY(p.price).toFixed(1)}`);
  const line = coords.join(' ');
  const area = `${toX(0).toFixed(1)},${H} ${line} ${toX(points.length - 1).toFixed(1)},${H}`;

  // Highlight last point
  const lastX = toX(points.length - 1);
  const lastY = toY(points[points.length - 1].price);

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" class="sparkline-svg">
    <polygon points="${area}" fill="#3b82f6" fill-opacity="0.12"/>
    <polyline points="${line}" fill="none" stroke="#3b82f6" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="2.5" fill="#3b82f6"/>
  </svg>`;
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
