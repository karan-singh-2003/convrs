# Tinybird Analytics Architecture Setup - Complete Guide

## Architecture Overview

```
POST Events to /v0/events?name=analytics_events_raw
                ↓
         analytics_events_raw (Raw datasource)
         [MergeTree partitioned by month]
                ↓
         analytics_events_pipe (Transformation)
         [Selects & filters all fields]
                ↓
         analytics_events (Materialized View)
         [MergeTree with optimized sorting]
                ↓
         Dashboard Queries (GROUP BY device, browser, country, etc.)
```

## Data Flow Explained

### 1. **Ingestion Layer** (`analytics_events_raw`)

- Receives JSON POST requests via `/v0/events?name=analytics_events_raw`
- Uses JSONPath extraction: `json:$.field_name`
- Raw data is stored with minimal transformation
- Partitioned by month for efficient storage and archival
- Sorting Key: `workspace_id, event_id, timestamp`

### 2. **Transformation Layer** (`analytics_events_pipe`)

- Simple pass-through pipe that selects all fields from raw datasource
- Can be extended with transformations in the future:
  - Data validation
  - Field normalization
  - Calculated columns
  - Deduplication logic
- Current setup: Clean, no complex logic (optimal for performance)

### 3. **Materialized View** (`analytics_events`)

- **TYPE MATERIALIZED**: Automatically syncs from the pipe
- When data arrives in `analytics_events_raw`, it flows through the pipe into this view
- Optimized sorting key for analytics queries:
  - `workspace_id` (partition by workspace)
  - `timestamp` (time-series queries)
  - `device_type, browser, country, os` (group by dimensions)
- All LowCardinality fields enable fast GROUP BY operations

### 4. **Query Layer** (Dashboard)

- Queries read directly from `analytics_events` (the MV)
- Queries get fast results due to optimized sorting and partitioning
- Supports:
  - `GROUP BY browser` ✅
  - `GROUP BY device_type` ✅
  - `GROUP BY country` ✅
  - Timeseries queries ✅
  - Workspace-level filtering ✅

## File Structure

```
packages/tinybird/
├── datasources/
│   ├── analytics_events_raw.datasource    (Raw ingestion - UNCHANGED)
│   └── analytics_events.datasource        (Materialized View - MODIFIED)
└── pipes/
    └── analytics_events_pipe.pipe         (Transformation - NEW)
```

## Files Modified/Created

### 1. ✅ `analytics_events_pipe.pipe` (NEW)

```
DESCRIPTION > Transformation pipe for raw analytics events
NODE raw_events: Selects all fields from analytics_events_raw
NODE output: Returns transformed data
```

**Key Features**:

- All 34 fields preserved
- No data loss
- Future-proof for adding transforms
- Production-ready SQL syntax

### 2. ✅ `analytics_events.datasource` (MODIFIED)

```
TYPE MATERIALIZED
SOURCE analytics_events_pipe
```

**Changes Made**:

- Added `DESCRIPTION`
- Added `TYPE MATERIALIZED` (was missing)
- Added `SOURCE analytics_events_pipe` (was disconnected)
- Updated `ENGINE_SORTING_KEY` for analytics:
  - Before: `workspace_id, event_id, timestamp`
  - After: `workspace_id, timestamp, device_type, browser, country, os`
  - Reasoning: Optimizes GROUP BY operations on dimension fields

**Why This Sorting Key**:

- Workspace filtering is first (most selective)
- Timestamp second (enables time-range queries)
- Dimension fields last (enables fast GROUP BY aggregations)
- Avoids grouping by `event_id` (unnecessary for analytics)

### 3. `analytics_events_raw.datasource` (NO CHANGES NEEDED)

Already production-ready with:

- TOKEN "analytics_events_raw_token" APPEND
- Proper JSONPath extraction
- Monthly partitioning
- LowCardinality optimization for dimensions

## Testing the Setup

### 1. Verify Data Flow

```bash
# Check raw data arrived
tb sql "SELECT count() FROM analytics_events_raw"

# Check materialized view is populated
tb sql "SELECT count() FROM analytics_events"

# Both should return same count (no data loss)
```

### 2. Test GroupBy Queries

