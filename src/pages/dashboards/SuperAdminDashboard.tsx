import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Building2, UserCheck, Briefcase } from 'lucide-react';
import { UserList } from '@/components/UserManagement/UserList';
import { supabase } from '@/integrations/supabase/client';

interface SuperAdminStats {
  opsUsers: number;
  vendors: number;
  qcTeamMembers: number;
  gigWorkers: number;
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<SuperAdminStats>({
    opsUsers: 0,
    vendors: 0,
    qcTeamMembers: 0,
    gigWorkers: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      try {
        // Get Ops Users count (ops_team role)
        const { count: opsUsers } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'ops_team')
          .eq('is_active', true);

        // Get Vendors count
        const { count: vendors } = await supabase
          .from('vendors')
          .select('*', { count: 'exact', head: true });

        // Get QC Team Members count (qc_team role)
        const { count: qcTeamMembers } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'qc_team')
          .eq('is_active', true);

        // Get Gig Workers count (gig_worker role)
        const { count: gigWorkers } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'gig_worker')
          .eq('is_active', true);

        setStats({
          opsUsers: opsUsers || 0,
          vendors: vendors || 0,
          qcTeamMembers: qcTeamMembers || 0,
          gigWorkers: gigWorkers || 0,
        });
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ops Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '-' : stats.opsUsers.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Operations team members</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendors</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '-' : stats.vendors.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Registered vendors</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">QC Team Members</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '-' : stats.qcTeamMembers.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Quality control team</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gig Workers</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '-' : stats.gigWorkers.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Active gig workers</p>
          </CardContent>
        </Card>
      </div>

      {/* User Management Section */}
      <UserList />
    </div>
  );
}