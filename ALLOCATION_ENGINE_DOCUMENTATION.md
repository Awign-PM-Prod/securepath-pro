# Allocation Engine Documentation
## Background Verification Platform

### Overview
The Allocation Engine is a sophisticated system designed to automatically assign background verification cases to the most suitable gig workers based on multiple criteria including capacity, performance, quality, and geographic coverage.

### Key Features

#### 1. **Capacity-Aware Allocation**
- Real-time capacity tracking per gig worker
- Dynamic capacity updates based on case status changes
- Daily capacity reset and management
- Capacity consumption on case acceptance
- Capacity freeing on case completion

#### 2. **Performance-Based Scoring**
- **Quality Score (35%)**: QC pass rate and quality metrics
- **Completion Rate (25%)**: Historical case completion rate
- **On-Time Rate (25%)**: TAT adherence and timely completion
- **Acceptance Rate (15%)**: Allocation acceptance rate

#### 3. **Geographic Coverage**
- Pincode-based coverage mapping
- Tier-based allocation (Tier 1, 2, 3)
- Coverage area optimization
- Distance-based tie-breaking

#### 4. **Multi-Wave Allocation**
- Initial allocation with 30-minute acceptance window
- Automatic reallocation on timeout/rejection
- Up to 3 waves of allocation attempts
- Escalation to vendor management on failure

### Architecture

#### Core Components

1. **AllocationEngine** (`src/services/allocationEngine.ts`)
   - Main allocation logic and candidate scoring
   - Configuration management
   - Candidate filtering and ranking

2. **AllocationService** (`src/services/allocationService.ts`)
   - High-level allocation operations
   - Capacity management
   - Notification handling
   - Reallocation logic

3. **AllocationDashboard** (`src/components/Allocation/AllocationDashboard.tsx`)
   - Real-time monitoring interface
   - Capacity visualization
   - Performance metrics
   - Manual allocation controls

4. **GigWorkerManagement** (`src/pages/GigWorkerManagement.tsx`)
   - Gig worker profile management
   - Coverage area configuration
   - Capacity settings
   - Performance tracking

#### Database Schema

##### Core Tables
- **`gig_partners`**: Gig worker profiles with performance metrics
- **`capacity_tracking`**: Real-time capacity management
- **`allocation_logs`**: Complete allocation history
- **`allocation_config`**: Configurable allocation parameters
- **`pincode_tiers`**: Geographic tier classification

##### Key Relationships
```sql
gig_partners (1) -> (N) capacity_tracking
gig_partners (1) -> (N) allocation_logs
cases (1) -> (N) allocation_logs
allocation_config (configuration storage)
```

### Allocation Flow

#### 1. **Case Creation Trigger**
```typescript
// When a case is created, trigger allocation
const allocationResult = await allocationService.allocateCase({
  caseId: case.id,
  pincode: case.location.pincode,
  pincodeTier: case.location.pincode_tier,
  priority: case.priority
});
```

#### 2. **Candidate Selection Process**
1. **Coverage Filter**: Find workers covering the case pincode
2. **Capacity Filter**: Ensure `capacity_available > 0`
3. **Quality Filter**: Apply minimum quality thresholds
4. **Scoring**: Calculate weighted performance score
5. **Ranking**: Sort by score (highest first)
6. **Selection**: Choose top candidate

#### 3. **Allocation Execution**
```typescript
// Create allocation log entry
const allocationLog = await supabase
  .from('allocation_logs')
  .insert({
    case_id: caseId,
    candidate_id: bestCandidate.id,
    candidate_type: 'gig',
    score_snapshot: candidateMetrics,
    final_score: calculatedScore,
    acceptance_window_minutes: 30,
    acceptance_deadline: new Date(Date.now() + 30 * 60 * 1000)
  });

// Update case status
await supabase
  .from('cases')
  .update({
    current_assignee_id: bestCandidate.id,
    status: 'auto_allocated'
  })
  .eq('id', caseId);

// Consume capacity
await allocationService.updateCapacity({
  gigPartnerId: bestCandidate.id,
  action: 'consume',
  caseId: caseId
});
```

#### 4. **Acceptance Handling**
```typescript
// Worker accepts allocation
await allocationService.acceptAllocation(allocationId, caseId);

// Update case status to 'accepted'
// Capacity remains consumed
// Start case execution timer
```

#### 5. **Rejection/Timeout Handling**
```typescript
// Worker rejects or timeout occurs
await allocationService.rejectAllocation(allocationId, caseId, reason);

// Free up capacity
await allocationService.updateCapacity({
  gigPartnerId: candidateId,
  action: 'free',
  caseId: caseId
});

// Trigger reallocation
await allocationService.triggerReallocation(caseId);
```

### Configuration

#### Scoring Weights
```json
{
  "quality_score": 0.35,
  "completion_rate": 0.25,
  "ontime_completion_rate": 0.25,
  "acceptance_rate": 0.15
}
```

#### Acceptance Window
```json
{
  "minutes": 30,
  "nudge_after_minutes": 15,
  "max_waves": 3
}
```