```bash
# Group by browser
tb sql "
  SELECT browser, count() as count
  FROM analytics_events
  WHERE workspace_id = 'ws_cmmm6isj2000304l5cn5ncqlb'
  GROUP BY browser
  ORDER BY count DESC
"

# Group by device
tb sql "
  SELECT device_type, count() as count
  FROM analytics_events
  GROUP BY device_type
"

# Group by country
tb sql "
  SELECT country, count() as count
  FROM analytics_events
  GROUP BY country
  ORDER BY count DESC
"
```

### 3. Test Timeseries

```bash
tb sql "
  SELECT
    toStartOfHour(timestamp) as hour,
    count() as events
  FROM analytics_events
  WHERE workspace_id = 'ws_cmmm6isj2000304l5cn5ncqlb'
  GROUP BY hour
  ORDER BY hour DESC
"
```

## Production Performance Tips

### 1. **Sorting Key Impact**

- Current: `workspace_id, timestamp, device_type, browser, country, os`
- Good for: Workspace filtering → Time range → Dimension grouping
- Avoids: Sorting by high-cardinality fields (event_id)

### 2. **Partitioning**

- Monthly partitioning (`toYYYYMM(timestamp)`) is optimal for:
  - Year-over-year analytics
  - Archive old months
  - Manage storage growth
  - Parallel query execution

### 3. **LowCardinality Fields**

- All dimensions use `LowCardinality(String)`
- ✅ Fast GROUP BY operations
- ✅ Reduced memory usage
- ✅ Better compression
- ✅ Faster scanning

### 4. **Data Types**

- `DateTime64(3)`: Millisecond precision for event timestamps
- `String`: URLs, user IDs (high cardinality)
- `UInt8`: is_bot flag (0 or 1)

## Migration Path (If Updating Existing Queries)

If your dashboard was querying `analytics_events_raw` directly, update to use `analytics_events`:

**Before**:

```sql
SELECT browser, count() FROM analytics_events_raw GROUP BY browser
```

**After**:

```sql
SELECT browser, count() FROM analytics_events GROUP BY browser
```

Benefits:

- Faster queries (optimized sorting)
- Always consistent data (no race conditions)
- Better query planning (ClickHouse understands structure)

## Troubleshooting

### Materialized View Not Updating

```bash
# Verify the MV configuration
tb datasource info analytics_events

# Check if pipe is correct
tb pipe info analytics_events_pipe

# Try pushing a test event
curl -X POST "http://localhost:8463/v0/events?name=analytics_events_raw" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"timestamp": "2026-03-21T10:30:00Z", "event_id": "test_123", ...}'

# Query after ~5 seconds
tb sql "SELECT count() FROM analytics_events"
```

### Data Loss

Check both tables have same count:

```bash
tb sql "SELECT 'raw' as table, count() FROM analytics_events_raw
UNION ALL
SELECT 'mv' as table, count() FROM analytics_events"
```

Should show identical counts.

## Next Steps (Optional Improvements)

### 1. Add Aggregation Layer

Create additional MV for pre-aggregated data:

```
analytics_events_daily (pre-aggregated by date, browser, device, country)
→ Speeds up dashboard even more
→ Trade-off: Storage vs query speed
```

### 2. Add Data Validation in Pipe

```sql
WHERE
  timestamp >= now() - INTERVAL 30 DAY
  AND event_id != ''
  AND workspace_id != ''
```

### 3. Add Calculated Fields

```sql
SELECT
  *,
  if(is_bot = 1, 'Bot', 'User') as user_type,
  splitByString('.', domain)[2] as domain_name
FROM analytics_events_raw
```

### 4. Archive Old Data

```
ALTER TABLE analytics_events_raw DELETE
WHERE toYYYYMM(timestamp) < 202601
```

## Summary

✅ **Raw ingestion**: `analytics_events_raw` (ready to receive POSTs)  
✅ **Transformation**: `analytics_events_pipe` (clean, expandable)  
✅ **Materialized View**: `analytics_events` (now connected, optimized)  
✅ **Data Flow**: POST → raw → pipe → MV → Dashboard queries  
✅ **Performance**: Optimized sorting for GROUP BY operations  
✅ **Reliability**: No data loss, all 34 fields preserved

**Status**: Ready for production use! 🚀
