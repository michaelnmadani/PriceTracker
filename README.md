# Price Tracker

A free product price tracking website that monitors prices across multiple retailers, tracks all-time lows, and alerts you when prices drop to your target.

**Cost: $0** — Hosted on GitHub Pages with daily automated price checks via GitHub Actions.

## Features

- **Track any product URL** — works with most retailers via structured data extraction (JSON-LD, OpenGraph, microdata)
- **Up to 5 URLs per product** — compare prices across Amazon, Best Buy, Walmart, etc.
- **Daily automated updates** — GitHub Actions runs the scraper every day at 6:00 AM UTC
- **All-time low tracking** — see the lowest price ever recorded for each product
- **Target price alerts** — set a target price and get visual alerts when prices drop
- **Price history charts** — interactive charts showing price trends over time
- **Responsive dashboard** — works on desktop and mobile

## Quick Start

### 1. Enable GitHub Pages

Go to your repository **Settings > Pages** and set:
- Source: **Deploy from a branch**
- Branch: **main** (or your default branch)
- Folder: **/docs**

Your site will be available at: `https://<username>.github.io/PriceTracker/`

### 2. Add Products

Click the **"+ Add Product"** button on the dashboard, fill in the form, then commit the generated `products.json` to your repository.

Or edit `data/products.json` directly:

```json
{
  "products": [
    {
      "id": "unique-id",
      "name": "Product Name",
      "urls": [
        { "url": "https://www.retailer1.com/product", "label": "Retailer 1" },
        { "url": "https://www.retailer2.com/product", "label": "Retailer 2" }
      ],
      "category": "electronics",
      "target_price": 199.99,
      "alert_enabled": true,
      "added_date": "2026-03-21",
      "active": true
    }
  ]
}
```

**Fields:**
| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique identifier (any short string) |
| `name` | Yes | Product display name |
| `urls` | Yes | Array of URLs to track (max 5), each with `url` and `label` |
| `category` | No | Category for filtering |
| `target_price` | No | Alert when price drops to this value |
| `alert_enabled` | No | Enable/disable price drop alerts (default: true) |
| `added_date` | No | Date added (YYYY-MM-DD) |
| `active` | No | Set to false to pause tracking (default: true) |

### 3. Run the Scraper

The scraper runs automatically daily via GitHub Actions. To trigger manually:

1. Go to **Actions** tab in your repository
2. Select **"Daily Price Scrape"**
3. Click **"Run workflow"**

To run locally:
```bash
pip install -r scraper/requirements.txt
python scraper/scrape.py
```

## How It Works

1. **GitHub Actions** triggers daily at 6:00 AM UTC (configurable in `.github/workflows/scrape.yml`)
2. **Python scraper** visits each product URL and extracts the price using structured data (JSON-LD, meta tags, microdata)
3. **Prices are saved** to `data/prices.json` with full history
4. **Data is copied** to `docs/data/` for the static frontend
5. **Changes are committed** and GitHub Pages auto-deploys

## Price Extraction

The scraper uses a generic approach that works on most retailer websites:

1. **JSON-LD** — `<script type="application/ld+json">` with `@type: Product`
2. **OpenGraph** — `og:price:amount` meta tags
3. **Microdata** — `itemprop="price"` elements
4. **Regex fallback** — common price patterns

This works because retailers embed structured data for SEO/search engines.

### Limitations

- **Amazon** aggressively blocks automated requests. Prices may not update reliably.
- **Some sites** may not include structured price data. The regex fallback may extract incorrect prices.
- **Anti-bot measures** may block the scraper temporarily. Failed fetches retain previous data.

## Project Structure

```
PriceTracker/
├── .github/workflows/scrape.yml   # Daily cron workflow
├── scraper/
│   ├── requirements.txt           # Python dependencies
│   ├── scrape.py                  # Main scraper
│   ├── fetchers/
│   │   ├── base.py                # Abstract fetcher
│   │   └── generic.py             # Generic price extractor
│   └── utils.py                   # HTTP utilities
├── data/
│   ├── products.json              # Your product list
│   └── prices.json                # Price history (auto-updated)
├── docs/                          # GitHub Pages site
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── app.js                 # Data loading
│       ├── table.js               # Product table
│       ├── chart.js               # Price charts
│       ├── addProduct.js          # Add product form
│       └── alerts.js              # Price alerts
└── README.md
```

## GitHub Actions Free Tier

The scraper runs in ~1-2 minutes per execution. At once per day, that's ~30-60 minutes per month — well within the 2,000 minutes/month free tier.
