import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MapPin, User, Star, CheckCircle } from 'lucide-react';

interface AllocationSummaryData {
  gigWorkerId: string;
  gigWorkerName: string;
  gigWorkerType: 'gig' | 'vendor';
  totalCases: number;
  assignedCases: {
    caseId: string;
    caseNumber: string;
    pincode: string;
    pincodeTier: string;
  }[];
  associatedPincodes: string[];
  qualityScore: number;
  completionRate: number;
  onTimeRate: number;
  acceptanceRate: number;
}

interface AllocationSummaryProps {
  data: AllocationSummaryData[];
  totalAllocated: number;
  totalFailed: number;
}

export default function AllocationSummary({ data, totalAllocated, totalFailed }: AllocationSummaryProps) {
  const getQualityBadge = (score: number) => {
    if (score >= 0.8) return <Badge className="bg-green-100 text-green-800">Excellent</Badge>;
    if (score >= 0.6) return <Badge className="bg-yellow-100 text-yellow-800">Good</Badge>;
    if (score >= 0.4) return <Badge className="bg-orange-100 text-orange-800">Fair</Badge>;
    return <Badge className="bg-red-100 text-red-800">Poor</Badge>;
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    if (score >= 0.4) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          Allocation Summary
        </CardTitle>
        <CardDescription>
          Overview of allocated cases by gig worker
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="font-semibold text-green-800">Successfully Allocated</span>
            </div>
            <p className="text-2xl font-bold text-green-900">{totalAllocated}</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-red-600" />
              <span className="font-semibold text-red-800">Failed Allocations</span>
            </div>
            <p className="text-2xl font-bold text-red-900">{totalFailed}</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-blue-600" />
              <span className="font-semibold text-blue-800">Gig Workers</span>
            </div>
            <p className="text-2xl font-bold text-blue-900">{data.length}</p>
          </div>
        </div>

        {/* Detailed Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-48">Gig Worker</TableHead>
                <TableHead className="w-24">Total Cases</TableHead>
                <TableHead className="w-48">Assigned Cases</TableHead>
                <TableHead className="w-48">Coverage Pincodes</TableHead>
                <TableHead className="w-32">Quality Score</TableHead>
                <TableHead className="w-32">Performance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((worker, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{worker.gigWorkerName}</p>
                        <p className="text-sm text-muted-foreground capitalize">
                          {worker.gigWorkerType}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-lg">
                      {worker.totalCases}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {worker.assignedCases.slice(0, 3).map((caseItem, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{caseItem.caseNumber}</p>
                            <p className="text-xs text-muted-foreground">
                              {caseItem.pincode} ({caseItem.pincodeTier})
                            </p>
                          </div>
                        </div>
                      ))}
                      {worker.assignedCases.length > 3 && (
                        <p className="text-xs text-muted-foreground">
                          +{worker.assignedCases.length - 3} more cases
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {worker.associatedPincodes.slice(0, 3).map((pincode, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {pincode}
                        </Badge>
                      ))}
                      {worker.associatedPincodes.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{worker.associatedPincodes.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-yellow-500" />
                      <span className={`font-semibold ${getScoreColor(worker.qualityScore)}`}>
                        {(worker.qualityScore * 100).toFixed(1)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span>Completion:</span>
                        <span className={getScoreColor(worker.completionRate)}>
                          {(worker.completionRate * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>On-time:</span>
                        <span className={getScoreColor(worker.onTimeRate)}>
                          {(worker.onTimeRate * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Acceptance:</span>
                        <span className={getScoreColor(worker.acceptanceRate)}>
                          {(worker.acceptanceRate * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {data.length === 0 && (
          <div className="text-center py-8">
            <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No allocations found</h3>
            <p className="text-muted-foreground">
              Run an allocation to see the summary here
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
