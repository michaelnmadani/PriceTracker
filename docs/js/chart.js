/**
 * chart.js — Price history charts using Chart.js.
 * Shows multi-line charts with one line per tracked URL.
 */

let priceChart = null;
let currentProduct = null;
let currentRange = 30;

const CHART_COLORS = [
  '#0d6efd', '#198754', '#dc3545', '#ffc107', '#6f42c1',
  '#0dcaf0', '#fd7e14', '#20c997', '#d63384', '#6610f2',
];

function showPriceChart(product) {
  currentProduct = product;
  currentRange = 30;

  document.getElementById('chart-title').textContent = `Price History: ${product.name}`;

  // Update active range button
  document.querySelectorAll('.chart-controls .btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.range) === currentRange);
  });

  renderChart();
  document.getElementById('chart-modal').classList.remove('hidden');
}

function renderChart() {
  if (!currentProduct) return;

  const ctx = document.getElementById('price-chart').getContext('2d');

  if (priceChart) {
    priceChart.destroy();
  }

  const urlEntries = currentProduct.url_entries || {};
  const datasets = [];
  let colorIndex = 0;

  // Calculate date cutoff
  let cutoffDate = null;
  if (currentRange > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - currentRange);
    cutoffDate = cutoff.toISOString().split('T')[0];
  }

  for (const [url, urlData] of Object.entries(urlEntries)) {
    const history = urlData.history || [];
    const color = CHART_COLORS[colorIndex % CHART_COLORS.length];

    // Filter by date range and reverse to chronological order
    let filtered = [...history].reverse();
    if (cutoffDate) {
      filtered = filtered.filter(h => h.date >= cutoffDate);
    }

    const dataPoints = filtered
      .filter(h => h.price != null)
      .map(h => ({
        x: h.date,
        y: h.price,
      }));

    // Mark unavailable points
    const unavailablePoints = filtered
      .filter(h => h.price != null && !h.available)
      .map(h => ({
        x: h.date,
        y: h.price,
      }));

    datasets.push({
      label: urlData.label || url,
      data: dataPoints,
      borderColor: color,
      backgroundColor: color + '20',
      borderWidth: 2,
      pointRadius: dataPoints.length > 60 ? 0 : 3,
      pointHoverRadius: 5,
      tension: 0.1,
      fill: false,
    });

    // Add unavailable markers as a separate dataset
    if (unavailablePoints.length > 0) {
      datasets.push({
        label: `${urlData.label || url} (Unavailable)`,
        data: unavailablePoints,
        borderColor: 'transparent',
        backgroundColor: '#dc3545',
        pointRadius: 6,
        pointStyle: 'crossRot',
        showLine: false,
      });
    }

    colorIndex++;
  }

  // Add target price line if set
  if (currentProduct.target_price != null) {
    // Find the date range from all datasets
    let allDates = [];
    datasets.forEach(ds => {
      ds.data.forEach(d => allDates.push(d.x));
    });
    allDates = [...new Set(allDates)].sort();

    if (allDates.length > 0) {
      datasets.push({
        label: 'Target Price',
        data: [
          { x: allDates[0], y: currentProduct.target_price },
          { x: allDates[allDates.length - 1], y: currentProduct.target_price },
        ],
        borderColor: '#ffc107',
        borderDash: [8, 4],
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
      });
    }
  }

  priceChart = new Chart(ctx, {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      scales: {
        x: {
          type: 'category',
          title: { display: true, text: 'Date' },
          ticks: {
            maxTicksLimit: 12,
            maxRotation: 45,
          },
        },
        y: {
          title: { display: true, text: 'Price ($)' },
          ticks: {
            callback: (value) => '$' + value.toFixed(2),
          },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const label = ctx.dataset.label || '';
              const value = ctx.parsed.y;
              return `${label}: $${value.toFixed(2)}`;
            },
          },
        },
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true,
            padding: 15,
          },
        },
      },
    },
  });
}

// Event listeners for range buttons
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.chart-controls .btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentRange = parseInt(btn.dataset.range);
      document.querySelectorAll('.chart-controls .btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderChart();
    });
  });
});
