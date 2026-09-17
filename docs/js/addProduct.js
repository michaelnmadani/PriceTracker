/**
 * addProduct.js — Add product modal with URL-first flow.
 * Pastes a URL → auto-fetches product info (Shopify stores) → pre-fills form.
 * Opens a pre-filled GitHub issue that triggers a workflow to commit the product.
 */

const ADD_MAX_URLS = 5;
const ADD_PASSWORD = '12345';
const REPO_OWNER = 'michaelnmadani';
const REPO_NAME = 'PriceTracker';

// Known retailer labels by hostname
const RETAILER_LABELS = {
  'jbhifi.com.au': 'JB Hi-Fi',
  'www.jbhifi.com.au': 'JB Hi-Fi',
  'officeworks.com.au': 'Officeworks',
  'www.officeworks.com.au': 'Officeworks',
  'amazon.com.au': 'Amazon AU',
  'www.amazon.com.au': 'Amazon AU',
  'remarkable.com': 'reMarkable',
  'au.elegoo.com': 'Elegoo',
  '3dcaststore.com.au': '3D Cast',
  'www.3dcaststore.com.au': '3D Cast',
  'anycubic.au': 'Anycubic',
  'www.anycubic.au': 'Anycubic',
  'harveynorman.com.au': 'Harvey Norman',
  'www.harveynorman.com.au': 'Harvey Norman',
  'kogan.com': 'Kogan',
  'www.kogan.com': 'Kogan',
  'myer.com.au': 'Myer',
  'www.myer.com.au': 'Myer',
  'target.com.au': 'Target',
  'www.target.com.au': 'Target',
};

let isAuthenticated = false;

function guessLabel(url) {
  try {
    const hostname = new URL(url).hostname;
    return RETAILER_LABELS[hostname] || hostname.replace('www.', '').split('.')[0];
  } catch {
    return 'Retailer';
  }
}

function isShopifyUrl(url) {
  return /\/products\/[\w-]/.test(url);
}

function buildShopifyJsonUrl(url) {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/products\/([\w-]+)/);
    if (!match) return null;
    return `${parsed.protocol}//${parsed.hostname}/products/${match[1]}.json`;
  } catch {
    return null;
  }
}

async function fetchShopifyProduct(url) {
  const jsonUrl = buildShopifyJsonUrl(url);
  if (!jsonUrl) return null;

  try {
    const res = await fetch(jsonUrl);
    if (!res.ok) return null;
    const data = await res.json();
    const product = data.product;
    if (!product) return null;

    const variants = product.variants || [];
    const available = variants.filter(v => v.available);
    const chosen = available.length > 0 ? available[0] : variants[0];
    const price = chosen ? parseFloat(chosen.price) : null;

    return { name: product.title, price };
  } catch {
    return null;
  }
}

// ── Modal lifecycle ──────────────────────────────────────────────────────────

function showAddProductModal() {
  const modal = document.getElementById('add-product-modal');
  if (!isAuthenticated) {
    showStep('add-password-form');
    document.getElementById('add-password-input').value = '';
    document.getElementById('add-password-error').classList.add('hidden');
    modal.classList.remove('hidden');
    document.getElementById('add-password-input').focus();
  } else {
    showStep('add-url-step');
    resetUrlStep();
    modal.classList.remove('hidden');
  }
}

function showStep(id) {
  ['add-password-form', 'add-url-step', 'add-product-form', 'add-product-output']
    .forEach(s => document.getElementById(s).classList.toggle('hidden', s !== id));
}

// ── Password ─────────────────────────────────────────────────────────────────

function handlePasswordSubmit() {
  const input = document.getElementById('add-password-input');
  if (input.value === ADD_PASSWORD) {
    isAuthenticated = true;
    showStep('add-url-step');
    resetUrlStep();
  } else {
    document.getElementById('add-password-error').classList.remove('hidden');
    input.value = '';
    input.focus();
  }
}

// ── URL step ─────────────────────────────────────────────────────────────────

function resetUrlStep() {
  document.getElementById('first-url-input').value = '';
  document.getElementById('url-fetch-status').textContent = '';
  document.getElementById('url-fetch-status').className = 'fetch-status';
  document.getElementById('first-url-input').focus();
}

async function handleFetchUrl() {
  const urlInput = document.getElementById('first-url-input');
  const status = document.getElementById('url-fetch-status');
  const url = urlInput.value.trim();

  if (!url) return;

  // Basic URL validation
  try { new URL(url); } catch {
    status.textContent = 'Please enter a valid URL.';
    status.className = 'fetch-status error';
    return;
  }

  status.textContent = 'Fetching product details…';
  status.className = 'fetch-status loading';
  document.getElementById('fetch-url-btn').disabled = true;

  let name = '';
  let price = null;

  if (isShopifyUrl(url)) {
    const result = await fetchShopifyProduct(url);
    if (result) {
      name = result.name || '';
      price = result.price;
      status.textContent = `Found: ${name}${price ? ` — $${price.toFixed(2)}` : ''}`;
      status.className = 'fetch-status success';
    } else {
      status.textContent = 'Could not auto-fetch details — please fill in manually.';
      status.className = 'fetch-status warn';
    }
  } else {
    status.textContent = 'Non-Shopify site — please fill in the product name and price manually.';
    status.className = 'fetch-status warn';
  }

  document.getElementById('fetch-url-btn').disabled = false;

  // Pre-fill and show the product form
  showProductForm(url, guessLabel(url), name, price);
}

