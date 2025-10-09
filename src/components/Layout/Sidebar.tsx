import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  Users,
  FileText,
  UserCheck,
  Building2,
  Briefcase,
  MapPin,
  BarChart3,
  Settings,
  LayoutDashboard,
  MapPinIcon,
  DollarSign,
  FileTextIcon,
  Tag,
  UserCog,
} from 'lucide-react';

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const { user } = useAuth();
  const location = useLocation();

  const getMenuItems = () => {
    if (!user) return [];

    const role = user.profile.role;
    
    switch (role) {
      case 'super_admin':
        return [
          { icon: Users, label: 'Team Management', href: '/admin/team' },
          { icon: Settings, label: 'System Settings', href: '/admin/settings' },
          { icon: BarChart3, label: 'Analytics', href: '/admin/analytics' },
        ];
      
      case 'ops_team':
        return [
          { icon: LayoutDashboard, label: 'Dashboard', href: '/ops' },
          { icon: FileText, label: 'Cases', href: '/ops/cases' },
          { icon: Users, label: 'Clients', href: '/ops/clients' },
          { icon: FileTextIcon, label: 'Client Contracts', href: '/ops/client-contracts' },
          { icon: Tag, label: 'Contract Types', href: '/ops/contract-types' },
          { icon: MapPinIcon, label: 'Pincode Tiers', href: '/ops/pincode-tiers' },
          { icon: UserCog, label: 'Gig Workers', href: '/ops/gig-workers' },
          { icon: BarChart3, label: 'Reports', href: '/ops/reports' },
          { icon: MapPin, label: 'Assignments', href: '/ops/assignments' },
        ];
      
      case 'vendor_team':
        return [
          { icon: Building2, label: 'Vendors', href: '/vendor-team/vendors' },
          { icon: Briefcase, label: 'Gig Workers', href: '/vendor-team/gig-workers' },
          { icon: FileText, label: 'Assignments', href: '/vendor-team/assignments' },
          { icon: BarChart3, label: 'Performance', href: '/vendor-team/performance' },
        ];
      
      case 'qc_team':
        return [
          { icon: UserCheck, label: 'Quality Review', href: '/qc/review' },
          { icon: FileText, label: 'Cases', href: '/qc/cases' },
          { icon: BarChart3, label: 'Reports', href: '/qc/reports' },
        ];
      
      case 'vendor':
        return [
          { icon: Briefcase, label: 'My Gig Workers', href: '/vendor/gig-workers' },
          { icon: FileText, label: 'Assignments', href: '/vendor/assignments' },
          { icon: BarChart3, label: 'Performance', href: '/vendor/performance' },
        ];
      
      case 'gig_worker':
        return [
          { icon: FileText, label: 'My Tasks', href: '/gig/tasks' },
          { icon: MapPin, label: 'Active Assignment', href: '/gig/active' },
          { icon: BarChart3, label: 'Earnings', href: '/gig/earnings' },
        ];
      
      case 'client':
        return [
          { icon: FileText, label: 'My Cases', href: '/client/cases' },
          { icon: BarChart3, label: 'Reports', href: '/client/reports' },
        ];
      
      default:
        return [];
    }
  };

  const menuItems = getMenuItems();

  return (
    <div className="flex h-screen flex-col gradient-sidebar w-full text-sidebar-foreground">
      <div className="p-6 border-b border-sidebar-border">
        <h2 className="text-xl font-bold text-sidebar-foreground flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
            <span className="text-white font-bold text-sm">BG</span>
          </div>
          <span className="text-sidebar-foreground">BG Verification</span>
        </h2>
      </div>
      
      <nav className="flex-1 px-6 py-6">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;
            
            return (
              <li key={item.href}>
                <Link
                  to={item.href}
                  onClick={onNavigate}
                  className={cn(
                    'sidebar-item text-sidebar-foreground',
                    isActive && 'sidebar-item-active'
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0 text-sidebar-foreground" />
                  <span className="flex-1 text-left text-sidebar-foreground">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}