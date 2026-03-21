from abc import ABC, abstractmethod


class BaseFetcher(ABC):
    """Abstract base class for price fetchers."""

    @abstractmethod
    def fetch(self, url: str) -> dict:
        """Fetch price and availability from a product URL.

        Returns:
            dict with keys:
                - price: float or None if extraction failed
                - available: bool
                - name: str or None (product name if found)
                - error: str or None (error message if failed)
        """
        raise NotImplementedError
