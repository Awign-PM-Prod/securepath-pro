# SecurePath Pro - Visual System Flowchart

## 📊 High-Level System Flow

```
                    ┌─────────────────────────────────┐
                    │   USER AUTHENTICATION & ROLE    │
                    │         BASED ROUTING           │
                    └────────────┬────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
         ┌──────────▼──────────┐    ┌────────▼─────────┐
         │  WEB USERS          │    │  MOBILE USERS     │
         │  (Desktop/Tablet)   │    │  (Smartphone)     │
         └──────────┬──────────┘    └────────┬─────────┘
                    │                         │
    ┌───────────────┴──────────────┬──────────┴──────────────┐
    │                              │                          │
┌───▼────────┐              ┌──────▼──────┐          ┌───────▼──────┐
│ Super Admin│              │  Ops Team   │          │  Gig Worker  │
│  Dashboard │              │  Dashboard  │          │  Mobile App  │
└────┬───────┘              └──────┬──────┘          └───────┬──────┘
     │                             │                          │
     │                    ┌────────▼────────┐                │
     │                    │ CASE MANAGEMENT │                │
     │                    │   & CREATION    │                │
     │                    └────────┬────────┘                │
     │                             │                          │
     │                    ┌────────▼────────────────┐        │
     │                    │  AUTO-ALLOCATION ENGINE │        │
     │                    │  • Quality Scoring      │        │
     │                    │  • Capacity Check       │        │
     │                    │  • Geographic Match     │        │
     │                    └────────┬────────────────┘        │
     │                             │                          │
     │                             └──────────────────────────┤
     │                                                        │
     │                                              ┌─────────▼─────────┐
     │                                              │  CASE ACCEPTANCE  │
     │                                              │  Accept / Reject  │
     │                                              └─────────┬─────────┘
     │                                                        │
     │                                              ┌─────────▼─────────┐
     │                                              │ FIELD EXECUTION   │
     │                                              │ • GPS Capture     │
     │                                              │ • Photo Evidence  │
     │                                              │ • Checklist Fill  │
     │                                              └─────────┬─────────┘
     │                                                        │
     │                                              ┌─────────▼─────────┐
     ├──────────────────────────────────────────────┤   SUBMISSION      │
     │                                              └─────────┬─────────┘
     │                                                        │
┌────▼───────┐                                     ┌─────────▼─────────┐
│  QC Team   │◄────────────────────────────────────┤   QC QUEUE        │
│ Workbench  │                                     └───────────────────┘
└────┬───────┘
     │
┌────▼────────────────────┐
│  QC DECISION            │
│  • Pass → Complete      │
│  • Reject → Rework      │
│  • Rework → Back to Gig │
└────┬────────────────────┘
     │
     │ (On Pass)
     │
┌────▼─────────────────┐
│  PAYMENT PROCESSING  │
│  • Calculate Rate    │
│  • Route Payment     │
│  • Bi-weekly Cycle   │
└────┬─────────────────┘
     │
┌────▼─────────────────┐
│  REPORTING           │
│  • Client Reports    │
│  • Analytics         │
│  • KPI Dashboard     │
└──────────────────────┘
```

---

## 🔄 Detailed Case Lifecycle Flow

