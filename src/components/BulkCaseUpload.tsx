// =====================================================
// Bulk Case Upload Component
// =====================================================

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Download, Upload, FileText, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { CSVTemplateService } from '@/services/csvTemplateService';
import { CSVParserService, ParsingResult } from '@/services/csvParserService';
import { BulkCaseService, BulkCreationResult } from '@/services/bulkCaseService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface BulkCaseUploadProps {
  onSuccess?: (result: BulkCreationResult) => void;
  onClose?: () => void;
}

export default function BulkCaseUpload({ onSuccess, onClose }: BulkCaseUploadProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'template' | 'upload' | 'parse' | 'create' | 'complete'>('template');
  const [csvContent, setCsvContent] = useState<string>('');
  const [parsingResult, setParsingResult] = useState<ParsingResult | null>(null);
  const [creationResult, setCreationResult] = useState<BulkCreationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  // Download template
  const handleDownloadTemplate = () => {
    try {
      CSVTemplateService.downloadTemplate();
      toast({
        title: 'Template Downloaded',
        description: 'CSV template has been downloaded successfully.',
      });
    } catch (error) {
      toast({
        title: 'Download Failed',
        description: 'Failed to download template. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast({
        title: 'Invalid File',
        description: 'Please upload a CSV file.',
        variant: 'destructive',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCsvContent(content);
      setStep('parse');
    };
    reader.readAsText(file);
  };

  // Parse CSV
  const handleParseCSV = async () => {
    if (!csvContent) return;

    setIsProcessing(true);
    setProgress(25);

    try {
      const result = await CSVParserService.parseCSV(csvContent);
      setParsingResult(result);
      setProgress(50);

      if (result.invalidRows.length > 0) {
        // Stay on parse step to show invalid cases, but allow proceeding with valid ones
        toast({
          title: 'Parsing Completed with Errors',
          description: `Found ${result.invalidRows.length} invalid case(s) and ${result.data.length} valid case(s). Please review invalid cases before proceeding.`,
          variant: 'destructive',
        });
      } else if (result.data.length > 0) {
        setStep('create');
        toast({
          title: 'CSV Parsed Successfully',
          description: `Found ${result.data.length} valid cases to create.`,
        });
      } else {
        toast({
          title: 'No Valid Cases',
          description: 'No valid cases found in the CSV file.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Parsing Error',
        description: 'Failed to parse CSV file. Please check the format.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Create cases
  const handleCreateCases = async () => {
    if (!parsingResult?.data || !user) return;

    setIsProcessing(true);
    setProgress(75);

    try {
      const result = await BulkCaseService.createBulkCases(parsingResult.data, user.id);
      setCreationResult(result);
      setStep('complete');
      setProgress(100);

      if (result.success) {
        toast({
          title: 'Cases Created Successfully',
          description: `Successfully created ${result.created} cases.`,
        });
        onSuccess?.(result);
      } else {
        toast({
          title: 'Creation Partially Failed',
          description: `Created ${result.created} cases, failed ${result.failed} cases.`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Creation Failed',
        description: 'Failed to create cases. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Download invalid cases CSV
  const handleDownloadInvalidCases = () => {
    if (!parsingResult || parsingResult.invalidRows.length === 0) return;

    // Get headers from the first invalid row
    const headers = Object.keys(parsingResult.invalidRows[0].rowData);
    
    // Add error_reasons column
    const csvHeaders = [...headers, 'error_reasons'];
    
    // Create CSV rows
    const csvRows = [
      csvHeaders.join(','),
      ...parsingResult.invalidRows.map(invalidRow => {
        const rowValues = headers.map(header => {
          const value = invalidRow.rowData[header] || '';
          // Escape commas and quotes in values
          if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        });
        // Add error reasons (combine all errors with semicolon)
        const errorReasons = invalidRow.errors.join('; ');
        const escapedErrors = errorReasons.includes(',') || errorReasons.includes('"') || errorReasons.includes('\n')
          ? `"${errorReasons.replace(/"/g, '""')}"`
          : errorReasons;
        rowValues.push(escapedErrors);
        return rowValues.join(',');
      })
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `invalid_cases_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }

    toast({
      title: 'Invalid Cases Downloaded',
      description: `Downloaded ${parsingResult.invalidRows.length} invalid case(s) with error reasons.`,
    });
  };

  // Reset component
  const handleReset = () => {
    setStep('template');
    setCsvContent('');
    setParsingResult(null);
    setCreationResult(null);
    setIsProcessing(false);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Get field descriptions
  const fieldDescriptions = CSVTemplateService.getFieldDescriptions();
  const validValues = CSVTemplateService.getValidValues();

  return (
    <div className="space-y-6">
      {/* Step 1: Template Download */}
      {step === 'template' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Download CSV Template
            </CardTitle>
            <CardDescription>
              Download the template file and fill it with your case data. Financial fields are automatically calculated from client contracts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={handleDownloadTemplate} className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Download Template
              </Button>
              <Button variant="outline" onClick={() => setStep('upload')}>
                I have the template ready
              </Button>
            </div>

            {/* Field descriptions */}
            <div className="mt-6">
              <h4 className="font-medium mb-3">Field Descriptions:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                {Object.entries(fieldDescriptions).map(([field, description]) => (
                  <div key={field} className="flex flex-col">
                    <span className="font-medium text-blue-600">{field}</span>
                    <span className="text-gray-600">{description}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Valid values */}
            <div className="mt-4">
              <h4 className="font-medium mb-3">Valid Values:</h4>
              <div className="space-y-2">
                {Object.entries(validValues).map(([field, values]) => (
                  <div key={field} className="flex flex-col">
                    <span className="font-medium text-green-600">{field}:</span>
                    <div className="flex flex-wrap gap-1">
                      {values.map((value) => (
                        <Badge key={value} variant="outline" className="text-xs">
                          {value}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: File Upload */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload CSV File
            </CardTitle>
            <CardDescription>
              Select the CSV file with your case data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="w-full"
              variant="outline"
            >
              <Upload className="h-4 w-4 mr-2" />
              Choose CSV File
            </Button>
            <Button variant="ghost" onClick={() => setStep('template')}>
              Back to Template
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Parse CSV */}
      {step === 'parse' && (
        <Card>
          <CardHeader>
            <CardTitle>Parse CSV File</CardTitle>
            <CardDescription>
              Review the parsed data before creating cases.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!parsingResult ? (
              <>
                <div className="flex gap-2">
                  <Button
                    onClick={handleParseCSV}
                    disabled={isProcessing}
                    className="flex items-center gap-2"
                  >
                    {isProcessing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Parsing...
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4" />
                        Parse CSV
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => setStep('upload')}>
                    Back to Upload
                  </Button>
                </div>

                {isProcessing && (
                  <div className="space-y-2">
                    <Progress value={progress} className="w-full" />
                    <p className="text-sm text-gray-600">Parsing CSV file...</p>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Parsing results summary */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Valid cases: {parsingResult.data.length}</span>
                  </div>
                  {parsingResult.invalidRows.length > 0 && (
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span className="text-sm">Invalid cases: {parsingResult.invalidRows.length}</span>
                    </div>
                  )}
                  {parsingResult.warnings.length > 0 && (
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm">Warnings: {parsingResult.warnings.length}</span>
                    </div>
                  )}
                </div>

                {/* Invalid cases - show all */}
                {parsingResult.invalidRows.length > 0 && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">Invalid Cases ({parsingResult.invalidRows.length}):</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDownloadInvalidCases}
                            className="flex items-center gap-2"
                          >
                            <Download className="h-4 w-4" />
                            Download Invalid Cases CSV
                          </Button>
                        </div>
                        <div className="max-h-96 overflow-y-auto space-y-2">
                          {parsingResult.invalidRows.map((invalidRow, index) => (
                            <div key={index} className="border-l-4 border-red-500 pl-3 py-2 bg-red-50 rounded">
                              <p className="font-medium text-sm">Row {invalidRow.rowNumber}:</p>
                              <ul className="list-disc list-inside text-sm mt-1 space-y-1">
                                {invalidRow.errors.map((error, errorIndex) => (
                                  <li key={errorIndex} className="text-red-700">{error}</li>
                                ))}
                              </ul>
                              <div className="mt-2 text-xs text-gray-600">
                                <p className="font-medium">Case Data:</p>
                                <div className="mt-1 space-y-0.5">
                                  {Object.entries(invalidRow.rowData).slice(0, 5).map(([key, value]) => (
                                    <p key={key}><span className="font-medium">{key}:</span> {value || '(empty)'}</p>
                                  ))}
                                  {Object.keys(invalidRow.rowData).length > 5 && (
                                    <p className="text-gray-500">... and {Object.keys(invalidRow.rowData).length - 5} more fields</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {parsingResult.data.length > 0 && (
                    <Button
                      onClick={() => setStep('create')}
                      className="flex items-center gap-2"
                      variant={parsingResult.invalidRows.length > 0 ? "outline" : "default"}
                    >
                      <CheckCircle className="h-4 w-4" />
                      {parsingResult.invalidRows.length > 0 
                        ? `Proceed with ${parsingResult.data.length} Valid Cases (${parsingResult.invalidRows.length} invalid will be skipped)`
                        : `Proceed to Create ${parsingResult.data.length} Cases`
                      }
                    </Button>
                  )}
                  <Button variant="outline" onClick={handleReset}>
                    Start Over
                  </Button>
                  <Button variant="outline" onClick={() => setStep('upload')}>
                    Back to Upload
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 4: Create Cases */}
      {step === 'create' && parsingResult && (
        <Card>
          <CardHeader>
            <CardTitle>Create Cases</CardTitle>
            <CardDescription>
              Review the parsed data and create cases. Financial fields will be calculated from client contracts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Parsing results */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Valid cases: {parsingResult.data.length}</span>
              </div>
              {parsingResult.errors.length > 0 && (
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm">Errors: {parsingResult.errors.length}</span>
                </div>
              )}
              {parsingResult.warnings.length > 0 && (
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm">Warnings: {parsingResult.warnings.length}</span>
                </div>
              )}
            </div>

            {/* Invalid cases - show all if any remain (shouldn't happen if shown in parse step) */}
            {parsingResult.invalidRows.length > 0 && (
              <Alert variant="destructive">
                <AlertDescription>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">Invalid Cases ({parsingResult.invalidRows.length}):</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadInvalidCases}
                        className="flex items-center gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Download Invalid Cases CSV
                      </Button>
                    </div>
                    <div className="max-h-96 overflow-y-auto space-y-2">
                      {parsingResult.invalidRows.map((invalidRow, index) => (
                        <div key={index} className="border-l-4 border-red-500 pl-3 py-2 bg-red-50 rounded">
                          <p className="font-medium text-sm">Row {invalidRow.rowNumber}:</p>
                          <ul className="list-disc list-inside text-sm mt-1 space-y-1">
                            {invalidRow.errors.map((error, errorIndex) => (
                              <li key={errorIndex} className="text-red-700">{error}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                onClick={handleCreateCases}
                disabled={isProcessing || parsingResult.data.length === 0}
                className="flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Create {parsingResult.data.length} Cases
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={handleReset}>
                Start Over
              </Button>
            </div>

            {isProcessing && (
              <div className="space-y-2">
                <Progress value={progress} className="w-full" />
                <p className="text-sm text-gray-600">Creating cases...</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 5: Complete */}
      {step === 'complete' && creationResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {creationResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              Bulk Creation Complete
            </CardTitle>
            <CardDescription>
              Summary of the bulk case creation process.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{creationResult.created}</div>
                <div className="text-sm text-green-600">Cases Created</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{creationResult.failed}</div>
                <div className="text-sm text-red-600">Cases Failed</div>
              </div>
            </div>

            {creationResult.caseNumbers.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Created Case Numbers:</h4>
                <div className="max-h-32 overflow-y-auto">
                  <div className="flex flex-wrap gap-1">
                    {creationResult.caseNumbers.map((caseNumber) => (
                      <Badge key={caseNumber} variant="outline">
                        {caseNumber}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {creationResult.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-medium">Errors ({creationResult.errors.length}):</p>
                    <div className="max-h-96 overflow-y-auto">
                      <ul className="list-disc list-inside text-sm">
                        {creationResult.errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button onClick={handleReset}>
                Create More Cases
              </Button>
              {onClose && (
                <Button variant="outline" onClick={onClose}>
                  Close
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}