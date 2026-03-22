/**
 * githubApi.js — Direct GitHub API integration for product CRUD operations.
 * Commits changes to data/products.json and docs/data/products.json
 * directly from the browser using a GitHub Personal Access Token.
 * The token is entered via a password prompt and stored in localStorage.
 */

const GH_REPO_OWNER = 'michaelnmadani';
const GH_REPO_NAME = 'PriceTracker';
const GH_BRANCH = 'claude/product-price-tracker-FwFd5';
const GH_TOKEN_KEY = 'pt_github_token';

function getGitHubToken() {
  return localStorage.getItem(GH_TOKEN_KEY);
}

/**
 * Shows a password-style modal prompting for the GitHub token.
 * Returns a promise that resolves with the token or rejects if cancelled.
 */
function promptForToken() {
  return new Promise((resolve, reject) => {
    // If modal already exists, remove it
    const existing = document.getElementById('gh-token-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'gh-token-modal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 420px;">
        <div class="modal-header">
          <h2>Enter Password</h2>
          <button class="modal-close" id="gh-token-close">&times;</button>
        </div>
        <form id="gh-token-form">
          <div class="form-group">
            <label for="gh-token-input">GitHub Personal Access Token</label>
            <input type="password" id="gh-token-input" required
              placeholder="ghp_xxxxxxxxxxxx"
              autocomplete="off"
              style="width: 100%; font-family: monospace;">
            <small style="color: var(--text-muted); margin-top: 0.25rem; display: block;">
              Create one at GitHub &rarr; Settings &rarr; Developer settings &rarr; Personal access tokens (with <strong>repo</strong> scope). Saved locally in your browser.
            </small>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Save</button>
            <button type="button" class="btn btn-secondary" id="gh-token-cancel">Cancel</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    const input = document.getElementById('gh-token-input');
    input.focus();

    const cleanup = () => modal.remove();

    document.getElementById('gh-token-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const token = input.value.trim();
      if (token) {
        localStorage.setItem(GH_TOKEN_KEY, token);
        cleanup();
        resolve(token);
      }
    });

    document.getElementById('gh-token-cancel').addEventListener('click', () => {
      cleanup();
      reject(new Error('Authentication cancelled'));
    });

    document.getElementById('gh-token-close').addEventListener('click', () => {
      cleanup();
      reject(new Error('Authentication cancelled'));
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        cleanup();
        reject(new Error('Authentication cancelled'));
      }
    });
  });
}

/**
 * Gets the token, prompting if not yet stored.
 */
async function ensureGitHubToken() {
  let token = getGitHubToken();
  if (!token) {
    token = await promptForToken();
  }
  return token;
}

async function ghApiFetch(path, options = {}) {
  const token = await ensureGitHubToken();

  const url = `https://api.github.com/repos/${GH_REPO_OWNER}/${GH_REPO_NAME}/${path}`;
  const resp = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (resp.status === 401) {
    // Token is invalid — clear it so they'll be prompted again
    localStorage.removeItem(GH_TOKEN_KEY);
    throw new Error('Invalid token. Please try again.');
  }

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GitHub API ${resp.status}: ${text.substring(0, 200)}`);
  }
  return resp.json();
}

async function ghGetFile(filePath) {
  return ghApiFetch(`contents/${filePath}?ref=${GH_BRANCH}`);
}

async function ghPutFile(filePath, contentBase64, sha, message) {
  const body = { message, content: contentBase64, branch: GH_BRANCH };
  if (sha) body.sha = sha;
  return ghApiFetch(`contents/${filePath}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

async function ghReadProducts() {
  const fileData = await ghGetFile('data/products.json');
  const content = JSON.parse(atob(fileData.content.replace(/\n/g, '')));
  return { products: content.products || [], sha: fileData.sha };
}

async function ghWriteProducts(products, message) {
  const json = JSON.stringify({ products }, null, 2) + '\n';
  const encoded = btoa(unescape(encodeURIComponent(json)));

  // Update data/products.json
  const fileData = await ghGetFile('data/products.json');
  await ghPutFile('data/products.json', encoded, fileData.sha, message);

  // Sync docs/data/products.json
  try {
    const docsFile = await ghGetFile('docs/data/products.json');
    await ghPutFile('docs/data/products.json', encoded, docsFile.sha, `Sync: ${message}`);
  } catch {
    await ghPutFile('docs/data/products.json', encoded, null, `Create: ${message}`);
  }
}

async function githubAddProduct(productData) {
  const { products } = await ghReadProducts();

  const product = {
    id: Math.random().toString(36).substring(2, 10),
    name: productData.name,
    urls: productData.urls,
    added_date: new Date().toISOString().split('T')[0],
    active: true,
  };
  if (productData.category) product.category = productData.category;
  if (productData.target_price != null) product.target_price = productData.target_price;
  product.alert_enabled = productData.alert_enabled !== false;

  products.push(product);
  await ghWriteProducts(products, `Add product: ${product.name}`);
  return product;
}

async function githubUpdateProduct(productData) {
  const { products } = await ghReadProducts();

  const index = products.findIndex(p => p.id === productData.id);
  if (index === -1) throw new Error('Product not found');

  const existing = products[index];
  const updated = {
    ...existing,
    name: productData.name,
    urls: productData.urls,
    category: productData.category || undefined,
    target_price: productData.target_price != null ? productData.target_price : undefined,
    alert_enabled: productData.alert_enabled,
  };
  Object.keys(updated).forEach(k => { if (updated[k] === undefined) delete updated[k]; });

  products[index] = updated;
  await ghWriteProducts(products, `Update product: ${updated.name}`);
  return updated;
}

async function githubDeleteProduct(productId) {
  const { products } = await ghReadProducts();

  const index = products.findIndex(p => p.id === productId);
  if (index === -1) throw new Error('Product not found');

  const name = products[index].name;
  products.splice(index, 1);
  await ghWriteProducts(products, `Delete product: ${name}`);
}
