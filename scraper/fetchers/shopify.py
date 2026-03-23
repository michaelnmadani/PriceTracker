import json
import re
from urllib.parse import urlparse, urlencode, parse_qs

from ..utils import fetch_page


class ShopifyFetcher:
    """Fetcher for Shopify stores using the public product JSON API.

    Shopify stores expose a /products/<handle>.json endpoint that returns
    structured product data. This is far more reliable than scraping HTML
    because it bypasses Cloudflare challenges and JavaScript rendering.
    """

    @staticmethod
    def is_shopify_url(url: str) -> bool:
        """Heuristic check if a URL looks like a Shopify product page."""
        return bool(re.search(r"/products/[\w-]+", url))

    def fetch(self, url: str, variant_id: str | None = None) -> dict:
        result = {"price": None, "available": True, "name": None, "error": None}

        json_url = self._build_json_url(url)
        if not json_url:
            result["error"] = "Could not construct Shopify JSON URL"
            result["available"] = False
            return result

        # Extract variant ID from query string if present
        if variant_id is None:
            parsed = parse_qs(urlparse(url).query)
            variant_ids = parsed.get("variant", [])
            if variant_ids:
                variant_id = variant_ids[0]

        response = fetch_page(json_url)
        if response is None:
            result["error"] = "Failed to fetch Shopify JSON endpoint"
            result["available"] = False
            return result

        try:
            data = response.json()
        except (json.JSONDecodeError, ValueError):
            result["error"] = "Invalid JSON from Shopify endpoint"
            result["available"] = False
            return result

        product = data.get("product")
        if not product:
            result["error"] = "No product data in Shopify JSON response"
            result["available"] = False
            return result

        result["name"] = product.get("title")
        variants = product.get("variants", [])

        if not variants:
            result["error"] = "No variants found"
            result["available"] = False
            return result

        # If a specific variant was requested, find it
        chosen = None
        if variant_id:
            for v in variants:
                if str(v.get("id")) == str(variant_id):
                    chosen = v
                    break

        # Fall back to the first available variant, or just the first one
        if not chosen:
            for v in variants:
                if v.get("available", False):
                    chosen = v
                    break
        if not chosen:
            chosen = variants[0]

        try:
            price = float(chosen.get("price", "0"))
        except (ValueError, TypeError):
            result["error"] = "Could not parse variant price"
            result["available"] = False
            return result

        result["price"] = price
        result["available"] = chosen.get("available", True)

        return result

    @staticmethod
    def _build_json_url(url: str) -> str | None:
        """Convert a Shopify product URL to its .json API endpoint."""
        parsed = urlparse(url)
        path = parsed.path.rstrip("/")

        match = re.search(r"/products/([\w-]+)$", path)
        if not match:
            return None

        json_path = "/products/" + match.group(1) + ".json"
        return f"{parsed.scheme}://{parsed.netloc}{json_path}"