// ── Product form ──────────────────────────────────────────────────────────────

function showProductForm(firstUrl, firstLabel, prefillName, prefillPrice) {
  document.getElementById('product-name').value = prefillName;
  if (prefillPrice) {
    document.getElementById('target-price').value = (prefillPrice * 0.85).toFixed(0); // suggest 15% below current
  } else {
    document.getElementById('target-price').value = '';
  }
  document.getElementById('product-category').value = '';
  document.getElementById('alert-enabled').checked = true;

  // Set up URL fields with first URL
  const urlFields = document.getElementById('url-fields');
  urlFields.innerHTML = '';
  urlFields.appendChild(createUrlRow(firstUrl, firstLabel, true));
  document.getElementById('add-url-btn').disabled = false;

  showStep('add-product-form');
  document.getElementById('product-name').focus();
}

function createUrlRow(url, label, hideRemove) {
  const row = document.createElement('div');
  row.classList.add('url-field-row');
  row.innerHTML = `
    <input type="url" placeholder="https://www.example.com/product" required class="url-input" value="${escapeAttr(url)}">
    <input type="text" placeholder="Retailer name" required class="label-input" value="${escapeAttr(label)}">
    <button type="button" class="btn btn-icon btn-remove-url" title="Remove">&times;</button>
  `;
  const removeBtn = row.querySelector('.btn-remove-url');
  if (hideRemove) removeBtn.style.visibility = 'hidden';
  removeBtn.addEventListener('click', () => {
    row.remove();
    document.getElementById('add-url-btn').disabled = false;
    updateRemoveButtons();
  });

  // Auto-fill label when URL changes
  row.querySelector('.url-input').addEventListener('blur', async (e) => {
    const urlVal = e.target.value.trim();
    const labelInput = row.querySelector('.label-input');
    if (urlVal && !labelInput.value) {
      labelInput.value = guessLabel(urlVal);
    }
  });

  return row;
}

function updateRemoveButtons() {
  const rows = document.querySelectorAll('#url-fields .url-field-row');
  rows.forEach(row => {
    row.querySelector('.btn-remove-url').style.visibility = rows.length > 1 ? 'visible' : 'hidden';
  });
}

function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

// ── Submit ────────────────────────────────────────────────────────────────────

function handleAddSubmit() {
  const name = document.getElementById('product-name').value.trim();
  const category = document.getElementById('product-category').value;
  const targetPrice = document.getElementById('target-price').value;
  const alertEnabled = document.getElementById('alert-enabled').checked;

  const urls = [];
  document.querySelectorAll('#url-fields .url-field-row').forEach(row => {
    const url = row.querySelector('.url-input').value.trim();
    const label = row.querySelector('.label-input').value.trim();
    if (url && label) urls.push({ url, label });
  });

  if (!name || urls.length === 0) return;

  const product = {
    id: generateId(),
    name,
    urls,
    added_date: new Date().toISOString().split('T')[0],
    active: true,
  };
  if (category) product.category = category;
  if (targetPrice) product.target_price = parseFloat(targetPrice);
  product.alert_enabled = alertEnabled;

  const title = encodeURIComponent(`[Add Product] ${name}`);
  const body = encodeURIComponent(
    `## New Product Request\n\n` +
    `\`\`\`json\n${JSON.stringify(product, null, 2)}\n\`\`\`\n`
  );
  window.open(`https://github.com/${REPO_OWNER}/${REPO_NAME}/issues/new?title=${title}&body=${body}`, '_blank');

  document.getElementById('add-product-output').classList.remove('hidden');
  showStep('add-product-output');
  document.getElementById('product-json-output').textContent =
    `A GitHub issue has been opened for "${name}".\n\nSubmit the issue and the product will be automatically added within ~30 seconds.\nA price scrape will kick off immediately after.`;
}

// ── Event wiring ──────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('add-product-btn').addEventListener('click', showAddProductModal);

  // Password
  document.getElementById('add-password-submit').addEventListener('click', handlePasswordSubmit);
  document.getElementById('add-password-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); handlePasswordSubmit(); }
  });

  // URL step
  document.getElementById('fetch-url-btn').addEventListener('click', handleFetchUrl);
  document.getElementById('first-url-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); handleFetchUrl(); }
  });

  // Product form
  document.getElementById('add-product-form').addEventListener('submit', e => {
    e.preventDefault();
    handleAddSubmit();
  });

  document.getElementById('add-url-btn').addEventListener('click', () => {
    const urlFields = document.getElementById('url-fields');
    if (urlFields.querySelectorAll('.url-field-row').length >= ADD_MAX_URLS) return;
    urlFields.appendChild(createUrlRow('', '', false));
    updateRemoveButtons();
    if (urlFields.querySelectorAll('.url-field-row').length >= ADD_MAX_URLS) {
      document.getElementById('add-url-btn').disabled = true;
    }
  });
});
