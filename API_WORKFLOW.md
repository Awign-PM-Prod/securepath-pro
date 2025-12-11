# API Workflow: Case Management with Fulfillment Portal

## Overview

This document describes the workflow for case creation and status tracking through the Fulfillment Portal integration. The system involves three parties:

1. **API User** - External system that creates cases
2. **Fulfillment Portal** - Intermediary gateway that routes requests and notifications
3. **Our Portal** (SecurePath Pro) - Background verification platform that processes cases

---

## System Architecture

```markdown:API_WORKFLOW.md
```
API User  ←→  Fulfillment Portal  ←→  Our Portal
```

- **API User** communicates only with **Fulfillment Portal**
- **Fulfillment Portal** communicates with both **API User** and **Our Portal**
- **Our Portal** sends status updates to **Fulfillment Portal**, which forwards them to **API User**

---

## Workflow 1: Case Creation

### Step-by-Step Flow

1. **API User initiates case creation**
   - API User sends a case creation request to Fulfillment Portal
   - Request includes: candidate details, location, contract type, deadlines, etc.

2. **Fulfillment Portal receives request**
   - Fulfillment Portal validates the request
   - Fulfillment Portal forwards the request to Our Portal

3. **Our Portal processes case creation**
   - Our Portal validates the data
   - Our Portal creates the case in the system
   - Case is assigned initial status: **"new"**
   - Our Portal generates a unique case number

4. **Response flows back**
   - Our Portal returns case details to Fulfillment Portal
   - Fulfillment Portal forwards the response to API User
   - API User receives confirmation with case ID and case number

### Result
- Case is created in Our Portal with status **"new"**
- API User has the case reference for future tracking

---

## Workflow 2: Status Change Notifications

### Overview

Whenever a case status changes in Our Portal, a notification is automatically sent to Fulfillment Portal, which then forwards it to the API User.

### Case Status Lifecycle

A case progresses through these statuses:

1. **new** - Case created, waiting to be assigned
2. **allocated** - Case assigned to a worker/vendor
3. **pending_allocation** - Previous assignment rejected or timed out
4. **in_progress** - Worker has started working on the case
5. **submitted** - Worker submitted the verification form
6. **qc_passed** - ✅ **Case completed** - Quality check approved
7. **qc_rejected** - Quality check rejected
8. **qc_rework** - Quality check requested rework
9. **reported** - Case report generated
10. **in_payment_cycle** - Case entered payment processing
11. **payment_complete** - Payment completed
12. **cancelled** - Case cancelled

### Notification Flow

**For Every Status Change:**

1. **Status changes in Our Portal**
   - Case status is updated (e.g., from "submitted" to "qc_passed")
   - System detects the status change

2. **Our Portal sends notification**
   - Our Portal automatically sends a status update message to Fulfillment Portal
   - Message includes: case ID, previous status, new status, timestamp

3. **Fulfillment Portal forwards notification**
   - Fulfillment Portal receives the status update
   - Fulfillment Portal forwards the notification to API User

4. **API User receives update**
   - API User receives the status change notification
   - API User can update their system accordingly

### Special Case: Completion Notification

**When status changes to "qc_passed" (Case Completed):**

1. **Our Portal detects completion**
   - Status changes to "qc_passed"
   - System identifies this as a completion event

2. **Our Portal sends completion notification**
   - Our Portal sends a detailed completion message to Fulfillment Portal
   - Message includes:
     - Case details
     - All form submissions and data
     - Quality check review information
     - Report URL (if available)
     - Completion timestamp

3. **Fulfillment Portal forwards completion**
   - Fulfillment Portal receives the completion notification
   - Fulfillment Portal forwards the complete data to API User

4. **API User receives completion**
   - API User receives the full completion details
   - API User can download reports, access submission data, etc.

---

## Complete Case Lifecycle Example

### Timeline of a Typical Case

1. **Day 1, 10:00 AM** - API User creates case
   - Status: **new**
   - Notification sent: "Case created"

2. **Day 1, 11:00 AM** - Case assigned to worker
   - Status: **allocated**
   - Notification sent: "Case allocated to worker"

3. **Day 1, 2:00 PM** - Worker starts working
   - Status: **in_progress**
   - Notification sent: "Case in progress"

4. **Day 2, 3:00 PM** - Worker submits form
   - Status: **submitted**
   - Notification sent: "Case submitted for review"

5. **Day 2, 4:00 PM** - Quality check passes
   - Status: **qc_passed** ✅
   - **Completion notification sent** with full case data and report

---

## Key Points

### What API User Does
- Creates cases via API call to Fulfillment Portal
- Receives status change notifications automatically
- Receives completion notification with full case data when status = "qc_passed"

### What Fulfillment Portal Does
- Receives case creation requests from API User
- Forwards requests to Our Portal
- Receives status updates from Our Portal
- Forwards status updates to API User

### What Our Portal Does
- Creates cases when requested
- Processes cases through the workflow
- Automatically sends status change notifications to Fulfillment Portal
- Sends detailed completion notification when case is completed (qc_passed)

### Communication Direction

**Case Creation:**
```
API User → Fulfillment Portal → Our Portal
```

**Status Updates:**
```
Our Portal → Fulfillment Portal → API User
```

---

## Notification Types

### Standard Status Update
- Sent for every status change
- Contains: case ID, previous status, new status, timestamp
- Example: "Case status changed from 'submitted' to 'qc_passed'"

### Completion Notification
- Sent only when status changes to "qc_passed"
- Contains: all standard status info PLUS complete case data, submissions, reports
- Example: "Case completed - includes full verification data and report"

---

## Error Handling

### If Fulfillment Portal is Unavailable
- Our Portal will queue the notification
- System will retry sending the notification
- Notifications are not lost

### If API User Webhook Fails
- Fulfillment Portal handles retry logic
- Our Portal's responsibility ends after delivery to Fulfillment Portal

---

## Summary

1. **API User creates case** → Request goes through Fulfillment Portal to Our Portal
2. **Case is created** → Response flows back through Fulfillment Portal to API User
3. **Case status changes** → Our Portal automatically notifies Fulfillment Portal
4. **Fulfillment Portal forwards** → API User receives status updates
5. **Case completes (qc_passed)** → API User receives detailed completion notification with all case data

**Key Benefit:** API User only needs to create the case once. All status updates and completion data are automatically delivered without polling or additional API calls.
```

This document focuses on the workflow without code. It describes:
- The three-party system
- Case creation flow
- Status change notification flow
- Completion notification details
- A complete example timeline
- Communication directions

Should I save this as `API_WORKFLOW.md` in your project root?






