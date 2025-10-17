import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserCheck, FileText, Clock, XCircle, Eye, MapPin, User, Phone, Calendar } from 'lucide-react';
import { caseService, Case } from '@/services/caseService';
import { useToast } from '@/hooks/use-toast';
import QCSubmissionReview from '@/components/QC/QCSubmissionReview';

export default function QCDashboard() {
  const [submittedCases, setSubmittedCases] = useState<Case[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0
  });
  const [selectedCaseForReview, setSelectedCaseForReview] = useState<Case | null>(null);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSubmittedCases();
  }, []);

  const loadSubmittedCases = async () => {
    try {
      setIsLoading(true);
      const cases = await caseService.getCasesByStatus('submitted');
      
      // Sort submitted cases by submitted_at field (most recent first)
      const sortedCases = cases.sort((a, b) => {
        const aSubmittedAt = a.submitted_at || a.created_at;
        const bSubmittedAt = b.submitted_at || b.created_at;
        return new Date(bSubmittedAt).getTime() - new Date(aSubmittedAt).getTime();
      });
      
      setSubmittedCases(sortedCases);
      
      // Calculate stats (you can expand this to get other status counts)
      setStats({
        pending: sortedCases.length,
        approved: 0, // You can fetch these separately if needed
        rejected: 0,
        total: sortedCases.length
      });
    } catch (error) {
      console.error('Failed to load submitted cases:', error);
      toast({
        title: 'Error',
        description: 'Failed to load submitted cases',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      submitted: { label: 'Submitted', className: 'bg-yellow-100 text-yellow-800' },
      qc_pending: { label: 'QC Pending', className: 'bg-blue-100 text-blue-800' },
      qc_passed: { label: 'QC Passed', className: 'bg-green-100 text-green-800' },
      qc_approved: { label: 'QC Approved', className: 'bg-green-100 text-green-800' },
      qc_rejected: { label: 'QC Rejected', className: 'bg-red-100 text-red-800' },
      qc_rework: { label: 'QC Rework', className: 'bg-orange-100 text-orange-800' },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || { label: status, className: 'bg-gray-100 text-gray-800' };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeTaken = (assignedAt?: string, submittedAt?: string) => {
    if (!assignedAt || !submittedAt) return 'N/A';
    
    const assigned = new Date(assignedAt);
    const submitted = new Date(submittedAt);
    const diffMs = submitted.getTime() - assigned.getTime();
    
    if (diffMs < 0) return 'Invalid';
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    } else {
      return `${diffMinutes}m`;
    }
  };

  const handleReviewCase = (caseItem: Case) => {
    setSelectedCaseForReview(caseItem);
    setIsReviewDialogOpen(true);
  };

  const handleReviewComplete = () => {
    // Refresh the cases list after QC action
    loadSubmittedCases();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">Cases awaiting QC</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.approved}</div>
            <p className="text-xs text-muted-foreground">This week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.rejected}</div>
            <p className="text-xs text-muted-foreground">Needs rework</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cases</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Submitted cases</p>
          </CardContent>
        </Card>
      </div>

      {/* Submitted Cases List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Submitted Cases for QC Review</CardTitle>
              <CardDescription>
                Cases that have been submitted by field workers and are awaiting quality control review
              </CardDescription>
            </div>
            <Button onClick={loadSubmittedCases} variant="outline" size="sm">
              <Clock className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {submittedCases.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Submitted Cases</h3>
              <p className="text-muted-foreground">
                There are currently no cases submitted for QC review.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {submittedCases.map((caseItem) => (
                <div
                  key={caseItem.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">{caseItem.case_number}</h3>
                        {getStatusBadge(caseItem.status)}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {caseItem.client_case_id} • {caseItem.contract_type}
                      </p>
                      <h4 className="font-medium text-base mb-1">{caseItem.candidate_name}</h4>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleReviewCase(caseItem)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Review
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">Client</p>
                        <p className="font-medium">{caseItem.client.name}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">Phone</p>
                        <p className="font-medium">{caseItem.phone_primary}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">Location</p>
                        <p className="font-medium">{caseItem.location.city}, {caseItem.location.state}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">Submitted</p>
                        <p className="font-medium">{formatDate(caseItem.submitted_at || caseItem.status_updated_at)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Additional QC Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm mt-4 pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">TAT Hours</p>
                        <p className="font-medium">{caseItem.tat_hours}h</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">Assigned On</p>
                        <p className="font-medium">{caseItem.assigned_at ? formatDate(caseItem.assigned_at) : 'N/A'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">Submitted On</p>
                        <p className="font-medium">{caseItem.submitted_at ? formatDate(caseItem.submitted_at) : 'N/A'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">Time Taken</p>
                        <p className="font-medium">{getTimeTaken(caseItem.assigned_at, caseItem.submitted_at)}</p>
                      </div>
                    </div>
                  </div>

                  {caseItem.current_assignee && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Assigned to</p>
                          <p className="font-medium">
                            {caseItem.current_assignee.name} 
                            <span className="text-sm text-muted-foreground ml-2">
                              ({caseItem.current_assignee.type === 'gig' ? 'Gig Worker' : 'Vendor'})
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* QC Submission Review Dialog */}
      {selectedCaseForReview && (
        <QCSubmissionReview
          caseId={selectedCaseForReview.id}
          caseNumber={selectedCaseForReview.case_number}
          candidateName={selectedCaseForReview.candidate_name}
          isOpen={isReviewDialogOpen}
          onClose={() => {
            setIsReviewDialogOpen(false);
            setSelectedCaseForReview(null);
          }}
          onActionComplete={handleReviewComplete}
        />
      )}
    </div>
  );
}