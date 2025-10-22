import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Upload, FileText, CheckCircle, XCircle, AlertCircle, Calendar, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { csvService, CSVImportResult, CSVExportOptions } from '@/services/csvService';

interface CSVManagementProps {
  onRefresh?: () => void;
}

export default function CSVManagement({ onRefresh }: CSVManagementProps) {
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<'create' | 'update'>('create');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<CSVImportResult | null>(null);
  const [exportOptions, setExportOptions] = useState<CSVExportOptions>({});
  const [isExporting, setIsExporting] = useState(false);
  const [templateContent, setTemplateContent] = useState('');
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setImportFile(file);
    } else {
      toast({
        title: 'Invalid File',
        description: 'Please select a valid CSV file',
        variant: 'destructive',
      });
    }
  };

  const handleImport = async () => {
    if (!importFile) return;

    setIsImporting(true);
    try {
      const content = await importFile.text();
      const result = await csvService.importCases(content, importMode === 'update');
      
      setImportResult(result);
      
      if (result.successful > 0) {
        toast({
          title: 'Import Successful',
          description: `Successfully processed ${result.successful} cases. ${result.failed} failed.`,
          variant: result.failed > 0 ? 'destructive' : 'default',
        });
        onRefresh?.();
      } else {
        toast({
          title: 'Import Failed',
          description: 'No cases were processed successfully',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Import failed:', error);
      toast({
        title: 'Import Error',
        description: 'Failed to import cases',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const csvContent = await csvService.exportCases(exportOptions);
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cases_export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: 'Export Successful',
        description: 'Cases exported successfully',
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: 'Export Error',
        description: 'Failed to export cases',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const template = csvService.generateTemplate();
      const blob = new Blob([template], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'case_import_template.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: 'Template Downloaded',
        description: 'CSV template downloaded successfully',
      });
    } catch (error) {
      console.error('Template download failed:', error);
      toast({
        title: 'Download Error',
        description: 'Failed to download template',
        variant: 'destructive',
      });
    }
  };

  const handleTestPayoutCalculation = async () => {
    try {
      await csvService.testPayoutCalculation();
      toast({
        title: 'Payout Test Complete',
        description: 'Check console for payout calculation results',
      });
    } catch (error) {
      console.error('Payout test failed:', error);
      toast({
        title: 'Test Error',
        description: 'Failed to test payout calculation',
        variant: 'destructive',
      });
    }
  };

  const resetImport = () => {
    setImportFile(null);
    setImportResult(null);
    setImportMode('create');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          CSV Management
        </CardTitle>
        <CardDescription>
          Import and export cases using CSV files
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="import" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="import">Import Cases</TabsTrigger>
            <TabsTrigger value="export">Export Cases</TabsTrigger>
          </TabsList>
          
          <TabsContent value="import" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Button onClick={() => setIsImportDialogOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Import CSV
                </Button>
                <Button variant="outline" onClick={handleDownloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
                <Button variant="outline" onClick={handleTestPayoutCalculation}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Test Payout
                </Button>
              </div>

              {importResult && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <div className="flex items-center gap-4">
                        <Badge variant="default">
                          {importResult.successful} Successful
                        </Badge>
                        {importResult.failed > 0 && (
                          <Badge variant="destructive">
                            {importResult.failed} Failed
                          </Badge>
                        )}
                      </div>
                      {importResult.errors.length > 0 && (
                        <div className="text-sm text-muted-foreground">
                          <strong>Errors:</strong>
                          <ul className="list-disc list-inside mt-1">
                            {importResult.errors.slice(0, 5).map((error, index) => (
                              <li key={index}>{error}</li>
                            ))}
                            {importResult.errors.length > 5 && (
                              <li>... and {importResult.errors.length - 5} more errors</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </TabsContent>

          <TabsContent value="export" className="space-y-4">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="status-filter">Status</Label>
                  <Select
                    value={exportOptions.status?.[0] || 'all'}
                    onValueChange={(value) => 
                      setExportOptions(prev => ({ 
                        ...prev, 
                        status: value === 'all' ? undefined : [value]
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="allocated">Allocated</SelectItem>
                      <SelectItem value="accepted">Accepted</SelectItem>
                      <SelectItem value="pending_allocation">Pending Allocation</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="submitted">Submitted</SelectItem>
                      <SelectItem value="qc_passed">QC Passed</SelectItem>
                      <SelectItem value="qc_rejected">QC Rejected</SelectItem>
                      <SelectItem value="qc_rework">QC Rework</SelectItem>
                      <SelectItem value="reported">Reported</SelectItem>
                      <SelectItem value="in_payment_cycle">In Payment Cycle</SelectItem>
                      <SelectItem value="payment_complete">Payment Complete</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="priority-filter">Priority</Label>
                  <Select
                    value={exportOptions.priority?.[0] || 'all'}
                    onValueChange={(value) => 
                      setExportOptions(prev => ({ 
                        ...prev, 
                        priority: value === 'all' ? undefined : [value]
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All priorities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All priorities</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="date-from">Date From</Label>
                  <Input
                    id="date-from"
                    type="date"
                    value={exportOptions.date_from || ''}
                    onChange={(e) => 
                      setExportOptions(prev => ({ 
                        ...prev, 
                        date_from: e.target.value || undefined 
                      }))
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="date-to">Date To</Label>
                  <Input
                    id="date-to"
                    type="date"
                    value={exportOptions.date_to || ''}
                    onChange={(e) => 
                      setExportOptions(prev => ({ 
                        ...prev, 
                        date_to: e.target.value || undefined 
                      }))
                    }
                  />
                </div>
              </div>

              <Button onClick={handleExport} disabled={isExporting}>
                {isExporting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* Import Dialog */}
        <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Import Cases from CSV</DialogTitle>
              <DialogDescription>
                Upload a CSV file to import cases. Make sure your file follows the template format.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="import-mode">Import Mode</Label>
                <Select value={importMode} onValueChange={(value: 'create' | 'update') => setImportMode(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="create">Create New Cases</SelectItem>
                    <SelectItem value="update">Update Existing Cases</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="csv-file">CSV File</Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                />
              </div>

              {importFile && (
                <Alert>
                  <FileText className="h-4 w-4" />
                  <AlertDescription>
                    Selected: {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsImportDialogOpen(false);
                  resetImport();
                }}
                disabled={isImporting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={!importFile || isImporting}
              >
                {isImporting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Importing...
                  </>
                ) : (
                  'Import Cases'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
