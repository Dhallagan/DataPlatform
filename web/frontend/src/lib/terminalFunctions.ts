export interface TerminalFunctionArg {
  name: string;
  required: boolean;
  description: string;
  example: string;
}

export interface TerminalFunctionSpec {
  code: 'OV' | 'SC' | 'BS' | 'GTM' | 'FIN' | 'PROD' | 'OPS' | 'CUS' | 'META' | 'ABOUT';
  aliases: string[];
  title: string;
  route: string;
  usage: string;
  summary: string;
  primaryModel: string;
  objective: string;
  output: string;
  args: TerminalFunctionArg[];
}

export const TERMINAL_FUNCTIONS: TerminalFunctionSpec[] = [
  {
    code: 'OV',
    aliases: ['OVERVIEW'],
    title: 'Overview',
    route: '/terminal',
    usage: 'OV [--month YYYY-MM]',
    summary: 'Cross-functional monthly business board.',
    primaryModel: 'term.business_snapshot_monthly',
    objective: 'Track monthly company trajectory across GTM, finance, product, and ops in one board.',
    output: 'Monthly matrix, trend lines, and organization leaderboard.',
    args: [
      { name: '--month', required: false, description: 'Force a specific month snapshot.', example: 'OV --month 2026-02' },
    ],
  },
  {
    code: 'SC',
    aliases: ['SCORECARD', 'EXEC', 'EXE'],
    title: 'Scorecard',
    route: '/terminal/executive',
    usage: 'SC',
    summary: 'Executive 15-metric scorecard.',
    primaryModel: 'term.scorecard_daily',
    objective: 'Give leadership one canonical KPI surface with consistent definitions.',
    output: 'Time-series table of metric, value, and date.',
    args: [],
  },
  {
    code: 'BS',
    aliases: ['SNAPSHOT'],
    title: 'Business Snapshot',
    route: '/terminal',
    usage: 'BS [--month YYYY-MM]',
    summary: 'Shortcut to monthly snapshot mode.',
    primaryModel: 'term.business_snapshot_monthly',
    objective: 'Jump directly to monthly close-level business state.',
    output: 'Month-scoped KPI and org drilldown.',
    args: [
      { name: '--month', required: false, description: 'Month to inspect (YYYY-MM).', example: 'BS --month 2026-02' },
    ],
  },
  {
    code: 'GTM',
    aliases: [],
    title: 'Go To Market',
    route: '/terminal/gtm',
    usage: 'GTM',
    summary: 'Pipeline and campaign efficiency terminal.',
    primaryModel: 'term.gtm_daily',
    objective: 'Run weekly demand and conversion operating review.',
    output: 'Pipeline KPIs, campaign board, and top customer monetization.',
    args: [],
  },
  {
    code: 'FIN',
    aliases: ['FINANCE'],
    title: 'Finance',
    route: '/terminal/finance',
    usage: 'FIN',
    summary: 'Budget, spend, and collection control.',
    primaryModel: 'term.finance_monthly',
    objective: 'Keep spend in policy and protect margin.',
    output: 'Budget vs actual, source/vendor concentration, org finance drilldown.',
    args: [],
  },
  {
    code: 'PROD',
    aliases: ['PRODUCT'],
    title: 'Product',
    route: '/terminal/product',
    usage: 'PROD',
    summary: 'Product engagement and adoption surface.',
    primaryModel: 'term.product_daily',
    objective: 'Monitor adoption and UX reliability changes quickly.',
    output: 'Product KPI deck with usage and reliability views.',
    args: [],
  },
  {
    code: 'OPS',
    aliases: [],
    title: 'Ops',
    route: '/terminal/ops',
    usage: 'OPS',
    summary: 'Reliability and throughput command surface.',
    primaryModel: 'term.exec_daily',
    objective: 'Detect and triage operational degradation early.',
    output: 'Control checks, throughput history, and impacted organizations.',
    args: [],
  },
  {
    code: 'META',
    aliases: ['DICT', 'DICTIONARY', 'SCHEMA', 'CATALOG', 'EXP'],
    title: 'Metadata Hub',
    route: '/terminal/meta',
    usage: 'META [DICT|SCHEMA]',
    summary: 'Holding function for metrics-layer documentation and discovery.',
    primaryModel: 'core.metric_catalog + core.table_catalog',
    objective: 'Show the metrics platform contract and schema map in one place.',
    output: 'Terminal-native metadata hub with quick links and profile stats.',
    args: [
      { name: 'panel', required: false, description: 'Optional target panel.', example: 'META SCHEMA' },
    ],
  },
  {
    code: 'CUS',
    aliases: ['CUSTOMER', 'CUST', 'CUSS'],
    title: 'Customer',
    route: '/customers',
    usage: 'CUS <organization_id>',
    summary: 'Open a customer drill profile.',
    primaryModel: 'term.customer_daily',
    objective: 'Jump from KPI anomaly to org-level context fast.',
    output: 'Customer profile view and detailed drill panel.',
    args: [
      { name: 'organization_id', required: true, description: 'Target organization id or a name fragment.', example: 'CUS org_1234' },
    ],
  },
  {
    code: 'ABOUT',
    aliases: ['ABT', 'ARCH'],
    title: 'Architecture Decisions',
    route: '/about',
    usage: 'ABOUT',
    summary: 'Read architecture decisions and implementation rationale.',
    primaryModel: 'Architecture record',
    objective: 'Provide one narrative source of truth for why this system is structured this way.',
    output: 'Decision essay, tradeoffs, and operating best practices.',
    args: [],
  },
];

