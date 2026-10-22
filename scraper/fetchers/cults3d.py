import os
import re

import requests

GRAPHQL_URL = "https://cults3d.com/graphql"

QUERY = """
query CreationPrice($slug: String!) {
  creation(slug: $slug) {
    name
    price(currency: USD) { cents }
  }
}
"""


class Cults3DFetcher:
    """Fetcher for Cults3D using the official GraphQL API.

    Cults3D blocks automated page requests from GitHub's servers, but its API
    accepts HTTP Basic auth with your Cults3D nickname and an API key, read
    from the CULTS3D_USERNAME and CULTS3D_API_KEY environment variables.
    Prices are returned in USD.
    """

    @staticmethod
    def is_cults3d_url(url: str) -> bool:
        return "cults3d.com/" in url

    @staticmethod
    def has_credentials() -> bool:
        return bool(os.environ.get("CULTS3D_USERNAME") and os.environ.get("CULTS3D_API_KEY"))

    @staticmethod
    def _slug(url: str) -> str | None:
        match = re.search(r"/3d-model/[^/]+/([^/?#]+)", url)
        return match.group(1) if match else None

    def fetch(self, url: str) -> dict:
        result = {"price": None, "available": True, "name": None, "error": None}

        slug = self._slug(url)
        if not slug:
            result.update(available=False, error="Could not find the model slug in the Cults3D URL")
            return result

        try:
            response = requests.post(
                GRAPHQL_URL,
                json={"query": QUERY, "variables": {"slug": slug}},
                auth=(os.environ["CULTS3D_USERNAME"], os.environ["CULTS3D_API_KEY"]),
                timeout=20,
            )
            response.raise_for_status()
            payload = response.json()
        except Exception as e:  # network, HTTP or JSON errors
            result.update(available=False, error=f"Cults3D API request failed: {type(e).__name__}: {e}"[:300])
            return result

        if payload.get("errors"):
            messages = "; ".join(err.get("message", "") for err in payload["errors"])
            result.update(available=False, error=f"Cults3D API error: {messages}"[:300])
            return result

        creation = (payload.get("data") or {}).get("creation")
        if not creation:
            result.update(available=False, error=f"Cults3D API returned no creation for slug '{slug}'")
            return result

        cents = (creation.get("price") or {}).get("cents")
        if cents is None:
            result.update(available=False, error="Cults3D API returned no price")
            return result

        result["price"] = round(cents / 100.0, 2)
        result["name"] = creation.get("name")
        return result
