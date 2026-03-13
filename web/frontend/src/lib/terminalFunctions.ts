export interface TerminalFunctionArg {
  name: string;
  required: boolean;
  description: string;
  example: string;
}

export interface TerminalFunctionSpec {
  code: 'CHAT' | 'OV' | 'EXE' | 'BS' | 'GTM' | 'LEADS' | 'FIN' | 'UE' | 'PROD' | 'OPS' | 'CUS' | 'META';
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
    code: 'CHAT',
    aliases: ['ASK'],
    title: 'Terminal Chat',
    route: '/terminal/chat',
    usage: 'CHAT',
    summary: 'Open the terminal-native assistant workspace.',
    primaryModel: 'Assistant over warehouse tools',
    objective: 'Ask questions and inspect query results without leaving terminal mode.',
    output: 'Conversation workspace with results and query history.',
    args: [],
  },
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
    code: 'EXE',
    aliases: ['SC', 'SCORECARD', 'EXEC'],
    title: 'Executive Scorecard',
    route: '/terminal/executive',
    usage: 'EXE',
    summary: 'Canonical executive KPI command surface.',
    primaryModel: 'term.scorecard_daily + term.exec_daily',
    objective: 'Run leadership operating review from one trusted metric contract.',
    output: 'Executive KPI set, trend context, and customer drill entry points.',
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
    aliases: ['GROW', 'GROWTH'],
    title: 'GTM',
    route: '/terminal/growth',
    usage: 'GTM',
    summary: 'GTM operations and acquisition efficiency.',
    primaryModel: 'gtm.growth_task_queue + gtm.agg_unit_economics_monthly',
    objective: 'Run the weekly GTM operating review from one surface.',
    output: 'Execution queue, funnel performance, channel efficiency, and unit economics.',
    args: [],
  },
  {
    code: 'LEADS',
    aliases: ['REV', 'REVIEW', 'QUEUE', 'INBOX'],
    title: 'Leads',
    route: '/terminal/leads',
    usage: 'LEADS',
    summary: 'Human-in-the-loop leads workbench.',
    primaryModel: 'gtm.growth_task_queue + gtm.action_log',
    objective: 'Review queued GTM work with context, draft, and approval actions in one surface.',
    output: 'Owner queue, selected account context, draft, and review actions.',
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
    code: 'UE',
    aliases: ['UNIT', 'ECON', 'MARGIN'],
    title: 'Unit Economics',
    route: '/terminal/unit-economics',
    usage: 'UE [organization_id]',
    summary: 'Blended cost, utilization, and margin rollup.',
    primaryModel: 'term.unit_economics_monthly + fin.agg_customer_unit_economics_monthly',
    objective: 'Track customer and firm unit economics with one terminal command.',
    output: 'Monthly blended expected cost/hour, utilization, and gross margin trends.',
    args: [
      {
        name: 'organization_id',
        required: false,
        description: 'Optional customer drill target.',
        example: 'UE org_1234',
      },
    ],
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
];

const HIDDEN_TERMINAL_FUNCTION_CODES = new Set<TerminalFunctionSpec['code']>(['CHAT', 'EXE', 'BS', 'PROD', 'OPS', 'CUS']);

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

  if (token === 'THIS' || token === 'THIS MONTH' || token === 'TM' || token === 'CURRENT' || token === 'CURRENT MONTH') {
    return toMonthParam(now);
  }
  if (token === 'LM' || token === 'LAST' || token === 'PREV' || token === 'PREVIOUS') {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return toMonthParam(d);
  }
  if (token === 'LAST MONTH' || token === 'PREVIOUS MONTH') {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return toMonthParam(d);
  }
  if (token === 'LAST QUARTER') {
    const d = new Date(now.getFullYear(), now.getMonth() - 2, 1);
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
    const upperArg = rest.join(' ').trim().toUpperCase();
    if (upperArg === 'FIN' || upperArg === 'FINANCE') return '/terminal/finance';
    if (upperArg === 'GTM' || upperArg === 'GROWTH') return '/terminal/growth';
    if (upperArg === 'UE' || upperArg === 'UNIT' || upperArg === 'UNIT ECON' || upperArg === 'UNIT ECONOMICS') {
      return '/terminal/unit-economics';
    }
    if (upperArg === 'LEADS' || upperArg === 'REV' || upperArg === 'REVIEW') return '/terminal/leads';
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
  if (fn.code === 'UE') {
    const org = rest.join(' ').trim();
    return org ? `${fn.route}?customer=${encodeURIComponent(org)}` : fn.route;
  }
  if (fn.code !== 'CUS') return fn.route;
  const org = rest.join(' ').trim();
  return org ? `/customers/${encodeURIComponent(org)}` : '/customers';
}
