'use client';

export default function SystemArchitectureDiagram() {
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-border bg-surface-primary p-4">
      <svg
        viewBox="0 0 960 320"
        role="img"
        aria-label="System architecture from source systems to analytics and action surfaces"
        className="min-w-[900px] w-full h-auto"
      >
        <defs>
          <marker id="arrow" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#9CA3AF" />
          </marker>
        </defs>

        <text x="34" y="36" fontSize="14" fill="#111827" fontWeight="600">
          BrowserBase Analytics System
        </text>

        <rect x="30" y="70" width="190" height="180" rx="12" fill="#ffffff" stroke="#E5E7EB" />
        <text x="50" y="98" fontSize="13" fill="#111827" fontWeight="600">
          Source Systems
        </text>
        <text x="50" y="122" fontSize="12" fill="#4B5563">
          • Supabase Postgres
        </text>
        <text x="50" y="143" fontSize="12" fill="#4B5563">
          • Stripe/Billing events
        </text>
        <text x="50" y="164" fontSize="12" fill="#4B5563">
          • Product session logs
        </text>
        <text x="50" y="185" fontSize="12" fill="#4B5563">
          • CRM & GTM activity
        </text>

        <rect x="280" y="70" width="190" height="180" rx="12" fill="#ffffff" stroke="#E5E7EB" />
        <text x="300" y="98" fontSize="13" fill="#111827" fontWeight="600">
          Replication Layer
        </text>
        <text x="300" y="122" fontSize="12" fill="#4B5563">
          • Source-aligned ingestion
        </text>
        <text x="300" y="143" fontSize="12" fill="#4B5563">
          • Incremental sync jobs
        </text>
        <text x="300" y="164" fontSize="12" fill="#4B5563">
          • Schema drift checks
        </text>
        <text x="300" y="185" fontSize="12" fill="#4B5563">
          • Freshness telemetry
        </text>

        <rect x="530" y="40" width="190" height="240" rx="12" fill="#ffffff" stroke="#E5E7EB" />
        <text x="550" y="68" fontSize="13" fill="#111827" fontWeight="600">
          MotherDuck + dbt
        </text>
        <text x="550" y="92" fontSize="12" fill="#4B5563">
          • bronze_supabase (raw)
        </text>
        <text x="550" y="113" fontSize="12" fill="#4B5563">
          • silver (staging + facts)
        </text>
        <text x="550" y="134" fontSize="12" fill="#4B5563">
          • growth/product/finance
        </text>
        <text x="550" y="155" fontSize="12" fill="#4B5563">
          • core metric contracts
        </text>
        <text x="550" y="176" fontSize="12" fill="#4B5563">
          • dbt tests + lineage
        </text>
        <text x="550" y="197" fontSize="12" fill="#4B5563">
          • governed marts
        </text>

        <rect x="780" y="70" width="150" height="80" rx="12" fill="#ffffff" stroke="#E5E7EB" />
        <text x="798" y="98" fontSize="13" fill="#111827" fontWeight="600">
          BasedHoc App
        </text>
        <text x="798" y="122" fontSize="12" fill="#4B5563">
          Dashboards + Reports
        </text>

        <rect x="780" y="170" width="150" height="80" rx="12" fill="#ffffff" stroke="#E5E7EB" />
        <text x="798" y="198" fontSize="13" fill="#111827" fontWeight="600">
          Ops Monitoring
        </text>
        <text x="798" y="222" fontSize="12" fill="#4B5563">
          Freshness + Drift
        </text>

        <line x1="220" y1="160" x2="280" y2="160" stroke="#9CA3AF" strokeWidth="2.2" markerEnd="url(#arrow)" />
        <line x1="470" y1="160" x2="530" y2="160" stroke="#9CA3AF" strokeWidth="2.2" markerEnd="url(#arrow)" />
        <line x1="720" y1="110" x2="780" y2="110" stroke="#9CA3AF" strokeWidth="2.2" markerEnd="url(#arrow)" />
        <line x1="720" y1="210" x2="780" y2="210" stroke="#9CA3AF" strokeWidth="2.2" markerEnd="url(#arrow)" />

        <text x="232" y="151" fontSize="10" fill="#6B7280">
          ingest
        </text>
        <text x="481" y="151" fontSize="10" fill="#6B7280">
          transform
        </text>
        <text x="734" y="101" fontSize="10" fill="#6B7280">
          consume
        </text>
        <text x="734" y="201" fontSize="10" fill="#6B7280">
          observe
        </text>
      </svg>
    </div>
  );
}
