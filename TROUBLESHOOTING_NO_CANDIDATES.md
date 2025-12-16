# Troubleshooting: "No Eligible Candidates Found"

## When This Error Appears

The "No eligible candidates found" error is shown when the allocation engine cannot find any gig workers or vendors that meet all the required criteria for a case.

## Conditions That Must Be Met

For a gig worker to be eligible, they must pass **ALL** of these checks:

### 1. **Role Eligibility** ✅
- Must have `role = 'gig_worker'` in the `profiles` table
- ❌ **If failing**: Check the profile's role field

### 2. **Availability Status** ✅
- `is_active = true` - Worker must be active
- `is_available = true` - Worker must be available (not on leave)
- `is_direct_gig = true` - Only direct gig workers (not vendor-managed)
- ❌ **If failing**: Check gig_partners table for these flags

### 3. **Capacity Requirements** ✅
- `capacity_available > 0` - Must have available capacity
- `active_cases_count < max_daily_capacity` - Not fully engaged
- ❌ **If failing**: Worker has reached their daily capacity limit

### 4. **Location Coverage** ✅
The worker must cover the case location through one of:
- **Exact Pincode Match**: Case pincode is in worker's `coverage_pincodes` array
- **City Match**: Worker's city matches case city (fallback)
- **Tier Match**: Worker's `coverage_pincodes` contains the case's pincode tier (e.g., "tier_1")
- ❌ **If failing**: Worker doesn't cover this location

### 5. **Performance Metrics** (Used for Ranking Only) 📊
- Performance metrics (quality_score, completion_rate, ontime_completion_rate, acceptance_rate) are **NOT** used for filtering
- They are only used for **ranking/scoring** to determine the best candidate
- All workers who meet the basic requirements (1-4) can be allocated, regardless of performance

## Common Scenarios

### Scenario 1: New Case with New Pincode
**Problem**: You created a case with a pincode that no gig worker covers.

**Solution**:
1. Check if any gig workers have this pincode in their `coverage_pincodes`
2. Check if any gig workers cover the city
3. Check if any gig workers cover the pincode tier
4. If none exist, you need to:
   - Add the pincode to a gig worker's coverage
   - Or manually assign the case

### Scenario 2: All Workers at Full Capacity
**Problem**: All eligible workers have reached their `max_daily_capacity`.

**Solution**:
1. Check `capacity_available` for all workers
2. Wait for workers to complete cases (capacity frees up)
3. Or manually increase a worker's `max_daily_capacity`

### Scenario 3: ~~Workers Below Quality Thresholds~~ (No Longer Applies)
**Note**: Performance thresholds have been removed. Workers are no longer filtered based on performance metrics. Performance is only used for ranking to select the best candidate among eligible workers.

### Scenario 4: No Active/Available Workers
**Problem**: Workers exist but are marked as inactive or unavailable.

**Solution**:
1. Check worker status:
   ```sql
   SELECT id, is_active, is_available, is_direct_gig 
   FROM gig_partners;
   ```
2. Activate workers or mark them as available

### Scenario 5: Workers Not Direct Gig Workers
**Problem**: Workers are vendor-managed (`is_direct_gig = false`).

**Solution**:
- These workers are excluded from auto-allocation
- Either make them direct gig workers or allocate through their vendor

## How to Debug

### Step 1: Check Case Details
```sql
SELECT 
  c.id,
  c.case_number,
  l.pincode,
  l.city,
  l.pincode_tier,
  c.priority
FROM cases c
JOIN locations l ON c.location_id = l.id
WHERE c.id = 'YOUR_CASE_ID';
```

### Step 2: Check Available Workers for This Location
```sql
SELECT 
  gp.id,
  p.first_name || ' ' || p.last_name as name,
  gp.is_active,
  gp.is_available,
  gp.is_direct_gig,
  gp.capacity_available,
  gp.max_daily_capacity,
  gp.active_cases_count,
  gp.quality_score,
  gp.completion_rate,
  gp.ontime_completion_rate,
  gp.acceptance_rate,
  gp.coverage_pincodes,
  gp.city,
  p.role
FROM gig_partners gp
JOIN profiles p ON gp.profile_id = p.id
WHERE 
  p.role = 'gig_worker'
  AND gp.is_active = true
  AND gp.is_available = true
  AND gp.is_direct_gig = true
  AND gp.capacity_available > 0;
```

### Step 3: Test Allocation Function Directly
```sql
SELECT * FROM get_allocation_candidates(
  'YOUR_CASE_ID'::UUID,
  'CASE_PINCODE',
  'CASE_TIER',
  'medium'::TEXT
);
```

This will show you exactly which workers are being considered and why they might be filtered out.

### Step 4: Check Each Filter Condition
Run these queries to see which condition is failing:

```sql
-- Check location coverage
SELECT id, coverage_pincodes, city 
FROM gig_partners 
WHERE 'CASE_PINCODE' = ANY(coverage_pincodes)
   OR coverage_pincodes @> ARRAY['CASE_PINCODE']
   OR city = 'CASE_CITY'
   OR coverage_pincodes @> ARRAY['CASE_TIER'];

-- Check capacity
SELECT id, capacity_available, active_cases_count, max_daily_capacity
FROM gig_partners
WHERE capacity_available > 0
  AND active_cases_count < max_daily_capacity;

-- Check performance metrics (for reference - not used for filtering)
SELECT id, quality_score, completion_rate, ontime_completion_rate, acceptance_rate
FROM gig_partners
WHERE is_active = true;
```

## Quick Fixes

### Fix 1: Add Pincode to Worker Coverage
```sql
UPDATE gig_partners
SET coverage_pincodes = array_append(coverage_pincodes, 'NEW_PINCODE')
WHERE id = 'WORKER_ID';
```

### Fix 2: Increase Worker Capacity
```sql
UPDATE gig_partners
SET max_daily_capacity = max_daily_capacity + 5
WHERE id = 'WORKER_ID';
```

### Fix 3: Activate/Available Worker
```sql
UPDATE gig_partners
SET is_active = true, is_available = true
WHERE id = 'WORKER_ID';
```

### Fix 4: ~~Improve Performance Metrics~~ (No Longer Needed)
**Note**: Performance metrics are no longer used for filtering, so you don't need to worry about workers with low performance scores being excluded.

### Fix 5: Reset Capacity (if stuck)
```sql
UPDATE gig_partners
SET capacity_available = max_daily_capacity,
    active_cases_count = (
      SELECT COUNT(*) 
      FROM cases 
      WHERE current_assignee_id = gig_partners.id 
        AND status IN ('allocated', 'accepted', 'in_progress', 'submitted')
    )
WHERE id = 'WORKER_ID';
```

## Prevention

1. **Set Up Worker Coverage**: Ensure workers have proper `coverage_pincodes` set
2. **Monitor Capacity**: Regularly check worker capacity and adjust `max_daily_capacity` as needed
3. **Track Performance**: Monitor worker metrics to ensure they stay above thresholds
4. **Maintain Availability**: Keep workers marked as active and available when they're working

## Manual Allocation Alternative

If auto-allocation fails, you can always manually assign the case:
1. Go to the case details
2. Click "Manual Allocate"
3. Select a specific gig worker or vendor
4. This bypasses all the auto-allocation filters

