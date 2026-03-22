/**
 * addProduct.js — Add product modal with password protection.
 * Generates product JSON for manual addition to products.json.
 */

const ADD_MAX_URLS = 5;
const ADD_PASSWORD = '12345';

let isAuthenticated = false;

function showAddProductModal() {
  const modal = document.getElementById('add-product-modal');

  if (!isAuthenticated) {
    // Show password prompt
    document.getElementById('add-password-form').classList.remove('hidden');
    document.getElementById('add-product-form').classList.add('hidden');
    document.getElementById('add-product-output').classList.add('hidden');
    document.getElementById('add-password-input').value = '';
    document.getElementById('add-password-error').classList.add('hidden');
    modal.classList.remove('hidden');
    document.getElementById('add-password-input').focus();
    return;
  }

  showAddForm();
  modal.classList.remove('hidden');
}

function handlePasswordSubmit() {
  const input = document.getElementById('add-password-input');
  if (input.value === ADD_PASSWORD) {
    isAuthenticated = true;
    showAddForm();
  } else {
    document.getElementById('add-password-error').classList.remove('hidden');
    input.value = '';
    input.focus();
  }
}

function showAddForm() {
  document.getElementById('add-password-form').classList.add('hidden');
  document.getElementById('add-product-form').classList.remove('hidden');
  document.getElementById('add-product-output').classList.add('hidden');

  // Reset form
  document.getElementById('add-product-form').reset();
  const urlFields = document.getElementById('url-fields');
  urlFields.innerHTML = '';
  const row = createAddUrlRow('', '', true);
  urlFields.appendChild(row);
  document.getElementById('add-url-btn').disabled = false;
}

function createAddUrlRow(url, label, hideRemove) {
  const row = document.createElement('div');
  row.classList.add('url-field-row');
  row.innerHTML = `
    <input type="url" placeholder="https://www.example.com/product" required class="url-input" value="${escapeAddAttr(url)}">
    <input type="text" placeholder="Retailer name" required class="label-input" value="${escapeAddAttr(label)}">
    <button type="button" class="btn btn-icon btn-remove-url" title="Remove">&times;</button>
  `;

  const removeBtn = row.querySelector('.btn-remove-url');
  if (hideRemove) removeBtn.style.visibility = 'hidden';

  removeBtn.addEventListener('click', () => {
    row.remove();
    document.getElementById('add-url-btn').disabled = false;
    updateAddRemoveButtons();
  });

  return row;
}

function escapeAddAttr(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function updateAddRemoveButtons() {
  const rows = document.querySelectorAll('#url-fields .url-field-row');
  rows.forEach(row => {
    const btn = row.querySelector('.btn-remove-url');
    btn.style.visibility = rows.length > 1 ? 'visible' : 'hidden';
  });
}

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

function handleAddSubmit() {
  const name = document.getElementById('product-name').value.trim();
  const category = document.getElementById('product-category').value;
  const targetPrice = document.getElementById('target-price').value;
  const alertEnabled = document.getElementById('alert-enabled').checked;

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
    name,
    urls,
    added_date: new Date().toISOString().split('T')[0],
    active: true,
  };

  if (category) product.category = category;
  if (targetPrice) product.target_price = parseFloat(targetPrice);
  product.alert_enabled = alertEnabled;

  // Show the JSON output
  document.getElementById('add-product-form').classList.add('hidden');
  document.getElementById('add-product-output').classList.remove('hidden');
  document.getElementById('product-json-output').textContent = JSON.stringify(product, null, 2);
}

function copyProductJson() {
  const text = document.getElementById('product-json-output').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copy-json-btn');
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy JSON'; }, 2000);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // Add product button
  document.getElementById('add-product-btn').addEventListener('click', showAddProductModal);

  // Password form
  document.getElementById('add-password-submit').addEventListener('click', handlePasswordSubmit);
  document.getElementById('add-password-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handlePasswordSubmit();
    }
  });

  // Add product form submit
  document.getElementById('add-product-form').addEventListener('submit', (e) => {
    e.preventDefault();
    handleAddSubmit();
  });

  // Add URL button
  document.getElementById('add-url-btn').addEventListener('click', () => {
    const urlFields = document.getElementById('url-fields');
    const rows = urlFields.querySelectorAll('.url-field-row');
    if (rows.length >= ADD_MAX_URLS) return;

    const row = createAddUrlRow('', '', false);
    urlFields.appendChild(row);
    updateAddRemoveButtons();

    if (urlFields.querySelectorAll('.url-field-row').length >= ADD_MAX_URLS) {
      document.getElementById('add-url-btn').disabled = true;
    }
  });

  // Copy JSON button
  document.getElementById('copy-json-btn').addEventListener('click', copyProductJson);
});
