/**
 * addProduct.js — Add product modal with password protection.
 * Triggers a GitHub Actions workflow to commit new products.
 */

const ADD_MAX_URLS = 5;
const ADD_PASSWORD = '12345';
const REPO_OWNER = 'michaelnmadani';
const REPO_NAME = 'PriceTracker';

let isAuthenticated = false;

function showAddProductModal() {
  const modal = document.getElementById('add-product-modal');

  if (!isAuthenticated) {
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

async function handleAddSubmit() {
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

  const token = document.getElementById('github-token-input').value.trim();
  if (!token) {
    alert('Please enter your GitHub token.');
    return;
  }

  // Show saving state
  const submitBtn = document.querySelector('#add-product-form .btn-primary');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = 'Adding...';
  submitBtn.disabled = true;

  try {
    await triggerAddProductWorkflow(token, {
      name,
      urls_json: JSON.stringify(urls),
      category: category || '',
      target_price: targetPrice || '',
      alert_enabled: alertEnabled ? 'true' : 'false',
    });

    // Show success
    document.getElementById('add-product-form').classList.add('hidden');
    document.getElementById('add-product-output').classList.remove('hidden');
    document.getElementById('product-json-output').textContent =
      `"${name}" has been added!\n\nThe GitHub Action is now committing it to the repo. The product will appear on the site after the Pages deploy completes (~30 seconds).\n\nPrices will be populated on the next scrape run.`;
  } catch (err) {
    alert('Failed to add product: ' + err.message);
  } finally {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
}

async function triggerAddProductWorkflow(token, inputs) {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/add-product.yml/dispatches`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ref: 'claude/product-price-tracker-FwFd5',
      inputs,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GitHub API error ${resp.status}: ${text}`);
  }
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
});
