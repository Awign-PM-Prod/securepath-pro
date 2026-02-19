import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Bell, Home, User, ChevronDown, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { gigWorkerService } from '@/services/gigWorkerService';
import { supabase } from '@/integrations/supabase/client';

interface CaseCounts {
  pending: number;
  accepted: number;
  in_progress: number;
  approved: number;
  rework: number;
  submitted: number;
}

export default function GigWorkerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [totalCases, setTotalCases] = useState(0);
  const [caseCounts, setCaseCounts] = useState<CaseCounts>({
    pending: 0,
    accepted: 0,
    in_progress: 0,
    approved: 0,
    rework: 0,
    submitted: 0,
  });
  const [dateFilter, setDateFilter] = useState<Date | undefined>(new Date());
  const [gigWorkerId, setGigWorkerId] = useState<string | null>(null);

  useEffect(() => {
    const fetchGigWorkerId = async () => {
      if (!user?.id) return;
      
      try {
        const result = await gigWorkerService.getGigWorkerId(user.id);
        if (result.success && result.gigWorkerId) {
          setGigWorkerId(result.gigWorkerId);
        }
      } catch (error) {
        console.error('Error fetching gig worker ID:', error);
      }
    };

    fetchGigWorkerId();
  }, [user?.id]);

  useEffect(() => {
    const fetchCaseData = async () => {
      if (!gigWorkerId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        // Build date filter query
        let query = supabase
          .from('cases')
          .select('id, status', { count: 'exact', head: false })
          .eq('current_assignee_id', gigWorkerId)
          .eq('current_assignee_type', 'gig')
          .eq('is_active', true);

        // Apply date filter if set
        if (dateFilter) {
          const startOfMonth = new Date(dateFilter.getFullYear(), dateFilter.getMonth(), 1);
          const endOfMonth = new Date(dateFilter.getFullYear(), dateFilter.getMonth() + 1, 0, 23, 59, 59);
          query = query
            .gte('created_at', startOfMonth.toISOString())
            .lte('created_at', endOfMonth.toISOString());
        }

        const { data: cases, error, count } = await query;

        if (error) throw error;

        // Count cases by status
        const counts: CaseCounts = {
          pending: 0,
          accepted: 0,
          in_progress: 0,
          approved: 0,
          rework: 0,
          submitted: 0,
        };

        cases?.forEach((caseItem) => {
          switch (caseItem.status) {
            case 'allocated':
              counts.pending++;
              break;
            case 'accepted':
              counts.accepted++;
              break;
            case 'in_progress':
              counts.in_progress++;
              break;
            case 'qc_passed':
              counts.approved++;
              break;
            case 'qc_rework':
              counts.rework++;
              break;
            case 'submitted':
              counts.submitted++;
              break;
          }
        });

        setTotalCases(count || 0);
        setCaseCounts(counts);
      } catch (error) {
        console.error('Error fetching case data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCaseData();
  }, [gigWorkerId, dateFilter]);

  const getUserName = () => {
    if (!user?.profile) return 'User';
    const firstName = user.profile.first_name || '';
    const lastName = user.profile.last_name || '';
    return `${firstName} ${lastName}`.trim() || 'User';
  };

  const statusCards = [
    { label: 'Pending', count: caseCounts.pending, color: 'text-blue-600' },
    { label: 'Accepted', count: caseCounts.accepted, color: 'text-green-600' },
    { label: 'In Progress', count: caseCounts.in_progress, color: 'text-orange-600' },
    { label: 'Approved', count: caseCounts.approved, color: 'text-green-600' },
    { label: 'Rework', count: caseCounts.rework, color: 'text-red-600' },
    { label: 'Submitted', count: caseCounts.submitted, color: 'text-purple-600' },
  ];

  const handleStatusCardClick = (status: string) => {
    // Map display labels to actual status values
    const statusMap: Record<string, string[]> = {
      'Pending': ['allocated'],
      'Accepted': ['accepted'],
      'In Progress': ['in_progress'],
      'Approved': ['qc_passed'],
      'Rework': ['qc_rework'],
      'Submitted': ['submitted'],
    };

    const statuses = statusMap[status] || [];
    // Navigate to active assignment page or tasks page if it exists
    // For now, just show a message or navigate to notifications
    // TODO: Implement proper navigation when tasks page is created
    console.log('Navigate to cases with status:', statuses);
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* Dark Blue Header */}
      <header className="bg-[#1e3a5f] text-white px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Background Verification</h1>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/10"
          onClick={() => navigate('/gig/notifications')}
        >
          <Bell className="h-5 w-5" />
        </Button>
      </header>

      {/* Welcome Section */}
      <div className="bg-gray-100 px-4 pt-4 pb-2">
        <div className="text-sm text-gray-700 mb-1">Welcome!</div>
        <div className="text-xl font-bold text-gray-900 mb-4">{getUserName()}</div>
        
        {/* Total Cases Card */}
        <Card className="bg-white shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <span className="text-gray-700 font-medium">Total Cases</span>
            <span className="text-blue-600 text-xl font-bold">{totalCases}</span>
          </CardContent>
        </Card>
      </div>

      {/* My Allocated Cases Section */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-lg font-bold text-gray-900">My Allocated Cases</h2>
            <p className="text-sm text-gray-500 mt-1">Manage your assigned background verification cases.</p>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="bg-blue-600 text-white border-blue-600 hover:bg-blue-700 hover:text-white"
              >
                {dateFilter ? format(dateFilter, 'MMM yyyy') : 'Select Date'}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={dateFilter}
                onSelect={setDateFilter}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Status Cards Grid - 2 rows of 3 */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          {statusCards.map((card, index) => (
            <Card
              key={index}
              className="bg-white shadow-sm cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleStatusCardClick(card.label)}
            >
              <CardContent className="p-4 flex flex-col items-start justify-between h-full">
                <div className="w-full flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">{card.label}</span>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </div>
                <span className={`text-2xl font-bold ${card.color}`}>{card.count}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gray-800 text-white border-t border-gray-700">
        <div className="flex items-center justify-around h-16">
          <button
            onClick={() => navigate('/gig')}
            className="flex flex-col items-center justify-center flex-1 h-full text-blue-400"
          >
            <Home className="h-6 w-6 mb-1" />
            <span className="text-xs">Home</span>
          </button>
          <button
            onClick={() => {
              // Profile page doesn't exist yet, could navigate to user menu or settings
              // For now, just keep it as a placeholder
              console.log('Profile clicked');
            }}
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-400"
          >
            <User className="h-6 w-6 mb-1" />
            <span className="text-xs">Profile</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
