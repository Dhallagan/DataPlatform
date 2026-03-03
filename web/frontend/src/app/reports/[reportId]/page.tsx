'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { REPORTS, executeReport, validateParams, ReportResult } from '@/lib/reports';
import EmbeddedSpreadsheet from '@/components/EmbeddedSpreadsheet';
import ReportDashboardCard from '@/components/ReportDashboardCard';
import Toolbar from '@/components/Toolbar';
import { exportToExcel } from '@/lib/excelExport';

export default function ReportPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const reportId = params.reportId as string;
  const report = REPORTS[reportId];
  const hasParameters = report ? report.parameters.length > 0 : false;
  const isMartMetricCompare = reportId === 'mart_metric_reconciliation';

  const [martSql, setMartSql] = useState(
    "SELECT * FROM information_schema.tables WHERE table_schema IN ('growth', 'product', 'finance', 'eng', 'ops') ORDER BY table_schema, table_name LIMIT 200"
  );
  const [metricSql, setMetricSql] = useState(
    "SELECT * FROM information_schema.tables WHERE table_schema = 'core' ORDER BY table_name LIMIT 100"
  );
  const [martResult, setMartResult] = useState<ReportResult | null>(null);
  const [tieResult, setTieResult] = useState<ReportResult | null>(null);
  const [martKeyColumn, setMartKeyColumn] = useState('');
  const [metricKeyColumn, setMetricKeyColumn] = useState('');
  const [martAmountColumn, setMartAmountColumn] = useState('');
  const [metricAmountColumn, setMetricAmountColumn] = useState('');
  const [martAvailableColumns, setMartAvailableColumns] = useState<string[]>([]);
  const [metricAvailableColumns, setMetricAvailableColumns] = useState<string[]>([]);
  const [martLoading, setMartLoading] = useState(false);
  const [tieLoading, setTieLoading] = useState(false);
  const [martError, setMartError] = useState<string | null>(null);
  const [tieError, setTieError] = useState<string | null>(null);
  const hasAutoRunCompare = useRef(false);

  const [formValues, setFormValues] = useState<Record<string, string | number>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const hasAutoRun = useRef(false);

  useEffect(() => {
    hasAutoRun.current = false;
  }, [reportId]);

  // Initialize form with URL params or defaults
  useEffect(() => {
    if (report) {
      const values: Record<string, string | number> = {};
      let hasUrlParams = false;
      let hasRequiredParams = true;

      for (const param of report.parameters) {
        // Check URL params first
        const urlValue = searchParams.get(param.name);
        if (urlValue !== null && urlValue !== '') {
          values[param.name] = param.type === 'number' ? Number(urlValue) : urlValue;
          hasUrlParams = true;
        } else if (param.default !== undefined) {
          values[param.name] = param.default;
        } else if (param.type === 'date' && param.name.includes('end')) {
          values[param.name] = new Date().toISOString().split('T')[0];
        } else if (param.type === 'date' && param.name.includes('start')) {
          const threeMonthsAgo = new Date();
          threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
          values[param.name] = threeMonthsAgo.toISOString().split('T')[0];
        }

        const candidate = values[param.name];
        if (param.required && (candidate === '' || candidate === null || candidate === undefined)) {
          hasRequiredParams = false;
        }
      }

      setFormValues(values);

      // Auto-run if we have URL params or no parameters are required.
      if ((hasUrlParams || hasRequiredParams || report.parameters.length === 0) && !hasAutoRun.current) {
        hasAutoRun.current = true;
        // Run after state is set
        setTimeout(() => {
          runReport(values);
        }, 0);
      }
    }
  }, [report, searchParams]);

  const runReport = async (values: Record<string, string | number>) => {
    const validation = validateParams(reportId, values);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }
    setIsLoading(true);
    setResult(null);
    setErrors({});
    try {
      const data = await executeReport(reportId, values);
      setResult(data);
    } catch (err) {
      setErrors({ _: err instanceof Error ? err.message : 'Failed to execute report' });
    } finally {
      setIsLoading(false);
    }
  };

  const runSideQuery = async (
    sql: string,
    setLoading: (loading: boolean) => void,
    setError: (error: string | null) => void,
    setData: (result: ReportResult | null) => void
  ) => {
    setLoading(true);
    setError(null);
    try {
      const data = await executeReport('execute_query', { sql });
      if (!data.success) {
        setError(data.error || 'Failed to execute query');
        setData(null);
      } else {
        setData(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute query');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const normalizeSql = (sql: string) => sql.trim().replace(/;+\s*$/, '');

  const getQueryColumns = async (sql: string): Promise<string[]> => {
    const normalized = normalizeSql(sql);
    const inspectSql = `WITH q AS (${normalized}) SELECT * FROM q LIMIT 1`;
    const inspectResult = await executeReport('execute_query', { sql: inspectSql });
    if (!inspectResult.success) {
      throw new Error(inspectResult.error || 'Failed to inspect query columns');
    }
    return inspectResult.columns || [];
  };

  const pickDefaultKey = (columns: string[]): string | null => {
    if (columns.length === 0) return null;
    const lowerMap = new Map(columns.map((col) => [col.toLowerCase(), col]));
    const exactId = lowerMap.get('id');
    if (exactId) return exactId;
    const idLike = columns.find((col) => col.toLowerCase().endsWith('_id'));
    if (idLike) return idLike;
    const keyLike = columns.find((col) => col.toLowerCase().includes('key'));
    if (keyLike) return keyLike;
    return columns[0];
  };

  const isSafeIdentifier = (value: string) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
  const quoteIdentifier = (value: string) => `"${value}"`;

  const runMetricTieOut = async () => {
    setTieLoading(true);
    setTieError(null);
    try {
      const normalizedMartSql = normalizeSql(martSql);
      const normalizedMetricSql = normalizeSql(metricSql);
      const [martColumns, metricColumns] = await Promise.all([
        getQueryColumns(normalizedMartSql),
        getQueryColumns(normalizedMetricSql),
      ]);
      setMartAvailableColumns(martColumns);
      setMetricAvailableColumns(metricColumns);

      const martKeyInput = martKeyColumn.trim();
      const metricKeyInput = metricKeyColumn.trim();
      const martKey = martKeyInput || pickDefaultKey(martColumns);
      const metricKey = metricKeyInput || pickDefaultKey(metricColumns);

      if (!martKey || !metricKey) {
        throw new Error('Could not detect tie keys. Enter mart and metric key columns.');
      }
      if (!martColumns.includes(martKey)) {
        throw new Error(`Mart key "${martKey}" not found in mart query columns.`);
      }
      if (!metricColumns.includes(metricKey)) {
        throw new Error(`Metric key "${metricKey}" not found in metric query columns.`);
      }
      if (!isSafeIdentifier(martKey) || !isSafeIdentifier(metricKey)) {
        throw new Error('Key columns must be valid SQL identifiers (letters, numbers, underscore).');
      }

      const martAmount = martAmountColumn.trim();
      const metricAmount = metricAmountColumn.trim();
      if ((martAmount && !isSafeIdentifier(martAmount)) || (metricAmount && !isSafeIdentifier(metricAmount))) {
        throw new Error('Amount columns must be valid SQL identifiers (letters, numbers, underscore).');
      }
      if (martAmount && !martColumns.includes(martAmount)) {
        throw new Error(`Mart amount "${martAmount}" not found in mart query columns.`);
      }
      if (metricAmount && !metricColumns.includes(metricAmount)) {
        throw new Error(`Metric amount "${metricAmount}" not found in metric query columns.`);
      }

      if (!martKeyInput) setMartKeyColumn(martKey);
      if (!metricKeyInput) setMetricKeyColumn(metricKey);

      const martKeyExpr = `m.${quoteIdentifier(martKey)}`;
      const metricKeyExpr = `g.${quoteIdentifier(metricKey)}`;
      const martAmountExpr = martAmount ? `TRY_CAST(m.${quoteIdentifier(martAmount)} AS DOUBLE)` : 'NULL';
      const metricAmountExpr = metricAmount ? `TRY_CAST(g.${quoteIdentifier(metricAmount)} AS DOUBLE)` : 'NULL';

      const sql = `
        WITH mart_query AS (
          ${normalizedMartSql}
        ),
        metric_query AS (
          ${normalizedMetricSql}
        )
        SELECT
          COALESCE(CAST(${martKeyExpr} AS VARCHAR), CAST(${metricKeyExpr} AS VARCHAR)) AS tie_key,
          ${martKeyExpr} AS mart_key_value,
          ${metricKeyExpr} AS metric_key_value,
          CASE
            WHEN ${martKeyExpr} IS NULL THEN 'metric_only'
            WHEN ${metricKeyExpr} IS NULL THEN 'mart_only'
            ELSE 'matched'
          END AS tie_status,
          ${martAmountExpr} AS mart_amount,
          ${metricAmountExpr} AS metric_amount,
          COALESCE(${martAmountExpr}, 0) - COALESCE(${metricAmountExpr}, 0) AS amount_delta
        FROM mart_query m
        FULL OUTER JOIN metric_query g
          ON CAST(${martKeyExpr} AS VARCHAR) = CAST(${metricKeyExpr} AS VARCHAR)
        ORDER BY
          CASE WHEN ${martKeyExpr} IS NULL OR ${metricKeyExpr} IS NULL THEN 0 ELSE 1 END,
          ABS(COALESCE(${martAmountExpr}, 0) - COALESCE(${metricAmountExpr}, 0)) DESC,
          tie_key
        LIMIT 1000
      `;

      const data = await executeReport('execute_query', { sql });
      if (!data.success) {
        setTieError(data.error || 'Failed to execute tie-out query');
        setTieResult(null);
      } else {
        setTieResult(data);
      }
    } catch (err) {
      setTieError(err instanceof Error ? err.message : 'Failed to execute tie-out query');
      setTieResult(null);
    } finally {
      setTieLoading(false);
    }
  };

  useEffect(() => {
    if (!isMartMetricCompare || hasAutoRunCompare.current) return;
    hasAutoRunCompare.current = true;
    runSideQuery(martSql, setMartLoading, setMartError, setMartResult);
    runMetricTieOut();
  }, [isMartMetricCompare, martSql, metricSql]);


  if (!report) {
    return (
      <div className="min-h-screen bg-surface-primary">
        <Toolbar />
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <h1 className="text-xl font-semibold text-content-primary mb-2">Report Not Found</h1>
            <Link href="/reports" className="text-accent hover:underline">Back to Reports</Link>
          </div>
        </div>
      </div>
    );
  }

  if (isMartMetricCompare) {
    const toSpreadsheetData = (queryResult: ReportResult | null) => {
      if (!queryResult?.success || !queryResult.data?.length) return null;
      return {
        columns: queryResult.columns || Object.keys(queryResult.data[0]),
        rows: queryResult.data,
        summary: { row_count: queryResult.row_count },
      };
    };

    const martSpreadsheetData = toSpreadsheetData(martResult);
    const tieSpreadsheetData = toSpreadsheetData(tieResult);

    return (
      <div className="min-h-screen flex flex-col bg-surface-secondary">
        <Toolbar />
        <header className="bg-surface-elevated border-b border-border px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <Link href="/reports" className="p-1.5 rounded hover:bg-surface-tertiary transition-colors">
              <svg className="w-4 h-4 text-content-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </Link>
            <div className="h-6 w-px bg-border" />
            <div>
              <h1 className="text-base font-bold text-content-primary">{report.name}</h1>
              <p className="text-xs text-content-secondary">Mart query (left) and equivalent metric query (right)</p>
            </div>
          </div>
          <button
            onClick={() => {
              runSideQuery(martSql, setMartLoading, setMartError, setMartResult);
              runMetricTieOut();
            }}
            className="px-3 py-1.5 text-xs bg-accent hover:bg-accent-hover text-white rounded"
          >
            Run Mart + Tie
          </button>
        </header>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-3 p-3 min-h-0">
          <section className="bg-surface-elevated border border-border rounded-lg flex flex-col min-h-0">
            <div className="p-3 border-b border-border">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-content-primary">Mart Query</h2>
                <button
                  onClick={() => runSideQuery(martSql, setMartLoading, setMartError, setMartResult)}
                  disabled={martLoading}
                  className="px-2.5 py-1 text-xs bg-surface-tertiary hover:bg-surface-primary rounded text-content-primary disabled:opacity-50"
                >
                  {martLoading ? 'Running...' : 'Run'}
                </button>
              </div>
              <textarea
                value={martSql}
                onChange={(e) => setMartSql(e.target.value)}
                rows={4}
                className="w-full px-2 py-1.5 bg-surface-primary border border-border rounded text-xs text-content-primary font-mono focus:outline-none focus:border-accent resize-y"
              />
              {martError && <p className="mt-2 text-xs text-error">{martError}</p>}
            </div>
            <div className="flex-1 min-h-0">
              {martSpreadsheetData ? (
                <EmbeddedSpreadsheet data={martSpreadsheetData} fullHeight />
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-content-tertiary">
                  {martLoading ? 'Running mart query...' : 'No mart results yet'}
                </div>
              )}
            </div>
          </section>

          <section className="bg-surface-elevated border border-border rounded-lg flex flex-col min-h-0">
            <div className="p-3 border-b border-border">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-content-primary">Metric Query Tied To Mart</h2>
                <button
                  onClick={runMetricTieOut}
                  disabled={tieLoading}
                  className="px-2.5 py-1 text-xs bg-surface-tertiary hover:bg-surface-primary rounded text-content-primary disabled:opacity-50"
                >
                  {tieLoading ? 'Running...' : 'Tie To Mart'}
                </button>
              </div>
              <textarea
                value={metricSql}
                onChange={(e) => setMetricSql(e.target.value)}
                rows={4}
                className="w-full px-2 py-1.5 bg-surface-primary border border-border rounded text-xs text-content-primary font-mono focus:outline-none focus:border-accent resize-y"
              />
              <div className="grid grid-cols-2 gap-2 mt-2">
                <input
                  value={martKeyColumn}
                  onChange={(e) => setMartKeyColumn(e.target.value)}
                  placeholder="Mart key column"
                  className="w-full px-2 py-1 bg-surface-primary border border-border rounded text-xs text-content-primary font-mono focus:outline-none focus:border-accent"
                />
                <input
                  value={metricKeyColumn}
                  onChange={(e) => setMetricKeyColumn(e.target.value)}
                  placeholder="Metric key column"
                  className="w-full px-2 py-1 bg-surface-primary border border-border rounded text-xs text-content-primary font-mono focus:outline-none focus:border-accent"
                />
                <input
                  value={martAmountColumn}
                  onChange={(e) => setMartAmountColumn(e.target.value)}
                  placeholder="Mart amount column (optional)"
                  className="w-full px-2 py-1 bg-surface-primary border border-border rounded text-xs text-content-primary font-mono focus:outline-none focus:border-accent"
                />
                <input
                  value={metricAmountColumn}
                  onChange={(e) => setMetricAmountColumn(e.target.value)}
                  placeholder="Metric amount column (optional)"
                  className="w-full px-2 py-1 bg-surface-primary border border-border rounded text-xs text-content-primary font-mono focus:outline-none focus:border-accent"
                />
              </div>
              {(martAvailableColumns.length > 0 || metricAvailableColumns.length > 0) && (
                <div className="mt-2 text-[10px] text-content-tertiary space-y-1">
                  {martAvailableColumns.length > 0 && (
                    <p>Mart columns: {martAvailableColumns.join(', ')}</p>
                  )}
                  {metricAvailableColumns.length > 0 && (
                    <p>Metric columns: {metricAvailableColumns.join(', ')}</p>
                  )}
                </div>
              )}
              {tieError && <p className="mt-2 text-xs text-error">{tieError}</p>}
            </div>
            <div className="flex-1 min-h-0">
              {tieSpreadsheetData ? (
                <EmbeddedSpreadsheet data={tieSpreadsheetData} fullHeight />
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-content-tertiary">
                  {tieLoading ? 'Running tie-out query...' : 'No tie-out results yet'}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    );
  }

  const handleChange = (name: string, value: string | number) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    runReport(formValues);
  };

  const getSpreadsheetData = () => {
    if (!result?.success || !result.data?.length) return null;
    return {
      columns: result.columns || Object.keys(result.data[0]),
      rows: result.data,
      summary: { total: result.total, total_outstanding: result.total_outstanding, row_count: result.row_count, count: result.count, buckets: result.summary },
    };
  };

  const spreadsheetData = getSpreadsheetData();
  const dashboardCardState = {
    isLoading,
    result,
    error: errors['_'] || null,
  };

  // Generate subtitle from current form values
  const generateSubtitle = (values: Record<string, string | number>) => {
    const parts: string[] = [];

    // Date range
    if (values.start_date && values.end_date) {
      const start = formatDateDisplay(values.start_date as string);
      const end = formatDateDisplay(values.end_date as string);
      parts.push(`${start} – ${end}`);
    } else if (values.as_of_date) {
      parts.push(`As of ${formatDateDisplay(values.as_of_date as string)}`);
    } else if (values.work_date) {
      parts.push(formatDateDisplay(values.work_date as string));
    }

    // Filters
    if (values.client_id) parts.push(`Client #${values.client_id}`);
    if (values.attorney_id) parts.push(`Attorney #${values.attorney_id}`);
    if (values.matter_id) parts.push(`Matter #${values.matter_id}`);
    if (values.practice_area) parts.push(`${values.practice_area}`);
    if (values.status) parts.push(`Status: ${values.status}`);

    return parts.length > 0 ? parts.join(' · ') : null;
  };

  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const exportExcel = async () => {
    if (!spreadsheetData) return;
    const subtitle = generateSubtitle(formValues);

    await exportToExcel({
      title: report.name,
      subtitle,
      columns: spreadsheetData.columns,
      rows: spreadsheetData.rows,
      filename: `${reportId}_${new Date().toISOString().split('T')[0]}.xlsx`,
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface-secondary">
      <Toolbar />
      {/* Header with Title & Subtitle */}
      <header className="bg-surface-elevated border-b border-border px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/reports" className="p-1.5 rounded hover:bg-surface-tertiary transition-colors">
            <svg className="w-4 h-4 text-content-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <div className="h-6 w-px bg-border" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-content-primary">{report.name}</h1>
              {result?.success && spreadsheetData && (
                <span className="text-xs text-content-tertiary bg-surface-tertiary px-2 py-0.5 rounded">
                  {spreadsheetData.rows.length} rows
                </span>
              )}
            </div>
            {generateSubtitle(formValues) && (
              <p className="text-xs text-content-secondary">{generateSubtitle(formValues)}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {result?.success && spreadsheetData && (
            <button onClick={exportExcel} className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-content-secondary hover:text-content-primary hover:bg-surface-tertiary rounded transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export
            </button>
          )}
          {hasParameters && (
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${sidebarOpen ? 'bg-accent text-white' : 'text-content-secondary hover:bg-surface-tertiary'}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
              </svg>
              Parameters
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Collapsible Sidebar */}
        <div className={`bg-surface-elevated border-r border-border flex-shrink-0 transition-all duration-200 overflow-hidden ${hasParameters && sidebarOpen ? 'w-64' : 'w-0'}`}>
          <form onSubmit={handleSubmit} className="p-3 space-y-3 w-64">
            {report.parameters.map((param) => (
              <div key={param.name}>
                <label className="block text-xs font-medium text-content-secondary mb-1">
                  {param.label}{param.required && <span className="text-error">*</span>}
                </label>
                {param.type === 'select' ? (
                  <select
                    value={formValues[param.name] ?? ''}
                    onChange={(e) => handleChange(param.name, e.target.value)}
                    className={`w-full px-2 py-1.5 bg-surface-primary border rounded text-xs text-content-primary focus:outline-none focus:border-accent ${errors[param.name] ? 'border-error' : 'border-border'}`}
                  >
                    {param.options?.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                ) : param.type === 'date' ? (
                  <input
                    type="date"
                    value={formValues[param.name] ?? ''}
                    onChange={(e) => handleChange(param.name, e.target.value)}
                    className={`w-full px-2 py-1.5 bg-surface-primary border rounded text-xs text-content-primary focus:outline-none focus:border-accent ${errors[param.name] ? 'border-error' : 'border-border'}`}
                  />
                ) : param.name === 'sql' ? (
                  <textarea
                    value={formValues[param.name] ?? ''}
                    onChange={(e) => handleChange(param.name, e.target.value)}
                    placeholder={param.placeholder}
                    rows={12}
                    className={`w-full px-2 py-1.5 bg-surface-primary border rounded text-xs text-content-primary font-mono focus:outline-none focus:border-accent resize-y min-h-[260px] ${errors[param.name] ? 'border-error' : 'border-border'}`}
                  />
                ) : (
                  <input
                    type={param.type === 'number' ? 'number' : 'text'}
                    value={formValues[param.name] ?? ''}
                    onChange={(e) => handleChange(param.name, e.target.value)}
                    placeholder={param.placeholder}
                    className={`w-full px-2 py-1.5 bg-surface-primary border rounded text-xs text-content-primary focus:outline-none focus:border-accent ${errors[param.name] ? 'border-error' : 'border-border'}`}
                  />
                )}
                {errors[param.name] && <p className="mt-0.5 text-[10px] text-error">{errors[param.name]}</p>}
              </div>
            ))}
            {errors['_'] && <p className="text-xs text-error bg-error/10 p-2 rounded">{errors['_']}</p>}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-3 py-2 bg-accent hover:bg-accent-hover text-white rounded text-xs font-medium disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {isLoading ? (
                <><svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Running...</>
              ) : (
                <><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>Run</>
              )}
            </button>
          </form>
        </div>

        {/* Results Area - Full Width */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {!result && !isLoading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <svg className="w-12 h-12 text-content-tertiary mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125" />
                </svg>
                <p className="text-sm text-content-tertiary">Configure parameters and run the report</p>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex items-center gap-2 text-content-tertiary">
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                <span className="text-sm">Executing query...</span>
              </div>
            </div>
          )}

          {result && !result.success && (
            <div className="p-4">
              <div className="bg-error/10 border border-error/20 rounded-lg p-4">
                <p className="text-sm text-error font-medium">Error</p>
                <p className="text-sm text-content-secondary mt-1">{result.error}</p>
              </div>
            </div>
          )}

          {result?.success && spreadsheetData && (
            <div className="flex-1 overflow-auto p-4 space-y-4">
              <ReportDashboardCard
                report={report}
                state={dashboardCardState}
                onRefresh={() => runReport(formValues)}
                showOpenLink={false}
              />
              <div className="h-[60vh] min-h-[420px] border border-border rounded-lg overflow-hidden">
                <EmbeddedSpreadsheet
                  data={spreadsheetData}
                  title={report.name}
                  subtitle={generateSubtitle(formValues) || undefined}
                  onDownload={exportExcel}
                  downloadLabel="Download Excel"
                  fullHeight
                />
              </div>
            </div>
          )}

          {result?.success && result.schema && (
            <div className="flex-1 overflow-auto p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(result.schema).map(([table, columns]) => (
                  <div key={table} className="bg-surface-elevated rounded-lg border border-border p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-semibold text-content-primary">{table}</span>
                      <span className="text-[10px] text-content-tertiary">({columns.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {columns.map((col) => (
                        <span key={col.name} className="text-[10px] bg-surface-tertiary px-1.5 py-0.5 rounded font-mono">
                          {col.name} <span className="text-content-tertiary">{col.type}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result?.success && !spreadsheetData && !result.schema && (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-content-tertiary">No results returned</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
