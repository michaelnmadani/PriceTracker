import json
import re

from bs4 import BeautifulSoup

from .base import BaseFetcher
from ..utils import fetch_page


class GenericFetcher(BaseFetcher):
    """Generic price fetcher using structured data (JSON-LD, meta tags, microdata).

    Works across most retailer websites because structured data is placed
    intentionally for SEO and is rarely blocked by anti-scraping measures.
    """

    def fetch(self, url: str) -> dict:
        result = {"price": None, "available": True, "name": None, "error": None}

        response = fetch_page(url)
        if response is None:
            result["error"] = "Failed to fetch page after retries"
            result["available"] = False
            return result

        soup = BeautifulSoup(response.text, "lxml")

        # Try extraction methods in priority order
        extracted = (
            self._extract_json_ld(soup)
            or self._extract_opengraph(soup)
            or self._extract_microdata(soup)
            or self._extract_regex(response.text)
        )

        if extracted:
            result["price"] = extracted.get("price")
            result["name"] = extracted.get("name") or result["name"]
            if "available" in extracted:
                result["available"] = extracted["available"]
        else:
            result["error"] = "Could not extract price from page"

        return result

    def _extract_json_ld(self, soup: BeautifulSoup) -> dict | None:
        """Extract price from JSON-LD structured data."""
        scripts = soup.find_all("script", type="application/ld+json")

        for script in scripts:
            try:
                data = json.loads(script.string)
                products = self._find_products_in_json_ld(data)
                for product in products:
                    price_info = self._extract_price_from_product(product)
                    if price_info:
                        return price_info
            except (json.JSONDecodeError, TypeError, AttributeError):
                continue

        return None

    def _find_products_in_json_ld(self, data) -> list:
        """Recursively find Product objects in JSON-LD data."""
        products = []

        if isinstance(data, list):
            for item in data:
                products.extend(self._find_products_in_json_ld(item))
        elif isinstance(data, dict):
            item_type = data.get("@type", "")
            if isinstance(item_type, list):
                item_type = " ".join(item_type)
            if "Product" in str(item_type):
                products.append(data)

            # Check @graph
            if "@graph" in data:
                products.extend(self._find_products_in_json_ld(data["@graph"]))

        return products

    def _extract_price_from_product(self, product: dict) -> dict | None:
        """Extract price from a JSON-LD Product object."""
        name = product.get("name")
        offers = product.get("offers", {})

        # offers can be a list or a single object
        if isinstance(offers, list):
            offers_list = offers
        else:
            offers_list = [offers]

        for offer in offers_list:
            if isinstance(offer, dict):
                # Try direct price field
                price = offer.get("price") or offer.get("lowPrice")
                if price is not None:
                    try:
                        price = float(str(price).replace(",", "").replace("$", ""))
                    except (ValueError, TypeError):
                        continue

                    # Shopify stores sometimes report prices in cents (e.g. 89900 for $899.00)
                    currency = offer.get("priceCurrency", "")
                    if price > 10000 and currency:
                        price = price / 100.0

                    availability = offer.get("availability", "")
                    available = "OutOfStock" not in str(availability)

                    return {"price": price, "name": name, "available": available}

                # Check priceSpecification
                price_spec = offer.get("priceSpecification", {})
                if isinstance(price_spec, dict):
                    price = price_spec.get("price")
                    if price is not None:
                        try:
                            price = float(str(price).replace(",", "").replace("$", ""))
                        except (ValueError, TypeError):
                            continue
                        return {"price": price, "name": name, "available": True}

        return None

    def _extract_opengraph(self, soup: BeautifulSoup) -> dict | None:
        """Extract price from OpenGraph meta tags."""
        price_tags = [
            ("product:price:amount", "property"),
            ("og:price:amount", "property"),
            ("product:price:amount", "name"),
        ]

        for tag_content, tag_attr in price_tags:
            meta = soup.find("meta", attrs={tag_attr: tag_content})
            if meta and meta.get("content"):
                try:
                    price = float(meta["content"].replace(",", "").replace("$", ""))
                    name_meta = soup.find("meta", attrs={"property": "og:title"})
                    name = name_meta["content"] if name_meta and name_meta.get("content") else None
                    return {"price": price, "name": name}
                except (ValueError, TypeError):
                    continue

        return None

    def _extract_microdata(self, soup: BeautifulSoup) -> dict | None:
        """Extract price from HTML microdata."""
        price_elem = soup.find(attrs={"itemprop": "price"})
        if price_elem:
            price_str = price_elem.get("content") or price_elem.get_text(strip=True)
            try:
                price = float(re.sub(r"[^\d.]", "", price_str))
                name_elem = soup.find(attrs={"itemprop": "name"})
                name = name_elem.get_text(strip=True) if name_elem else None
                return {"price": price, "name": name}
            except (ValueError, TypeError):
                pass

        return None

    def _extract_regex(self, html: str) -> dict | None:
        """Last resort: extract price using regex patterns."""
        patterns = [
            r'\$\s*(\d{1,3}(?:,\d{3})*\.\d{2})',
            r'"price"\s*:\s*["\']?(\d+\.\d{2})["\']?',
            r'class="[^"]*price[^"]*"[^>]*>\s*\$?\s*(\d{1,3}(?:,\d{3})*\.\d{2})',
        ]

        # Collect all candidate prices across all patterns
        candidates = []
        for pattern in patterns:
            matches = re.findall(pattern, html, re.IGNORECASE)
            for m in matches:
                try:
                    price = float(m.replace(",", ""))
                    # Require decimal cents and a realistic product price range
                    if 10.0 <= price <= 100000:
                        candidates.append(price)
                except (ValueError, TypeError):
                    continue

        if not candidates:
            return None

        # Pick the most frequently occurring price (likely the real product price)
        from collections import Counter
        price_counts = Counter(candidates)
        best_price = price_counts.most_common(1)[0][0]
        return {"price": best_price}
