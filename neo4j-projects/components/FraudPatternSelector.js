const PATTERNS = [
  {
    id: "shell-companies",
    label: "Shell Company Operators",
    description: "Officers controlling 10+ entities",
    endpoint: "/api/graph/shell-companies",
  },
  {
    id: "shared-addresses",
    label: "Shared Address Clusters",
    description: "Addresses with many registered entities",
    endpoint: "/api/graph/shared-addresses",
  },
  {
    id: "intermediary-hubs",
    label: "Intermediary Hubs",
    description: "Agents setting up the most entities",
    endpoint: "/api/graph/intermediary-hubs",
  },
];

export default function FraudPatternSelector({ selected, onSelect }) {
  return (
    <div className="pattern-selector">
      <h3>Fraud Detection Patterns</h3>
      <div className="pattern-buttons">
        {PATTERNS.map((pattern) => (
          <button
            key={pattern.id}
            className={`pattern-btn ${selected === pattern.id ? "active" : ""}`}
            onClick={() => onSelect(pattern)}
          >
            <span className="pattern-name">{pattern.label}</span>
            <span className="pattern-desc">{pattern.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
