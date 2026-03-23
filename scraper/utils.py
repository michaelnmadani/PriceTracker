import random
import time

import cloudscraper
import requests


def _create_scraper():
    """Create a cloudscraper session that bypasses Cloudflare challenges."""
    return cloudscraper.create_scraper(
        browser={"browser": "chrome", "platform": "windows", "desktop": True},
    )


def fetch_page(url: str, max_retries: int = 3, timeout: int = 15) -> requests.Response | None:
    """Fetch a webpage with retry logic and Cloudflare bypass.

    Uses cloudscraper to handle Cloudflare JavaScript challenges.
    Returns the Response object on success, or None on failure.
    """
    scraper = _create_scraper()

    for attempt in range(max_retries):
        try:
            if attempt > 0:
                delay = (2 ** attempt) + random.uniform(0, 1)
                time.sleep(delay)

            response = scraper.get(url, timeout=timeout, allow_redirects=True)
            response.raise_for_status()
            return response
        except (requests.RequestException, Exception) as e:
            print(f"  Attempt {attempt + 1}/{max_retries} failed for {url}: {e}")

    return None


def random_delay(min_seconds: float = 2.0, max_seconds: float = 5.0):
    """Sleep for a random duration between requests."""
    time.sleep(random.uniform(min_seconds, max_seconds))
