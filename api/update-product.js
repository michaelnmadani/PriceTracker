/**
 * Vercel serverless function: PUT /api/update-product
 * Updates an existing product in data/products.json (and docs/data/products.json)
 * by committing via the GitHub API.
 */

const REPO_OWNER = 'michaelnmadani';
const REPO_NAME = 'PriceTracker';
const BRANCH = process.env.GITHUB_BRANCH || 'claude/product-price-tracker-FwFd5';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Server misconfigured: missing GITHUB_TOKEN' });
  }

  const { id, name, urls, category, target_price, alert_enabled } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Product id is required' });
  }

  if (!name || !urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'name and urls are required' });
  }

  for (const entry of urls) {
    if (!entry.url || !entry.label) {
      return res.status(400).json({ error: 'Each URL entry must have url and label' });
    }
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

    // Update fields while preserving others (added_date, active, etc.)
    products[index].name = name;
    products[index].urls = urls;
    products[index].category = category || undefined;
    if (target_price != null && target_price !== '') {
      products[index].target_price = parseFloat(target_price);
    } else {
      delete products[index].target_price;
    }
    if (alert_enabled != null) {
      products[index].alert_enabled = Boolean(alert_enabled);
    }

    // Clean undefined fields
    if (!products[index].category) delete products[index].category;

    const updatedContent = JSON.stringify({ products }, null, 2) + '\n';
    const encodedContent = Buffer.from(updatedContent).toString('base64');

    await githubUpdateFile(token, 'data/products.json', encodedContent, fileData.sha,
      `Update product: ${name}`);

    try {
      const docsFileData = await githubGetFile(token, 'docs/data/products.json');
      await githubUpdateFile(token, 'docs/data/products.json', encodedContent, docsFileData.sha,
        `Sync docs/data/products.json: update ${name}`);
    } catch (docsErr) {
      await githubCreateFile(token, 'docs/data/products.json', encodedContent,
        `Create docs/data/products.json: update ${name}`);
    }

    return res.status(200).json({ success: true, product: products[index] });
  } catch (err) {
    console.error('Failed to update product:', err);
    return res.status(500).json({ error: err.message || 'Failed to update product' });
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
