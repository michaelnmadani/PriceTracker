import { useState, useEffect } from "react";

export default function StatsCards() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/graph/stats")
      .then((r) => r.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="stats-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="stat-card loading">
            <div className="stat-skeleton" />
          </div>
        ))}
      </div>
    );
  }

  if (!stats || stats.error) {
    return (
      <div className="stats-grid">
        <div className="stat-card error">
          <p>Could not load statistics. Is Neo4j connected?</p>
        </div>
      </div>
    );
  }

  const cards = [
    {
      label: "Entities",
      value: stats.nodes?.Entity || 0,
      icon: "🏢",
      color: "#4f8ef7",
    },
    {
      label: "Officers",
      value: stats.nodes?.Officer || 0,
      icon: "👤",
      color: "#e74c3c",
    },
    {
      label: "Intermediaries",
      value: stats.nodes?.Intermediary || 0,
      icon: "🔗",
      color: "#2ecc71",
    },
    {
      label: "Addresses",
      value: stats.nodes?.Address || 0,
      icon: "📍",
      color: "#9b59b6",
    },
  ];

  return (
    <div className="stats-grid">
      {cards.map((card) => (
        <div
          key={card.label}
          className="stat-card"
          style={{ borderTopColor: card.color }}
        >
          <div className="stat-icon">{card.icon}</div>
          <div className="stat-value">{card.value.toLocaleString()}</div>
          <div className="stat-label">{card.label}</div>
        </div>
      ))}
    </div>
  );
}
