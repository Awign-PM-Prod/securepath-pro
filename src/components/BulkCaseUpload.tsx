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
      setStep('create');
      setProgress(50);

      if (!result.success) {
        toast({
          title: 'Parsing Failed',
          description: `Found ${result.errors.length} errors in the CSV file.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'CSV Parsed Successfully',
          description: `Found ${result.data.length} valid cases to create.`,
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

            {/* Errors */}
            {parsingResult.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-medium">Errors found:</p>
                    <ul className="list-disc list-inside text-sm">
                      {parsingResult.errors.slice(0, 5).map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                      {parsingResult.errors.length > 5 && (
                        <li>... and {parsingResult.errors.length - 5} more errors</li>
                      )}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                onClick={handleCreateCases}
                disabled={isProcessing || parsingResult.errors.length > 0}
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
                    <p className="font-medium">Errors:</p>
                    <ul className="list-disc list-inside text-sm">
                      {creationResult.errors.slice(0, 5).map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                      {creationResult.errors.length > 5 && (
                        <li>... and {creationResult.errors.length - 5} more errors</li>
                      )}
                    </ul>
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