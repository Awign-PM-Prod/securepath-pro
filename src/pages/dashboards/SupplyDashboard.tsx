import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, UserPlus, Building2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface SupplyStats {
  totalVendors: number;
  activeVendors: number;
  totalGigWorkers: number;
  activeGigWorkers: number;
}

export default function SupplyDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<SupplyStats>({
    totalVendors: 0,
    activeVendors: 0,
    totalGigWorkers: 0,
    activeGigWorkers: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      try {
        // Get total vendors count
        const { count: totalVendors } = await supabase
          .from('vendors')
          .select('*', { count: 'exact', head: true });

        // Get active vendors count
        const { count: activeVendors } = await supabase
          .from('vendors')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);

        // Get total gig workers count
        const { count: totalGigWorkers } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'gig_worker');

        // Get active gig workers count
        const { count: activeGigWorkers } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'gig_worker')
          .eq('is_active', true);

        setStats({
          totalVendors: totalVendors || 0,
          activeVendors: activeVendors || 0,
          totalGigWorkers: totalGigWorkers || 0,
          activeGigWorkers: activeGigWorkers || 0,
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="card-modern">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Vendors</CardTitle>
            <div className="p-2 rounded-lg bg-blue-50">
              <Building2 className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {isLoading ? '-' : stats.totalVendors.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">All registered vendors</p>
          </CardContent>
        </Card>

        <Card className="card-modern">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Vendors</CardTitle>
            <div className="p-2 rounded-lg bg-green-50">
              <Building2 className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {isLoading ? '-' : stats.activeVendors.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Currently active vendors</p>
          </CardContent>
        </Card>

        <Card className="card-modern">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Gig Workers</CardTitle>
            <div className="p-2 rounded-lg bg-purple-50">
              <Users className="h-4 w-4 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {isLoading ? '-' : stats.totalGigWorkers.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">All registered gig workers</p>
          </CardContent>
        </Card>

        <Card className="card-modern">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Gig Workers</CardTitle>
            <div className="p-2 rounded-lg bg-emerald-50">
              <UserPlus className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {isLoading ? '-' : stats.activeGigWorkers.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Currently active gig workers</p>
          </CardContent>
        </Card>
      </div>

      <Card className="card-modern">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl font-bold text-foreground">Supply Team Dashboard</CardTitle>
          <CardDescription className="text-base">
            Manage vendors and gig workers efficiently
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3 p-4 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200">
              <h3 className="text-lg font-semibold text-blue-900">Vendor Management</h3>
              <p className="text-sm text-blue-700">
                Create, manage, and track vendor accounts and their information
              </p>
              <Button onClick={() => navigate('/supply/vendors')} variant="outline" className="w-full bg-white hover:bg-blue-600 hover:text-white hover:border-blue-600">
                Manage Vendors
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-3 p-4 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200">
              <h3 className="text-lg font-semibold text-purple-900">Gig Worker Management</h3>
              <p className="text-sm text-purple-700">
                Create, manage, and track gig worker accounts, capacity, and coverage areas
              </p>
              <Button onClick={() => navigate('/supply/gig-workers')} variant="outline" className="w-full bg-white hover:bg-purple-600 hover:text-white hover:border-purple-600">
                Manage Gig Workers
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

