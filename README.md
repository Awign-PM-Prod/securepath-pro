# Background Verification System

A comprehensive background verification task management platform with role-based access control.

## 🚀 Quick Start

### Step 1: Create First Super Admin User

Since this is a secure system with no public signup, create the first admin user manually:

**Using Supabase Dashboard** (Recommended):
1. Go to [Supabase Dashboard → Authentication → Users](https://supabase.com/dashboard/project/ycbftnwzoxktoroqpslo/auth/users)
2. Click "Add user" 
3. Fill in:
   - **Email**: `admin@bgverification.com`
   - **Password**: `admin123` 
   - **User Metadata** (Important - copy exactly):
   ```json
   {
     "first_name": "System", 
     "last_name": "Administrator", 
     "role": "super_admin"
   }
   ```
4. Click "Create user"

### Step 2: Login & Test System
1. Visit the app and click "Sign In to Continue"
2. Login with: `admin@bgverification.com` / `admin123`
3. You'll be redirected to the Super Admin dashboard
4. Use "Add User" button to create team members

## 👥 User Roles & Capabilities

| Role | Access | Can Create | Key Features |
|------|--------|------------|-------------|
| **Super Admin** | Web | ops_team, vendor_team, qc_team | Full system control |
| **Operations Team** | Web | client | Case management, client management |
| **Vendor Team** | Web + Mobile | vendor, gig_worker | Vendor & workforce management |
| **QC Team** | Web | - | Quality control and case review |
| **Vendor** | Web + Mobile | gig_worker | Manage own gig workers |
| **Gig Worker** | Mobile-optimized | - | Execute verification tasks |
| **Client** | Web | - | View reports and case status |

## 🔧 System Architecture

**Security Features:**
- ✅ No public signup (admin-created accounts only)
- ✅ Role-based access control (RLS policies)
- ✅ Secure user creation via edge functions
- ✅ Mobile-optimized responsive design
- ✅ Protected routes and navigation

**Technology Stack:**
- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Supabase (Auth, Database, Edge Functions)
- **UI Components**: shadcn/ui
- **Mobile**: Container-ready for Capacitor deployment

## 📱 Mobile Support

- Responsive design optimized for gig workers
- Touch-friendly interfaces on all devices  
- Ready for future Capacitor app packaging
- Bottom navigation for mobile users

## 🔐 Authentication Flow

1. **Login Only** - No public registration
2. **Role Detection** - Automatic dashboard routing
3. **Permission Checks** - Database-level security
4. **Session Management** - Persistent login state

## 📋 Next Steps (Phase 2)

- [ ] Case management system
- [ ] File upload & GPS tracking
- [ ] Payment processing integration
- [ ] Advanced reporting & analytics
- [ ] Email intake & bulk operations
- [ ] Mobile app packaging

## 🛠 Development

### Local Development
```bash
npm install
npm run dev
```

### Project Structure
```
src/
├── components/Layout/     # App shell and navigation
├── components/UserManagement/  # User CRUD operations  
├── pages/dashboards/      # Role-specific dashboards
├── contexts/AuthContext   # Authentication state
└── types/auth.ts         # TypeScript definitions

supabase/
├── functions/create-user/ # Secure user creation
└── migrations/           # Database schema
```

## 📞 Support

- Check console logs for debugging
- Verify Supabase project configuration
- Ensure proper user metadata format when creating users
- Test with different screen sizes for mobile optimization

---

**Lovable Project URL**: https://lovable.dev/projects/01985c74-f1b4-41b5-845b-5825d1d3cecd



Detailed Solution:
Background Verification Platform — Solution Document (with Capacity, Email Intake, Rate Cards)
1) Purpose & Outcomes
Build a web + mobile platform to run background-verification cases (aka “tickets”) from intake → capacity-aware auto-allocation → field execution → QC → reporting → payouts, with:
Dynamic, capacity-aware auto-allocation that respects per-gig max capacity during the day, freeing slots as they finish cases.


Quality as a ranking factor (QC pass performance).


Automated email intake to create cases from a dedicated inbox.


Rate cards by pincode tier + completion-time slabs, with Ops overrides and post-assignment travel/bonus offers.


Client defaults and contracts (default TATs, SLAs).


Vendor-managed gig teams (add/remove, assign/reassign), payment routing (vendor vs direct gig), and rate visibility rules on mobile.