const HIDDEN_TERMINAL_FUNCTION_CODES = new Set<TerminalFunctionSpec['code']>(['PROD', 'BS']);

export const VISIBLE_TERMINAL_FUNCTIONS: TerminalFunctionSpec[] = TERMINAL_FUNCTIONS.filter(
  (fn) => !HIDDEN_TERMINAL_FUNCTION_CODES.has(fn.code),
);

export function findTerminalFunction(token: string): TerminalFunctionSpec | null {
  const normalized = token.trim().split('.')[0].toUpperCase();
  if (!normalized) return null;
  return (
    TERMINAL_FUNCTIONS.find((fn) => fn.code === normalized || fn.aliases.includes(normalized)) || null
  );
}

function toMonthParam(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function parseMonthShortcut(raw: string): string | null {
  const token = raw.trim().toUpperCase();
  if (!token) return null;
  const now = new Date();

  if (/^\d{4}-\d{2}$/.test(token)) return token;
  if (/^\d{4}-\d{2}-\d{2}$/.test(token)) return token.slice(0, 7);

  if (token === 'THIS' || token === 'TM' || token === 'CURRENT') return toMonthParam(now);
  if (token === 'LM' || token === 'LAST' || token === 'PREV' || token === 'PREVIOUS') {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return toMonthParam(d);
  }

  const offset = token.match(/^M-(\d{1,2})$/);
  if (offset) {
    const n = Number(offset[1]);
    const d = new Date(now.getFullYear(), now.getMonth() - n, 1);
    return toMonthParam(d);
  }

  return null;
}

export function resolveTerminalCommandHref(raw: string): string | null {
  const input = raw.trim();
  if (!input) return null;
  const commandMatch = input.match(/^([^\s.]+)(?:[.\s]+(.+))?$/);
  if (!commandMatch) return null;
  const token = commandMatch[1];
  const argRaw = (commandMatch[2] || '').trim();
  const rest = argRaw ? argRaw.split(/\s+/) : [];
  const fn = findTerminalFunction(token);
  if (!fn) return null;
  if (fn.code === 'OV' || fn.code === 'BS') {
    const monthParam = parseMonthShortcut(rest.join(' '));
    return monthParam ? `${fn.route}?month=${encodeURIComponent(monthParam)}` : fn.route;
  }
  if (fn.code === 'META') {
    const panelToken = rest.join(' ').trim().toUpperCase();
    if (!panelToken) return fn.route;
    if (panelToken.startsWith('DICT')) return '/terminal/meta?panel=dictionary';
    if (panelToken.startsWith('SCHEMA')) return '/terminal/meta?panel=schema';
    return fn.route;
  }
  if (fn.code !== 'CUS') return fn.route;
  const org = rest.join(' ').trim();
  return org ? `/customers/${encodeURIComponent(org)}` : '/customers';
}
