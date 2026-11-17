/**
 * chart.js — Price history charts using Chart.js.
 * Shows multi-line charts with one line per tracked URL.
 */

let priceChart = null;
let currentProduct = null;
let currentRange = 30;

const CHART_COLORS = [
  '#2563eb', '#16a34a', '#db2777', '#7c3aed', '#ea580c',
  '#0891b2', '#ca8a04', '#475569', '#dc2626', '#4f46e5',
];

function shortDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function showPriceChart(product) {
  currentProduct = product;
  currentRange = 30;

  document.getElementById('chart-title').textContent = product.name;
  renderChartStats(product);

  document.querySelectorAll('.chart-controls .tab-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.range) === currentRange);
  });

  renderChart();
  document.getElementById('chart-modal').classList.remove('hidden');
}

function renderChartStats(product) {
  const stat = (label, value, sub, cls = '') => `
    <div class="chart-stat ${cls}">
      <span class="chart-stat-label">${label}</span>
      <span class="chart-stat-value">${value}</span>
      ${sub ? `<span class="chart-stat-sub">${sub}</span>` : ''}
    </div>`;

  let targetSub = '';
  if (product.target_price != null && product.best_price != null) {
    targetSub = product.at_target ? 'Reached' : `$${(product.best_price - product.target_price).toFixed(2)} to go`;
  }

  document.getElementById('chart-stats').innerHTML = [
    stat('Best price', formatPrice(product.best_price), product.best_source ? `at ${escapeHtml(product.best_source)}` : ''),
    stat('All-time low', formatPrice(product.all_time_low), formatDate(product.all_time_low_date), 'stat-low'),
    stat('Target', formatPrice(product.target_price), targetSub, 'stat-target'),
  ].join('');
}

function renderChart() {
  if (!currentProduct) return;

  const ctx = document.getElementById('price-chart').getContext('2d');

  if (priceChart) {
    priceChart.destroy();
  }

  let cutoffDate = null;
  if (currentRange > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - currentRange);
    cutoffDate = cutoff.toISOString().split('T')[0];
  }

  const withData = Object.entries(currentProduct.url_entries || {})
    .filter(([, d]) => (d.history || []).some(h => h.price != null));
  const single = withData.length === 1;
  const datasets = [];

  withData.forEach(([url, urlData], i) => {
    const color = CHART_COLORS[i % CHART_COLORS.length];

    let filtered = [...(urlData.history || [])].reverse();
    if (cutoffDate) {
      filtered = filtered.filter(h => h.date >= cutoffDate);
    }

    const dataPoints = filtered
      .filter(h => h.price != null)
      .map(h => ({ x: h.date, y: h.price }));

    const unavailablePoints = filtered
      .filter(h => h.price != null && !h.available)
      .map(h => ({ x: h.date, y: h.price }));

    datasets.push({
      label: urlData.label || url,
      data: dataPoints,
      borderColor: color,
      backgroundColor: single ? color + '14' : color,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointHoverBorderWidth: 2,
      pointHoverBackgroundColor: '#fff',
      tension: 0,
      fill: single ? 'start' : false,
    });

    if (unavailablePoints.length > 0) {
      datasets.push({
        label: `${urlData.label || url} (unavailable)`,
        data: unavailablePoints,
        borderColor: '#dc2626',
        backgroundColor: '#dc2626',
        pointRadius: 5,
        pointStyle: 'crossRot',
        showLine: false,
      });
    }
  });

  if (currentProduct.target_price != null) {
    let allDates = [];
    datasets.forEach(ds => ds.data.forEach(d => allDates.push(d.x)));
    allDates = [...new Set(allDates)].sort();

    if (allDates.length > 0) {
      datasets.push({
        label: `Target ${formatPrice(currentProduct.target_price)}`,
        data: [
          { x: allDates[0], y: currentProduct.target_price },
          { x: allDates[allDates.length - 1], y: currentProduct.target_price },
        ],
        borderColor: '#f59e0b',
        backgroundColor: '#f59e0b',
        borderDash: [6, 4],
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: false,
      });
    }
  }

  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.color = '#64748b';

  priceChart = new Chart(ctx, {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          type: 'category',
          grid: { display: false },
          border: { color: '#e2e8f0' },
          ticks: {
            maxTicksLimit: 8,
            maxRotation: 0,
            callback: function (value) { return shortDate(this.getLabelForValue(value)); },
          },
        },
        y: {
          grace: '5%',
          grid: { color: '#f1f5f9' },
          border: { display: false },
          ticks: {
            maxTicksLimit: 6,
            callback: (value) => '$' + Math.round(value).toLocaleString('en-AU'),
          },
        },
      },
      plugins: {
        tooltip: {
          backgroundColor: '#0f172a',
          padding: 10,
          cornerRadius: 8,
          boxPadding: 4,
          usePointStyle: true,
          callbacks: {
            title: (items) => items.length ? formatDate(items[0].label) : '',
            label: (ctx) => `${ctx.dataset.label}: $${ctx.parsed.y.toFixed(2)}`,
          },
        },
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true,
            pointStyle: 'line',
            boxWidth: 18,
            padding: 16,
          },
        },
      },
    },
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.chart-controls .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentRange = parseInt(btn.dataset.range);
      document.querySelectorAll('.chart-controls .tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderChart();
    });
  });
});