2) User Roles
Client (Phase 2 portal): Submit/view cases, download reports; defaults from client contract.


Ops Team: Intake (manual/bulk/email automation), oversee auto-allocation, handle exceptions, TAT & quality monitoring, payouts.


Vendor Management Team (VMT): Ensure supply coverage; respond to unallocated or low-capacity regions; onboard vendors/gigs.


QC Team: Review submissions; Pass/Reject/Rework; enforce quality policy.


Vendor (Org): Manage gig roster (add/remove), assign/reassign cases within its team; receives payments for vendor-routed work.


Gig Partner (Field): Accept/execute cases on mobile; if direct (not via vendor), they see task earnings; if via vendor, rate hidden.



3) Core Modules
Case Intake


Manual single/bulk (CSV).


Email Automation (Phase 1): Parse a dedicated inbox to create cases.


(Phase 2) Client portal/API.


Capacity-Aware Auto-Allocation & Reallocation


Rank by pincode coverage, capacity availability, performance, quality (QC pass), distance/ETA (optional).


Respect per-gig dynamic capacity; free capacity when a case is Submitted/QC-passed (configurable).


Case Acceptance & Execution (Mobile for gig/vendor).


QC Workbench (web).


Rate Cards & Pricing


Pincode tier × completion-time slab; Ops override + post-assignment travel/bonus offers.


Tracking & Alerts


Live status, TAT risk, capacity gaps, email-parsing failures.


Reporting & Payments


Client/ops reports; bi-weekly payouts with routing (vendor vs direct gig).



4) Lifecycle & States
Created → Auto-Allocated → Pending Acceptance → Accepted → In-Progress → Submitted → QC (Pass/Reject/Rework) → Completed → Reported → In Payment Cycle
Transitions:
Acceptance SLA timer ⇒ reallocate if timeout/reject.


Capacity: On “Accepted” consume 1 slot of assignee; on Submitted/QC-Pass free 1 slot.


QC Reject/Rework loops back to assignee; capacity remains occupied (configurable: hold or free on Reject).



5) Capacity-Aware Auto-Allocation Engine
Inputs
Coverage: pincode match and active service area.


Capacity: capacity_available > 0 at allocation time.


Performance & Quality:


Completion rate (last N cases)


On-time completion rate (TAT adherence)


QC pass rate (quality)


Optional: recent load, distance/ETA, vendor priority.


Scoring (example, configurable)
Quality (QC pass): 0.35


Completion rate: 0.25


On-time completion: 0.25


Acceptance rate: 0.15
 (Tie-breakers: lower active load, closer distance, vendor priority)


Flow
Build candidate set by pincode & active status.


Filter for capacity_available > 0.


Rank by score; allocate to top candidate.


Start acceptance window (e.g., 30 min) → nudge → on timeout/reject auto-reallocate.


If no capacity anywhere → Unallocated → alert VMT (with pincode & demand).


Capacity Model
max_daily_capacity per gig (dynamic, editable by vendor/ops).


capacity_available = max_daily_capacity − active_assigned_count (+ configurable rule for when to free).


Capacity resets daily at a configured time; mid-day increases when cases move past the configured freeing state.



6) Rate Cards & Pricing Logic
Rate Card
Dimensions:


Pincode Tier (e.g., Tier-1 metro, Tier-2 city, Tier-3 town/rural).


Completion-time slab (e.g., within 24h, 48h, 72h).


Fields: base_rate_in_inr, optional travel_allowance_default, bonus_default.


Overrides & Incentives
Ops override at creation (set custom rate, TAT → picks slab).


Post-assignment incentives: add travel or bonus to accelerate acceptance/completion; recorded as adjustments on the case payout.


Visibility rule (mobile):


Direct gigs: show total earning (base + incentive).


Vendor-routed gigs: hide rate; display “via vendor”.



7) Email Intake Automation (Phase 1)
Dedicated email (e.g., tickets@company.com).


Ingestion service (Gmail/IMAP/Graph):


Poll inbox, parse structured attachments (CSV/JSON/PDF) or email body (regex/templates).


Extract: client, subject, description, address, pincode (or geocode), TAT (if given), priority, attachments.


Create Case and trigger auto-allocation.


Error handling:


