import { useEffect, useRef, useState } from "react";

export default function GraphVisualization({ nodeId }) {
  const containerRef = useRef(null);
  const visRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!nodeId) return;

    setLoading(true);
    setError(null);

    fetch(`/api/graph/networks?nodeId=${encodeURIComponent(nodeId)}&depth=2`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          setLoading(false);
          return;
        }
        renderGraph(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [nodeId]);

  function renderGraph(data) {
    if (!containerRef.current || !data.nodes) return;

    // Clean up previous visualization
    if (visRef.current) {
      containerRef.current.innerHTML = "";
    }

    const typeColors = {
      Entity: "#4f8ef7",
      Officer: "#e74c3c",
      Intermediary: "#2ecc71",
      Address: "#9b59b6",
    };

    const nodes = (data.nodes || [])
      .filter((n) => n && n.id)
      .map((n) => ({
        id: n.id,
        label: truncate(n.label || "Unknown", 25),
        color: typeColors[n.type] || "#666",
        title: `${n.type}: ${n.label}\n${n.country || ""}`,
        shape: "dot",
        size: n.type === "Officer" ? 20 : n.type === "Entity" ? 15 : 10,
      }));

    const edges = (data.relationships || [])
      .filter((r) => r && r.source && r.target)
      .map((r, i) => ({
        id: `e${i}`,
        from: r.source,
        to: r.target,
        label: r.type,
        arrows: "to",
        color: { color: "#555", opacity: 0.7 },
        font: { size: 9, color: "#888" },
      }));

    if (typeof window !== "undefined" && window.vis) {
      const network = new window.vis.Network(
        containerRef.current,
        {
          nodes: new window.vis.DataSet(nodes),
          edges: new window.vis.DataSet(edges),
        },
        {
          physics: {
            solver: "forceAtlas2Based",
            forceAtlas2Based: { gravitationalConstant: -30 },
            stabilization: { iterations: 100 },
          },
          nodes: {
            font: { size: 11, color: "#ddd" },
            borderWidth: 2,
          },
          edges: {
            smooth: { type: "continuous" },
          },
          interaction: {
            hover: true,
            tooltipDelay: 200,
          },
        }
      );
      visRef.current = network;
    } else {
      // Fallback: render as simple list
      containerRef.current.innerHTML = `
        <div style="padding: 20px; color: #aaa;">
          <p>Graph contains ${nodes.length} nodes and ${edges.length} relationships.</p>
          <p>Install vis-network for interactive visualization.</p>
        </div>
      `;
    }
  }

  return (
    <div className="graph-container">
      <script
        src="https://unpkg.com/vis-network@9.1.6/standalone/umd/vis-network.min.js"
        async
      />
      {!nodeId && (
        <div className="graph-placeholder">
          <p>Search for an entity or officer, then click to visualize their network.</p>
        </div>
      )}
      {loading && (
        <div className="graph-loading">
          <p>Loading network graph...</p>
        </div>
      )}
      {error && (
        <div className="graph-error">
          <p>Error: {error}</p>
        </div>
      )}
      <div ref={containerRef} className="graph-canvas" />
    </div>
  );
}

function truncate(str, len) {
  if (!str) return "";
  return str.length > len ? str.slice(0, len - 1) + "..." : str;
}
