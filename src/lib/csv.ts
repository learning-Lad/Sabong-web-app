// Quote all cells and neutralize spreadsheet formulas in user-entered content.
export function csv(rows: string[][]) {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const safe = /^[\s]*[=+@\-\t\r]/.test(value) ? "'" + value : value;
          return '"' + safe.replace(/"/g, '""') + '"';
        })
        .join(","),
    )
    .join("\r\n");
}
