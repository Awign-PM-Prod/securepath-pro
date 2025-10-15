# 🚀 Getting Started - SecurePath Pro
## Your Complete Onboarding Guide

> **Welcome!** This guide will help you understand and start working on the SecurePath Pro background verification platform.

---

## 📚 Table of Contents
1. [Quick Understanding](#quick-understanding)
2. [Project Setup](#project-setup)
3. [Understanding the Flow](#understanding-the-flow)
4. [Development Workflow](#development-workflow)
5. [Key Files to Know](#key-files-to-know)
6. [Common Tasks](#common-tasks)
7. [Troubleshooting](#troubleshooting)

---

## 🎯 Quick Understanding

### What is This Project?
**SecurePath Pro** is a **Background Verification Platform** - think "Uber for background checks."

**The Core Flow:**
```
Client needs verification 
  → System creates case
  → AI finds best field worker
  → Worker visits location
  → Captures evidence (photos + GPS)
  → QC team reviews
  → Client gets report
  → Worker gets paid
```

### Who Uses It?
1. **Ops Team** - Create cases, manage clients
2. **Gig Workers** - Execute field verifications (mobile)
3. **QC Team** - Review and approve submissions
4. **Vendors** - Manage teams of gig workers
5. **Clients** - Track cases and download reports

---

## 💻 Project Setup

### Step 1: Clone & Install (If Not Done)
```bash
# You already have the project, but if needed:
cd d:\Awigna\Projects\BGV\securepath-pro

# Install dependencies
npm install
```

### Step 2: Environment Setup
Make sure you have `.env` file with Supabase credentials:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Step 3: Database Setup (IMPORTANT!)

**Run these SQL scripts in Supabase SQL Editor in this order:**

1. **Core Migrations** (if not already done):
   - Navigate to `database/migrations/core/`
   - Run all files in numerical order

2. **Feature Migrations**:
   - Navigate to `database/migrations/features/`
   - Run all files in order

3. **Create Test Data**:
   ```sql
   -- Run from database/test-data/
   -- This creates test users and sample data
   ```

### Step 4: Start Development Server
```bash
npm run dev

# App runs on http://localhost:5173
```

### Step 5: Create First Admin User

**Using Supabase Dashboard:**
1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add user"
3. Fill in:
   - Email: `admin@bgverification.com`
   - Password: `admin123`
   - User Metadata:
   ```json
   {
     "first_name": "System",
     "last_name": "Administrator",
     "role": "super_admin"
   }
   ```
4. Click "Create user"

### Step 6: Test Login
1. Visit `http://localhost:5173`
2. Login with `admin@bgverification.com` / `admin123`
3. You should see the Super Admin dashboard

---

## 🔄 Understanding the Flow

### 1. AUTHENTICATION FLOW

```
User visits app
  ↓
Login page (if not authenticated)
  ↓
Check user role from profiles table
  ↓
Redirect to role-based dashboard:
  - super_admin → /admin
  - ops_team → /ops
  - vendor_team → /vendor-team
  - qc_team → /qc
  - vendor → /vendor
  - gig_worker → /gig
  - client → /client
```

**Key Files:**
- `src/contexts/AuthContext.tsx` - Authentication logic
- `src/components/ProtectedRoute.tsx` - Route protection
- `src/pages/Login.tsx` - Login page

---

### 2. CASE CREATION & ALLOCATION FLOW

```
┌─────────────────────────────────────────────────────┐
│ STEP 1: OPS TEAM CREATES CASE                       │
├─────────────────────────────────────────────────────┤
│ 1. Navigate to /ops/cases                           │
│ 2. Click "Create New Case"                          │
│ 3. Fill form:                                       │
│    - Select Client                                  │
│    - Enter Pincode (e.g., "400001")                 │
│    - System auto-fills: city, state, tier, TAT      │
│    - Add subject details, priority                  │
│ 4. Submit                                           │
│                                                     │
│ System actions:                                     │
│ - Geocodes address                                  │
│ - Determines pincode tier (Tier-1/2/3)              │
│ - Triggers auto-allocation                          │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│ STEP 2: AUTO-ALLOCATION ENGINE (AUTOMATIC)          │
├─────────────────────────────────────────────────────┤
│ Algorithm:                                          │
│                                                     │
│ 1. Find candidates:                                 │
│    - Coverage match (pincode or tier)               │
│    - Capacity available > 0                         │
│    - Active status                                  │
│                                                     │
│ 2. Filter by quality thresholds:                    │
│    - Quality score ≥ 30%                            │
│    - Completion rate ≥ 30%                          │
│    - Acceptance rate ≥ 30%                          │
│                                                     │
│ 3. Score candidates:                                │
│    Score = (Quality × 10) + (Performance ÷ 10)      │
│    Performance = Completion(40%) + OnTime(40%)      │
│                  + Acceptance(20%)                  │
│                                                     │
│ 4. Allocate to highest scorer                       │
│ 5. Send notification to worker                      │
│                                                     │
│ If rejected/timeout → Try next candidate (max 3)    │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│ STEP 3: GIG WORKER ACCEPTANCE (MOBILE)              │
├─────────────────────────────────────────────────────┤
│ 1. Receive push notification                        │
│ 2. View case details on mobile app                  │
│ 3. See earning (if direct gig)                      │
│ 4. Accept or Reject (30-minute window)              │
│                                                     │
│ On Accept:                                          │
│ - Capacity: capacity_available - 1                  │
│ - Status: Accepted                                  │
│ - Timer: Start execution timer                      │
│                                                     │
│ On Reject:                                          │
│ - Reallocate to next candidate                      │
│ - Log rejection reason                              │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│ STEP 4: FIELD EXECUTION (MOBILE)                    │
├─────────────────────────────────────────────────────┤
│ 1. Navigate to location (GPS directions)            │
│ 2. Capture photos:                                  │
│    - Minimum 3 photos required                      │
│    - GPS coordinates auto-captured                  │
│    - EXIF data embedded                             │
│ 3. Fill verification checklist                      │
│ 4. Submit case                                      │
│                                                     │
│ On Submit:                                          │
│ - Capacity: capacity_available + 1 (freed)          │
│ - Status: Submitted                                 │
│ - Queue: Moves to QC queue                          │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│ STEP 5: QC REVIEW (WEB)                             │
├─────────────────────────────────────────────────────┤
│ QC Team reviews submission:                         │
│                                                     │
│ 1. Open case from QC queue                          │
│ 2. Validate evidence:                               │
│    ✓ Photos clear and relevant                      │
│    ✓ GPS matches address                            │
│    ✓ EXIF data authentic                            │
│    ✓ Checklist complete                             │
│                                                     │
│ 3. Decision:                                        │
│    - PASS → Case completed                          │
│    - REJECT → Back to worker with reason            │
│    - REWORK → Back to worker with instructions      │
│                                                     │
│ On PASS:                                            │
│ - Status: Completed                                 │
│ - Report: Generated for client                      │
│ - Payment: Line item created                        │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│ STEP 6: PAYMENT PROCESSING (BI-WEEKLY)              │
├─────────────────────────────────────────────────────┤
│ Payment Calculation:                                │
│                                                     │
│ Base Rate = Pincode Tier × Completion Time Slab     │
│           + Travel Allowance                        │
│           + Performance Bonus                       │
│           + Ops Override                            │
│                                                     │
│ Route Payment:                                      │
│ - Vendor case → Pay vendor                          │
│ - Direct gig → Pay worker                           │
│                                                     │
│ Process:                                            │
│ 1. Payment lines accumulate for 2 weeks             │
│ 2. Ops team reviews and approves batch              │
│ 3. System disburses (Bank/UPI/Wallet)               │
│ 4. Notification sent to beneficiaries               │
└─────────────────────────────────────────────────────┘
```

---

### 3. CAPACITY MANAGEMENT FLOW

```
06:00 AM (Daily Reset)
  ↓
Reset all capacities to max_daily_capacity (e.g., 10)
  ↓
Throughout the day:

Case Allocated → No capacity change (pending acceptance)
  ↓
Case Accepted → capacity_available - 1 (consumed)
  ↓
Worker completes and submits → capacity_available + 1 (freed)
  ↓
QC Pass → No capacity change (already freed on submit)
  ↓
Repeat...
  ↓
Next day 06:00 AM → Reset again to max
```

**Key Points:**
- Each worker has `max_daily_capacity` (e.g., 10 cases/day)
- Capacity consumed on **Accept**
- Capacity freed on **Submit** (not QC pass)
- Daily reset at 6:00 AM
- System only allocates to workers with `capacity_available > 0`

---

## 👨‍💻 Development Workflow

### For Frontend Changes

1. **Locate the component:**
   ```
   src/
   ├── pages/          → Full page components
   ├── components/     → Reusable components
   └── services/       → Business logic
   ```

2. **Make changes**

3. **Test in browser:**
   ```bash
   npm run dev
   ```

4. **Check for linting errors:**
   ```bash
   npm run lint
   ```

### For Backend/Database Changes

1. **Create SQL migration:**
   ```
   database/migrations/features/YYYYMMDD_description.sql
   ```

2. **Run in Supabase SQL Editor**

3. **Update documentation:**
   - Update `database/reference/SCHEMA_REFERENCE.md`
   - Update relevant .md files

4. **Test with frontend**

### For Allocation Logic Changes

**Key Files:**
- `src/services/allocationEngine.ts` - Frontend allocation logic
- `database/functions/allocation/` - Database allocation functions

**Testing:**
1. Create test case
2. Trigger allocation
3. Check logs for scoring details
4. Verify correct candidate selected

---

## 📁 Key Files to Know

### Frontend (React + TypeScript)

**Core Files:**
```
src/
├── App.tsx                          # Main app with routing
├── contexts/
│   └── AuthContext.tsx              # Authentication logic
├── pages/
│   ├── CaseManagement.tsx           # Case creation & listing
│   ├── AllocationManagement.tsx     # Allocation monitoring
│   ├── QCManagement.tsx             # QC workbench
│   ├── GigWorkerDashboard.tsx       # Mobile worker dashboard
│   └── dashboards/
│       ├── OpsDashboard.tsx         # Ops team dashboard
│       └── ...
├── services/
│   ├── allocationEngine.ts          # ⭐ Smart allocation logic
│   ├── caseService.ts               # Case CRUD operations
│   ├── paymentService.ts            # Payment processing
│   ├── rateCardService.ts           # Pricing calculations
│   └── gigWorkerAuthService.ts      # Gig worker authentication
└── components/
    ├── CaseManagement/
    │   ├── CaseForm.tsx             # Case creation form
    │   ├── CaseList.tsx             # Case listing
    │   └── CaseDetail.tsx           # Case details view
    └── Allocation/
        ├── AllocationDashboard.tsx  # Allocation monitoring
        └── AllocationConfig.tsx     # Allocation settings
```

### Database (PostgreSQL + Functions)

**Core Migrations:**
```
database/
├── migrations/
│   ├── core/                        # Essential schema
│   └── features/                    # Feature additions
├── functions/
│   ├── allocation/
│   │   ├── get_allocation_candidates.sql    # ⭐ Find eligible workers
│   │   └── allocate_case_to_candidate.sql   # ⭐ Assign case
│   ├── capacity/
│   │   ├── consume_capacity.sql             # Reduce capacity
│   │   └── free_capacity.sql                # Increase capacity
│   └── users/
│       └── create_gig_worker.sql            # Create gig worker
└── rls/
    └── policies/                    # Security policies
```

### Configuration Files
```
├── package.json          # Dependencies
├── vite.config.ts        # Build configuration
├── tailwind.config.ts    # Styling configuration
└── tsconfig.json         # TypeScript configuration
```

---

## 🛠️ Common Tasks

### Task 1: Create a New Case (Testing)

1. **Login as Ops Team:**
   ```
   Email: admin@bgverification.com
   Password: admin123
   ```

2. **Navigate to Cases:**
   ```
   /ops/cases → Click "Create New Case"
   ```

3. **Fill Form:**
   - Client: Select from dropdown
   - Pincode: Enter "400001" (Mumbai)
   - Subject: "Test Verification"
   - Priority: "High"

4. **Submit:**
   - System auto-fills location details
   - Triggers allocation automatically

### Task 2: Monitor Allocation

1. **Go to Allocation Dashboard:**
   ```
   /ops/allocation
   ```

2. **View:**
   - Active allocations
   - Capacity overview
   - Performance metrics
   - Pending acceptances

### Task 3: Add a Gig Worker

1. **Login as Vendor Team/Super Admin**

2. **Navigate to Gig Workers:**
   ```
   /ops/gig-workers → Click "Add Gig Worker"
   ```

3. **Fill Details:**
   - Name, email, phone
   - Coverage pincodes (e.g., ["400001", "400002"])
   - Max daily capacity (e.g., 10)

4. **System Actions:**
   - Creates user account
   - Generates password setup token
   - Sends email to gig worker
   - Worker sets password via `/gig/setup`

### Task 4: Perform QC Review

1. **Login as QC Team**

2. **Go to QC Workbench:**
   ```
   /qc → View Queue
   ```

3. **Open Case:**
   - View photos
   - Check GPS location
   - Validate EXIF data
   - Review checklist

4. **Make Decision:**
   - Pass → Case completed
   - Reject → Back to worker with reason
   - Rework → Back with instructions

### Task 5: Modify Allocation Logic

1. **Open Allocation Engine:**
   ```
   src/services/allocationEngine.ts
   ```

2. **Modify Scoring Weights:**
   ```typescript
   scoring_weights: {
     completion_rate: 0.4,      // Change these
     ontime_completion_rate: 0.4,
     acceptance_rate: 0.2,
   }
   ```

3. **Or Modify Thresholds:**
   ```typescript
   quality_thresholds: {
     min_quality_score: 0.30,    // Adjust these
     min_completion_rate: 0.30,
     min_acceptance_rate: 0.30,
   }
   ```

4. **Test:**
   - Create new case
   - Check allocation logs
   - Verify new logic works

---

## 🐛 Troubleshooting

### Issue 1: Login Not Working

**Symptoms:** Can't login, redirects to login page

**Solutions:**
1. Check if user exists in Supabase Auth
2. Verify user has profile in `profiles` table
3. Check role is correctly set
4. Clear browser cache/cookies

**Debug:**
```javascript
// In browser console
supabase.auth.getUser().then(console.log)
```

### Issue 2: Allocation Not Working

**Symptoms:** Case created but not allocated

**Solutions:**
1. Check if gig workers exist with:
   - Coverage matching case pincode
   - `capacity_available > 0`
   - `is_active = true`
   - Quality scores above thresholds

**Debug:**
```sql
-- Run in Supabase SQL Editor
SELECT * FROM get_allocation_candidates(
  'case-id-here',
  '400001',  -- pincode
  'tier1'    -- tier
);
```

### Issue 3: Capacity Not Updating

**Symptoms:** Capacity stuck, not reducing/increasing

**Solutions:**
1. Check `capacity_tracking` table exists
2. Verify daily capacity initialized
3. Check capacity functions working

**Debug:**
```sql
-- Check current capacity
SELECT * FROM capacity_tracking 
WHERE date = CURRENT_DATE;

-- Manual reset
SELECT initialize_daily_capacity();
```

### Issue 4: QC Review Not Showing Cases

**Symptoms:** QC queue empty but cases submitted

**Solutions:**
1. Check case status is 'submitted'
2. Verify RLS policies for QC team
3. Check QC workflow table

**Debug:**
```sql
-- Check submitted cases
SELECT * FROM cases 
WHERE status = 'submitted';

-- Check RLS policies
SELECT * FROM pg_policies 
WHERE tablename = 'cases';
```

### Issue 5: Payment Not Calculating

**Symptoms:** Payment line not created or amount wrong

**Solutions:**
1. Check rate card exists for pincode tier
2. Verify client contract has rate card mapping
3. Check payment calculation function

**Debug:**
```sql
-- Check rate cards
SELECT * FROM rate_cards 
WHERE pincode_tier = 'tier1';

-- Manual calculation test
SELECT calculate_case_payment('case-id-here');
```

---

## 📚 Next Steps

### Day 1: Familiarize
- [ ] Read `PROJECT_SUMMARY.md` - Quick overview
- [ ] Read `SYSTEM_FLOWCHART.md` - Visual flows
- [ ] Run the app locally
- [ ] Login and explore all dashboards

### Day 2: Understand Core Logic
- [ ] Read `ALLOCATION_ENGINE_DOCUMENTATION.md`
- [ ] Study `src/services/allocationEngine.ts`
- [ ] Review allocation database functions
- [ ] Create test cases and watch allocation

### Day 3: Database Deep Dive
- [ ] Read `database/reference/SCHEMA_REFERENCE.md`
- [ ] Explore key tables in Supabase
- [ ] Understand RLS policies
- [ ] Review migration files

### Week 1 Goals
- [ ] Create cases successfully
- [ ] Understand allocation flow
- [ ] Perform QC review
- [ ] Modify a component (UI change)
- [ ] Write your first database function

### Week 2 Goals
- [ ] Implement a small feature
- [ ] Fix a bug
- [ ] Optimize a query
- [ ] Improve documentation
- [ ] Help review code

---

## 🎯 Key Concepts Summary

### 1. Auto-Allocation Algorithm
```
Find candidates → Filter by thresholds → Score them → Allocate to best
```

**Scoring Formula:**
```
final_score = (quality_score × 10) + (performance_score ÷ 10)

performance_score = 
  (completion_rate × 0.4) + 
  (ontime_rate × 0.4) + 
  (acceptance_rate × 0.2)
```

### 2. Capacity Management
```
Daily max = 10
On accept: -1
On submit: +1
Daily reset: 6:00 AM → back to max
```

### 3. Rate Calculation
```
Base Rate = Tier (1/2/3) × Time Slab (24h/48h/72h)
Total = Base + Travel + Bonus + Override
```

### 4. QC Validation
```
Check: Photos + GPS + EXIF + Checklist
Decision: Pass / Reject / Rework
On Pass: Complete → Report → Payment
```

### 5. Payment Routing
```
If vendor case → Pay vendor
If direct gig → Pay gig worker
Bi-weekly cycle → Approval → Disburse
```

---

## 🔗 Important Documentation Links

**Must Read (In Order):**
1. `PROJECT_SUMMARY.md` - Quick project overview
2. `SYSTEM_FLOWCHART.md` - Visual flowcharts
3. `ALLOCATION_ENGINE_DOCUMENTATION.md` - Allocation details
4. `database/reference/SCHEMA_REFERENCE.md` - Database schema
5. `database/reference/DEVELOPMENT_GUIDE.md` - Development guide

**Reference:**
- `README.md` - Setup instructions
- `IMPLEMENTATION_SUMMARY.md` - What's been built
- `DATABASE_SCHEMA_SUMMARY.md` - Database overview
- `GIG_WORKER_PASSWORD_PROCESS.md` - Gig worker auth
- `TESTING_INSTRUCTIONS.md` - Testing guide

**Visual Learning:**
- `FLOWCHART_MERMAID.md` - Interactive diagrams (view on GitHub)
- `PROJECT_ANALYSIS_AND_FLOW.md` - Complete analysis

---

## 💡 Pro Tips

### Tip 1: Use Console Logging
```typescript
// In allocationEngine.ts
console.log('Candidates:', candidates);
console.log('Scores:', scoredCandidates);
```

### Tip 2: Test with Different Roles
```
Create multiple test users:
- Ops team member
- QC team member
- Gig worker
- Vendor
```

### Tip 3: Use Supabase Dashboard
```
- View real-time data changes
- Test SQL queries directly
- Monitor logs and errors
- Check RLS policies
```

### Tip 4: Understand Database Functions
```sql
-- Test functions independently
SELECT * FROM get_allocation_candidates(...);
SELECT * FROM allocate_case_to_candidate(...);
```

### Tip 5: Mobile Testing
```
- Use browser DevTools mobile view
- Test on actual phone
- Check responsive design
- Test offline mode
```

---

## 🆘 Getting Help

### When Stuck:
1. **Check Documentation** - Answer might be in .md files
2. **Check Console** - Browser console and server logs
3. **Check Supabase Logs** - Database errors show here
4. **Debug Step by Step** - Use console.log liberally
5. **Ask Team** - Don't hesitate to ask questions

### Useful Commands:
```bash
# Start dev server
npm run dev

# Check for errors
npm run lint

# Build for production
npm run build

# Run Supabase locally (if configured)
supabase start
```

---

## ✅ You're Ready to Start!

**Your Checklist:**
- [x] Project cloned and dependencies installed
- [x] Database migrations run
- [x] First admin user created
- [x] Can login and see dashboard
- [x] Read this guide
- [x] Understand basic flow

**What to Do Now:**
1. Login to the app
2. Explore all dashboards
3. Create a test case
4. Watch it get allocated
5. Simulate worker acceptance
6. Try QC review
7. Start coding!

---

**Remember:** This is a complex system, so take it step by step. Start with small tasks, understand the flow, and gradually work on bigger features.

**Good luck! You've got this! 🚀**

---

**Document Version**: 1.0  
**Created**: October 14, 2025  
**Purpose**: Comprehensive onboarding guide for new developers  
**Next Update**: Based on developer feedback