Unknown client → route to Ops review.


Parse failure → create Email Intake Error alert with original msg link.


Security: allow-listed sender domains per client.



8) Client Defaults & Contracts
Client Profile stores: default TAT(s) per case type, rate card mapping, allowed channels (email/drive/API), escalation contacts, SLA terms, report delivery preference (portal/email/webhook), contract effective dates.


On case creation (any channel), defaults apply unless overridden per case.



9) Vendor & Gig Management
Vendor Admin (web & mobile manager view):


Add/Remove gig partners (KYC, coverage pincodes, daily capacity).


Assign/Reassign cases within vendor’s roster (within capacity/security bounds).


View team metrics (load, acceptance, on-time, quality).


Payment Routing:


Vendor cases: payout to vendor; vendor handles intra-team split.


Direct gigs: payout to gig.


Visibility:


Vendors see negotiated vendor rates; gigs under vendors do not see task rates.



10) Workflows (Swimlane Summary)
Intake (Ops + System)
Email arrives → parse → Case created → pincode geocoded if needed → auto-allocate.


Manual single/bulk: same creation path → auto-allocate.


Allocation & Capacity
Engine ranks eligible + capacity_available candidates → allocate → acceptance timer.


On accept: consume capacity; on submission/QC-pass (configurable), free capacity.


On reject/timeout: auto-reallocate; on exhaustion: raise Unallocated alert to VMT.


Field Execution (Gig/Vendor Mobile)
Receive assignment → (Direct gig sees pay; vendor-gig does not) → accept → navigate → capture images, GPS, answers → submit.


QC (Web)
Queue → open → validate GPS/EXIF/checklist → Pass/Reject/Rework with reason codes.


Rework: notify assignee; capacity rule applied per config (hold/free).


Reporting & Payments
Case report generated on QC Pass → delivered per client setting.


Bi-weekly payout run → route based on assignment type (vendor vs direct gig).


Adjustments from overrides/bonus captured in payout lines.



11) Data Model (Key Entities)
Case
case_id (UUID), client_id, title, description, priority, attachments[]


Location: address_line, city, state, country, pincode, lat, lng


SLA: tat_hours (default from client or override), due_at


Rates: rate_card_id (nullable), rate_base_inr, rate_adjustments {travel_inr, bonus_inr, override_reason}, visible_to_gig (bool depends on assignment_type)


Status: lifecycle enum


Assignment: assignee_id, assignee_type (GIG|VENDOR), vendor_id (nullable)


Audit: source (manual|bulk|email|api), created_at/by, last_updated_at/by


Submission
submission_id, case_id, assignee_id, submitted_at, photos[] {url, lat, lng, ts}, answers (JSON), notes, device_info


QC Review
qc_id, case_id, reviewer_id, result (PASS|REJECT|REWORK), reason_code, comments, reviewed_at


Allocation Log
allocation_id, case_id, candidate_id, allocated_at, accepted_at, decision (Accepted|Rejected|Timeout), wave_number, score_snapshot


Gig Partner
gig_id, name, phone, coverage_pincodes[], max_daily_capacity, capacity_available, last_reset_at, performance {completion_rate, ontime_rate, acceptance_rate}, quality {qc_pass_rate, qc_pass_count}, active


Vendor
vendor_id, name, coverage_pincodes[], performance_score, quality {qc_pass_rate, qc_pass_count}, active, payout_bank, roster_size


Client
client_id, name, default_tats {case_type → hours}, contract {start, end, terms, escalation_contacts[], rate_card_policy}, report_delivery (portal|email|webhook), ingestion {email, drive, api}


Rate Card
rate_card_id, client_id (nullable for global), pincode_tier (T1|T2|T3), completion_slab (24h|48h|72h|… ), base_rate_inr, default_travel_inr (optional), default_bonus_inr (optional)


Payment Line
payout_id, cycle_tag, beneficiary_type (VENDOR|GIG), beneficiary_id, case_id,
 base_rate_inr, adjustments {travel_inr, bonus_inr, ops_override_delta}, total_inr, status (Pending|Ready|Disbursed), timestamps


Email Intake Log
email_id, received_at, sender, subject, parse_status (Success|Failed|Quarantined), case_id (nullable), error_details



