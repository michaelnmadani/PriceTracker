import { useState, useCallback } from "react";
import Layout from "../components/Layout";
import StatsCards from "../components/StatsCards";
import FraudPatternSelector from "../components/FraudPatternSelector";
import SearchBar from "../components/SearchBar";
import GraphVisualization from "../components/GraphVisualization";
import DataTable from "../components/DataTable";

export default function Home() {
  const [selectedPattern, setSelectedPattern] = useState(null);
  const [patternData, setPatternData] = useState(null);
  const [patternLoading, setPatternLoading] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  const handlePatternSelect = useCallback(async (pattern) => {
    setSelectedPattern(pattern.id);
    setPatternLoading(true);
    try {
      const res = await fetch(pattern.endpoint);
      const data = await res.json();
      setPatternData(data);
    } catch {
      setPatternData({ error: "Failed to load data" });
    }
    setPatternLoading(false);
  }, []);

  const handleSearchSelect = useCallback((result) => {
    setSelectedNodeId(result.id);
  }, []);

  const handleRowClick = useCallback((nodeId) => {
    setSelectedNodeId(nodeId);
  }, []);

  return (
    <Layout>
      <section className="search-section">
        <SearchBar onSelect={handleSearchSelect} />
      </section>

      <section className="stats-section">
        <StatsCards />
      </section>

      <section className="patterns-section">
        <FraudPatternSelector
          selected={selectedPattern}
          onSelect={handlePatternSelect}
        />
      </section>

      <div className="content-grid">
        <section className="graph-section">
          <h3>Network Graph</h3>
          <GraphVisualization nodeId={selectedNodeId} />
        </section>

        <section className="table-section">
          {patternLoading ? (
            <div className="loading-indicator">Loading fraud patterns...</div>
          ) : (
            <DataTable data={patternData} pattern={selectedPattern} />
          )}
        </section>
      </div>
    </Layout>
  );
}