#### Capacity Rules
```json
{
  "consume_on": "accepted",
  "free_on": "submitted",
  "reset_time": "06:00",
  "max_daily_capacity": 10
}
```

#### Quality Thresholds
```json
{
  "min_quality_score": 0.6,
  "min_completion_rate": 0.5,
  "min_acceptance_rate": 0.4
}
```

### API Endpoints

#### Allocation Operations
```typescript
// Allocate case
POST /api/allocation/allocate
{
  "caseId": "uuid",
  "pincode": "400001",
  "pincodeTier": "tier1",
  "priority": "high"
}

// Accept allocation
POST /api/allocation/accept
{
  "allocationId": "uuid",
  "caseId": "uuid"
}

// Reject allocation
POST /api/allocation/reject
{
  "allocationId": "uuid",
  "caseId": "uuid",
  "reason": "string"
}
```

#### Monitoring Endpoints
```typescript
// Get capacity overview
GET /api/allocation/capacity

// Get allocation history
GET /api/allocation/history/:caseId

// Get performance metrics
GET /api/allocation/performance
```

### Monitoring and Analytics

#### Real-Time Metrics
- **Total Allocations**: Cases allocated today
- **Success Rate**: Percentage of accepted allocations
- **Pending Allocations**: Cases awaiting response
- **Capacity Utilization**: Overall capacity usage

#### Performance Tracking
- **Quality Scores**: QC pass rates by worker
- **Completion Rates**: Historical completion performance
- **On-Time Rates**: TAT adherence metrics
- **Acceptance Rates**: Allocation acceptance patterns

#### Capacity Management
- **Available Capacity**: Real-time capacity per worker
- **Utilization Trends**: Capacity usage over time
- **Coverage Analysis**: Geographic coverage optimization
- **Load Balancing**: Workload distribution

### Error Handling

#### Allocation Failures
1. **No Eligible Candidates**: Alert vendor management
2. **Capacity Exhausted**: Trigger capacity increase
3. **Quality Thresholds**: Adjust thresholds or improve worker performance
4. **System Errors**: Log and retry with fallback

#### Reallocation Scenarios
1. **Worker Rejection**: Immediate reallocation to next candidate
2. **Timeout**: Automatic reallocation after 30 minutes
3. **Multiple Failures**: Escalate to manual allocation
4. **System Overload**: Queue management and prioritization

### Testing

#### Test Scenarios
1. **High Performance Allocation**: Test with high-scoring workers
2. **Capacity Constraints**: Test with limited capacity
3. **Coverage Matching**: Test pincode coverage logic
4. **Reallocation Flow**: Test timeout and rejection handling
5. **Error Conditions**: Test system failure scenarios

#### Test Data Setup
```sql
-- Run test_allocation_engine.sql to set up test data
-- Includes test gig workers, cases, and capacity tracking
-- Validates allocation logic and scoring
```

### Deployment Considerations

#### Performance Optimization
- **Database Indexing**: Optimize queries for allocation engine
- **Caching**: Cache worker performance metrics
- **Batch Processing**: Handle high-volume allocation
- **Monitoring**: Real-time performance tracking

#### Scalability
- **Horizontal Scaling**: Multiple allocation engine instances
- **Load Balancing**: Distribute allocation load
- **Database Sharding**: Partition by geographic regions
- **Queue Management**: Handle allocation queues

#### Security
- **Access Control**: Role-based allocation permissions
- **Audit Logging**: Complete allocation audit trail
- **Data Privacy**: Secure worker and case data
- **API Security**: Secure allocation endpoints

### Future Enhancements

#### Planned Features
1. **Machine Learning**: Predictive allocation based on historical data
2. **Dynamic Scoring**: Real-time score adjustment based on performance
3. **Geographic Optimization**: Route optimization for field visits
4. **Predictive Capacity**: Forecast capacity needs based on demand
5. **Advanced Analytics**: Deep insights into allocation patterns

#### Integration Opportunities
1. **Mobile App**: Real-time allocation notifications
2. **SMS/WhatsApp**: Multi-channel notification delivery
3. **External APIs**: Integration with mapping and routing services
4. **Analytics Platform**: Advanced reporting and insights
5. **Workflow Automation**: Automated case management workflows

### Troubleshooting

#### Common Issues
1. **Allocation Not Working**: Check capacity and quality thresholds
2. **Performance Issues**: Optimize database queries and indexing
3. **Notification Failures**: Verify notification service configuration
4. **Capacity Issues**: Check daily capacity initialization
5. **Scoring Problems**: Validate scoring weights and calculations

#### Debug Tools
- **Allocation Logs**: Complete audit trail of all allocations
- **Performance Metrics**: Real-time worker performance tracking
- **Capacity Monitoring**: Live capacity status across all workers
- **Error Logging**: Detailed error tracking and reporting

---

*This documentation provides a comprehensive guide to the Allocation Engine system. For technical implementation details, refer to the source code and API documentation.*
