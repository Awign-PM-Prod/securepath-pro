import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Target, 
  Clock, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  AlertCircle,
  User
} from 'lucide-react';
import { allocationEngine, AllocationResult } from '@/services/allocationEngine';
import { useToast } from '@/hooks/use-toast';

interface AllocationActionsProps {
  caseId: string;
  caseNumber: string;
  pincode: string;
  pincodeTier: string;
  currentStatus: string;
  onAllocationUpdate: () => void;
}

export default function AllocationActions({ 
  caseId, 
  caseNumber, 
  pincode, 
  pincodeTier, 
  currentStatus,
  onAllocationUpdate 
}: AllocationActionsProps) {
  const [isAllocating, setIsAllocating] = useState(false);
  const [isReallocating, setIsReallocating] = useState(false);
  const [allocationStatus, setAllocationStatus] = useState<any[]>([]);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const { toast } = useToast();

  const canAllocate = ['created', 'allocated', 'pending_acceptance'].includes(currentStatus);
  const canReallocate = ['allocated', 'pending_acceptance'].includes(currentStatus);

  const handleAllocate = async () => {
    setIsAllocating(true);
    try {
      const result: AllocationResult = await allocationEngine.allocateCase(caseId, pincode, pincodeTier);
      
      if (result.success) {
        toast({
          title: 'Case Allocated',
          description: `Case ${caseNumber} has been allocated to ${result.assignee_type} worker`,
        });
        onAllocationUpdate();
      } else {
        toast({
          title: 'Allocation Failed',
          description: result.error || 'Failed to allocate case',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Allocation error:', error);
      toast({
        title: 'Error',
        description: 'An error occurred during allocation',
        variant: 'destructive',
      });
    } finally {
      setIsAllocating(false);
    }
  };

  const handleReallocate = async () => {
    setIsReallocating(true);
    try {
      const result: AllocationResult = await allocationEngine.reallocateCase(caseId);
      
      if (result.success) {
        toast({
          title: 'Case Reallocated',
          description: `Case ${caseNumber} has been reallocated (Wave ${result.wave_number})`,
        });
        onAllocationUpdate();
      } else {
        toast({
          title: 'Reallocation Failed',
          description: result.error || 'Failed to reallocate case',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Reallocation error:', error);
      toast({
        title: 'Error',
        description: 'An error occurred during reallocation',
        variant: 'destructive',
      });
    } finally {
      setIsReallocating(false);
    }
  };

  const loadAllocationStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const status = await allocationEngine.getAllocationStatus(caseId);
      setAllocationStatus(status);
    } catch (error) {
      console.error('Failed to load allocation status:', error);
      toast({
        title: 'Error',
        description: 'Failed to load allocation status',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const getStatusBadge = (decision: string) => {
    const colors = {
      allocated: 'bg-blue-100 text-blue-800',
      accepted: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      timeout: 'bg-gray-100 text-gray-800',
    };
    
    return (
      <Badge className={colors[decision as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
        {decision.charAt(0).toUpperCase() + decision.slice(1)}
      </Badge>
    );
  };

  const getTimeRemaining = (deadline: string) => {
    const now = new Date();
    const due = new Date(deadline);
    const diffMs = due.getTime() - now.getTime();
    const diffMins = Math.ceil(diffMs / (1000 * 60));
    
    if (diffMins <= 0) return 'Overdue';
    if (diffMins < 60) return `${diffMins}m`;
    
    const diffHours = Math.floor(diffMins / 60);
    const remainingMins = diffMins % 60;
    return `${diffHours}h ${remainingMins}m`;
  };

  const isOverdue = (deadline: string) => {
    return new Date(deadline) < new Date();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Allocation Actions
        </CardTitle>
        <CardDescription>
          Manage case allocation and assignment
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Action Buttons */}
        <div className="flex gap-2">
          {canAllocate && (
            <Button 
              onClick={handleAllocate} 
              disabled={isAllocating}
              className="flex-1"
            >
              {isAllocating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Allocating...
                </>
              ) : (
                <>
                  <Target className="h-4 w-4 mr-2" />
                  Allocate Case
                </>
              )}
            </Button>
          )}
          
          {canReallocate && (
            <Button 
              onClick={handleReallocate} 
              disabled={isReallocating}
              variant="outline"
              className="flex-1"
            >
              {isReallocating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Reallocating...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reallocate
                </>
              )}
            </Button>
          )}

          <Button 
            onClick={loadAllocationStatus} 
            disabled={isLoadingStatus}
            variant="outline"
          >
            {isLoadingStatus ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Clock className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Allocation Status */}
        {allocationStatus.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium">Allocation History</h4>
            <div className="space-y-2">
              {allocationStatus.map((allocation, index) => (
                <div key={allocation.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Wave {allocation.wave_number}</Badge>
                      {getStatusBadge(allocation.decision)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {(allocation.final_score * 100).toFixed(1)}% score
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {allocation.gig_partners?.profiles?.first_name} {allocation.gig_partners?.profiles?.last_name}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {allocation.candidate_type}
                    </Badge>
                  </div>

                  {allocation.decision === 'allocated' && (
                    <div className="flex items-center gap-2 text-sm">
                      {isOverdue(allocation.acceptance_deadline) ? (
                        <>
                          <AlertCircle className="h-4 w-4 text-red-500" />
                          <span className="text-red-600">
                            Overdue - {getTimeRemaining(allocation.acceptance_deadline)}
                          </span>
                        </>
                      ) : (
                        <>
                          <Clock className="h-4 w-4 text-yellow-500" />
                          <span>
                            {getTimeRemaining(allocation.acceptance_deadline)} remaining
                          </span>
                        </>
                      )}
                    </div>
                  )}

                  {allocation.decision === 'accepted' && (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span>Accepted</span>
                    </div>
                  )}

                  {allocation.decision === 'rejected' && (
                    <div className="flex items-center gap-2 text-sm text-red-600">
                      <XCircle className="h-4 w-4" />
                      <span>Rejected</span>
                      {allocation.reallocation_reason && (
                        <span className="text-muted-foreground">
                          - {allocation.reallocation_reason}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground mt-1">
                    Allocated: {new Date(allocation.allocated_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Allocation Status */}
        {allocationStatus.length === 0 && !isLoadingStatus && (
          <div className="text-center py-4">
            <Target className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No allocation history</p>
            <p className="text-xs text-muted-foreground">Click the clock icon to load status</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

