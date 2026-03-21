/**
 * Vercel serverless function: POST /api/add-product
 * Adds a new product to data/products.json (and docs/data/products.json)
 * by committing via the GitHub API.
 */

const REPO_OWNER = 'michaelnmadani';
const REPO_NAME = 'PriceTracker';
const BRANCH = 'main';

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Server misconfigured: missing GITHUB_TOKEN' });
  }

  const { name, urls, category, target_price, alert_enabled } = req.body;

  if (!name || !urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'name and urls are required' });
  }

  // Validate each URL entry
  for (const entry of urls) {
    if (!entry.url || !entry.label) {
      return res.status(400).json({ error: 'Each URL entry must have url and label' });
    }
  }

  // Build the product object
  const product = {
    id: Math.random().toString(36).substring(2, 10),
    name,
    urls,
    added_date: new Date().toISOString().split('T')[0],
    active: true,
  };
  if (category) product.category = category;
  if (target_price != null && target_price !== '') product.target_price = parseFloat(target_price);
  if (alert_enabled != null) product.alert_enabled = Boolean(alert_enabled);

  try {
    // Read current data/products.json from the repo
    const fileData = await githubGetFile(token, 'data/products.json');
    const currentContent = JSON.parse(
      Buffer.from(fileData.content, 'base64').toString('utf-8')
    );

    const products = currentContent.products || [];
    products.push(product);
    const updatedContent = JSON.stringify({ products }, null, 2) + '\n';
    const encodedContent = Buffer.from(updatedContent).toString('base64');

    // Commit updated data/products.json
    await githubUpdateFile(token, 'data/products.json', encodedContent, fileData.sha,
      `Add tracked product: ${name}`);

    // Also update docs/data/products.json so the frontend picks it up on redeploy
    try {
      const docsFileData = await githubGetFile(token, 'docs/data/products.json');
      await githubUpdateFile(token, 'docs/data/products.json', encodedContent, docsFileData.sha,
        `Sync docs/data/products.json: add ${name}`);
    } catch (docsErr) {
      // If docs/data/products.json doesn't exist yet, create it
      await githubCreateFile(token, 'docs/data/products.json', encodedContent,
        `Create docs/data/products.json: add ${name}`);
    }

    return res.status(200).json({ success: true, product });
  } catch (err) {
    console.error('Failed to save product:', err);
    return res.status(500).json({ error: 'Failed to save product to repository' });
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