```
┌─────────────┐
│   START     │
│ Case Created│
└──────┬──────┘
       │
       ▼
┌─────────────────────────┐
│  1. CASE INTAKE         │
│  ─────────────────      │
│  • Manual Entry         │
│  • Bulk CSV Import      │
│  • Email Automation     │
│                         │
│  Capture:               │
│  - Client details       │
│  - Subject info         │
│  - Location/Address     │
│  - Priority level       │
│  - TAT requirements     │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────────────┐
│  2. LOCATION PROCESSING         │
│  ────────────────────────        │
│  • Geocode address              │
│  • Extract pincode              │
│  • Determine pincode tier       │
│    (Tier-1: Metro, Tier-2: City,│
│     Tier-3: Rural)              │
└──────────┬──────────────────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│  3. AUTO-ALLOCATION ENGINE               │
│  ─────────────────────────────────        │
│                                          │
│  Step 1: GET CANDIDATES                  │
│  ┌────────────────────────────────────┐  │
│  │ • Match pincode coverage           │  │
│  │ • Check capacity_available > 0     │  │
│  │ • Verify active status             │  │
│  └────────────────────────────────────┘  │
│           │                              │
│           ▼                              │
│  Step 2: FILTER QUALITY                  │
│  ┌────────────────────────────────────┐  │
│  │ Minimum Thresholds:                │  │
│  │ • Quality Score ≥ 30%              │  │
│  │ • Completion Rate ≥ 30%            │  │
│  │ • Acceptance Rate ≥ 30%            │  │
│  └────────────────────────────────────┘  │
│           │                              │
│           ▼                              │
│  Step 3: CALCULATE SCORES                │
│  ┌────────────────────────────────────┐  │
│  │ Primary Sort: Quality Score        │  │
│  │                                    │  │
│  │ Performance Score (Secondary):     │  │
│  │   Completion Rate:      40%        │  │
│  │   On-Time Rate:         40%        │  │
│  │   Acceptance Rate:      20%        │  │
│  └────────────────────────────────────┘  │
│           │                              │
│           ▼                              │
│  Step 4: ALLOCATE                        │
│  ┌────────────────────────────────────┐  │
│  │ • Sort by score (highest first)    │  │
│  │ • Assign to top candidate          │  │
│  │ • Start acceptance timer (30 min)  │  │
│  │ • Send notification                │  │
│  └────────────────────────────────────┘  │
└──────────────┬───────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  4. ACCEPTANCE DECISION                 │
│  ────────────────────────────            │
│                                         │
│  Gig Worker Receives Notification       │
│           │                             │
│     ┌─────┴─────┐                       │
│     ▼           ▼                       │
│  [ACCEPT]   [REJECT/TIMEOUT]            │
│     │           │                       │
│     │           └──→ Reallocate         │
│     │               (Wave 2/3)          │
│     │               Max 3 Waves         │
│     │               │                   │
│     ▼               ▼                   │
│  Consume      Try Next                  │
│  Capacity     Candidate                 │
│  (-1)              │                    │
│     │              └──→ (If no more     │
│     │                   candidates:     │
│     │                   Alert VMT)      │
│     ▼                                   │
│  PROCEED                                │
└─────┬───────────────────────────────────┘
      │
      ▼
┌────────────────────────────────────┐
│  5. FIELD EXECUTION (Mobile)       │
│  ─────────────────────────────      │
│                                    │
│  Step 1: Navigate                  │
│  • View case location on map       │
│  • Get directions                  │
│                                    │
│  Step 2: Capture Evidence          │
│  • Take photos (min 3)             │
│  • GPS coordinates captured        │
│  • EXIF data embedded              │
│                                    │
│  Step 3: Fill Checklist            │
│  • Dynamic form fields             │
│  • Required validations            │
│                                    │
│  Step 4: Submit                    │
│  • Upload photos                   │
│  • Submit data                     │
│  • Free capacity (+1)              │
└────────┬───────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│  6. QUALITY CONTROL                    │
│  ──────────────────────────             │
│                                        │
│  QC Reviewer Receives Case             │
│           │                            │
│           ▼                            │
│  Validate Evidence:                    │
│  ┌──────────────────────────────────┐  │
│  │ ✓ GPS location matches address   │  │
│  │ ✓ EXIF data authentic            │  │
│  │ ✓ Photo quality acceptable       │  │
│  │ ✓ Checklist complete             │  │
│  │ ✓ All required fields filled     │  │
│  └──────────────────────────────────┘  │
│           │                            │
│           ▼                            │
│  Make Decision:                        │
│           │                            │
│     ┌─────┴─────┬────────┐             │
│     ▼           ▼        ▼             │
│  [PASS]     [REJECT]  [REWORK]         │
│     │           │        │             │
│     │           └────────┴──→ Back to  │
│     │                       Gig Worker │
│     │                       with Reason│
│     ▼                                  │
│  Complete Case                         │
└────────┬───────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│  7. PAYMENT PROCESSING                     │
│  ─────────────────────────────              │
│                                            │
│  Step 1: Calculate Amount                  │
│  ┌──────────────────────────────────────┐  │
│  │ Base Rate = Pincode Tier × Time Slab │  │
│  │           + Travel Allowance         │  │
│  │           + Performance Bonus        │  │
│  │           + Ops Override             │  │
│  └──────────────────────────────────────┘  │
│           │                                │
│           ▼                                │
│  Step 2: Route Payment                     │
│  ┌──────────────────────────────────────┐  │
│  │ Assignment Type?                     │  │
│  │   • Vendor → Pay Vendor              │  │
│  │   • Direct Gig → Pay Gig Worker      │  │
│  └──────────────────────────────────────┘  │
│           │                                │
│           ▼                                │
│  Step 3: Payment Cycle                     │
│  ┌──────────────────────────────────────┐  │
│  │ • Add to bi-weekly cycle             │  │
│  │ • Aggregate all payments             │  │
│  │ • Ops approval                       │  │
│  │ • Disburse (Bank/UPI/Wallet)         │  │
│  └──────────────────────────────────────┘  │
│           │                                │
│           ▼                                │
│  Send Notification                         │
└────────┬───────────────────────────────────┘
         │
         ▼
┌────────────────────┐
│   CASE COMPLETE    │
│   ───────────────  │
│   • Generate Report│
│   • Update Metrics │
│   • Client Notified│
└────────────────────┘
         │
         ▼
┌────────────────────┐
│       END          │
└────────────────────┘
```

