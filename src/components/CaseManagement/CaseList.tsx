import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Search, Filter, Plus, Eye, Edit, Trash2, MapPin, Clock, User, Building } from 'lucide-react';
import { format } from 'date-fns';

interface Case {
  id: string;
  case_number: string;
  client_case_id: string;
  contract_type: string;
  candidate_name: string;
  phone_primary: string;
  phone_secondary?: string;
  status: 'created' | 'auto_allocated' | 'pending_acceptance' | 'accepted' | 'in_progress' | 'submitted' | 'qc_pending' | 'qc_passed' | 'qc_rejected' | 'qc_rework' | 'completed' | 'reported' | 'in_payment_cycle' | 'cancelled';
  client: {
    id: string;
    name: string;
    email: string;
  };
  location: {
    address_line: string;
    city: string;
    state: string;
    pincode: string;
  };
  assignee?: {
    id: string;
    name: string;
    type: 'gig' | 'vendor';
  };
  vendor_tat_start_date: string;
  tat_hours: number;
  due_at: string;
  created_at: string;
  base_rate_inr?: number;
  bonus_inr?: number;
  penalty_inr?: number;
  total_payout_inr?: number;
}

interface CaseListProps {
  cases: Case[];
  onViewCase: (caseId: string) => void;
  onEditCase: (caseId: string) => void;
  onDeleteCase: (caseId: string) => void;
  onCreateCase: () => void;
  isLoading?: boolean;
}


const STATUS_COLORS = {
  created: 'bg-gray-100 text-gray-800',
  auto_allocated: 'bg-blue-100 text-blue-800',
  pending_acceptance: 'bg-yellow-100 text-yellow-800',
  accepted: 'bg-green-100 text-green-800',
  in_progress: 'bg-blue-100 text-blue-800',
  submitted: 'bg-purple-100 text-purple-800',
  qc_pending: 'bg-orange-100 text-orange-800',
  qc_passed: 'bg-green-100 text-green-800',
  qc_rejected: 'bg-red-100 text-red-800',
  qc_rework: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  reported: 'bg-green-100 text-green-800',
  in_payment_cycle: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

const STATUS_LABELS = {
  created: 'Created',
  auto_allocated: 'Auto Allocated',
  pending_acceptance: 'Pending Acceptance',
  accepted: 'Accepted',
  in_progress: 'In Progress',
  submitted: 'Submitted',
  qc_pending: 'QC Pending',
  qc_passed: 'QC Passed',
  qc_rejected: 'QC Rejected',
  qc_rework: 'QC Rework',
  completed: 'Completed',
  reported: 'Reported',
  in_payment_cycle: 'In Payment Cycle',
  cancelled: 'Cancelled',
};

export default function CaseList({ 
  cases, 
  onViewCase, 
  onEditCase, 
  onDeleteCase, 
  onCreateCase, 
  isLoading = false 
}: CaseListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

    const filteredCases = cases.filter(caseItem => {
    const matchesSearch = 
      caseItem.case_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      caseItem.client_case_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      caseItem.candidate_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      caseItem.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      caseItem.location.city.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || caseItem.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: Case['status']) => (
    <Badge className={STATUS_COLORS[status]}>
      {STATUS_LABELS[status]}
    </Badge>
  );

  const getContractTypeBadge = (contractType: string) => {
    const typeLabels: Record<string, string> = {
      'residential_address_check': 'Residential',
      'business_address_check': 'Business',
    };
    
    return (
      <Badge variant="outline">
        {typeLabels[contractType] || contractType}
      </Badge>
    );
  };

  const isOverdue = (dueAt: string) => {
    return new Date(dueAt) < new Date();
  };

  const getDaysUntilDue = (dueAt: string) => {
    const now = new Date();
    const due = new Date(dueAt);
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cases</CardTitle>
          <CardDescription>Loading cases...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Cases</CardTitle>
            <CardDescription>
              Manage background verification cases ({filteredCases.length} of {cases.length})
            </CardDescription>
          </div>
          <Button onClick={onCreateCase} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Case
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search cases, clients, or locations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Cases Table */}
        {filteredCases.length === 0 ? (
          <div className="text-center py-8">
            <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No cases found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Get started by creating your first case'
              }
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <Button onClick={onCreateCase}>
                <Plus className="h-4 w-4 mr-2" />
                Create Case
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Case #</TableHead>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Contract Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Payout</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCases.map((caseItem) => (
                  <TableRow key={caseItem.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <div>
                        <div className="font-semibold">{caseItem.case_number}</div>
                        <div className="text-sm text-muted-foreground">Client ID: {caseItem.client_case_id}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs">
                        <p className="font-medium truncate">{caseItem.candidate_name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {caseItem.phone_primary}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{caseItem.client.name}</p>
                          <p className="text-sm text-muted-foreground">{caseItem.client.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getContractTypeBadge(caseItem.contract_type)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{caseItem.location.city}, {caseItem.location.state}</p>
                          <p className="text-sm text-muted-foreground">{caseItem.location.pincode}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(caseItem.status)}
                    </TableCell>
                    <TableCell>
                      {caseItem.assignee ? (
                        <div>
                          <p className="font-medium">{caseItem.assignee.name}</p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {caseItem.assignee.type}
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className={`font-medium ${isOverdue(caseItem.due_at) ? 'text-red-600' : ''}`}>
                            {format(new Date(caseItem.due_at), 'MMM dd, yyyy')}
                          </p>
                          <p className={`text-sm ${isOverdue(caseItem.due_at) ? 'text-red-500' : 'text-muted-foreground'}`}>
                            {isOverdue(caseItem.due_at) 
                              ? 'Overdue' 
                              : `${getDaysUntilDue(caseItem.due_at)} days left`
                            }
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">₹{(caseItem.total_payout_inr || 0).toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground">
                          Base: ₹{(caseItem.base_rate_inr || 0).toFixed(2)}
                        </p>
                        {((caseItem.bonus_inr || 0) > 0 || (caseItem.penalty_inr || 0) > 0) && (
                          <p className="text-xs text-muted-foreground">
                            {(caseItem.bonus_inr || 0) > 0 && `+₹${(caseItem.bonus_inr || 0).toFixed(2)}`}
                            {(caseItem.penalty_inr || 0) > 0 && ` -₹${(caseItem.penalty_inr || 0).toFixed(2)}`}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onViewCase(caseItem.id)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onEditCase(caseItem.id)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Case
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => onDeleteCase(caseItem.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Case
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
