interface ExportOptions {
  title: string;
  subtitle?: string | null;
  columns: string[];
  rows: Record<string, unknown>[];
  filename: string;
}

export async function exportToExcel({ title, subtitle, columns, rows, filename }: ExportOptions) {
  // Dynamic import to avoid SSR issues
  const XLSX = await import('xlsx');

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();

  // Build data array with title, subtitle, and headers
  const wsData: (string | number | null)[][] = [];

  // Add title row
  wsData.push([title]);

  // Add subtitle row if present
  if (subtitle) {
    wsData.push([subtitle]);
  }

  // Add empty row for spacing
  wsData.push([]);

  // Add header row
  const headerRow = columns.map(col => formatColumnHeader(col));
  wsData.push(headerRow);

  // Add data rows
  rows.forEach(row => {
    const rowData = columns.map(col => {
      const value = row[col];
      if (value === null || value === undefined) return null;
      if (typeof value === 'number') return value;
      return String(value);
    });
    wsData.push(rowData);
  });

  // Create worksheet from data
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Calculate column widths based on content
  const colWidths = columns.map((col) => {
    const headerWidth = formatColumnHeader(col).length;
    const maxDataWidth = rows.reduce((max, row) => {
      const value = row[col];
      const strLen = value !== null && value !== undefined
        ? formatCellValue(value, col).length
        : 0;
      return Math.max(max, strLen);
    }, 0);
    return { wch: Math.min(Math.max(headerWidth, maxDataWidth, 8) + 2, 40) };
  });

  ws['!cols'] = colWidths;

  // Merge title cell across all columns
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(columns.length - 1, 0) } }, // Title
  ];

  if (subtitle) {
    ws['!merges'].push(
      { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(columns.length - 1, 0) } } // Subtitle
    );
  }

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Report');

  // Generate and download file
  XLSX.writeFile(wb, filename);
}

function formatColumnHeader(col: string): string {
  return col.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatCellValue(value: unknown, column: string): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    const lower = column.toLowerCase();
    if (['amount', 'total', 'revenue', 'balance', 'price', 'outstanding', 'current'].some(t => lower.includes(t))) {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
    }
    return value.toLocaleString();
  }
  return String(value);
}