---

## 🔄 Capacity Management Cycle

```
       ┌────────────────────────────────┐
       │   DAILY CYCLE (24 Hours)       │
       └────────────────────────────────┘

TIME: 06:00 AM
┌─────────────────────────────────────────┐
│  CAPACITY RESET                         │
│  ────────────────                        │
│  For all gig workers:                   │
│  capacity_available = max_daily_capacity│
│  (e.g., 10)                             │
└─────────────────┬───────────────────────┘
                  │
TIME: 09:00 AM    ▼
┌─────────────────────────────────────────┐
│  CASE ALLOCATED                         │
│  ──────────────                          │
│  Worker A: capacity = 10                │
│  Case assigned (pending acceptance)     │
│  Capacity = 10 (no change yet)          │
└─────────────────┬───────────────────────┘
                  │
TIME: 09:15 AM    ▼
┌─────────────────────────────────────────┐
│  CASE ACCEPTED                          │
│  ─────────────                           │
│  Worker A accepts case                  │
│  Capacity: 10 → 9 (consumed)            │
└─────────────────┬───────────────────────┘
                  │
TIME: 10:00 AM    ▼
┌─────────────────────────────────────────┐
│  MORE ALLOCATIONS                       │
│  ────────────────                        │
│  Worker A accepts 4 more cases          │
│  Capacity: 9 → 5 (4 more consumed)      │
└─────────────────┬───────────────────────┘
                  │
TIME: 12:00 PM    ▼
┌─────────────────────────────────────────┐
│  NEW CASE - CAPACITY CHECK              │
│  ─────────────────────────               │
│  New case for Worker A's area           │
│  Worker A: capacity = 5 ✓               │
│  Allocate to Worker A                   │
│  On Accept: capacity 5 → 4              │
└─────────────────┬───────────────────────┘
                  │
TIME: 02:00 PM    ▼
┌─────────────────────────────────────────┐
│  CASE SUBMITTED                         │
│  ──────────────                          │
│  Worker A submits first case            │
│  Capacity: 4 → 5 (freed)                │
└─────────────────┬───────────────────────┘
                  │
TIME: 02:30 PM    ▼
┌─────────────────────────────────────────┐
│  QC PASS                                │
│  ───────                                 │
│  QC reviews and passes case             │
│  Capacity: No change (already freed)    │
│  Payment line created                   │
└─────────────────┬───────────────────────┘
                  │
TIME: 03:00 PM    ▼
┌─────────────────────────────────────────┐
│  NEW ALLOCATION POSSIBLE                │
│  ───────────────────────                 │
│  Worker A now has capacity = 5          │
│  Can receive new assignments            │
└─────────────────┬───────────────────────┘
                  │
                  ▼
              [Continue...]

TIME: 06:00 AM (Next Day)
┌─────────────────────────────────────────┐
│  RESET CAPACITY                         │
│  ──────────────                          │
│  capacity_available = max_daily_capacity│
│  Cycle repeats                          │
└─────────────────────────────────────────┘
```

