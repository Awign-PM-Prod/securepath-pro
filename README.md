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