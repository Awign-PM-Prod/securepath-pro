# Priority-Based Allocation System

## Overview
The auto-allocation engine has been updated to implement an 8-step priority-based allocation order that narrows down to the perfect gig worker systematically.

## 8-Step Allocation Priority Order

### 1. Pin-Code Wise Allocation
**Priority: Highest**
- Tasks are first mapped to agents available within the same pin code
- Ensures hyperlocal deployment
- Reduces travel time and cost
- **Implementation**: Exact pincode match in `coverage_pincodes` array

### 2. City-Wise Allocation
**Priority: High (Fallback)**
- If no agents are available at the pin code level, tasks expand to city-level allocation
- Optimizes for wider coverage while maintaining proximity
- **Implementation**: Falls back to city match when pincode match fails

### 3. Agent Eligibility-Based Allocation
**Priority: Required Filter**
- Only agents who meet predefined eligibility criteria are shortlisted
- **Current Criteria**:
  - Role: Must be `gig_worker` role
  - Skills: (Placeholder for future implementation)
  - Training: (Placeholder for future implementation)
- **Implementation**: Filters by `profiles.role = 'gig_worker'`
- **Note**: Performance metrics (quality_score, completion_rate, etc.) are NOT used for filtering - they are only used for ranking/scoring

### 4. Agent Availability-Based Allocation
**Priority: Required Filter**
- Checks agents' current availability status:
  - Active/logged in (`is_active = true`)
  - Not on leave (`is_available = true`)
  - Not engaged in another task (`active_cases_count < max_daily_capacity`)
- **Implementation**: Multiple availability checks in WHERE clause

### 5. Current Capacity-Based Allocation
**Priority: Required Filter**
- Tasks assigned based on agent's current workload
- Prevents over-allocation
- Ensures each agent remains within defined task capacity limits
- **Implementation**: `capacity_available > 0` and `active_cases_count < max_daily_capacity`

### 6. Experience and Rating-Based Allocation
**Priority: Scoring Factor**
- Agents with higher experience prioritized
- Better performance ratings prioritized
- Proven reliability prioritized
- Especially important for critical or complex tasks
- **Implementation**:
  - **Experience Score**: Based on `total_cases_completed`
    - 100+ cases: 1.0
    - 50-99 cases: 0.8
    - 20-49 cases: 0.6
    - 10-19 cases: 0.4
    - 5-9 cases: 0.2
    - <5 cases: 0.1
  - **Rating**: Uses `quality_score` (QC pass rate)

### 7. Priority-Based Allocation
**Priority: Dynamic Boost**
- High-priority tasks (urgent/high) routed first to most reliable, experienced, and high-rated agents
- **Implementation**:
  - For `urgent` or `high` priority cases: Applies priority boost multiplier
  - Boost = (quality_score × 0.5 + completion_rate × 0.3 + ontime_completion_rate × 0.2) × 2.0
  - Ensures best agents get critical cases

### 8. Historical Performance-Based Allocation
**Priority: Final Scoring**
- Allocation influenced by past behavior:
  - Task acceptance rates
  - Completion timelines
  - Adherence to quality standards
  - Issue/escalation history (placeholder)
- Consistently reliable agents prioritized to minimize risk
- **Implementation**:
  - **Reliability Score**: Weighted combination
    - Acceptance Rate: 25%
    - Completion Rate: 30%
    - On-Time Completion Rate: 25%
    - Quality Score: 20%
  - **Performance Score**: Historical metrics
    - Completion Rate: 40%
    - On-Time Completion Rate: 40%
    - Acceptance Rate: 20%

## Scoring Algorithm

### Final Score Calculation
```
Final Score = Base Score + Location Bonus + Experience Bonus + Reliability Bonus + Priority Boost

Where:
- Base Score = (quality_score × 10) + (performance_score ÷ 10)
- Location Bonus = 100 (pincode) | 50 (city) | 10 (tier)
- Experience Bonus = experience_score × 20
- Reliability Bonus = reliability_score × 30
- Priority Boost = (for urgent/high priority) calculated boost × 2.0
```

### Sorting Order
Candidates are sorted by:
1. **Location Match Type** (pincode > city > tier)
2. **Priority Boost** (descending) - for urgent/high priority cases
3. **Experience Score** (descending)
4. **Reliability Score** (descending)
5. **Performance Score** (descending)
6. **Quality Score** (descending)
7. **Capacity Available** (descending) - for load balancing

## Database Function

### Function Signature
```sql
get_allocation_candidates(
    p_case_id UUID,
    p_pincode TEXT,
    p_pincode_tier TEXT,
    p_case_priority TEXT DEFAULT 'medium'
)
```

### New Return Fields
- `location_match_type`: 'pincode' | 'city' | 'tier'
- `experience_score`: 0.0 to 1.0
- `reliability_score`: 0.0 to 1.0
- `priority_boost`: 0.0 or calculated boost for high-priority cases

## TypeScript Integration

### Updated Interfaces

```typescript
interface AllocationCandidate {
  // ... existing fields ...
  location_match_type?: 'pincode' | 'city' | 'tier';
  experience_score?: number;
  reliability_score?: number;
  priority_boost?: number;
}
```

### Updated Methods

#### `getCandidates()`
Now accepts `casePriority` parameter:
```typescript
async getCandidates(
  caseId: string, 
  pincode: string, 
  pincodeTier: string,
  casePriority: 'low' | 'medium' | 'high' | 'urgent' = 'medium'
): Promise<AllocationCandidate[]>
```

#### `allocateCase()`
Now accepts `casePriority` parameter:
```typescript
async allocateCase(
  caseId: string, 
  pincode: string, 
  pincodeTier: string,
  casePriority: 'low' | 'medium' | 'high' | 'urgent' = 'medium'
): Promise<AllocationResult>
```

## Usage Example

```typescript
// Allocate a high-priority case
const result = await allocationEngine.allocateCase(
  caseId,
  '110001',
  'tier_1',
  'urgent'  // High priority - will prioritize best agents
);

// The engine will:
// 1. First try pincode match
// 2. Fall back to city match if needed
// 3. Filter by eligibility, availability, capacity
// 4. Score by experience, reliability, performance
// 5. Apply priority boost for urgent cases
// 6. Select best candidate
```

## Configuration

The system uses existing `allocation_config` table for:
- Scoring weights
- Quality thresholds
- Acceptance window
- Capacity rules

## Future Enhancements

1. **Skills-Based Matching**: Add skills table and match case requirements to agent skills
2. **Training Certification**: Track training/certifications and match to case requirements
3. **Escalation History**: Track escalations and penalize agents with high escalation rates
4. **Distance Calculation**: Implement actual distance calculation using geocoding
5. **Leave Management**: Integrate with leave management system for availability

## Migration

To apply the new allocation system:

1. Run the SQL migration:
   ```sql
   \i database/functions/allocation/get_allocation_candidates_priority_based.sql
   ```

2. The TypeScript code is already updated and backward compatible
3. Existing allocations will continue to work with default 'medium' priority

## Testing

Test the allocation with different priorities:
```sql
-- Test high-priority allocation
SELECT * FROM get_allocation_candidates(
    'case-id-here'::UUID,
    '110001',
    'tier_1',
    'urgent'
);

-- Test medium-priority allocation (default)
SELECT * FROM get_allocation_candidates(
    'case-id-here'::UUID,
    '110001',
    'tier_1'
);
```