---

## 🌐 User Role Navigation Map

```
┌─────────────────────────────────────────────────────────────┐
│                    USER LOGIN PORTAL                        │
│                  (Authentication Layer)                     │
└────────────────────────┬────────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          │                             │
          ▼                             ▼
    ┌──────────┐                  ┌──────────┐
    │   WEB    │                  │  MOBILE  │
    │  Access  │                  │  Access  │
    └──────────┘                  └──────────┘

┌─────────────────────────────────────────────────────────────┐
│                  SUPER ADMIN DASHBOARD                      │
│  ─────────────────────────────────────────────────────      │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ User Management │  │ System Config   │                  │
│  │ • Create Users  │  │ • Allocation    │                  │
│  │ • Manage Roles  │  │   Weights       │                  │
│  │ • View All Data │  │ • Thresholds    │                  │
│  └─────────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  OPS TEAM DASHBOARD                         │
│  ──────────────────────────────────────────────────          │
│                                                             │
│  ┌────────────┐  ┌────────────┐  ┌─────────────────┐       │
│  │    Case    │  │   Client   │  │   Allocation    │       │
│  │ Management │  │ Management │  │   Monitoring    │       │
│  │            │  │            │  │                 │       │
│  │ • Create   │  │ • Add      │  │ • View Queue    │       │
│  │ • Bulk     │  │   Clients  │  │ • Reassign      │       │
│  │   Import   │  │ • Contracts│  │ • Capacity Map  │       │
│  │ • Manual   │  │ • Rate     │  │ • TAT Monitor   │       │
│  │   Assign   │  │   Cards    │  │                 │       │
│  └────────────┘  └────────────┘  └─────────────────┘       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                VENDOR TEAM DASHBOARD                        │
│  ──────────────────────────────────────────────────          │
│                                                             │
│  ┌────────────┐  ┌────────────┐  ┌─────────────────┐       │
│  │   Vendor   │  │ Gig Worker │  │    Capacity     │       │
│  │ Management │  │ Management │  │   Management    │       │
│  │            │  │            │  │                 │       │
│  │ • Onboard  │  │ • Add Gig  │  │ • Monitor       │       │
│  │   Vendors  │  │   Workers  │  │   Utilization   │       │
│  │ • Coverage │  │ • Set      │  │ • Identify Gaps │       │
│  │   Areas    │  │   Capacity │  │ • Alert Low     │       │
│  └────────────┘  └────────────┘  └─────────────────┘       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    QC TEAM DASHBOARD                        │
│  ──────────────────────────────────────────────────          │
│                                                             │
│  ┌─────────────────────────────────────────────────┐        │
│  │              QC WORKBENCH                       │        │
│  │  ────────────────────────────────────────        │        │
│  │                                                 │        │
│  │  • Review Queue (Pending Cases)                 │        │
│  │  • Evidence Viewer (Photos, GPS, EXIF)          │        │
│  │  • Decision Actions (Pass/Reject/Rework)        │        │
│  │  • Reason Codes & Comments                      │        │
│  │  • Quality Metrics Dashboard                    │        │
│  │  • Reviewer Performance                         │        │
│  └─────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   VENDOR DASHBOARD                          │
│  ──────────────────────────────────────────────────          │
│                                                             │
│  ┌────────────┐  ┌────────────┐  ┌─────────────────┐       │
│  │   Team     │  │    Case    │  │    Payment      │       │
│  │ Management │  │   Assign   │  │    Tracking     │       │
│  │            │  │            │  │                 │       │
│  │ • Add/     │  │ • Assign to│  │ • View Payouts  │       │
│  │   Remove   │  │   Workers  │  │ • Payment Cycle │       │
│  │   Gig      │  │ • Reassign │  │ • Team Earnings │       │
│  │   Workers  │  │ • Monitor  │  │                 │       │
│  └────────────┘  └────────────┘  └─────────────────┘       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              GIG WORKER MOBILE DASHBOARD                    │
│  ──────────────────────────────────────────────────          │
│                                                             │
│  ┌─────────────────────────────────────────────────┐        │
│  │         MY ASSIGNMENTS (Mobile View)            │        │
│  │  ────────────────────────────────────────        │        │
│  │                                                 │        │
│  │  📋 Pending Acceptance                          │        │
│  │     └─ Accept/Reject (30 min timer)             │        │
│  │                                                 │        │
│  │  🏃 In Progress                                  │        │
│  │     ├─ Navigate to Location                     │        │
│  │     ├─ Capture Photos + GPS                     │        │
│  │     ├─ Fill Checklist                           │        │
│  │     └─ Submit Case                              │        │
│  │                                                 │        │
│  │  ✅ Completed                                    │        │
│  │     └─ View History & Earnings*                 │        │
│  │                                                 │        │
│  │  🔄 Rework Required                             │        │
│  │     └─ View Reason & Re-submit                  │        │
│  │                                                 │        │
│  │  *Earnings visible only for direct gigs         │        │
│  └─────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   CLIENT DASHBOARD                          │
│  ──────────────────────────────────────────────────          │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │   Case Status   │  │    Reports      │                  │
│  │                 │  │                 │                  │
│  │ • View Cases    │  │ • Download PDF  │                  │
│  │ • Track Status  │  │ • Excel Export  │                  │
│  │ • SLA Monitor   │  │ • Analytics     │                  │
│  └─────────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 📈 Data Flow Diagram

```
┌────────────────────────────────────────────────────────────┐
│                     FRONTEND (React SPA)                   │
│  ─────────────────────────────────────────────────          │
│                                                            │
│  Components → Services → API Calls → Supabase Client      │
│     ↑                                           ↓          │
│     └─────────── State Management ←─────────────┘          │
│                  (React Query)                             │
└────────────────────────────┬───────────────────────────────┘
                             │
                             │ HTTPS/WSS
                             ↓
