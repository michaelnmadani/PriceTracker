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
    emptyState.innerHTML = App.currentTab === 'archived'
      ? 'No archived products. Click <strong>Archive</strong> on a product to move it here.'
      : 'No products tracked yet. Click <strong>"+ Add Product"</strong> to get started.';
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

  const storeCount = (product.urls || []).length;
  const meta = [
    product.category ? `<span class="tag">${escapeHtml(product.category)}</span>` : '',
    storeCount > 1 ? `<span>${storeCount} stores</span>` : '',
  ].filter(Boolean).join('');

  tr.innerHTML = `
    <td class="name-cell">
      <div class="name-line">${expandBtn}<span class="product-name">${escapeHtml(product.name)}</span></div>
      ${meta ? `<div class="meta-line">${meta}</div>` : ''}
    </td>
    <td class="price-cell">
      <div class="price-main">${formatPrice(product.best_price)}${product.at_all_time_low ? ' <span class="badge badge-atl">Lowest</span>' : ''}</div>
      ${product.best_source ? `<div class="cell-sub">at ${escapeHtml(product.best_source)}</div>` : ''}
    </td>
    <td class="avail-cell">
      ${product.best_price != null
        ? (product.available
          ? '<span class="badge badge-available">In stock</span>'
          : '<span class="badge badge-unavailable">Unavailable</span>')
        : '<span class="badge badge-muted">No data</span>'
      }
    </td>
    <td class="atl-cell" data-label="All-time low">
      <div>${formatPrice(product.all_time_low)}</div>
      ${product.all_time_low_date ? `<div class="cell-sub">${formatDate(product.all_time_low_date)}</div>` : ''}
    </td>
    <td class="change-cell">${formatChange(product.price_change)}</td>
    <td class="target-cell" data-label="Target">${formatTarget(product)}</td>
    <td class="sparkline-cell">${buildSparkline(product)}</td>
    <td class="actions-cell">
      <button class="btn btn-sm btn-secondary view-chart-btn" data-product-id="${product.id}">Detail</button>
      ${product.is_archived
        ? `<button class="btn btn-sm btn-unarchive unarchive-btn" data-product-id="${escapeHtml(product.id)}" data-product-name="${escapeHtml(product.name)}">Unarchive</button>`
        : `<button class="btn btn-sm btn-archive archive-btn" data-product-id="${escapeHtml(product.id)}" data-product-name="${escapeHtml(product.name)}">Archive</button>`
      }
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

  // Archive / Unarchive button
  const archiveBtn = tr.querySelector('.archive-btn');
  const unarchiveBtn = tr.querySelector('.unarchive-btn');
  if (archiveBtn) {
    archiveBtn.addEventListener('click', () => openArchiveIssue(product.id, product.name, true));
  }
  if (unarchiveBtn) {
    unarchiveBtn.addEventListener('click', () => openArchiveIssue(product.id, product.name, false));
  }

  return tr;
}

function createSubRows(product) {
  const rows = [];

  const entries = Object.entries(product.url_entries)
    .sort(([, a], [, b]) => (a.current_price ?? Infinity) - (b.current_price ?? Infinity));

  entries.forEach(([url, urlData], i) => {
    const tr = document.createElement('tr');
    tr.classList.add('sub-row');
    if (i === entries.length - 1) tr.classList.add('sub-row-last');

    let change = null;
    const history = urlData.history || [];
    if (history.length >= 2 && history[0].price != null && history[1].price != null) {
      change = history[0].price - history[1].price;
    }

    const hasPrice = urlData.current_price != null;
    const isBest = hasPrice && urlData.label === product.best_source;
    if (isBest) tr.classList.add('sub-row-best');

    let availability;
    if (!hasPrice) availability = '<span class="badge badge-muted">No price found</span>';
    else if (urlData.current_availability) availability = '<span class="badge badge-available">In stock</span>';
    else availability = '<span class="badge badge-unavailable">Unavailable</span>';

    tr.innerHTML = `
      <td>
        <a class="retailer-link" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(urlData.label || 'Link')}<span aria-hidden="true"> ↗</span></a>
      </td>
      <td class="${hasPrice ? 'sub-price' : 'price-same'}">${formatPrice(urlData.current_price)}${isBest ? ' <span class="badge badge-best">Best</span>' : ''}</td>
      <td>${availability}</td>
      <td>
        <div>${formatPrice(urlData.all_time_low)}</div>
        ${urlData.all_time_low_date ? `<div class="cell-sub">${formatDate(urlData.all_time_low_date)}</div>` : ''}
      </td>
      <td>${formatChange(change)}</td>
      <td colspan="3"></td>
    `;

    rows.push(tr);
  });

  return rows.reverse();
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

  const W = 150, H = 40, PAD = 4;
  const prices = points.map(p => p.price);
  const first = prices[0];
  const last = prices[prices.length - 1];
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const flat = maxP === minP;
  const range = maxP - minP || 1;

  const color = last < first ? '#16a34a' : last > first ? '#dc2626' : '#64748b';

  const toX = i => PAD + (i / (points.length - 1)) * (W - PAD * 2);
  const toY = p => flat ? H / 2 : H - PAD - ((p - minP) / range) * (H - PAD * 2);

  const line = points.map((p, i) => `${toX(i).toFixed(1)},${toY(p.price).toFixed(1)}`).join(' ');
  const area = `${toX(0).toFixed(1)},${H} ${line} ${toX(points.length - 1).toFixed(1)},${H}`;

  const lastX = toX(points.length - 1);
  const lastY = toY(last);

  const target = product.target_price;
  const targetLine = !flat && target != null && target >= minP && target <= maxP
    ? `<line x1="${PAD}" x2="${W - PAD}" y1="${toY(target).toFixed(1)}" y2="${toY(target).toFixed(1)}" stroke="#f59e0b" stroke-width="1" stroke-dasharray="3 3"/>`
    : '';

  const pct = first ? ((last - first) / first) * 100 : 0;
  const trendLabel = Math.abs(pct) < 0.5 ? 'No change' : `${pct > 0 ? '+' : ''}${pct.toFixed(0)}%`;

  return `<div class="sparkline-wrap">
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" class="sparkline-svg" role="img" aria-label="90 day trend: ${trendLabel}">
      ${flat ? '' : `<polygon points="${area}" fill="${color}" fill-opacity="0.08"/>`}
      ${targetLine}
      <polyline points="${line}" fill="none" stroke="${color}" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="2.75" fill="${color}" stroke="#fff" stroke-width="1"/>
    </svg>
    <span class="sparkline-trend" style="color:${color}">${trendLabel}</span>
  </div>`;
}

function openArchiveIssue(productId, productName, archive) {
  const action = archive ? 'Archive' : 'Unarchive';
  const title = encodeURIComponent(`[${action} Product] ${productId}`);
  const body = encodeURIComponent(`${action} product: ${productName}`);
  const url = `https://github.com/michaelnmadani/PriceTracker/issues/new?title=${title}&body=${body}`;
  window.open(url, '_blank', 'noopener');
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
