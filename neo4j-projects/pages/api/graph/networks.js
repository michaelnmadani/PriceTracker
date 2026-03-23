import { runQuery } from "../../../lib/neo4j";

export default async function handler(req, res) {
  const { nodeId, type = "officer" } = req.query;
  const depth = Math.min(parseInt(req.query.depth) || 2, 3);

  try {
    let query;
    if (nodeId) {
      // Get network around a specific node
      query = `
        MATCH path = (start {node_id: $nodeId})-[*1..${depth}]-(connected)
        WITH nodes(path) AS pathNodes, relationships(path) AS pathRels
        UNWIND pathNodes AS n
        WITH collect(DISTINCT {
          id: n.node_id,
          label: coalesce(n.name, n.address, 'Unknown'),
          type: labels(n)[0],
          country: n.country
        }) AS nodes, pathRels
        UNWIND pathRels AS r
        WITH nodes, collect(DISTINCT {
          source: startNode(r).node_id,
          target: endNode(r).node_id,
          type: type(r)
        }) AS relationships
        RETURN nodes, relationships
      `;
      const results = await runQuery(query, { nodeId });
      res.status(200).json(results[0] || { nodes: [], relationships: [] });
    } else {
      // Get top connected officers with their entities
      query = `
        MATCH (o:Officer)-[r:OFFICER_OF]->(e:Entity)
        WITH o, collect(e) AS entities, count(e) AS cnt
        ORDER BY cnt DESC
        LIMIT 5
        UNWIND entities AS e
        OPTIONAL MATCH (e)-[:REGISTERED_ADDRESS]->(a:Address)
        WITH o, e, a
        RETURN collect(DISTINCT {
          id: o.node_id, label: o.name, type: 'Officer', country: o.country
        }) + collect(DISTINCT {
          id: e.node_id, label: e.name, type: 'Entity', country: e.jurisdiction
        }) + collect(DISTINCT {
          id: a.node_id, label: a.address, type: 'Address', country: a.country
        }) AS nodes
      `;
      const results = await runQuery(query);
      res.status(200).json({ nodes: results[0]?.nodes || [], relationships: [] });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