┌────────────────────────────────────────────────────────────┐
│                  SUPABASE BACKEND                          │
│  ─────────────────────────────────────────────────          │
│                                                            │
│  ┌────────────┐  ┌────────────┐  ┌─────────────────┐      │
│  │    Auth    │  │  Database  │  │  Edge Functions │      │
│  │   (JWT)    │  │(PostgreSQL)│  │     (Deno)      │      │
│  └────────────┘  └────────────┘  └─────────────────┘      │
│                         │                                  │
│  ┌────────────┐  ┌──────▼──────┐  ┌─────────────────┐     │
│  │  Storage   │  │     RLS     │  │   Real-time     │     │
│  │  (Files)   │  │  Policies   │  │ Subscriptions   │     │
│  └────────────┘  └─────────────┘  └─────────────────┘     │
└────────────────────────────┬───────────────────────────────┘
                             │
                             │ PostgreSQL Protocol
                             ↓
┌────────────────────────────────────────────────────────────┐
│                    DATABASE LAYER                          │
│  ─────────────────────────────────────────────────          │
│                                                            │
│  Tables → Functions → Triggers → Indexes                   │
│                                                            │
│  • 30+ Tables with relationships                           │
│  • 50+ Database functions (PL/pgSQL)                       │
│  • RLS policies for security                               │
│  • Audit triggers for logging                              │
│  • Performance indexes                                     │
└────────────────────────────────────────────────────────────┘

External Integrations:
┌─────────────┐  ┌─────────────┐  ┌─────────────────┐
│    Email    │  │     SMS     │  │    WhatsApp     │
│   Service   │  │   Provider  │  │    (Planned)    │
└─────────────┘  └─────────────┘  └─────────────────┘
       ↑                 ↑                  ↑
       └─────────────────┴──────────────────┘
                         │
              Notification Service Layer
```

---

## 🔐 Security Flow

```
┌──────────────────────────────────────────────────────────┐
│              SECURITY ARCHITECTURE                       │
└──────────────────────────────────────────────────────────┘

