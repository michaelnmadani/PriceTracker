/**
 * app.js — Main application logic. Loads data, merges products with prices,
 * initializes table, charts, and alerts.
 */

// Global app state
const App = {
  products: [],
  prices: {},
  mergedData: [],
  sortColumn: 'name',
  sortDirection: 'asc',
  searchQuery: '',
  categoryFilter: '',
};

async function loadData() {
  try {
    const cacheBuster = `?v=${Date.now()}`;
    const [productsRes, pricesRes] = await Promise.all([
      fetch('data/products.json' + cacheBuster),
      fetch('data/prices.json' + cacheBuster),
    ]);

    const productsData = await productsRes.json();
    const pricesData = await pricesRes.json();

    App.products = productsData.products || [];
    App.prices = pricesData.entries || {};

    // Update last updated display
    const lastUpdated = pricesData.last_updated;
    const el = document.getElementById('last-updated');
    if (lastUpdated) {
      const date = new Date(lastUpdated);
      el.textContent = `Last updated: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    } else {
      el.textContent = 'No price data yet — run the scraper or wait for the daily update.';
    }

    mergeData();
    populateCategories();
    updateSummary();
    renderTable(getFilteredData());
    checkAlerts();
  } catch (err) {
    console.error('Failed to load data:', err);
    document.getElementById('last-updated').textContent = `Failed to load data: ${err.message}`;
    document.getElementById('empty-state').classList.remove('hidden');
  }
}

function mergeData() {
  App.mergedData = App.products
    .filter(p => p.active !== false)
    .map(product => {
      const priceEntry = App.prices[product.id] || {};
      const urlEntries = priceEntry.urls || {};

      // Calculate price change (vs yesterday) using best price
      let priceChange = null;
      const bestPrice = priceEntry.best_current_price;
      if (bestPrice != null) {
        // Find yesterday's best price across all URLs
        let yesterdayBest = null;
        for (const urlData of Object.values(urlEntries)) {
          const history = urlData.history || [];
          if (history.length >= 2) {
            const yesterdayPrice = history[1].price;
            if (yesterdayPrice != null && (yesterdayBest == null || yesterdayPrice < yesterdayBest)) {
              yesterdayBest = yesterdayPrice;
            }
          }
        }
        if (yesterdayBest != null) {
          priceChange = bestPrice - yesterdayBest;
        }
      }

      // Check availability across all URLs
      let anyAvailable = false;
      for (const urlData of Object.values(urlEntries)) {
        if (urlData.current_availability) {
          anyAvailable = true;
          break;
        }
      }

      // Check if at target price
      const atTarget = product.target_price != null && bestPrice != null && bestPrice <= product.target_price;
      const atAllTimeLow = bestPrice != null && priceEntry.overall_all_time_low != null
        && bestPrice <= priceEntry.overall_all_time_low;

      return {
        ...product,
        best_price: bestPrice,
        best_source: priceEntry.best_current_source,
        all_time_low: priceEntry.overall_all_time_low,
        all_time_low_date: priceEntry.overall_all_time_low_date,
        all_time_low_source: priceEntry.overall_all_time_low_source,
        price_change: priceChange,
        available: anyAvailable,
        at_target: atTarget,
        at_all_time_low: atAllTimeLow,
        url_entries: urlEntries,
      };
    });
}

function populateCategories() {
  const categories = new Set();
  App.mergedData.forEach(p => {
    if (p.category) categories.add(p.category);
  });

  const select = document.getElementById('category-filter');
  // Keep first option
  while (select.options.length > 1) select.remove(1);

  for (const cat of [...categories].sort()) {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
    select.appendChild(opt);
  }
}

function updateSummary() {
  const data = App.mergedData;
  document.getElementById('total-products').textContent = data.length;
  document.getElementById('at-all-time-low').textContent = data.filter(p => p.at_all_time_low).length;
  document.getElementById('active-alerts').textContent = data.filter(p => p.at_target && p.alert_enabled).length;
  document.getElementById('unavailable-count').textContent = data.filter(p => !p.available && p.best_price != null).length;
}

function getFilteredData() {
  let data = App.mergedData;

  if (App.searchQuery) {
    const q = App.searchQuery.toLowerCase();
    data = data.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.category && p.category.toLowerCase().includes(q)) ||
      (p.best_source && p.best_source.toLowerCase().includes(q))
    );
  }

  if (App.categoryFilter) {
    data = data.filter(p => p.category === App.categoryFilter);
  }

  return sortData(data);
}

function sortData(data) {
  const col = App.sortColumn;
  const dir = App.sortDirection === 'asc' ? 1 : -1;

  return [...data].sort((a, b) => {
    let va, vb;
    switch (col) {
      case 'name': va = a.name.toLowerCase(); vb = b.name.toLowerCase(); break;
      case 'best_price': va = a.best_price ?? Infinity; vb = b.best_price ?? Infinity; break;
      case 'availability': va = a.available ? 1 : 0; vb = b.available ? 1 : 0; break;
      case 'all_time_low': va = a.all_time_low ?? Infinity; vb = b.all_time_low ?? Infinity; break;
      case 'price_change': va = a.price_change ?? 0; vb = b.price_change ?? 0; break;
      case 'alert': va = a.at_target ? 1 : 0; vb = b.at_target ? 1 : 0; break;
      default: va = 0; vb = 0;
    }
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });
}

function formatPrice(price) {
  if (price == null) return '—';
  return '$' + price.toFixed(2);
}

function formatChange(change) {
  if (change == null) return '<span class="price-same">—</span>';
  if (change > 0) return `<span class="price-up">+$${change.toFixed(2)}</span>`;
  if (change < 0) return `<span class="price-down">-$${Math.abs(change).toFixed(2)}</span>`;
  return '<span class="price-same">$0.00</span>';
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  loadData();

  // Search
  document.getElementById('search-input').addEventListener('input', (e) => {
    App.searchQuery = e.target.value;
    renderTable(getFilteredData());
  });

  // Category filter
  document.getElementById('category-filter').addEventListener('change', (e) => {
    App.categoryFilter = e.target.value;
    renderTable(getFilteredData());
  });

  // Sort headers
  document.querySelectorAll('#product-table th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (App.sortColumn === col) {
        App.sortDirection = App.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        App.sortColumn = col;
        App.sortDirection = 'asc';
      }
      updateSortIcons();
      renderTable(getFilteredData());
    });
  });

  // Close modals
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.dataset.closeModal;
      document.getElementById(modalId).classList.add('hidden');
    });
  });

  // Close modal on backdrop click
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });
  });
});

function updateSortIcons() {
  document.querySelectorAll('#product-table th[data-sort]').forEach(th => {
    const icon = th.querySelector('.sort-icon');
    if (th.dataset.sort === App.sortColumn) {
      icon.textContent = App.sortDirection === 'asc' ? ' \u25B2' : ' \u25BC';
    } else {
      icon.textContent = '';
    }
  });
}
