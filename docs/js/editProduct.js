/**
 * editProduct.js — Edit and delete product modal logic.
 * Allows authorized users to modify product name, target price, URLs,
 * category, and alert settings, or delete the product entirely.
 */

const EDIT_MAX_URLS = 5;

let editingProductId = null;

function openEditModal(productId) {
  if (!isDeviceAuthorized()) {
    showUnauthorizedMessage();
    return;
  }

  const product = App.products.find(p => p.id === productId);
  if (!product) return;

  editingProductId = productId;

  const modal = document.getElementById('edit-product-modal');
  const form = document.getElementById('edit-product-form');
  const saving = document.getElementById('edit-product-saving');
  const deleteConfirm = document.getElementById('edit-delete-confirm');

  form.classList.remove('hidden');
  saving.classList.add('hidden');
  deleteConfirm.classList.add('hidden');

  // Populate fields
  document.getElementById('edit-product-name').value = product.name;
  document.getElementById('edit-product-category').value = product.category || '';
  document.getElementById('edit-target-price').value = product.target_price != null ? product.target_price : '';
  document.getElementById('edit-alert-enabled').checked = product.alert_enabled !== false;

  // Populate URL fields
  const urlFields = document.getElementById('edit-url-fields');
  const addUrlBtn = document.getElementById('edit-add-url-btn');
  urlFields.innerHTML = '';
  addUrlBtn.disabled = false;

  const urls = product.urls || [];
  urls.forEach((entry, i) => {
    const row = createEditUrlRow(entry.url, entry.label, urls.length <= 1);
    urlFields.appendChild(row);
  });

  if (urls.length === 0) {
    const row = createEditUrlRow('', '', true);
    urlFields.appendChild(row);
  }

  if (urls.length >= EDIT_MAX_URLS) {
    addUrlBtn.disabled = true;
  }

  updateEditRemoveButtons();
  modal.classList.remove('hidden');
}

function createEditUrlRow(url, label, hideRemove) {
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
    document.getElementById('edit-add-url-btn').disabled = false;
    updateEditRemoveButtons();
  });

  return row;
}

function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function updateEditRemoveButtons() {
  const rows = document.querySelectorAll('#edit-url-fields .url-field-row');
  rows.forEach(row => {
    const btn = row.querySelector('.btn-remove-url');
    btn.style.visibility = rows.length > 1 ? 'visible' : 'hidden';
  });
}

async function handleEditSubmit() {
  const name = document.getElementById('edit-product-name').value.trim();
  const category = document.getElementById('edit-product-category').value;
  const targetPrice = document.getElementById('edit-target-price').value;
  const alertEnabled = document.getElementById('edit-alert-enabled').checked;

  const urlRows = document.querySelectorAll('#edit-url-fields .url-field-row');
  const urls = [];
  urlRows.forEach(row => {
    const url = row.querySelector('.url-input').value.trim();
    const label = row.querySelector('.label-input').value.trim();
    if (url && label) {
      urls.push({ url, label });
    }
  });

  if (!name || urls.length === 0) return;

  const form = document.getElementById('edit-product-form');
  const saving = document.getElementById('edit-product-saving');

  form.classList.add('hidden');
  saving.classList.remove('hidden');
  saving.querySelector('.saving-message').textContent = 'Saving changes...';

  const payload = {
    id: editingProductId,
    name,
    urls,
    category: category || undefined,
    target_price: targetPrice ? parseFloat(targetPrice) : undefined,
    alert_enabled: alertEnabled,
  };

  try {
    const updated = await githubUpdateProduct(payload);

    saving.classList.add('hidden');

    // Update client-side state
    const index = App.products.findIndex(p => p.id === editingProductId);
    if (index !== -1) {
      App.products[index] = updated;
    }
    mergeData();
    populateCategories();
    updateSummary();
    renderTable(getFilteredData());

    document.getElementById('edit-product-modal').classList.add('hidden');
  } catch (err) {
    console.error('Failed to update product:', err);
    saving.classList.add('hidden');
    alert('Failed to save: ' + err.message);
    form.classList.remove('hidden');
  }
}

function showDeleteConfirm() {
  document.getElementById('edit-product-form').classList.add('hidden');
  document.getElementById('edit-delete-confirm').classList.remove('hidden');

  const product = App.products.find(p => p.id === editingProductId);
  const nameEl = document.getElementById('edit-delete-product-name');
  if (product && nameEl) {
    nameEl.textContent = product.name;
  }
}

function cancelDelete() {
  document.getElementById('edit-delete-confirm').classList.add('hidden');
  document.getElementById('edit-product-form').classList.remove('hidden');
}

async function handleDeleteProduct() {
  const saving = document.getElementById('edit-product-saving');
  const deleteConfirm = document.getElementById('edit-delete-confirm');

  deleteConfirm.classList.add('hidden');
  saving.classList.remove('hidden');
  saving.querySelector('.saving-message').textContent = 'Deleting product...';

  try {
    await githubDeleteProduct(editingProductId);

    saving.classList.add('hidden');

    // Remove from client-side state
    App.products = App.products.filter(p => p.id !== editingProductId);
    mergeData();
    populateCategories();
    updateSummary();
    renderTable(getFilteredData());

    document.getElementById('edit-product-modal').classList.add('hidden');
  } catch (err) {
    console.error('Failed to delete product:', err);
    saving.classList.add('hidden');
    alert('Failed to delete: ' + err.message);
    deleteConfirm.classList.remove('hidden');
  }
}

// Wire up event listeners once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('edit-product-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    handleEditSubmit();
  });

  document.getElementById('edit-add-url-btn').addEventListener('click', () => {
    const urlFields = document.getElementById('edit-url-fields');
    const rows = urlFields.querySelectorAll('.url-field-row');
    if (rows.length >= EDIT_MAX_URLS) return;

    const row = createEditUrlRow('', '', false);
    urlFields.appendChild(row);
    updateEditRemoveButtons();

    if (urlFields.querySelectorAll('.url-field-row').length >= EDIT_MAX_URLS) {
      document.getElementById('edit-add-url-btn').disabled = true;
    }
  });

  document.getElementById('edit-delete-btn').addEventListener('click', showDeleteConfirm);
  document.getElementById('edit-delete-cancel-btn').addEventListener('click', cancelDelete);
  document.getElementById('edit-delete-confirm-btn').addEventListener('click', handleDeleteProduct);
});
