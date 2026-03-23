import neo4j from "neo4j-driver";

const URI = process.env.NEO4J_URI;
const USERNAME = process.env.NEO4J_USERNAME;
const PASSWORD = process.env.NEO4J_PASSWORD;
const DATABASE = process.env.NEO4J_DATABASE;

let driver;

function getDriver() {
  if (!driver) {
    driver = neo4j.driver(URI, neo4j.auth.basic(USERNAME, PASSWORD));
  }
  return driver;
}

export async function runQuery(cypher, params = {}) {
  const d = getDriver();
  const session = d.session({ database: DATABASE });
  try {
    const result = await session.run(cypher, params);
    return result.records.map((record) => {
      const obj = {};
      record.keys.forEach((key) => {
        const val = record.get(key);
        // Convert Neo4j integers to JS numbers
        obj[key] = neo4j.isInt(val) ? val.toNumber() : val;
      });
      return obj;
    });
  } finally {
    await session.close();
  }
}

export function getNeo4jConfig() {
  return { URI, USERNAME, PASSWORD, DATABASE };
}
