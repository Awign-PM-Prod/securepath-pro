# Auto-Allocation Logic - Current Implementation

## Overview
The auto-allocation engine assigns cases to gig workers or vendors based on performance, capacity, and geographic coverage.

## 1. Candidate Selection (`get_allocation_candidates` function)

### Gig Workers
**Filters:**
- ✅ `is_active = true` - Worker must be active
- ✅ `is_available = true` - Worker must be available
- ✅ `is_direct_gig = true` - Only direct gig workers (not vendor-managed)
- ✅ `capacity_available > 0` - Must have available capacity
- ✅ **Coverage Pincode Match** - Worker's `coverage_pincodes` array must contain:
  - The exact case pincode (e.g., "110001"), OR
  - The case's pincode tier (e.g., "tier_1")

### Vendors
**Filters:**
- ✅ `is_active = true` - Vendor must be active
- ✅ `capacity_available > 0` - Must have available capacity
- ✅ **Coverage Pincode Match** - Vendor's `coverage_pincodes` array must contain:
  - The exact case pincode (e.g., "110001"), OR
  - The case's pincode tier (e.g., "tier_1")

## 2. Scoring Algorithm

### Performance Score Calculation
For **Gig Workers**:
```
performance_score = (completion_rate × 0.4) + (ontime_completion_rate × 0.4) + (acceptance_rate × 0.2)
```

For **Vendors**:
```
performance_score = (quality_score × 0.6) + (vendor_performance_score × 0.4)
```

### Final Score Calculation
```
final_score = (quality_score × 10) + (performance_score ÷ 10)
```

**Weight Distribution:**
- **Completion Rate**: 40%
- **On-time Completion Rate**: 40%
- **Acceptance Rate**: 20%
- **Quality Score**: Used as primary sort (multiplied by 10)

## 3. Quality Thresholds (Minimum Requirements)

Default thresholds (configurable in `allocation_config` table):
- ✅ `min_quality_score`: 0.30 (30%)
- ✅ `min_completion_rate`: 0.30 (30%)
- ✅ `min_acceptance_rate`: 0.30 (30%)

Candidates below these thresholds are **filtered out**.

## 4. Allocation Process

### Step 1: Get Candidates
```sql
SELECT candidates FROM get_allocation_candidates(case_id, pincode, pincode_tier)
```

### Step 2: Filter by Thresholds
- Remove candidates with quality/completion/acceptance below thresholds
- Remove candidates with no capacity

### Step 3: Calculate & Sort Scores
- Calculate `final_score` for each candidate
- Sort by `final_score` (highest first)

### Step 4: Assign to Best Candidate
- Select the **top-scored candidate**
- Call `allocate_case_to_candidate()` RPC function
  - Updates `cases` table with assignee
  - Decrements `capacity_available` for gig worker/vendor
  - Updates `active_cases_count`
  - Changes case status to `auto_allocated`

### Step 5: Capacity Validation
- If selected candidate has **no capacity**, function returns `false`
- Allocation engine automatically tries the **next best candidate**
- Process repeats until successful allocation or all candidates exhausted

## 5. Capacity Management

### Allocation (Consume Capacity)
When a case is allocated:
- `capacity_available -= 1`
- `active_cases_count += 1`
- Updates both `gig_partners`/`vendors` table AND `capacity_tracking` table

### Unallocation (Free Capacity)
When a case is unallocated:
- Recalculates capacity based on **actual assigned cases count**
- `capacity_available = max_daily_capacity - actual_assigned_count`
- `active_cases_count = actual_assigned_count`
- Handles missing `capacity_tracking` records gracefully

### Daily Reset
- Capacity resets at configured time (default: 06:00)
- `capacity_available = max_daily_capacity`

## 6. Coverage Pincodes

Workers/Vendors can be assigned to:
1. **Specific Pincodes**: `["110001", "110002", "110003"]`
2. **Pincode Tiers**: `["tier_1", "tier_2"]` (covers all tier 1/2 pincodes)
3. **Combination**: `["110001", "tier_2"]` (specific pincode + tier)

**Matching Logic:**
```sql
WHERE coverage_pincodes @> ARRAY[case_pincode] 
   OR coverage_pincodes @> ARRAY[case_tier]
```

## 7. Multi-Type Candidates

The system supports:
- ✅ **Direct Gig Workers** (`is_direct_gig = true`)
- ✅ **Vendors** (can further assign to their gig workers)
- ❌ **Vendor-Managed Gig Workers** (`is_direct_gig = false`) - excluded from auto-allocation

## 8. Error Handling & Fallback

### No Candidates Found
- Returns error: `"No eligible candidates found"`
- Case remains in `created` status

### All Candidates Below Threshold
- Returns error: `"No candidates meet quality thresholds"`
- Ops team can manually assign or adjust thresholds

### Capacity Full
- Automatically tries next candidate in sorted list
- Continues until successful or all candidates exhausted

### Missing Capacity Tracking
- Falls back to `gig_partners` table for capacity data
- Only updates `gig_partners` table, skips `capacity_tracking`

## 9. Configuration

Configuration stored in `allocation_config` table:

```json
{
  "scoring_weights": {
    "completion_rate": 0.4,
    "ontime_completion_rate": 0.4,
    "acceptance_rate": 0.2
  },
  "quality_thresholds": {
    "min_quality_score": 0.30,
    "min_completion_rate": 0.30,
    "min_acceptance_rate": 0.30
  },
  "acceptance_window": {
    "minutes": 30,
    "nudge_after_minutes": 15,
    "max_waves": 3
  },
  "capacity_rules": {
    "consume_on": "accepted",
    "free_on": "submitted",
    "reset_time": "06:00",
    "max_daily_capacity": 10
  }
}
```

## 10. Key Database Functions

1. **`get_allocation_candidates(case_id, pincode, tier)`**
   - Returns eligible gig workers and vendors
   - Filters by coverage, capacity, and status

2. **`allocate_case_to_candidate(case_id, candidate_id, type, vendor_id)`**
   - Validates capacity before allocation
   - Updates case assignment
   - Decrements capacity
   - Returns `true` on success, `false` if no capacity

## Summary

The allocation logic prioritizes:
1. **Quality Score** (primary sort - highest weight)
2. **Completion & On-time Rates** (40% each)
3. **Acceptance Rate** (20%)
4. **Available Capacity** (must be > 0)
5. **Geographic Coverage** (exact pincode or tier match)

Cases are assigned to the **highest-scoring candidate** with available capacity who covers the case location.
