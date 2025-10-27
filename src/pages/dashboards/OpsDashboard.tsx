import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Users, Clock, CheckCircle, ArrowRight, Target } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DashboardStatsService, DashboardStats } from '@/services/dashboardStatsService';

export default function OpsDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalCases: 0,
    activeClients: 0,
    pendingCases: 0,
    completedCases: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      try {
        const dashboardStats = await DashboardStatsService.getOpsDashboardStats();
        setStats(dashboardStats);
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Cases</CardTitle>
            <div className="p-2 rounded-lg bg-blue-50">
              <FileText className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {isLoading ? '-' : stats.totalCases.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">All verification cases</p>
          </CardContent>
        </Card>

        <Card className="card-modern">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Clients</CardTitle>
            <div className="p-2 rounded-lg bg-green-50">
              <Users className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {isLoading ? '-' : stats.activeClients.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Registered clients</p>
          </CardContent>
        </Card>

        <Card className="card-modern">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Cases</CardTitle>
            <div className="p-2 rounded-lg bg-yellow-50">
              <Clock className="h-4 w-4 text-yellow-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {isLoading ? '-' : stats.pendingCases.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting assignment</p>
          </CardContent>
        </Card>

        <Card className="card-modern">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            <div className="p-2 rounded-lg bg-emerald-50">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {isLoading ? '-' : stats.completedCases.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Completed cases</p>
          </CardContent>
        </Card>
      </div>

      <Card className="card-modern">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl font-bold text-foreground">Operations Dashboard</CardTitle>
          <CardDescription className="text-base">
            Manage cases, clients, and operations efficiently
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-3 p-4 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200">
              <h3 className="text-lg font-semibold text-blue-900">Case Management</h3>
              <p className="text-sm text-blue-700">
                Create, manage, and track background verification cases
              </p>
              <Button onClick={() => navigate('/ops/cases')} className="w-full btn-primary">
                Manage Cases
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-3 p-4 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200">
              <h3 className="text-lg font-semibold text-purple-900">Allocation Engine</h3>
              <p className="text-sm text-purple-700">
                Manage case allocation and gig worker capacity
              </p>
              <Button onClick={() => navigate('/ops/allocation')} className="w-full btn-primary">
                <Target className="mr-2 h-4 w-4" />
                Manage Allocation
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-3 p-4 rounded-lg bg-gradient-to-br from-green-50 to-green-100 border border-green-200">
              <h3 className="text-lg font-semibold text-green-900">Client Management</h3>
              <p className="text-sm text-green-700">
                Manage client accounts and settings
              </p>
              <Button variant="outline" className="w-full btn-secondary" onClick={() => navigate('/ops/clients')}>
                Manage Clients
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
            <div 
              className="space-y-3 p-4 rounded-lg bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate('/ops/client-contracts')}
            >
              <h3 className="text-lg font-semibold text-orange-900">Rate Cards & Contracts</h3>
              <p className="text-sm text-orange-700">
                Manage pricing and client contracts
              </p>
              <Button variant="outline" className="w-full btn-secondary" onClick={() => navigate('/ops/client-contracts')}>
                Manage Rate Cards
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}