import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Users, Clock, CheckCircle, MapPin, Building2, Target, Briefcase } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter } from 'date-fns';
import { DateRange } from 'react-day-picker';

interface ManageStats {
  // Cases
  casesTotal: number;
  casesApproved: number;
  casesRejected: number;
  casesRework: number;
  // Allocations
  allocationsTotal: number;
  allocationsSuccessful: number;
  allocationsPending: number;
  capacityUtilization: number;
  // Clients
  activeClients: number;
  inactiveClients: number;
  newClients: number;
  // Contracts
  activeContracts: number;
  totalBonuses: number;
  totalPenalties: number;
  // Pincodes
  totalPincodes: number;
  tier1Pincodes: number;
  tier2Pincodes: number;
  tier3Pincodes: number;
  // Vendors
  activeVendors: number;
  totalGigWorkers: number;
  vendorTotalCases: number;
  avgQualityScore: number;
}

type DateFilterType = 'all' | 'this_week' | 'this_month' | 'this_quarter' | 'custom';

export default function OpsDashboard() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilterType>('all');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Top-level dashboard stats (affected by date filter)
  const [totalCases, setTotalCases] = useState(0);
  const [pendingCases, setPendingCases] = useState(0);
  const [completedCases, setCompletedCases] = useState(0);
  const [activeClientsCount, setActiveClientsCount] = useState(0);

  // Manage section stats
  const [manageStats, setManageStats] = useState<ManageStats>({
    casesTotal: 0, casesApproved: 0, casesRejected: 0, casesRework: 0,
    allocationsTotal: 0, allocationsSuccessful: 0, allocationsPending: 0, capacityUtilization: 0,
    activeClients: 0, inactiveClients: 0, newClients: 0,
    activeContracts: 0, totalBonuses: 0, totalPenalties: 0,
    totalPincodes: 0, tier1Pincodes: 0, tier2Pincodes: 0, tier3Pincodes: 0,
    activeVendors: 0, totalGigWorkers: 0, vendorTotalCases: 0, avgQualityScore: 0,
  });

  const cutoffDate = '2025-11-02T00:00:00.000Z';

  const getDateRange = (): { from: string; to: string } | null => {
    const now = new Date();
    switch (dateFilter) {
      case 'this_week': {
        const start = startOfWeek(now, { weekStartsOn: 1 });
        return { from: start.toISOString(), to: now.toISOString() };
      }
      case 'this_month': {
        const start = startOfMonth(now);
        return { from: start.toISOString(), to: now.toISOString() };
      }
      case 'this_quarter': {
        const start = startOfQuarter(now);
        return { from: start.toISOString(), to: now.toISOString() };
      }
      case 'custom': {
        if (customDateRange?.from) {
          const from = customDateRange.from;
          const to = customDateRange.to || now;
          return { from: from.toISOString(), to: to.toISOString() };
        }
        return null;
      }
      default:
        return null;
    }
  };

  const customDateLabel = useMemo(() => {
    if (dateFilter !== 'custom' || !customDateRange?.from) return 'Custom Date';
    const from = format(customDateRange.from, 'dd MMM');
    const to = customDateRange.to ? format(customDateRange.to, 'dd MMM') : 'now';
    return `Custom Date (${from} - ${to})`;
  }, [dateFilter, customDateRange]);

  useEffect(() => {
    let cancelled = false;

    const fetchAllStats = async () => {
      setIsLoading(true);
      try {
        const dateRange = getDateRange();

        // Build case queries with optional date filter
        const buildCaseQuery = (query: any) => {
          let q = query.eq('is_active', true).gte('created_at', cutoffDate);
          if (dateRange) {
            q = q.gte('created_at', dateRange.from).lte('created_at', dateRange.to);
          }
          return q;
        };

        // Fetch all stats in parallel
        const [
          totalCasesResult,
          pendingCasesResult,
          completedCasesResult,
          activeClientsResult,
          // Cases breakdown for manage section
          casesByStatusResult,
          // Allocation stats
          allocationCasesResult,
          capacityResult,
          // Clients
          allClientsResult,
          newClientsResult,
          // Contracts
          activeContractsResult,
          // Pincodes
          totalPincodesResult,
          tier1PincodesResult,
          tier2PincodesResult,
          tier3PincodesResult,
          // Vendors
          activeVendorsResult,
          totalGigWorkersResult,
          vendorsDataResult,
        ] = await Promise.all([
          // Dashboard top cards
          buildCaseQuery(supabase.from('cases').select('*', { count: 'exact', head: true })),
          buildCaseQuery(supabase.from('cases').select('*', { count: 'exact', head: true })).in('status', ['new', 'pending_allocation']),
          buildCaseQuery(supabase.from('cases').select('*', { count: 'exact', head: true })).in('status', ['qc_passed', 'reported', 'payment_complete']),
          supabase.from('clients').select('*', { count: 'exact', head: true }).eq('is_active', true),
          // Cases by QC response for donut chart
          buildCaseQuery(supabase.from('cases').select('status, QC_Response')),
          // Allocation stats: all non-new cases
          buildCaseQuery(supabase.from('cases').select('id, status')),
          // Capacity utilization
          supabase.from('capacity_tracking').select('max_daily_capacity, current_capacity_available').eq('is_active', true),
          // All clients for active/inactive
          supabase.from('clients').select('id, is_active, created_at'),
          // New clients (last 30 days)
          supabase.from('clients').select('*', { count: 'exact', head: true }).gte('created_at', subDays(new Date(), 30).toISOString()),
          // Active contracts
          supabase.from('client_contracts').select('*', { count: 'exact', head: true }).eq('is_active', true),
          // Pincodes
          supabase.from('pincode_tiers').select('*', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('pincode_tiers').select('*', { count: 'exact', head: true }).eq('is_active', true).eq('tier', 'tier1'),
          supabase.from('pincode_tiers').select('*', { count: 'exact', head: true }).eq('is_active', true).eq('tier', 'tier2'),
          supabase.from('pincode_tiers').select('*', { count: 'exact', head: true }).eq('is_active', true).eq('tier', 'tier3'),
          // Vendors
          supabase.from('vendors').select('*', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'gig_worker').eq('is_active', true),
          supabase.from('vendors').select('total_cases_assigned, quality_score').eq('is_active', true),
        ]);

        // Don't update state if effect was cleaned up (component unmounted or deps changed)
        if (cancelled) return;

        // Top-level stats
        setTotalCases(totalCasesResult.count || 0);
        setPendingCases(pendingCasesResult.count || 0);
        setCompletedCases(completedCasesResult.count || 0);
        setActiveClientsCount(activeClientsResult.count || 0);

        // Cases manage card
        const casesData = casesByStatusResult.data || [];
        const casesTotal = casesData.length;
        const casesApproved = casesData.filter((c: any) => c.QC_Response === 'Approved' || c.status === 'qc_passed' || c.status === 'reported' || c.status === 'payment_complete').length;
        const casesRejected = casesData.filter((c: any) => c.QC_Response === 'Rejected').length;
        const casesRework = casesData.filter((c: any) => c.QC_Response === 'Rework').length;

        // Allocation stats
        const allocationCases = allocationCasesResult.data || [];
        const allocationsTotal = allocationCases.filter((c: any) => c.status !== 'new').length;
        const allocationsSuccessful = allocationCases.filter((c: any) =>
          c.status !== 'new' && c.status !== 'allocated' && c.status !== 'pending_allocation'
        ).length;
        const allocationsPending = allocationCases.filter((c: any) => c.status === 'allocated' || c.status === 'pending_allocation').length;

        // Capacity utilization
        const capData = capacityResult.data || [];
        let capacityUtilization = 0;
        if (capData.length > 0) {
          const totalMax = capData.reduce((sum: number, d: any) => sum + (d.max_daily_capacity || 0), 0);
          const totalAvailable = capData.reduce((sum: number, d: any) => sum + (d.current_capacity_available || 0), 0);
          capacityUtilization = totalMax > 0 ? Math.round(((totalMax - totalAvailable) / totalMax) * 100) : 0;
        }

        // Client stats
        const allClients = allClientsResult.data || [];
        const activeClients = allClients.filter((c: any) => c.is_active).length;
        const inactiveClients = allClients.filter((c: any) => !c.is_active).length;

        // Vendor stats
        const vendorsData = vendorsDataResult.data || [];
        const vendorTotalCases = vendorsData.reduce((sum: number, v: any) => sum + (v.total_cases_assigned || 0), 0);
        const avgQualityScore = vendorsData.length > 0
          ? Math.round((vendorsData.reduce((sum: number, v: any) => sum + (v.quality_score || 0), 0) / vendorsData.length) * 1000) / 10
          : 0;

        setManageStats({
          casesTotal,
          casesApproved,
          casesRejected,
          casesRework,
          allocationsTotal,
          allocationsSuccessful,
          allocationsPending,
          capacityUtilization,
          activeClients,
          inactiveClients,
          newClients: newClientsResult.count || 0,
          activeContracts: activeContractsResult.count || 0,
          totalBonuses: 0,
          totalPenalties: 0,
          totalPincodes: totalPincodesResult.count || 0,
          tier1Pincodes: tier1PincodesResult.count || 0,
          tier2Pincodes: tier2PincodesResult.count || 0,
          tier3Pincodes: tier3PincodesResult.count || 0,
          activeVendors: activeVendorsResult.count || 0,
          totalGigWorkers: totalGigWorkersResult.count || 0,
          vendorTotalCases,
          avgQualityScore,
        });
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchAllStats();

    return () => {
      cancelled = true;
    };
  }, [dateFilter, customDateRange]);

  const pad = (n: number) => String(n).padStart(2, '0');

  // Donut chart data
  const donutData = [
    { name: 'Approved', value: manageStats.casesApproved, color: '#22c55e' },
    { name: 'Rejected', value: manageStats.casesRejected, color: '#ef4444' },
    { name: 'Rework', value: manageStats.casesRework, color: '#f59e0b' },
  ];

  // Remaining cases (not approved/rejected/rework) shown as grey
  const categorized = manageStats.casesApproved + manageStats.casesRejected + manageStats.casesRework;
  const remaining = Math.max(0, manageStats.casesTotal - categorized);
  const fullDonutData = remaining > 0
    ? [...donutData, { name: 'Other', value: remaining, color: '#e5e7eb' }]
    : donutData;

  // Allocation progress
  const allocationSuccessPercent = manageStats.allocationsTotal > 0
    ? Math.round((manageStats.allocationsSuccessful / manageStats.allocationsTotal) * 100)
    : 0;

  const StatValue = ({ value, loading }: { value: number | string; loading?: boolean }) => (
    <span>{loading || isLoading ? '-' : typeof value === 'number' ? value.toLocaleString() : value}</span>
  );

  return (
    <div className="space-y-8 p-6">
      {/* Dashboard Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        {/* Date Filter Tabs */}
        <div className="flex items-center gap-1 mt-4">
          {[
            { key: 'all' as DateFilterType, label: 'All' },
            { key: 'this_week' as DateFilterType, label: 'This Week' },
            { key: 'this_month' as DateFilterType, label: 'This Month' },
            { key: 'this_quarter' as DateFilterType, label: 'This Quarter' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setDateFilter(tab.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                dateFilter === tab.key
                  ? 'bg-[#1e3a5f] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <button
                onClick={() => {
                  if (dateFilter !== 'custom') setDateFilter('custom');
                }}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  dateFilter === 'custom'
                    ? 'bg-[#1e3a5f] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {customDateLabel}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={customDateRange}
                onSelect={(range) => {
                  setCustomDateRange(range);
                  setDateFilter('custom');
                  if (range?.to) setIsCalendarOpen(false);
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white shadow-sm border">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-50">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  <StatValue value={totalCases} />
                </div>
                <div className="text-sm text-gray-500">Total Cases</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm border">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-green-50">
                <Clock className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  <StatValue value={pendingCases} />
                </div>
                <div className="text-sm text-gray-500">Pending Cases</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm border">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-50">
                <CheckCircle className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  <StatValue value={completedCases} />
                </div>
                <div className="text-sm text-gray-500">Completed Cases</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm border">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-50">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  <StatValue value={activeClientsCount} />
                </div>
                <div className="text-sm text-gray-500">Active Clients</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Manage Section */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Manage</h2>

        {/* Top Row: Cases + Allocations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* Cases Card */}
          <Card className="bg-white shadow-sm border">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-gray-600" />
                  <span className="text-lg font-semibold text-gray-900">Cases</span>
                </div>
              </div>
              <div className="flex items-center gap-6">
                {/* Donut Chart */}
                <div className="relative w-32 h-32 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={fullDonutData.filter(d => d.value > 0).length > 0 ? fullDonutData : [{ name: 'Empty', value: 1, color: '#e5e7eb' }]}
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={55}
                        paddingAngle={2}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {(fullDonutData.filter(d => d.value > 0).length > 0 ? fullDonutData : [{ name: 'Empty', value: 1, color: '#e5e7eb' }]).map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Stats */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Total Cases</span>
                    <span className="font-semibold text-gray-900"><StatValue value={manageStats.casesTotal} /></span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
                      <span className="text-gray-600">Approved</span>
                    </div>
                    <span className="font-semibold text-gray-900">{pad(manageStats.casesApproved)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                      <span className="text-gray-600">Rejected</span>
                    </div>
                    <span className="font-semibold text-gray-900">{pad(manageStats.casesRejected)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block" />
                      <span className="text-gray-600">Rework</span>
                    </div>
                    <span className="font-semibold text-gray-900">{pad(manageStats.casesRework)}</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate('/ops/cases')}
                >
                  Manage
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Allocations Card */}
          <Card className="bg-white shadow-sm border">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-gray-600" />
                  <span className="text-lg font-semibold text-gray-900">Allocations</span>
                </div>
                <span className="text-lg font-bold text-gray-900"><StatValue value={manageStats.allocationsTotal} /></span>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Successful <span className="font-semibold text-gray-900">{manageStats.allocationsSuccessful.toLocaleString()}</span></span>
                  <span className="text-gray-600">Pending <span className="font-semibold text-gray-900">{manageStats.allocationsPending.toLocaleString()}</span></span>
                </div>
                {/* Progress Bar */}
                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div className="h-full rounded-full flex">
                    <div
                      className="bg-green-500 h-full transition-all"
                      style={{ width: `${allocationSuccessPercent}%` }}
                    />
                    <div
                      className="bg-orange-400 h-full transition-all"
                      style={{ width: `${100 - allocationSuccessPercent}%` }}
                    />
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  Capacity Utilization <span className="font-semibold text-gray-900">{manageStats.capacityUtilization}%</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate('/ops/allocation')}
                >
                  Manage
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row: Clients, Contracts, Pincodes, Vendors */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Clients Card */}
          <Card className="bg-white shadow-sm border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-gray-600" />
                  <span className="font-semibold text-gray-900">Clients</span>
                </div>
                <span className="font-bold text-gray-900"><StatValue value={manageStats.activeClients + manageStats.inactiveClients} /></span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Active Clients</span>
                  <span className="font-semibold text-gray-900">{pad(manageStats.activeClients)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Inactive Clients</span>
                  <span className="font-semibold text-gray-900">{pad(manageStats.inactiveClients)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">New clients</span>
                  <span className="font-semibold text-gray-900">{pad(manageStats.newClients)}</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t">
                <Button variant="outline" className="w-full" onClick={() => navigate('/ops/clients')}>
                  Manage
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Contracts Card */}
          <Card className="bg-white shadow-sm border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-gray-600" />
                  <span className="font-semibold text-gray-900">Contracts</span>
                </div>
                <span className="font-bold text-gray-900">{pad(manageStats.activeContracts)}</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Active Contracts</span>
                  <span className="font-semibold text-gray-900">{pad(manageStats.activeContracts)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Bonuses</span>
                  <span className="font-semibold text-gray-900">{pad(manageStats.totalBonuses)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Penalties</span>
                  <span className="font-semibold text-gray-900">{pad(manageStats.totalPenalties)}</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t">
                <Button variant="outline" className="w-full" onClick={() => navigate('/ops/client-contracts')}>
                  Manage
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Pincodes Card */}
          <Card className="bg-white shadow-sm border border-blue-400 ring-1 ring-blue-200">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-gray-600" />
                  <span className="font-semibold text-gray-900">Pincodes</span>
                </div>
                <span className="font-bold text-gray-900"><StatValue value={manageStats.totalPincodes} /></span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Active</span>
                  <span className="font-semibold text-gray-900"><StatValue value={manageStats.totalPincodes} /></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Tier 1 (Metro)</span>
                  <span className="font-semibold text-gray-900"><StatValue value={manageStats.tier1Pincodes} /></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Tier 2 (Cities)</span>
                  <span className="font-semibold text-gray-900"><StatValue value={manageStats.tier2Pincodes} /></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Tier 3 (Rural)</span>
                  <span className="font-semibold text-gray-900"><StatValue value={manageStats.tier3Pincodes} /></span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t">
                <Button variant="outline" className="w-full" onClick={() => navigate('/ops/pincode-tiers')}>
                  Manage
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Vendors Card */}
          <Card className="bg-white shadow-sm border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-gray-600" />
                  <span className="font-semibold text-gray-900">Vendors</span>
                </div>
                <span className="font-bold text-gray-900"><StatValue value={manageStats.activeVendors} /></span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Active Vendors</span>
                  <span className="font-semibold text-gray-900"><StatValue value={manageStats.activeVendors} /></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Gig Workers</span>
                  <span className="font-semibold text-gray-900"><StatValue value={manageStats.totalGigWorkers} /></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Cases</span>
                  <span className="font-semibold text-gray-900"><StatValue value={manageStats.vendorTotalCases} /></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Avg Quality Score</span>
                  <span className="font-semibold text-gray-900">{manageStats.avgQualityScore}%</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t">
                <Button variant="outline" className="w-full" onClick={() => navigate('/ops/vendors')}>
                  Manage
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
