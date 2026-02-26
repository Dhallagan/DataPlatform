# Setting Up on Supabase

## Quick Start (5 minutes)

### Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **New Project**
3. Name it `browserbase-prototype` (or anything)
4. Choose a region close to you
5. Set a database password (save this!)
6. Click **Create new project** and wait ~2 minutes

### Step 2: Run the Schema Migration

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy the contents of `supabase/migrations/001_schema.sql`
4. Paste and click **Run**
5. You should see "Success. No rows returned" ✓

### Step 3: Seed the Data

**Option A: Python Script (recommended)**

```bash
cd /Users/dylan/Development/BrowserBase/supabase

# Install the Supabase Python client
pip install supabase

# Set your credentials (find them in Dashboard → Settings → API)
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_KEY="eyJ..."  # Use the service_role key, NOT anon

# Run the seeder
python seed_supabase.py
```

**Option B: SQL Editor (slower, manual)**

1. Generate the SQL: `python seed_data.py` (creates `seed.sql`)
2. The file is ~10MB, so you'll need to split it
3. Copy/paste sections into the SQL Editor

### Step 4: Verify

In the SQL Editor, run:

```sql
-- Check row counts
SELECT 'organizations' as table_name, COUNT(*) FROM organizations
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'browser_sessions', COUNT(*) FROM browser_sessions
UNION ALL SELECT 'session_events', COUNT(*) FROM session_events;
```

Expected output:
| table_name | count |
|------------|-------|
| organizations | 50 |
| users | ~263 |
| browser_sessions | ~9,970 |
| session_events | 10,000 |

---

## Connecting to Your Warehouse

### Get Your Connection String

1. Go to **Settings → Database**
2. Under **Connection string**, copy the URI
3. It looks like: `postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres`

### For Snowflake/Fivetran

Use the connection string above as a Postgres source. Fivetran and Airbyte both support Supabase directly.

### For dbt

Update `warehouse/profiles.yml`:

```yaml
browserbase:
  target: supabase
  outputs:
    supabase:
      type: postgres
      host: db.[YOUR-REF].supabase.co
      port: 5432
      user: postgres
      password: [YOUR-PASSWORD]
      dbname: postgres
      schema: public
      threads: 4
```

Then run:
```bash
cd warehouse
dbt run
```

---

## Sample Queries to Try

### Top Organizations by Session Count

```sql
SELECT 
    o.name,
    o.status,
    COUNT(s.id) as total_sessions,
    COUNT(CASE WHEN s.status = 'completed' THEN 1 END) as successful
FROM organizations o
LEFT JOIN browser_sessions s ON o.id = s.organization_id
GROUP BY o.id, o.name, o.status
ORDER BY total_sessions DESC
LIMIT 10;
```

### Daily Session Trends

```sql
SELECT 
    DATE(created_at) as day,
    COUNT(*) as sessions,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful,
    ROUND(100.0 * COUNT(CASE WHEN status = 'completed' THEN 1 END) / COUNT(*), 1) as success_rate
FROM browser_sessions
GROUP BY DATE(created_at)
ORDER BY day DESC
LIMIT 30;
```

### MRR by Plan

```sql
SELECT 
    p.name as plan,
    p.monthly_price,
    COUNT(DISTINCT s.organization_id) as customers,
    SUM(p.monthly_price) as mrr
FROM subscriptions s
JOIN plans p ON s.plan_id = p.id
WHERE s.status = 'active'
GROUP BY p.name, p.monthly_price
ORDER BY mrr DESC;
```

### Active Organizations (last 30 days)

```sql
SELECT 
    o.name,
    o.slug,
    p.name as plan,
    COUNT(bs.id) as sessions_30d,
    MAX(bs.created_at) as last_session
FROM organizations o
JOIN subscriptions s ON o.id = s.organization_id
JOIN plans p ON s.plan_id = p.id
LEFT JOIN browser_sessions bs ON o.id = bs.organization_id 
    AND bs.created_at > NOW() - INTERVAL '30 days'
WHERE o.status = 'active'
GROUP BY o.id, o.name, o.slug, p.name
HAVING COUNT(bs.id) > 0
ORDER BY sessions_30d DESC;
```

---

## Troubleshooting

### "permission denied" errors

Make sure you're using the `service_role` key, not the `anon` key.

### Seed script is slow

Session events are the slowest part. The script limits to 10k events. For full data, use the SQL file directly.

### Can't connect from dbt

1. Check that your IP is allowed (Settings → Database → Connection Pooling)
2. Use port 5432 for direct connections
3. Use port 6543 for connection pooling

---

## What's Next?

1. **Connect Hex** - Add Supabase as a Postgres data source
2. **Set up Fivetran** - Replicate to Snowflake for the full medallion architecture
3. **Build dashboards** - Use the `v_*` metric views as templates