1. AUTHENTICATION
   ┌─────────────┐
   │   User      │
   │   Login     │
   └──────┬──────┘
          │
          ▼
   ┌─────────────────┐
   │ Supabase Auth   │
   │ • Email/Password│
   │ • JWT Token     │
   └────────┬────────┘
            │
            ▼
   ┌─────────────────┐
   │  Verify Token   │
   │  Check Profile  │
   └────────┬────────┘
            │
            ▼

2. AUTHORIZATION (Role-Based)
   ┌──────────────────────────────────────┐
   │         Check User Role              │
   ├──────────────────────────────────────┤
   │                                      │
   │  Super Admin → All Access            │
   │  Ops Team    → Cases, Clients        │
   │  Vendor Team → Vendors, Gig Workers  │
   │  QC Team     → QC Queue              │
   │  Vendor      → Own Team Data         │
   │  Gig Worker  → Own Cases             │
   │  Client      → Own Cases Only        │
   └──────────────┬───────────────────────┘
                  │
                  ▼

3. ROW LEVEL SECURITY (RLS)
   ┌─────────────────────────────────────┐
   │    Database RLS Policies            │
   ├─────────────────────────────────────┤
   │                                     │
   │  SELECT Policy:                     │
   │    → User can only see allowed rows │
   │                                     │
   │  INSERT Policy:                     │
   │    → User can only create allowed   │
   │                                     │
   │  UPDATE Policy:                     │
   │    → User can only modify allowed   │
   │                                     │
   │  DELETE Policy:                     │
   │    → User can only delete allowed   │
   └─────────────┬───────────────────────┘
                 │
                 ▼

4. DATA ACCESS
   ┌──────────────────────────────────────┐
   │       Execute Query                  │
   │  • RLS automatically enforced        │
   │  • Returns only authorized data      │
   │  • Audit log created                 │
   └──────────────────────────────────────┘
```

---

## 📊 Key Performance Indicators (KPIs)

```
┌──────────────────────────────────────────────────────────┐
│                  PERFORMANCE METRICS                     │
└──────────────────────────────────────────────────────────┘

ALLOCATION METRICS
├─ Auto-Allocation Success Rate:  > 90%
├─ Average Acceptance Time:       < 15 minutes
├─ Reallocation Rate:              < 10%
└─ Capacity Utilization:          > 80%

QUALITY METRICS
├─ QC Pass Rate:                  > 90%
├─ Average Review Time:           < 30 minutes
├─ Rework Rate:                   < 5%
└─ Quality Score (Avg):           > 85%

OPERATIONAL METRICS
├─ TAT Compliance:                > 95%
├─ Cases per Day:                 Tracking
├─ Worker Productivity:           Tracking
└─ Client Satisfaction:           > 90%

FINANCIAL METRICS
├─ Payment Accuracy:              > 99%
├─ Processing Time:               < 2 days
├─ Adjustment Rate:               < 2%
└─ Cost per Case:                 Tracking

TECHNICAL METRICS
├─ System Uptime:                 > 99.9%
├─ API Response Time:             < 200ms
├─ Page Load Time:                < 2s
└─ Error Rate:                    < 0.1%
```

---

## 🎯 Quick Reference: Who Does What

| User Role | Primary Actions | Key Screens |
|-----------|----------------|-------------|
| **Super Admin** | Create users, manage system config | User Management, System Settings |
| **Ops Team** | Create cases, manage clients, monitor allocation | Case List, Client Management, Allocation Dashboard |
| **Vendor Team** | Onboard vendors, manage gig workers, monitor capacity | Vendor Management, Gig Worker Management, Capacity Dashboard |
| **QC Team** | Review submissions, pass/reject cases | QC Workbench, Review Queue |
| **Vendor** | Manage team, assign cases, view payments | Team Dashboard, Case Assignment, Payment Tracking |
| **Gig Worker** | Accept cases, execute field work, submit evidence | Mobile Dashboard, Case Details, Photo Capture |
| **Client** | View case status, download reports | Case Status, Reports Portal |

---

**Document Version**: 1.0  
**Created**: October 14, 2025  
**Purpose**: Visual flowchart and system flow documentation