12) UI — Key Screens (Web)
Ops Dashboard: Allocation %, Avg acceptance time, TAT risk, Capacity heatmap by pincode, Unallocated queue, Email-intake errors.


Create Case (single/bulk): Address + geocoding, client defaults (TAT) prefilled, rate card auto-select, override controls, post-assignment travel/bonus.


Allocation Console: Pending Acceptance with timers, capacity badges (X/Y), reassign & nudge, ranked candidates (with quality %).


Case Detail: Timeline, SLA ticks, current payout breakdown (base + adjustments), visibility badge (direct vs vendor).


QC Workbench: Evidence viewer (EXIF/GPS), quick actions, reason codes, rework loop.


Vendor Mgmt: Vendors list, Add/Remove gig, set per-gig max capacity, bulk pincode coverage, vendor internal assign/reassign.


Payments: Cycle summary; routing by assignment type; exports (CSV/PDF).


Email Intake: Source inbox status, last parsed items, retry on failures.



13) Mobile (Gig/Vendor)
Gig (Direct): Sees earning for each assignment (base + bonus/travel, if any).


Gig (Via Vendor): No earnings display (shows “via vendor”); rest identical.


Common: Assignments with acceptance timer, map & nav deeplink, guided checklist, photo capture (min count, anti-blur), GPS lock, offline queue & auto-sync, rework tasks.



14) Notifications & Alerts
Channels: SMS, WhatsApp, IVR, push, email.


Key events: Allocation, acceptance reminders, reallocation, QC results, capacity low in region, email parse failures, TAT risk/breach, report ready, payout posted.


Templates support variables (case_id, pincode, tat_hours, deeplink, etc.) and language.



15) Policies & Business Rules
Capacity Consumption Point: Default at Accept; free on Submitted or QC Pass (choose one per policy).


Quality Minimums: Optional threshold (e.g., QC pass ≥ 85%) to remain eligible for auto-allocation.


Overrides: Ops can override rate/TAT; overrides are fully audited.


Visibility: Earnings visible only for direct gigs.



16) Reporting & KPIs
Ops: Allocation within SLA %, acceptance time, capacity utilization (per pincode/vendor/gig), QC pass %, rework rate, TAT breaches, email-intake success rate.


Client: Case status dashboards, turnaround adherence, QC outcomes, geography split.


Finance: Payout summaries (vendor vs gig), adjustments (travel/bonus/overrides).



17) Phase Plan
Phase 1 (now includes)
Manual/bulk and email intake automation.


Capacity-aware auto-allocation & reallocation with quality factor.


Gig/Vendor mobile apps (visibility rules).


QC workbench.


Rate cards (by pincode tier & completion slab) + Ops overrides + post-assignment travel/bonus.


Client defaults & contracts (used in backend; basic admin UI).


Payments (bi-weekly) with routing (vendor vs gig).


Alerts & notifications.


Phase 2
Client self-serve portal & API for creation and reports.


Advanced analytics (capacity forecasting, quality trendlines).


Webhooks to client systems.



18) Integrations
Email: Gmail/IMAP/Graph API for intake; secure service account; parse engines (structured templates + fallback regex).


Maps/Geo: Google Geocoding/Reverse Geocoding; static maps in reports.


Comms: WhatsApp/SMS/IVR providers; email delivery.


Storage: Signed URLs for media; CDN.


Auth: OTP for gigs; SSO for staff (optional).



19) Security & Audit
RBAC by role & assignment type; vendors cannot see other vendors’ data.


PII encrypted at rest; transport TLS.


Audit log for all allocation, overrides, payouts, visibility decisions.


Image integrity (timestamps, optional watermarking); GPS spoof flags.



20) Edge Cases
Capacity zero but high demand: auto-escalate to VMT + vendor recruitment callout.


Email attachments malformed: quarantine + Ops review pipeline.


Address → bad geocode: QC flag; fallback to manual pincode selection.


Rework loops: cap max loops; alert Ops on repeated rejects.


Vendor removes gig mid-case: auto-reallocate; notify Ops.



21) Configurations (Admin)
Allocation weights (quality/perf), acceptance window.


Capacity rules (consume/free points, reset time).


Default TATs per client/case type.


Rate card tiers and slabs; incentives policy & caps.


QC reason codes & mandatory comments.


Notification templates + channels.


Payment cycles & rounding rules.



