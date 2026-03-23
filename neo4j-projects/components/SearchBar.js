import { useState, useCallback } from "react";

export default function SearchBar({ onSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const search = useCallback(
    async (q) => {
      if (q.length < 2) {
        setResults([]);
        setShowDropdown(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q)}&limit=10`
        );
        const data = await res.json();
        setResults(data.results || []);
        setShowDropdown(true);
      } catch {
        setResults([]);
      }
      setLoading(false);
    },
    []
  );

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    // Debounce
    clearTimeout(handleChange._timer);
    handleChange._timer = setTimeout(() => search(val), 300);
  };

  const handleSelect = (result) => {
    setQuery(result.name);
    setShowDropdown(false);
    if (onSelect) onSelect(result);
  };

  const typeColors = {
    Entity: "#4f8ef7",
    Officer: "#e74c3c",
    Intermediary: "#2ecc71",
  };

  return (
    <div className="search-container">
      <input
        type="text"
        className="search-input"
        placeholder="Search entities, officers, intermediaries..."
        value={query}
        onChange={handleChange}
        onFocus={() => results.length > 0 && setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
      />
      {loading && <span className="search-spinner" />}
      {showDropdown && results.length > 0 && (
        <div className="search-dropdown">
          {results.map((r, i) => (
            <button
              key={`${r.id}-${i}`}
              className="search-result"
              onMouseDown={() => handleSelect(r)}
            >
              <span
                className="result-type"
                style={{ backgroundColor: typeColors[r.type] || "#666" }}
              >
                {r.type}
              </span>
              <span className="result-name">{r.name}</span>
              {r.detail && (
                <span className="result-detail">{r.detail}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
