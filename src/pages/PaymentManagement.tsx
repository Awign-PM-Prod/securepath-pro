import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  DollarSign, 
  Calendar, 
  Users, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Download,
  Plus,
  RefreshCw,
  FileText
} from 'lucide-react';
import { paymentService, PaymentCycle, PaymentLine } from '@/services/paymentService';
import { useToast } from '@/hooks/use-toast';

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-800',
  processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const PAYMENT_STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function PaymentManagement() {
  const [paymentCycles, setPaymentCycles] = useState<PaymentCycle[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<PaymentCycle | null>(null);
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadPaymentCycles();
  }, []);

  const loadPaymentCycles = async () => {
    setIsLoading(true);
    try {
      const cycles = await paymentService.getPaymentCycles();
      setPaymentCycles(cycles);
    } catch (error) {
      console.error('Failed to load payment cycles:', error);
      toast({
        title: 'Error',
        description: 'Failed to load payment cycles',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadPaymentLines = async (cycleId: string) => {
    try {
      const lines = await paymentService.getPaymentLines(cycleId);
      setPaymentLines(lines);
    } catch (error) {
      console.error('Failed to load payment lines:', error);
      toast({
        title: 'Error',
        description: 'Failed to load payment lines',
        variant: 'destructive',
      });
    }
  };

  const handleCreateCycle = async () => {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 14); // 2 weeks

    try {
      const cycle = await paymentService.createPaymentCycle(
        startDate.toISOString(),
        endDate.toISOString()
      );

      if (cycle) {
        await loadPaymentCycles();
        toast({
          title: 'Payment Cycle Created',
          description: 'New payment cycle has been created successfully',
        });
      } else {
        throw new Error('Failed to create cycle');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create payment cycle',
        variant: 'destructive',
      });
    }
  };

  const handleProcessCycle = async (cycleId: string) => {
    setIsProcessing(true);
    try {
      const success = await paymentService.processPaymentCycle(cycleId);
      if (success) {
        await loadPaymentCycles();
        if (selectedCycle?.id === cycleId) {
          await loadPaymentLines(cycleId);
        }
        toast({
          title: 'Payment Cycle Processed',
          description: 'Payment cycle has been processed successfully',
        });
      } else {
        throw new Error('Failed to process cycle');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to process payment cycle',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectCycle = async (cycle: PaymentCycle) => {
    setSelectedCycle(cycle);
    await loadPaymentLines(cycle.id);
  };

  const getStatusBadge = (status: string, statusColors: Record<string, string>) => (
    <Badge className={statusColors[status] || 'bg-gray-100 text-gray-800'}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
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
          <h1 className="text-3xl font-bold">Payment Management</h1>
          <p className="text-muted-foreground">
            Manage payment cycles, vendor payouts, and financial reporting
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadPaymentCycles}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleCreateCycle}>
            <Plus className="h-4 w-4 mr-2" />
            Create Cycle
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cycles</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{paymentCycles.length}</div>
            <p className="text-xs text-muted-foreground">All payment cycles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Cycles</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {paymentCycles.filter(c => c.status === 'processing').length}
            </div>
            <p className="text-xs text-muted-foreground">Currently processing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(paymentCycles.reduce((sum, cycle) => sum + cycle.total_amount_inr, 0))}
            </div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cases</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {paymentCycles.reduce((sum, cycle) => sum + cycle.total_cases, 0)}
            </div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="cycles" className="space-y-6">
        <TabsList>
          <TabsTrigger value="cycles">Payment Cycles</TabsTrigger>
          <TabsTrigger value="lines">Payment Lines</TabsTrigger>
          <TabsTrigger value="reports">Financial Reports</TabsTrigger>
        </TabsList>

        {/* Payment Cycles Tab */}
        <TabsContent value="cycles" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payment Cycles</CardTitle>
              <CardDescription>
                Manage bi-weekly payment cycles and processing
              </CardDescription>
            </CardHeader>
            <CardContent>
              {paymentCycles.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Payment Cycles</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first payment cycle to get started
                  </p>
                  <Button onClick={handleCreateCycle}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Payment Cycle
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cycle Tag</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Total Amount</TableHead>
                      <TableHead>Total Cases</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentCycles.map((cycle) => (
                      <TableRow 
                        key={cycle.id} 
                        className={`cursor-pointer hover:bg-muted/50 ${
                          selectedCycle?.id === cycle.id ? 'bg-primary/5' : ''
                        }`}
                        onClick={() => handleSelectCycle(cycle)}
                      >
                        <TableCell className="font-medium">{cycle.cycle_tag}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{new Date(cycle.start_date).toLocaleDateString()}</div>
                            <div className="text-muted-foreground">
                              to {new Date(cycle.end_date).toLocaleDateString()}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(cycle.status, STATUS_COLORS)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(cycle.total_amount_inr)}
                        </TableCell>
                        <TableCell>{cycle.total_cases}</TableCell>
                        <TableCell>
                          {new Date(cycle.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {cycle.status === 'draft' && (
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleProcessCycle(cycle.id);
                                }}
                                disabled={isProcessing}
                              >
                                {isProcessing ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  'Process'
                                )}
                              </Button>
                            )}
                            <Button size="sm" variant="outline">
                              <FileText className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Lines Tab */}
        <TabsContent value="lines" className="space-y-6">
          {selectedCycle ? (
            <Card>
              <CardHeader>
                <CardTitle>Payment Lines - {selectedCycle.cycle_tag}</CardTitle>
                <CardDescription>
                  Individual payment lines for this cycle
                </CardDescription>
              </CardHeader>
              <CardContent>
                {paymentLines.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Payment Lines</h3>
                    <p className="text-muted-foreground">
                      Process the payment cycle to generate payment lines
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Case ID</TableHead>
                        <TableHead>Gig Worker</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Base Rate</TableHead>
                        <TableHead>Adjustments</TableHead>
                        <TableHead>Total Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentLines.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell className="font-medium">
                            {line.case_id.slice(-8)}
                          </TableCell>
                          <TableCell>{line.gig_partner_id.slice(-8)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {line.assignment_type}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(line.base_rate_inr)}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>Travel: {formatCurrency(line.travel_allowance_inr)}</div>
                              <div>Bonus: {formatCurrency(line.bonus_inr)}</div>
                              <div>Adj: {formatCurrency(line.adjustment_inr)}</div>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(line.total_amount_inr)}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(line.status, PAYMENT_STATUS_COLORS)}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {line.status === 'pending' && (
                                <Button size="sm">
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Approve
                                </Button>
                              )}
                              {line.status === 'approved' && (
                                <Button size="sm" variant="outline">
                                  <DollarSign className="h-4 w-4 mr-1" />
                                  Pay
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Select a Payment Cycle</h3>
                <p className="text-muted-foreground">
                  Choose a payment cycle to view its payment lines
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Financial Reports Tab */}
        <TabsContent value="reports" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Financial Reports</CardTitle>
              <CardDescription>
                Generate and download financial reports
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Financial Reports</h3>
                <p className="text-muted-foreground mb-4">
                  Generate detailed financial reports and analytics
                </p>
                <Button>
                  <Download className="h-4 w-4 mr-2" />
                  Generate Report
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

