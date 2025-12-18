import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AllocationCandidate, allocationEngine } from '@/services/allocationEngine';
import { supabase } from '@/integrations/supabase/client';
import { User, MapPin, Phone, Mail, TrendingUp, Award, Clock, AlertCircle, CheckCircle, XCircle, RefreshCw, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { format } from 'date-fns';

interface AlternativeCandidate {
  candidate: AllocationCandidate;
  final_score: number;
  rejectionReasons: string[];
}

interface AllocationPreview {
  caseId: string;
  caseNumber: string;
  candidate: AllocationCandidate | null;
  casePincode?: string;
  applicantName?: string;
  addressLine?: string;
  city?: string;
  state?: string;
  error?: string;
  isManualSelection?: boolean;
  alternativeCandidates?: AlternativeCandidate[];
}

interface AllocationConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previews: AllocationPreview[];
  onConfirm: () => void;
  onCancel: () => void;
  onPreviewsChange?: (previews: AllocationPreview[]) => void;
  isAllocating?: boolean;
}

export default function AllocationConfirmationDialog({
  open,
  onOpenChange,
  previews,
  onConfirm,
  onCancel,
  onPreviewsChange,
  isAllocating = false
}: AllocationConfirmationDialogProps) {
  const [localPreviews, setLocalPreviews] = useState<AllocationPreview[]>(previews);
  const [changeGigWorkerDialog, setChangeGigWorkerDialog] = useState<{
    open: boolean;
    caseIds: string[];
    casePincode: string;
    casePincodeTier: string;
    currentCandidateId: string;
  } | null>(null);
  const [allocationType, setAllocationType] = useState<'direct' | 'vendor'>('direct');
  const [availableDirectGigWorkers, setAvailableDirectGigWorkers] = useState<AllocationCandidate[]>([]);
  const [availableVendorGigWorkers, setAvailableVendorGigWorkers] = useState<AllocationCandidate[]>([]);
  const [selectedGigWorker, setSelectedGigWorker] = useState<string>('');
  const [isLoadingWorkers, setIsLoadingWorkers] = useState(false);
  const [expandedAlternatives, setExpandedAlternatives] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLocalPreviews(previews);
  }, [previews]);

  // Group cases by candidate
  const casesByCandidate = new Map<string, { candidate: AllocationCandidate; cases: AllocationPreview[] }>();
  const errorCases: AllocationPreview[] = [];

  localPreviews.forEach(preview => {
    if (preview.error || !preview.candidate) {
      errorCases.push(preview);
    } else {
      const candidateId = preview.candidate.candidate_id;
      if (!casesByCandidate.has(candidateId)) {
        casesByCandidate.set(candidateId, {
          candidate: preview.candidate,
          cases: []
        });
      }
      casesByCandidate.get(candidateId)!.cases.push(preview);
    }
  });

  const successfulCount = localPreviews.length - errorCases.length;
  const failedCount = errorCases.length;

  const handleChangeGigWorker = async (caseIds: string[], casePincode: string, currentCandidateId: string) => {
    setIsLoadingWorkers(true);
    try {
      // Fetch pincode tier from the first case
      const firstCaseId = caseIds[0];
      const { data: caseData } = await supabase
        .from('cases')
        .select('location:locations(pincode_tier)')
        .eq('id', firstCaseId)
        .single();

      const casePincodeTier = (caseData?.location as any)?.pincode_tier || 'tier3';

      setChangeGigWorkerDialog({
        open: true,
        caseIds,
        casePincode,
        casePincodeTier,
        currentCandidateId
      });
      setAllocationType('direct');
      setSelectedGigWorker('');
      
      // Load available gig workers
      await loadAvailableGigWorkers(casePincode, casePincodeTier);
    } catch (error) {
      console.error('Failed to fetch case details:', error);
      setIsLoadingWorkers(false);
    }
  };

  const loadAvailableGigWorkers = async (pincode: string, pincodeTier: string) => {
    setIsLoadingWorkers(true);
    try {
      // Fetch all gig workers directly from database without pincode filtering
      const { data: gigWorkers, error } = await supabase
        .from('gig_partners')
        .select(`
          id,
          vendor_id,
          is_direct_gig,
          capacity_available,
          max_daily_capacity,
          quality_score,
          completion_rate,
          ontime_completion_rate,
          acceptance_rate,
          total_cases_completed,
          active_cases_count,
          coverage_pincodes,
          profiles!inner (
            first_name,
            last_name,
            email,
            phone
          ),
          vendors (
            name
          )
        `)
        .eq('is_active', true)
        .eq('is_available', true)
        .gt('capacity_available', 0)
        .order('capacity_available', { ascending: false });

      if (error) throw error;

      // Convert to AllocationCandidate format
      const candidates: AllocationCandidate[] = (gigWorkers || []).map(worker => ({
        candidate_id: worker.id,
        candidate_type: 'gig' as const,
        vendor_id: worker.vendor_id || undefined,
        candidate_name: `${worker.profiles?.first_name || ''} ${worker.profiles?.last_name || ''}`.trim() || 'Unknown',
        phone: worker.profiles?.phone || '',
        email: worker.profiles?.email || '',
        pincode: '',
        coverage_pincodes: worker.coverage_pincodes || [],
        max_daily_capacity: worker.max_daily_capacity || 0,
        capacity_available: worker.capacity_available || 0,
        completion_rate: worker.completion_rate || 0,
        ontime_completion_rate: worker.ontime_completion_rate || 0,
        acceptance_rate: worker.acceptance_rate || 0,
        quality_score: worker.quality_score || 0,
        qc_pass_count: 0,
        total_cases_completed: worker.total_cases_completed || 0,
        active_cases_count: worker.active_cases_count || 0,
        is_direct_gig: worker.is_direct_gig || false,
        is_active: true,
        is_available: true,
        performance_score: ((worker.completion_rate || 0) * 0.4 + 
                           (worker.ontime_completion_rate || 0) * 0.4 + 
                           (worker.acceptance_rate || 0) * 0.2),
        vendor_name: (worker.vendors as any)?.name || undefined,
        location_match_type: undefined,
        experience_score: 0,
        reliability_score: 0,
        priority_boost: 0
      }));

      // Separate direct and vendor-based gig workers
      const directWorkers = candidates.filter(c => c.is_direct_gig);
      const vendorWorkers = candidates.filter(c => !c.is_direct_gig);
      
      setAvailableDirectGigWorkers(directWorkers);
      setAvailableVendorGigWorkers(vendorWorkers);
    } catch (error) {
      console.error('Failed to load gig workers:', error);
    } finally {
      setIsLoadingWorkers(false);
    }
  };

  const handleConfirmGigWorkerChange = () => {
    if (!changeGigWorkerDialog || !selectedGigWorker) return;

    const selectedWorker = allocationType === 'direct'
      ? availableDirectGigWorkers.find(w => w.candidate_id === selectedGigWorker)
      : availableVendorGigWorkers.find(w => w.candidate_id === selectedGigWorker);

    if (!selectedWorker) return;

    // Update previews for the affected cases
    // If the case had an error (no eligible candidates), mark it as manual selection
    const updatedPreviews = localPreviews.map(preview => {
      if (changeGigWorkerDialog.caseIds.includes(preview.caseId)) {
        return {
          ...preview,
          candidate: selectedWorker,
          error: undefined, // Remove error so it moves to regular candidates section
          isManualSelection: preview.error ? true : preview.isManualSelection // Mark as manual if it had an error
        };
      }
      return preview;
    });

    setLocalPreviews(updatedPreviews);
    if (onPreviewsChange) {
      onPreviewsChange(updatedPreviews);
    }
    setChangeGigWorkerDialog(null);
    setSelectedGigWorker('');
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const getLocationMatchBadge = (matchType?: string) => {
    if (!matchType) return null;
    
    const variants: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
      pincode: { label: 'Exact Pincode Match', variant: 'default' },
      city: { label: 'City Match', variant: 'secondary' },
      tier: { label: 'Tier Match', variant: 'outline' }
    };

    const config = variants[matchType] || { label: matchType, variant: 'outline' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confirm Auto Allocation</DialogTitle>
          <DialogDescription>
            Review the allocation preview before confirming. Cases will be allocated to the gig workers shown below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <span>
                  <strong>{successfulCount}</strong> case(s) ready to allocate
                  {failedCount > 0 && (
                    <span className="text-destructive ml-2">
                      • <strong>{failedCount}</strong> case(s) cannot be allocated
                    </span>
                  )}
                </span>
              </div>
            </AlertDescription>
          </Alert>

          {/* Error Cases */}
          {errorCases.length > 0 && (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="text-destructive flex items-center gap-2">
                  <XCircle className="h-5 w-5" />
                  Cases That Cannot Be Allocated ({errorCases.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {errorCases.map((errorCase) => (
                    <div
                      key={errorCase.caseId}
                      className="p-3 bg-destructive/5 rounded border border-destructive/20 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <div className="font-medium">
                          {errorCase.caseNumber}{' '}
                          {errorCase.applicantName && (
                            <span className="text-sm text-muted-foreground">
                              - {errorCase.applicantName}
                            </span>
                          )}
                        </div>
                        {(errorCase.addressLine || errorCase.city || errorCase.state || errorCase.casePincode) && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {errorCase.addressLine && <span>{errorCase.addressLine}, </span>}
                            {errorCase.city && <span>{errorCase.city}, </span>}
                            {errorCase.state && <span>{errorCase.state} </span>}
                            {errorCase.casePincode && <span>- {errorCase.casePincode}</span>}
                          </div>
                        )}
                        {errorCase.error && (
                          <div className="text-xs text-destructive mt-1">
                            {errorCase.error}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2 md:mt-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const caseIds = [errorCase.caseId];
                            const casePincode = errorCase.casePincode || '';
                            handleChangeGigWorker(caseIds, casePincode, '');
                          }}
                          disabled={isAllocating || isLoadingWorkers}
                        >
                          <User className="h-4 w-4 mr-2" />
                          Assign Manually
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Candidates */}
          {Array.from(casesByCandidate.entries())
            .filter(([_, { candidate }]) => candidate !== null && candidate !== undefined)
            .map(([candidateId, { candidate, cases }]) => (
            <Card key={candidateId}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      {candidate.candidate_name}
                      <Badge variant={candidate.candidate_type === 'gig' ? 'default' : 'secondary'}>
                        {candidate.candidate_type === 'gig' 
                          ? (candidate.is_direct_gig ? 'Direct Gig Worker' : 'Vendor-based Gig Worker')
                          : 'Vendor'}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="mt-2">
                      {cases.length} case(s) will be allocated to {
                        candidate.candidate_type === 'gig' && !candidate.is_direct_gig && candidate.vendor_id
                          ? 'the vendor'
                          : candidate.candidate_type === 'gig' 
                            ? 'this worker' 
                            : 'this vendor'
                      }
                      {candidate.candidate_type === 'gig' && !candidate.is_direct_gig && candidate.vendor_id && (
                        <span className="text-xs text-muted-foreground block mt-1">
                          (via vendor-based gig worker: {candidate.candidate_name})
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {getLocationMatchBadge(candidate.location_match_type)}
                    {cases.some(c => c.isManualSelection) && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        Selected Manually
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  {/* Contact Info */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>{candidate.phone || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span className="truncate">{candidate.email || 'N/A'}</span>
                    </div>
                  </div>

                  {/* Location */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>
                        {(() => {
                          // Show case pincode if it's in the gig worker's coverage pincodes
                          const casePincode = cases.find(c => c.casePincode)?.casePincode;
                          if (casePincode && candidate.coverage_pincodes?.includes(casePincode)) {
                            return casePincode;
                          }
                          return 'N/A';
                        })()}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Coverage: {candidate.coverage_pincodes?.length || 0} area(s)
                    </div>
                  </div>

                  {/* Capacity */}
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Capacity</div>
                    <div className="text-sm text-muted-foreground">
                      {candidate.capacity_available} / {candidate.max_daily_capacity} available
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {candidate.active_cases_count} active case(s)
                    </div>
                  </div>

                  {/* Experience */}
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Experience</div>
                    <div className="text-sm text-muted-foreground">
                      {candidate.total_cases_completed} cases completed
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Score: {(candidate.experience_score || 0) * 100}%
                    </div>
                  </div>
                </div>

                {/* Performance Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <TrendingUp className="h-4 w-4" />
                      Quality Score
                    </div>
                    <div className="text-lg font-bold">{formatPercentage(candidate.quality_score ?? 0)}</div>
                    <div className="text-xs text-muted-foreground">
                      {candidate.qc_pass_count ?? 0} QC passes
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <CheckCircle className="h-4 w-4" />
                      Completion Rate
                    </div>
                    <div className="text-lg font-bold">{formatPercentage(candidate.completion_rate ?? 0)}</div>
                    <div className="text-xs text-muted-foreground">
                      On-time: {formatPercentage(candidate.ontime_completion_rate ?? 0)}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Award className="h-4 w-4" />
                      Acceptance Rate
                    </div>
                    <div className="text-lg font-bold">{formatPercentage(candidate.acceptance_rate ?? 0)}</div>
                    <div className="text-xs text-muted-foreground">
                      Reliability: {formatPercentage(candidate.reliability_score ?? 0)}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <TrendingUp className="h-4 w-4" />
                      Performance Score
                    </div>
                    <div className="text-lg font-bold">{formatPercentage(candidate.performance_score ?? 0)}</div>
                    <div className="text-xs text-muted-foreground">
                      Final Score: {(candidate.final_score ?? 0).toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Cases List */}
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium">Cases to be allocated:</div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const caseIds = cases.map(c => c.caseId);
                        const casePincode = cases.find(c => c.casePincode)?.casePincode || '';
                        handleChangeGigWorker(caseIds, casePincode, candidateId);
                      }}
                      disabled={isAllocating || isLoadingWorkers}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Change Gig Worker
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {cases.map((casePreview) => (
                      <Badge key={casePreview.caseId} variant="outline">
                        {casePreview.caseNumber}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Alternative Candidates - Show if any case has alternatives */}
                {(() => {
                  const firstCaseWithAlternatives = cases.find(c => c.alternativeCandidates && c.alternativeCandidates.length > 0);
                  if (!firstCaseWithAlternatives?.alternativeCandidates) return null;
                  
                  return (
                    <div className="mt-4 pt-4 border-t">
                      <button
                        onClick={() => {
                          const newExpanded = new Set(expandedAlternatives);
                          if (newExpanded.has(candidateId)) {
                            newExpanded.delete(candidateId);
                          } else {
                            newExpanded.add(candidateId);
                          }
                          setExpandedAlternatives(newExpanded);
                        }}
                        className="flex items-center justify-between w-full text-left mb-2 hover:text-primary transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Info className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            Other Candidates ({firstCaseWithAlternatives.alternativeCandidates.length})
                          </span>
                          <span className="text-xs text-muted-foreground">
                            (Gig workers who could have been allocated)
                          </span>
                        </div>
                        {expandedAlternatives.has(candidateId) ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                      {expandedAlternatives.has(candidateId) && (
                        <div className="space-y-3 mt-2">
                          {firstCaseWithAlternatives.alternativeCandidates.map((alt, index) => (
                            <Card key={alt.candidate.candidate_id} className="bg-muted/50">
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <User className="h-4 w-4 text-muted-foreground" />
                                      <span className="font-medium">{alt.candidate.candidate_name}</span>
                                      <Badge variant="outline" className="text-xs">
                                        #{index + 2} Choice
                                      </Badge>
                                      {alt.candidate.is_direct_gig ? (
                                        <Badge variant="secondary" className="text-xs">Direct</Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-xs">
                                          {alt.candidate.vendor_name || 'Vendor-based'}
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      Final Score: {alt.final_score.toFixed(2)} (vs {(candidate.final_score || 0).toFixed(2)})
                                    </div>
                                  </div>
                                  <div className="text-xs text-muted-foreground text-right">
                                    <div>Capacity: {alt.candidate.capacity_available}/{alt.candidate.max_daily_capacity}</div>
                                    {alt.candidate.location_match_type && (
                                      <div className="mt-1">
                                        {getLocationMatchBadge(alt.candidate.location_match_type)}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Quick Stats */}
                                <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
                                  <div>
                                    <span className="text-muted-foreground">Quality:</span>{' '}
                                    <span className="font-medium">{((alt.candidate.quality_score ?? 0) * 100).toFixed(1)}%</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Completion:</span>{' '}
                                    <span className="font-medium">{((alt.candidate.completion_rate ?? 0) * 100).toFixed(1)}%</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Experience:</span>{' '}
                                    <span className="font-medium">{alt.candidate.total_cases_completed ?? 0} cases</span>
                                  </div>
                                </div>

                                {/* Rejection Reasons */}
                                <div className="border-t pt-2">
                                  <div className="text-xs font-medium text-muted-foreground mb-1">Why not selected:</div>
                                  <ul className="space-y-1">
                                    {alt.rejectionReasons.map((reason, reasonIndex) => (
                                      <li key={reasonIndex} className="text-xs text-muted-foreground flex items-start gap-1">
                                        <span className="text-destructive mt-0.5">•</span>
                                        <span>{reason}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          ))}
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={onCancel}
            disabled={isAllocating}
          >
            Cancel
          </Button>
          <Button 
            onClick={onConfirm}
            disabled={isAllocating || successfulCount === 0}
            className="flex items-center gap-2"
          >
            {isAllocating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Allocating...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                Confirm & Allocate {successfulCount} Case(s)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Change Gig Worker Dialog */}
      <Dialog open={changeGigWorkerDialog?.open || false} onOpenChange={(open) => {
        if (!open) {
          setChangeGigWorkerDialog(null);
          setSelectedGigWorker('');
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Change Gig Worker</DialogTitle>
            <DialogDescription>
              Select a new gig worker for {changeGigWorkerDialog?.caseIds.length || 0} case(s)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Allocation Type Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Gig Worker Type</label>
              <div className="flex space-x-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    value="direct"
                    checked={allocationType === 'direct'}
                    onChange={(e) => {
                      setAllocationType('direct');
                      setSelectedGigWorker('');
                    }}
                    className="text-blue-600"
                  />
                  <span className="text-sm">Direct Gig Worker</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    value="vendor"
                    checked={allocationType === 'vendor'}
                    onChange={(e) => {
                      setAllocationType('vendor');
                      setSelectedGigWorker('');
                    }}
                    className="text-blue-600"
                  />
                  <span className="text-sm">Vendor Gig Workers</span>
                </label>
              </div>
            </div>

            {isLoadingWorkers ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-sm text-muted-foreground">Loading available gig workers...</div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Direct Gig Worker Selection */}
                {allocationType === 'direct' && (
                  <div>
                    <label htmlFor="direct-gig-worker-select" className="text-sm font-medium">
                      Select Direct Gig Worker
                    </label>
                    <Select value={selectedGigWorker} onValueChange={setSelectedGigWorker}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Choose a direct gig worker..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableDirectGigWorkers.map((worker) => (
                          <SelectItem key={worker.candidate_id} value={worker.candidate_id}>
                            <div className="flex items-center justify-between w-full">
                              <span>{worker.candidate_name}</span>
                              <div className="flex items-center space-x-2 text-xs text-muted-foreground ml-4">
                                <span>Capacity: {worker.capacity_available}/{worker.max_daily_capacity}</span>
                                <span>Quality: {Math.round((worker.quality_score || 0) * 100)}%</span>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {availableDirectGigWorkers.length === 0 && (
                      <Alert className="mt-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          No available direct gig workers found for this pincode.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

                {/* Vendor Gig Worker Selection */}
                {allocationType === 'vendor' && (
                  <div>
                    <label htmlFor="vendor-gig-worker-select" className="text-sm font-medium">
                      Select Vendor Gig Worker
                    </label>
                    <Select value={selectedGigWorker} onValueChange={setSelectedGigWorker}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Choose a vendor gig worker..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableVendorGigWorkers.map((worker) => (
                          <SelectItem key={worker.candidate_id} value={worker.candidate_id}>
                            <div className="flex items-center justify-between w-full">
                              <span>{worker.candidate_name}</span>
                              <div className="flex items-center space-x-2 text-xs text-muted-foreground ml-4">
                                <span>Capacity: {worker.capacity_available}/{worker.max_daily_capacity}</span>
                                <span>Quality: {Math.round((worker.quality_score || 0) * 100)}%</span>
                                {worker.vendor_name && (
                                  <span className="text-blue-600">({worker.vendor_name})</span>
                                )}
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {availableVendorGigWorkers.length === 0 && (
                      <Alert className="mt-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          No available vendor gig workers found for this pincode.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

                {/* Selected Worker Details */}
                {selectedGigWorker && (() => {
                  const worker = allocationType === 'direct'
                    ? availableDirectGigWorkers.find(w => w.candidate_id === selectedGigWorker)
                    : availableVendorGigWorkers.find(w => w.candidate_id === selectedGigWorker);
                  
                  if (!worker) return null;
                  
                  return (
                    <div className="bg-muted p-4 rounded-lg">
                      <h4 className="font-medium mb-2">Selected Gig Worker Details</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Name:</span> {worker.candidate_name}
                        </div>
                        <div>
                          <span className="font-medium">Capacity:</span> {worker.capacity_available}/{worker.max_daily_capacity}
                        </div>
                        <div>
                          <span className="font-medium">Quality Score:</span> {Math.round((worker.quality_score || 0) * 100)}%
                        </div>
                        <div>
                          <span className="font-medium">Completion Rate:</span> {Math.round((worker.completion_rate || 0) * 100)}%
                        </div>
                        {worker.vendor_name && (
                          <div className="col-span-2">
                            <span className="font-medium">Vendor:</span> {worker.vendor_name}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setChangeGigWorkerDialog(null);
                setSelectedGigWorker('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmGigWorkerChange}
              disabled={!selectedGigWorker}
            >
              Confirm Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

