import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  CheckCircle, 
  XCircle, 
  RotateCcw, 
  Eye, 
  MapPin, 
  Clock, 
  User, 
  FileText,
  Image,
  Navigation,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface QCSubmission {
  id: string;
  case_id: string;
  case_number: string;
  gig_worker: {
    id: string;
    name: string;
    phone: string;
  };
  submitted_at: string;
  status: 'pending' | 'in_review' | 'passed' | 'rejected' | 'rework';
  photos: Array<{
    id: string;
    photo_url: string;
    taken_at: string;
    location: {
      lat: number;
      lng: number;
    };
    category: 'premises' | 'documents' | 'evidence' | 'other';
    description?: string;
  }>;
  answers: Record<string, any>;
  notes: string;
  qc_reviews: Array<{
    id: string;
    reviewer: string;
    result: 'pass' | 'reject' | 'rework';
    comments: string;
    reviewed_at: string;
  }>;
}

interface QCReview {
  result: 'pass' | 'reject' | 'rework';
  comments: string;
  reason_codes: string[];
  quality_score: number;
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

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_review: 'bg-blue-100 text-blue-800',
  passed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  rework: 'bg-orange-100 text-orange-800',
};

export default function QCWorkbench() {
  const [submissions, setSubmissions] = useState<QCSubmission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<QCSubmission | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReviewing, setIsReviewing] = useState(false);
  const [review, setReview] = useState<QCReview>({
    result: 'pass',
    comments: '',
    reason_codes: [],
    quality_score: 85,
  });
  const { toast } = useToast();

  // Mock data - in real app, this would come from API
  useEffect(() => {
    const mockSubmissions: QCSubmission[] = [
      {
        id: '1',
        case_id: 'case-1',
        case_number: 'BG-20250120-000001',
        gig_worker: {
          id: 'gw-1',
          name: 'Rajesh Kumar',
          phone: '+91 98765 43210',
        },
        submitted_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        status: 'pending',
        photos: [
          {
            id: 'photo-1',
            photo_url: '/placeholder.svg',
            taken_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            location: { lat: 19.0760, lng: 72.8777 },
            category: 'premises',
            description: 'Front view of the building',
          },
          {
            id: 'photo-2',
            photo_url: '/placeholder.svg',
            taken_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            location: { lat: 19.0760, lng: 72.8777 },
            category: 'documents',
            description: 'Property documents',
          },
        ],
        answers: {
          'address_verified': true,
          'person_met': 'John Doe',
          'documents_verified': true,
          'additional_notes': 'All documents verified successfully',
        },
        notes: 'Verification completed successfully. All documents are in order.',
        qc_reviews: [],
      },
      {
        id: '2',
        case_id: 'case-2',
        case_number: 'BG-20250120-000002',
        gig_worker: {
          id: 'gw-2',
          name: 'Priya Sharma',
          phone: '+91 98765 43211',
        },
        submitted_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        status: 'in_review',
        photos: [
          {
            id: 'photo-3',
            photo_url: '/placeholder.svg',
            taken_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
            location: { lat: 28.6139, lng: 77.2090 },
            category: 'premises',
            description: 'Building entrance',
          },
        ],
        answers: {
          'address_verified': true,
          'person_met': 'Jane Smith',
          'documents_verified': false,
          'additional_notes': 'Documents were not available',
        },
        notes: 'Address verified but documents were not provided by the resident.',
        qc_reviews: [],
      },
    ];

    setSubmissions(mockSubmissions);
    setIsLoading(false);
  }, []);

  const handleSelectSubmission = (submission: QCSubmission) => {
    setSelectedSubmission(submission);
    setReview({
      result: 'pass',
      comments: '',
      reason_codes: [],
      quality_score: 85,
    });
  };

  const handleReviewSubmit = async () => {
    if (!selectedSubmission) return;

    setIsReviewing(true);
    try {
      // In real app, this would be an API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      const updatedSubmission = {
        ...selectedSubmission,
        status: review.result === 'pass' ? 'passed' : review.result === 'reject' ? 'rejected' : 'rework',
        qc_reviews: [
          ...selectedSubmission.qc_reviews,
          {
            id: Date.now().toString(),
            reviewer: 'Current User',
            result: review.result,
            comments: review.comments,
            reviewed_at: new Date().toISOString(),
          },
        ],
      };

      setSubmissions(prev => 
        prev.map(sub => sub.id === selectedSubmission.id ? updatedSubmission : sub)
      );
      setSelectedSubmission(updatedSubmission);

      toast({
        title: 'Review Submitted',
        description: `Submission ${review.result === 'pass' ? 'passed' : review.result === 'reject' ? 'rejected' : 'marked for rework'}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to submit review',
        variant: 'destructive',
      });
    } finally {
      setIsReviewing(false);
    }
  };

  const handleReasonCodeToggle = (reasonId: string) => {
    setReview(prev => ({
      ...prev,
      reason_codes: prev.reason_codes.includes(reasonId)
        ? prev.reason_codes.filter(id => id !== reasonId)
        : [...prev.reason_codes, reasonId],
    }));
  };

  const getStatusBadge = (status: QCSubmission['status']) => (
    <Badge className={STATUS_COLORS[status]}>
      {status.replace('_', ' ').toUpperCase()}
    </Badge>
  );

  const getQualityScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">QC Workbench</h1>
          <p className="text-muted-foreground">
            Review and quality check case submissions
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            {submissions.filter(s => s.status === 'pending').length} pending
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Submissions List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Submissions Queue</CardTitle>
              <CardDescription>
                {submissions.length} submissions to review
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {submissions.map((submission) => (
                <div
                  key={submission.id}
                  className={`p-3 border rounded-lg cursor-pointer hover:bg-muted/50 ${
                    selectedSubmission?.id === submission.id ? 'border-primary bg-primary/5' : ''
                  }`}
                  onClick={() => handleSelectSubmission(submission)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{submission.case_number}</span>
                    {getStatusBadge(submission.status)}
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span>{submission.gig_worker.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(submission.submitted_at).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Image className="h-3 w-3" />
                      <span>{submission.photos.length} photos</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>TAT: {submission.tat_hours || 'N/A'}h</span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Review Panel */}
        <div className="lg:col-span-2">
          {selectedSubmission ? (
            <div className="space-y-6">
              {/* Submission Header */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{selectedSubmission.case_number}</CardTitle>
                      <CardDescription>
                        Submitted by {selectedSubmission.gig_worker.name}
                      </CardDescription>
                    </div>
                    {getStatusBadge(selectedSubmission.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Submitted</p>
                      <p className="font-medium">
                        {new Date(selectedSubmission.submitted_at).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Gig Worker</p>
                      <p className="font-medium">{selectedSubmission.gig_worker.name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Photos</p>
                      <p className="font-medium">{selectedSubmission.photos.length}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Previous Reviews</p>
                      <p className="font-medium">{selectedSubmission.qc_reviews.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Photos Gallery */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Image className="h-5 w-5" />
                    Evidence Photos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {selectedSubmission.photos.map((photo) => (
                      <div key={photo.id} className="space-y-2">
                        <div className="relative">
                          <img
                            src={photo.photo_url}
                            alt="Evidence photo"
                            className="w-full h-32 object-cover rounded-lg border"
                          />
                          <div className="absolute top-2 left-2">
                            <Badge variant="secondary" className="text-xs">
                              {photo.category}
                            </Badge>
                          </div>
                          <div className="absolute top-2 right-2">
                            <Button size="sm" variant="secondary">
                              <Eye className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium">{photo.description}</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{new Date(photo.taken_at).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span>{photo.location.lat.toFixed(4)}, {photo.location.lng.toFixed(4)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Answers */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Verification Answers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(selectedSubmission.answers).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-sm font-medium capitalize">
                          {key.replace('_', ' ')}:
                        </span>
                        <span className="text-sm">
                          {typeof value === 'boolean' ? (
                            <Badge variant={value ? 'default' : 'destructive'}>
                              {value ? 'Yes' : 'No'}
                            </Badge>
                          ) : Array.isArray(value) ? (
                            <div className="flex flex-wrap gap-1">
                              {value.map((item, index) => {
                                // Handle both string values and objects with label/value structure
                                const displayValue = typeof item === 'object' && item !== null && 'label' in item ? item.label : item;
                                return <Badge key={index} variant="secondary">{String(displayValue)}</Badge>;
                              })}
                            </div>
                          ) : typeof value === 'object' && value !== null ? (
                            // Handle objects that might have label/value structure
                            'label' in value ? String(value.label) : 
                            'value' in value ? String(value.value) :
                            JSON.stringify(value)
                          ) : (
                            String(value)
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                  {selectedSubmission.notes && (
                    <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm font-medium mb-1">Notes:</p>
                      <p className="text-sm text-muted-foreground">{selectedSubmission.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* QC Review Form */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    QC Review
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Review Result */}
                  <div className="space-y-2">
                    <Label>Review Result</Label>
                    <div className="flex gap-2">
                      <Button
                        variant={review.result === 'pass' ? 'default' : 'outline'}
                        onClick={() => setReview(prev => ({ ...prev, result: 'pass' }))}
                        className="flex-1"
                      >
                        <ThumbsUp className="h-4 w-4 mr-2" />
                        Pass
                      </Button>
                      <Button
                        variant={review.result === 'reject' ? 'destructive' : 'outline'}
                        onClick={() => setReview(prev => ({ ...prev, result: 'reject' }))}
                        className="flex-1"
                      >
                        <ThumbsDown className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                      <Button
                        variant={review.result === 'rework' ? 'default' : 'outline'}
                        onClick={() => setReview(prev => ({ ...prev, result: 'rework' }))}
                        className="flex-1"
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Rework
                      </Button>
                    </div>
                  </div>

                  {/* Quality Score */}
                  <div className="space-y-2">
                    <Label>Quality Score: {review.quality_score}%</Label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={review.quality_score}
                      onChange={(e) => setReview(prev => ({ ...prev, quality_score: parseInt(e.target.value) }))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Poor</span>
                      <span className={getQualityScoreColor(review.quality_score)}>
                        {review.quality_score >= 90 ? 'Excellent' : 
                         review.quality_score >= 70 ? 'Good' : 'Needs Improvement'}
                      </span>
                      <span>Excellent</span>
                    </div>
                  </div>

                  {/* Reason Codes */}
                  <div className="space-y-2">
                    <Label>Reason Codes (if rejecting or reworking)</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {QC_REASON_CODES.map((reason) => (
                        <Button
                          key={reason.id}
                          variant={review.reason_codes.includes(reason.id) ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleReasonCodeToggle(reason.id)}
                          className="justify-start"
                        >
                          {reason.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Comments */}
                  <div className="space-y-2">
                    <Label>Comments</Label>
                    <Textarea
                      value={review.comments}
                      onChange={(e) => setReview(prev => ({ ...prev, comments: e.target.value }))}
                      placeholder="Add your review comments..."
                      rows={4}
                    />
                  </div>

                  {/* Submit Button */}
                  <Button 
                    onClick={handleReviewSubmit} 
                    disabled={isReviewing}
                    className="w-full"
                  >
                    {isReviewing ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Submitting Review...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Submit Review
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Select a Submission</h3>
                <p className="text-muted-foreground">
                  Choose a submission from the list to start reviewing
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

