export default function DataTable({ data, pattern }) {
  if (!data || !data.results || data.results.length === 0) {
    return (
      <div className="data-table-empty">
        <p>Select a fraud pattern above to view results.</p>
      </div>
    );
  }

  const columns = getColumnsForPattern(pattern);

  return (
    <div className="data-table-container">
      <h3>
        {data.pattern?.replace(/_/g, " ").toUpperCase()} — {data.results.length}{" "}
        results
      </h3>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.results.map((row, i) => (
              <tr key={i}>
                {columns.map((col) => (
                  <td key={col.key}>
                    {col.render ? col.render(row[col.key]) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function getColumnsForPattern(pattern) {
  switch (pattern) {
    case "shell-companies":
      return [
        { key: "officer", label: "Officer" },
        { key: "country", label: "Country" },
        { key: "entityCount", label: "Entities Controlled" },
        {
          key: "sampleEntities",
          label: "Sample Entities",
          render: (v) => (v ? v.join(", ") : ""),
        },
      ];
    case "shared-addresses":
      return [
        { key: "address", label: "Address" },
        { key: "country", label: "Country" },
        { key: "entityCount", label: "Entities Registered" },
        {
          key: "sampleEntities",
          label: "Sample Entities",
          render: (v) => (v ? v.join(", ") : ""),
        },
      ];
    case "intermediary-hubs":
      return [
        { key: "intermediary", label: "Intermediary" },
        { key: "country", label: "Country" },
        { key: "entityCount", label: "Entities Created" },
        {
          key: "jurisdictions",
          label: "Jurisdictions",
          render: (v) => (v ? v.join(", ") : ""),
        },
      ];
    default:
      return [
        { key: "name", label: "Name" },
        { key: "type", label: "Type" },
        { key: "detail", label: "Detail" },
      ];
  }
}
