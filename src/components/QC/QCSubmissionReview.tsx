import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  CheckCircle, 
  XCircle, 
  RotateCcw, 
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  RefreshCw
} from 'lucide-react';
import DynamicFormSubmission from '@/components/CaseManagement/DynamicFormSubmission';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { qcService, QCReviewRequest } from '@/services/qcService';

interface QCSubmissionReviewProps {
  caseId: string;
  caseNumber: string;
  candidateName: string;
  isOpen: boolean;
  onClose: () => void;
  onActionComplete?: () => void;
}

interface QCAction {
  action: 'approve' | 'reject' | 'rework';
  comments: string;
  reasonCodes: string[];
}

const QC_REASON_CODES = [
  { id: 'photo_quality', label: 'Poor Photo Quality', category: 'technical' },
  { id: 'missing_evidence', label: 'Missing Evidence', category: 'completeness' },
  { id: 'location_mismatch', label: 'Location Mismatch', category: 'accuracy' },
  { id: 'document_illegible', label: 'Document Illegible', category: 'technical' },
  { id: 'incomplete_verification', label: 'Incomplete Verification', category: 'completeness' },
  { id: 'wrong_address', label: 'Wrong Address', category: 'accuracy' },
  { id: 'time_mismatch', label: 'Time Mismatch', category: 'accuracy' },
  { id: 'other', label: 'Other', category: 'general' },
];

