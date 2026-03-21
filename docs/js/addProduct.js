/**
 * addProduct.js — "Add Product" modal form logic.
 * Generates JSON for the new product and provides download/GitHub edit options.
 */

const MAX_URLS = 5;

document.addEventListener('DOMContentLoaded', () => {
  const addBtn = document.getElementById('add-product-btn');
  const modal = document.getElementById('add-product-modal');
  const form = document.getElementById('add-product-form');
  const output = document.getElementById('add-product-output');
  const addUrlBtn = document.getElementById('add-url-btn');
  const urlFields = document.getElementById('url-fields');

  // Open modal
  addBtn.addEventListener('click', () => {
    resetForm();
    modal.classList.remove('hidden');
  });

  // Add URL field
  addUrlBtn.addEventListener('click', () => {
    const rows = urlFields.querySelectorAll('.url-field-row');
    if (rows.length >= MAX_URLS) {
      addUrlBtn.disabled = true;
      return;
    }

    const row = document.createElement('div');
    row.classList.add('url-field-row');
    row.innerHTML = `
      <input type="url" placeholder="https://www.example.com/product" required class="url-input">
      <input type="text" placeholder="Retailer name" required class="label-input">
      <button type="button" class="btn btn-icon btn-remove-url" title="Remove">&times;</button>
    `;
    urlFields.appendChild(row);

    // Update remove button visibility
    updateRemoveButtons();

    if (urlFields.querySelectorAll('.url-field-row').length >= MAX_URLS) {
      addUrlBtn.disabled = true;
    }

    // Remove URL field handler
    row.querySelector('.btn-remove-url').addEventListener('click', () => {
      row.remove();
      addUrlBtn.disabled = false;
      updateRemoveButtons();
    });
  });

  // Form submit
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSubmit();
  });

  // Copy JSON button
  document.getElementById('copy-json-btn').addEventListener('click', () => {
    const jsonText = document.getElementById('product-json-output').textContent;
    navigator.clipboard.writeText(jsonText).then(() => {
      const btn = document.getElementById('copy-json-btn');
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy JSON'; }, 2000);
    });
  });

  // Download JSON button
  document.getElementById('download-json-btn').addEventListener('click', () => {
    downloadProductsJson();
  });
});

function resetForm() {
  const form = document.getElementById('add-product-form');
  const output = document.getElementById('add-product-output');
  const addUrlBtn = document.getElementById('add-url-btn');
  const urlFields = document.getElementById('url-fields');

  form.reset();
  form.classList.remove('hidden');
  output.classList.add('hidden');
  addUrlBtn.disabled = false;

  // Reset to single URL field
  urlFields.innerHTML = `
    <div class="url-field-row">
      <input type="url" placeholder="https://www.example.com/product" required class="url-input">
      <input type="text" placeholder="Retailer name" required class="label-input">
      <button type="button" class="btn btn-icon btn-remove-url" title="Remove" style="visibility: hidden;">&times;</button>
    </div>
  `;
}

function updateRemoveButtons() {
  const rows = document.querySelectorAll('#url-fields .url-field-row');
  rows.forEach(row => {
    const btn = row.querySelector('.btn-remove-url');
    btn.style.visibility = rows.length > 1 ? 'visible' : 'hidden';
  });
}

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

function handleSubmit() {
  const name = document.getElementById('product-name').value.trim();
  const category = document.getElementById('product-category').value;
  const targetPrice = document.getElementById('target-price').value;
  const alertEnabled = document.getElementById('alert-enabled').checked;

  // Collect URLs
  const urlRows = document.querySelectorAll('#url-fields .url-field-row');
  const urls = [];
  urlRows.forEach(row => {
    const url = row.querySelector('.url-input').value.trim();
    const label = row.querySelector('.label-input').value.trim();
    if (url && label) {
      urls.push({ url, label });
    }
  });

  if (!name || urls.length === 0) return;

  const product = {
    id: generateId(),
    name: name,
    urls: urls,
    category: category || undefined,
    target_price: targetPrice ? parseFloat(targetPrice) : undefined,
    alert_enabled: alertEnabled,
    added_date: new Date().toISOString().split('T')[0],
    active: true,
  };

  // Clean undefined fields
  Object.keys(product).forEach(key => {
    if (product[key] === undefined) delete product[key];
  });

  // Show output
  const form = document.getElementById('add-product-form');
  const output = document.getElementById('add-product-output');

  form.classList.add('hidden');
  output.classList.remove('hidden');

  // Build the full products.json content
  const existingProducts = App.products || [];
  const updatedProducts = { products: [...existingProducts, product] };
  const jsonStr = JSON.stringify(updatedProducts, null, 2);

  document.getElementById('product-json-output').textContent = jsonStr;

  // GitHub edit link
  const githubLink = document.getElementById('github-edit-link');
  const repoUrl = 'https://github.com/michaelnmadani/PriceTracker';
  githubLink.href = `${repoUrl}/edit/main/data/products.json`;
  githubLink.textContent = 'Edit on GitHub';

  // Store for download
  output.dataset.json = jsonStr;
}

function downloadProductsJson() {
  const output = document.getElementById('add-product-output');
  const jsonStr = output.dataset.json || '{"products": []}';

  const blob = new Blob([jsonStr + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'products.json';
  a.click();
  URL.revokeObjectURL(url);
}
