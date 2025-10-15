import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MapPin, 
  Clock, 
  DollarSign, 
  Camera, 
  CheckCircle, 
  XCircle,
  Navigation,
  Phone,
  FileText,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MobileCase {
  id: string;
  case_number: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'allocated' | 'accepted' | 'in_progress' | 'submitted';
  client: {
    name: string;
    contact_person?: string;
    phone?: string;
  };
  location: {
    address_line: string;
    city: string;
    state: string;
    pincode: string;
    lat?: number;
    lng?: number;
  };
  due_at: string;
  base_rate_inr: number;
  total_rate_inr: number;
  travel_allowance_inr: number;
  bonus_inr: number;
  tat_hours: number;
  instructions?: string;
  attachments?: Array<{
    id: string;
    file_name: string;
    file_url: string;
  }>;
}

const PRIORITY_COLORS = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
};

const STATUS_COLORS = {
  allocated: 'bg-blue-100 text-blue-800',
  accepted: 'bg-green-100 text-green-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  submitted: 'bg-purple-100 text-purple-800',
};

export default function GigWorkerMobile() {
  const [currentCase, setCurrentCase] = useState<MobileCase | null>(null);
  const [pendingCases, setPendingCases] = useState<MobileCase[]>([]);
  const [completedCases, setCompletedCases] = useState<MobileCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { toast } = useToast();

  // Mock data - in real app, this would come from API
  useEffect(() => {
    const mockCases: MobileCase[] = [
      {
        id: '1',
        case_number: 'BG-20250120-000001',
        title: 'Background Verification - John Doe',
        description: 'Complete background verification for new employee John Doe including address, education, and employment verification.',
        priority: 'high',
        status: 'allocated',
        client: {
          name: 'ABC Corporation',
          contact_person: 'HR Manager',
          phone: '+91 98765 43210',
        },
        location: {
          address_line: '123 Main Street, Sector 5',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
          lat: 19.0760,
          lng: 72.8777,
        },
        due_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
        base_rate_inr: 500,
        total_rate_inr: 550,
        travel_allowance_inr: 50,
        bonus_inr: 0,
        tat_hours: 24,
        instructions: 'Please ensure thorough verification of all documents. Take clear photos of the premises and any relevant documents.',
      },
      {
        id: '2',
        case_number: 'BG-20250120-000002',
        title: 'Address Verification - Jane Smith',
        description: 'Verify residential address for Jane Smith in Delhi.',
        priority: 'medium',
        status: 'in_progress',
        client: {
          name: 'XYZ Industries',
          contact_person: 'HR Team',
          phone: '+91 98765 43211',
        },
        location: {
          address_line: '456 Park Avenue, Connaught Place',
          city: 'New Delhi',
          state: 'Delhi',
          pincode: '110001',
          lat: 28.6139,
          lng: 77.2090,
        },
        due_at: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString(),
        base_rate_inr: 400,
        total_rate_inr: 400,
        travel_allowance_inr: 0,
        bonus_inr: 0,
        tat_hours: 48,
      },
    ];

    setPendingCases(mockCases.filter(c => c.status === 'allocated'));
    setCompletedCases(mockCases.filter(c => c.status === 'submitted'));
    setCurrentCase(mockCases.find(c => c.status === 'in_progress') || null);
    setIsLoading(false);
  }, []);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleAcceptCase = async (caseId: string) => {
    try {
      // In real app, this would be an API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const caseToAccept = pendingCases.find(c => c.id === caseId);
      if (caseToAccept) {
        setCurrentCase({ ...caseToAccept, status: 'accepted' });
        setPendingCases(prev => prev.filter(c => c.id !== caseId));
        toast({
          title: 'Case Accepted',
          description: 'You have accepted the case successfully.',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to accept case. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleRejectCase = async (caseId: string) => {
    if (window.confirm('Are you sure you want to reject this case?')) {
      try {
        // In real app, this would be an API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setPendingCases(prev => prev.filter(c => c.id !== caseId));
        toast({
          title: 'Case Rejected',
          description: 'You have rejected the case.',
        });
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to reject case. Please try again.',
          variant: 'destructive',
        });
      }
    }
  };

  const handleStartCase = async (caseId: string) => {
    try {
      // In real app, this would be an API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (currentCase) {
        setCurrentCase({ ...currentCase, status: 'in_progress' });
        toast({
          title: 'Case Started',
          description: 'You have started working on the case.',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to start case. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleSubmitCase = async (caseId: string) => {
    try {
      // In real app, this would be an API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (currentCase) {
        setCompletedCases(prev => [...prev, { ...currentCase, status: 'submitted' }]);
        setCurrentCase(null);
        toast({
          title: 'Case Submitted',
          description: 'Your case submission has been sent for review.',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to submit case. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const getTimeRemaining = (dueAt: string) => {
    const now = new Date();
    const due = new Date(dueAt);
    const diffMs = due.getTime() - now.getTime();
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
    
    if (diffHours <= 0) return 'Overdue';
    if (diffHours < 24) return `${diffHours}h`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ${diffHours % 24}h`;
  };

  const isOverdue = (dueAt: string) => {
    return new Date(dueAt) < new Date();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold">Gig Worker Dashboard</h1>
              <p className="text-sm text-muted-foreground">Background Verification</p>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-xs text-muted-foreground">
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Current Case */}
      {currentCase && (
        <div className="p-4">
          <Card className="border-2 border-primary">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{currentCase.case_number}</CardTitle>
                <Badge className={STATUS_COLORS[currentCase.status]}>
                  {currentCase.status.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
              <CardDescription className="text-sm">
                {currentCase.title}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Case Details */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{currentCase.location.address_line}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className={`text-sm ${isOverdue(currentCase.due_at) ? 'text-red-600' : ''}`}>
                    {getTimeRemaining(currentCase.due_at)} remaining
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">₹{currentCase.total_rate_inr}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                {currentCase.status === 'accepted' && (
                  <Button 
                    onClick={() => handleStartCase(currentCase.id)}
                    className="flex-1"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Start Case
                  </Button>
                )}
                {currentCase.status === 'in_progress' && (
                  <Button 
                    onClick={() => handleSubmitCase(currentCase.id)}
                    className="flex-1"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Submit Case
                  </Button>
                )}
                <Button variant="outline" className="flex-1">
                  <Camera className="h-4 w-4 mr-2" />
                  Take Photo
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs defaultValue="pending" className="px-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending">Pending ({pendingCases.length})</TabsTrigger>
          <TabsTrigger value="current">Current</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completedCases.length})</TabsTrigger>
        </TabsList>

        {/* Pending Cases Tab */}
        <TabsContent value="pending" className="space-y-4 mt-4">
          {pendingCases.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Pending Cases</h3>
                <p className="text-muted-foreground">No cases are currently allocated to you.</p>
              </CardContent>
            </Card>
          ) : (
            pendingCases.map((caseItem) => (
              <Card key={caseItem.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">{caseItem.case_number}</h3>
                      <Badge className={PRIORITY_COLORS[caseItem.priority]}>
                        {caseItem.priority.toUpperCase()}
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-muted-foreground">{caseItem.title}</p>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{caseItem.location.city}, {caseItem.location.state}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className={`text-sm ${isOverdue(caseItem.due_at) ? 'text-red-600' : ''}`}>
                          {getTimeRemaining(caseItem.due_at)} remaining
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">₹{caseItem.total_rate_inr}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        onClick={() => handleAcceptCase(caseItem.id)}
                        className="flex-1"
                        size="sm"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Accept
                      </Button>
                      <Button 
                        onClick={() => handleRejectCase(caseItem.id)}
                        variant="outline"
                        className="flex-1"
                        size="sm"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Current Case Tab */}
        <TabsContent value="current" className="mt-4">
          {currentCase ? (
            <Card>
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">{currentCase.case_number}</h3>
                    <Badge className={STATUS_COLORS[currentCase.status]}>
                      {currentCase.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-muted-foreground">{currentCase.title}</p>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{currentCase.location.address_line}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className={`text-sm ${isOverdue(currentCase.due_at) ? 'text-red-600' : ''}`}>
                        {getTimeRemaining(currentCase.due_at)} remaining
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {currentCase.is_direct_gig ? `₹${currentCase.total_rate_inr}` : 'Contact Vendor'}
                      </span>
                    </div>
                  </div>

                  {currentCase.instructions && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <h4 className="font-medium text-sm mb-1">Instructions</h4>
                      <p className="text-sm text-muted-foreground">{currentCase.instructions}</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {currentCase.status === 'accepted' && (
                      <Button 
                        onClick={() => handleStartCase(currentCase.id)}
                        className="flex-1"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Start Case
                      </Button>
                    )}
                    {currentCase.status === 'in_progress' && (
                      <Button 
                        onClick={() => handleSubmitCase(currentCase.id)}
                        className="flex-1"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Submit Case
                      </Button>
                    )}
                    <Button variant="outline" className="flex-1">
                      <Camera className="h-4 w-4 mr-2" />
                      Take Photo
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Current Case</h3>
                <p className="text-muted-foreground">You don't have any active cases at the moment.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Completed Cases Tab */}
        <TabsContent value="completed" className="space-y-4 mt-4">
          {completedCases.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Completed Cases</h3>
                <p className="text-muted-foreground">Your completed cases will appear here.</p>
              </CardContent>
            </Card>
          ) : (
            completedCases.map((caseItem) => (
              <Card key={caseItem.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">{caseItem.case_number}</h3>
                      <Badge className={STATUS_COLORS[caseItem.status]}>
                        {caseItem.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-muted-foreground">{caseItem.title}</p>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{caseItem.location.city}, {caseItem.location.state}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">₹{caseItem.total_rate_inr}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="grid grid-cols-4 h-16">
          <button className="flex flex-col items-center justify-center text-primary">
            <FileText className="h-5 w-5" />
            <span className="text-xs mt-1">Cases</span>
          </button>
          <button className="flex flex-col items-center justify-center text-muted-foreground">
            <Camera className="h-5 w-5" />
            <span className="text-xs mt-1">Camera</span>
          </button>
          <button className="flex flex-col items-center justify-center text-muted-foreground">
            <Navigation className="h-5 w-5" />
            <span className="text-xs mt-1">Navigation</span>
          </button>
          <button className="flex flex-col items-center justify-center text-muted-foreground">
            <Phone className="h-5 w-5" />
            <span className="text-xs mt-1">Support</span>
          </button>
        </div>
      </div>
    </div>
  );
}

