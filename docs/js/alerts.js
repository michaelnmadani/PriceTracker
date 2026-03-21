/**
 * alerts.js — Target price alert logic.
 * Shows alert banner, highlights rows, and updates tab badge count.
 */

function checkAlerts() {
  const alerts = App.mergedData.filter(p => p.at_target && p.alert_enabled);
  const banner = document.getElementById('alert-banner');

  if (alerts.length === 0) {
    banner.classList.add('hidden');
    document.title = 'Price Tracker';
    return;
  }

  // Update tab title with badge count
  document.title = `(${alerts.length}) Price Tracker`;

  // Build alert banner
  banner.innerHTML = '';
  banner.classList.remove('hidden');

  alerts.forEach(product => {
    const alertItem = document.createElement('div');
    alertItem.classList.add('alert-item');

    // Find which source(s) hit the target
    const sources = [];
    const urlEntries = product.url_entries || {};
    for (const [url, urlData] of Object.entries(urlEntries)) {
      if (urlData.current_price != null && urlData.current_price <= product.target_price) {
        sources.push({
          label: urlData.label || 'Unknown',
          price: urlData.current_price,
        });
      }
    }

    const sourceText = sources.length > 0
      ? sources.map(s => `${s.label} ($${s.price.toFixed(2)})`).join(', ')
      : `$${product.best_price.toFixed(2)}`;

    alertItem.innerHTML = `
      <span class="alert-badge">PRICE DROP</span>
      <span>
        <strong>${escapeHtml(product.name)}</strong> is at or below your target price
        of $${product.target_price.toFixed(2)} at ${sourceText}!
      </span>
    `;

    banner.appendChild(alertItem);
  });
}
