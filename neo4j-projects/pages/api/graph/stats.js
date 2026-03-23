import { runQuery } from "../../../lib/neo4j";

export default async function handler(req, res) {
  try {
    const nodeCounts = await runQuery(`
      CALL {
        MATCH (e:Entity) RETURN 'Entity' AS label, count(e) AS count
        UNION ALL
        MATCH (o:Officer) RETURN 'Officer' AS label, count(o) AS count
        UNION ALL
        MATCH (i:Intermediary) RETURN 'Intermediary' AS label, count(i) AS count
        UNION ALL
        MATCH (a:Address) RETURN 'Address' AS label, count(a) AS count
      }
      RETURN label, count
    `);

    const relCounts = await runQuery(`
      MATCH ()-[r]->()
      RETURN type(r) AS type, count(r) AS count
      ORDER BY count DESC
    `);

    const nodes = {};
    nodeCounts.forEach((r) => (nodes[r.label] = r.count));

    res.status(200).json({
      nodes,
      relationships: relCounts,
      totalNodes: Object.values(nodes).reduce((a, b) => a + b, 0),
      totalRelationships: relCounts.reduce((a, b) => a + b.count, 0),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