export default function QCSubmissionReview({ 
  caseId, 
  caseNumber, 
  candidateName, 
  isOpen, 
  onClose, 
  onActionComplete 
}: QCSubmissionReviewProps) {
  const [selectedAction, setSelectedAction] = useState<'approve' | 'reject' | 'rework' | null>(null);
  const [comments, setComments] = useState('');
  const [reasonCodes, setReasonCodes] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleActionSelect = (action: 'approve' | 'reject' | 'rework') => {
    setSelectedAction(action);
    if (action === 'approve') {
      setReasonCodes([]);
    }
  };

  const handleReasonCodeToggle = (reasonId: string) => {
    setReasonCodes(prev => 
      prev.includes(reasonId) 
        ? prev.filter(id => id !== reasonId)
        : [...prev, reasonId]
    );
  };

  const handleSubmitAction = async () => {
    if (!selectedAction) return;

    // Validation for reject/rework actions
    if (selectedAction !== 'approve') {
      // Either reason codes OR comments must be provided
      if (reasonCodes.length === 0 && !comments.trim()) {
        toast({
          title: 'Feedback Required',
          description: 'Please select at least one reason code OR provide comments for rejection or rework.',
          variant: 'destructive',
        });
        return;
      }
    }

    if (!user?.id) {
      toast({
        title: 'Authentication Error',
        description: 'User not authenticated. Please log in again.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    try {
      // Prepare QC review request
      const qcReviewRequest: QCReviewRequest = {
        caseId,
        submissionId: '', // Will be fetched by the service
        reviewerId: user.id,
        result: selectedAction === 'approve' ? 'pass' : selectedAction === 'reject' ? 'reject' : 'rework',
        reasonCodes,
        comments: comments.trim(),
        qualityScores: {
          overall_score: selectedAction === 'approve' ? 85 : selectedAction === 'reject' ? 30 : 60, // Default scores
        },
        reworkInstructions: selectedAction === 'rework' ? comments.trim() : undefined,
        reworkDeadline: selectedAction === 'rework' ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : undefined, // 24 hours from now
      };

      // Submit QC review to database
      const result = await qcService.submitQCReview(qcReviewRequest);

      if (!result.success) {
        throw new Error(result.error || 'Failed to submit QC review');
      }

      const actionText = selectedAction === 'approve' ? 'approved' : 
                        selectedAction === 'reject' ? 'rejected' : 'marked for rework';

      toast({
        title: 'QC Action Submitted',
        description: `Case ${caseNumber} has been ${actionText} successfully.`,
      });

      // Reset form
      setSelectedAction(null);
      setComments('');
      setReasonCodes([]);
      
      // Close dialog and notify parent
      onClose();
      onActionComplete?.();
    } catch (error) {
      console.error('Failed to submit QC action:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to submit QC action. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (isProcessing) return;
    
    setSelectedAction(null);
    setComments('');
    setReasonCodes([]);
    onClose();
  };

  const getActionButtonVariant = (action: string) => {
    if (selectedAction === action) {
      switch (action) {
        case 'approve': return 'default';
        case 'reject': return 'destructive';
        case 'rework': return 'default';
        default: return 'outline';
      }
    }
    return 'outline';
  };

  const getActionButtonIcon = (action: string) => {
    switch (action) {
      case 'approve': return <ThumbsUp className="h-4 w-4" />;
      case 'reject': return <ThumbsDown className="h-4 w-4" />;
      case 'rework': return <RotateCcw className="h-4 w-4" />;
      default: return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            QC Review - {caseNumber}
          </DialogTitle>
          <DialogDescription>
            Review submission details for {candidateName} and make QC decision
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-6">
            {/* Submission Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Submission Details</CardTitle>
                <CardDescription>
                  Review all submitted form data, files, and evidence
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DynamicFormSubmission caseId={caseId} />
              </CardContent>
            </Card>

            {/* QC Action Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">QC Decision</CardTitle>
                <CardDescription>
                  Select your decision and provide feedback
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Action Buttons */}
                <div className="space-y-3">
                  <Label>Select Action</Label>
                  <div className="flex gap-3">
                    <Button
                      variant={getActionButtonVariant('approve')}
                      onClick={() => handleActionSelect('approve')}
                      className="flex-1"
                      disabled={isProcessing}
                    >
                      {getActionButtonIcon('approve')}
                      <span className="ml-2">Approve</span>
                    </Button>
                    <Button
                      variant={getActionButtonVariant('reject')}
                      onClick={() => handleActionSelect('reject')}
                      className="flex-1"
                      disabled={isProcessing}
                    >
                      {getActionButtonIcon('reject')}
                      <span className="ml-2">Reject</span>
                    </Button>
                    <Button
                      variant={getActionButtonVariant('rework')}
                      onClick={() => handleActionSelect('rework')}
                      className="flex-1"
                      disabled={isProcessing}
                    >
                      {getActionButtonIcon('rework')}
                      <span className="ml-2">Rework Needed</span>
                    </Button>
                  </div>
                </div>

                {/* Reason Codes (for reject/rework) */}
                {selectedAction && selectedAction !== 'approve' && (
                  <div className="space-y-3">
                    <Label>
                      Reason Codes <span className="text-muted-foreground text-sm">(Select at least one OR provide comments below)</span>
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      {QC_REASON_CODES.map((reason) => (
                        <Button
                          key={reason.id}
                          variant={reasonCodes.includes(reason.id) ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleReasonCodeToggle(reason.id)}
                          className="justify-start"
                          disabled={isProcessing}
                        >
                          {reason.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Comments */}
                <div className="space-y-3">
                  <Label htmlFor="comments">
                    Comments 
                    {selectedAction && selectedAction !== 'approve' && (
                      <span className="text-muted-foreground text-sm ml-2">
                        (Required if no reason codes selected above)
                      </span>
                    )}
                  </Label>
                  <Textarea
                    id="comments"
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder={
                      selectedAction === 'approve' 
                        ? 'Add any additional comments (optional)...'
                        : 'Please explain the reason for rejection or rework...'
                    }
                    rows={4}
                    disabled={isProcessing}
                  />
                </div>

                {/* Action Summary */}
                {selectedAction && (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="font-medium">Action Summary</span>
                    </div>
                    <div className="text-sm space-y-1">
                      <p><strong>Action:</strong> {selectedAction === 'approve' ? 'Approve' : selectedAction === 'reject' ? 'Reject' : 'Rework Needed'}</p>
                      {reasonCodes.length > 0 && (
                        <p><strong>Reasons:</strong> {reasonCodes.map(id => QC_REASON_CODES.find(r => r.id === id)?.label).join(', ')}</p>
                      )}
                      {comments && (
                        <p><strong>Comments:</strong> {comments}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <div className="flex justify-end pt-4">
                  <Button 
                    onClick={handleSubmitAction}
                    disabled={!selectedAction || isProcessing}
                    className="min-w-[120px]"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Submit Decision
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
