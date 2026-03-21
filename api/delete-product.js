/**
 * Vercel serverless function: DELETE /api/delete-product
 * Removes a product from data/products.json (and docs/data/products.json)
 * by committing via the GitHub API.
 */

const REPO_OWNER = 'michaelnmadani';
const REPO_NAME = 'PriceTracker';
const BRANCH = process.env.GITHUB_BRANCH || 'claude/product-price-tracker-FwFd5';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'DELETE' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Server misconfigured: missing GITHUB_TOKEN' });
  }

  // Parse body manually if Vercel didn't auto-parse it (common for DELETE)
  let body = req.body;
  if (!body || typeof body === 'string') {
    try {
      body = typeof body === 'string' ? JSON.parse(body) : {};
    } catch (_) {
      body = {};
    }
  }

  const { id } = body;

  if (!id) {
    return res.status(400).json({ error: 'Product id is required' });
  }

  try {
    const fileData = await githubGetFile(token, 'data/products.json');
    const currentContent = JSON.parse(
      Buffer.from(fileData.content, 'base64').toString('utf-8')
    );

    const products = currentContent.products || [];
    const index = products.findIndex(p => p.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const removedName = products[index].name;
    products.splice(index, 1);

    const updatedContent = JSON.stringify({ products }, null, 2) + '\n';
    const encodedContent = Buffer.from(updatedContent).toString('base64');

    await githubUpdateFile(token, 'data/products.json', encodedContent, fileData.sha,
      `Delete product: ${removedName}`);

    try {
      const docsFileData = await githubGetFile(token, 'docs/data/products.json');
      await githubUpdateFile(token, 'docs/data/products.json', encodedContent, docsFileData.sha,
        `Sync docs/data/products.json: delete ${removedName}`);
    } catch (docsErr) {
      await githubCreateFile(token, 'docs/data/products.json', encodedContent,
        `Create docs/data/products.json: delete ${removedName}`);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Failed to delete product:', err);
    return res.status(500).json({ error: err.message || 'Failed to delete product' });
  }
}

async function githubGetFile(token, path) {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}?ref=${BRANCH}`;
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  if (!resp.ok) {
    throw new Error(`GitHub GET ${path}: ${resp.status} ${await resp.text()}`);
  }
  return resp.json();
}

async function githubUpdateFile(token, path, contentBase64, sha, message) {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;
  const resp = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      content: contentBase64,
      sha,
      branch: BRANCH,
    }),
  });
  if (!resp.ok) {
    throw new Error(`GitHub PUT ${path}: ${resp.status} ${await resp.text()}`);
  }
  return resp.json();
}

async function githubCreateFile(token, path, contentBase64, message) {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;
  const resp = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      content: contentBase64,
      branch: BRANCH,
    }),
  });
  if (!resp.ok) {
    throw new Error(`GitHub CREATE ${path}: ${resp.status} ${await resp.text()}`);
  }
  return resp.json();
}
