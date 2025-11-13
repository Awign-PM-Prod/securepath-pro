import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Upload, Download, FileText, CheckCircle, XCircle } from 'lucide-react';
import { pincodeTierService, BulkPincodeTierData } from '@/services/pincodeTierService';

interface BulkPincodeTierFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedData {
  data: BulkPincodeTierData[];
  errors: string[];
}

export default function BulkPincodeTierForm({ 
  onSuccess, 
  onCancel, 
  isOpen, 
  onOpenChange 
}: BulkPincodeTierFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [uploadResult, setUploadResult] = useState<{ success: number; errors: any[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      parseCSVContent(content);
    };
    reader.readAsText(file);
  };

  const parseCSVContent = (content: string) => {
    const lines = content.split('\n').filter(line => line.trim());
    const data: BulkPincodeTierData[] = [];
    const errors: string[] = [];

    // Skip header row if it exists
    const startIndex = lines[0]?.toLowerCase().includes('pincode') ? 1 : 0;

    lines.slice(startIndex).forEach((line, index) => {
      const row = line.split(',').map(cell => cell.trim().replace(/"/g, ''));
      
      if (row.length < 2) {
        errors.push(`Row ${index + startIndex + 1}: Insufficient columns`);
        return;
      }

      const [pincode, tier, city = '', state = '', region = ''] = row;

      // Validate pincode
      if (!pincode || !/^\d{6}$/.test(pincode)) {
        errors.push(`Row ${index + startIndex + 1}: Invalid pincode format`);
        return;
      }

      // Validate tier
      if (!tier || !['tier_1', 'tier_2', 'tier_3'].includes(tier)) {
        errors.push(`Row ${index + startIndex + 1}: Invalid tier (must be tier_1, tier_2, or tier_3)`);
        return;
      }

      // Convert tier_1, tier_2, tier_3 to tier1, tier2, tier3
      const normalizedTier = tier.replace('_', '') as 'tier1' | 'tier2' | 'tier3';
      
      data.push({
        pincode,
        tier: normalizedTier,
        city: city || undefined,
        state: state || undefined,
        region: region || undefined,
      });
    });

    setParsedData({ data, errors });
  };

  const handleUpload = async () => {
    if (!parsedData || parsedData.data.length === 0) return;

    setIsLoading(true);
    try {
      const result = await pincodeTierService.bulkCreatePincodeTiers(parsedData.data);
      setUploadResult(result);
      
      if (result.success > 0) {
        setTimeout(() => {
          onSuccess();
          onOpenChange(false);
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to upload pincode tiers:', error);
      setUploadResult({
        success: 0,
        errors: [error]
      });
    } finally {
      setIsLoading(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = 'pincode,tier,city,state,region\n110001,tier_1,New Delhi,Delhi,North\n400001,tier_1,Mumbai,Maharashtra,West\n302001,tier_2,Jaipur,Rajasthan,North';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pincode_tiers_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const resetForm = () => {
    setParsedData(null);
    setUploadResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetForm();
    onCancel();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Bulk Upload Pincode Tiers</DialogTitle>
          <DialogDescription>
            Upload multiple pincode tiers using a CSV file. Download the template to see the required format.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!parsedData && !uploadResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload CSV File
                </CardTitle>
                <CardDescription>
                  Select a CSV file with pincode tier data. The file should have columns: pincode, tier, city, state, region
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    Choose File
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={downloadTemplate}
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download Template
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </CardContent>
            </Card>
          )}

          {parsedData && !uploadResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Preview Data
                </CardTitle>
                <CardDescription>
                  Review the parsed data before uploading. {parsedData.data.length} valid records found.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {parsedData.errors.length > 0 && (
                  <Alert>
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>{parsedData.errors.length} errors found:</strong>
                      <ul className="mt-2 list-disc list-inside text-sm">
                        {parsedData.errors.slice(0, 5).map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                        {parsedData.errors.length > 5 && (
                          <li>... and {parsedData.errors.length - 5} more errors</li>
                        )}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Pincode</th>
                        <th className="text-left p-2">Tier</th>
                        <th className="text-left p-2">City</th>
                        <th className="text-left p-2">State</th>
                        <th className="text-left p-2">Region</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.data.slice(0, 10).map((item, index) => (
                        <tr key={index} className="border-b">
                          <td className="p-2">{item.pincode}</td>
                          <td className="p-2">{item.tier}</td>
                          <td className="p-2">{item.city || '-'}</td>
                          <td className="p-2">{item.state || '-'}</td>
                          <td className="p-2">{item.region || '-'}</td>
                        </tr>
                      ))}
                      {parsedData.data.length > 10 && (
                        <tr>
                          <td colSpan={5} className="p-2 text-center text-muted-foreground">
                            ... and {parsedData.data.length - 10} more records
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleUpload} disabled={isLoading || parsedData.data.length === 0}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Upload {parsedData.data.length} Records
                  </Button>
                  <Button variant="outline" onClick={resetForm}>
                    Choose Different File
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {uploadResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {uploadResult.success > 0 ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  Upload Results
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{uploadResult.success}</div>
                    <div className="text-sm text-green-600">Successfully Uploaded</div>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{uploadResult.errors.length}</div>
                    <div className="text-sm text-red-600">Failed</div>
                  </div>
                </div>

                {uploadResult.errors.length > 0 && (
                  <Alert>
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Errors encountered:</strong>
                      <ul className="mt-2 list-disc list-inside text-sm">
                        {uploadResult.errors.slice(0, 3).map((error, index) => (
                          <li key={index}>
                            {error.batch 
                              ? `Batch ${error.batch} (${error.recordsInBatch} records): ${error.error?.message || error.error || error}`
                              : error.message || error}
                          </li>
                        ))}
                        {uploadResult.errors.length > 3 && (
                          <li>... and {uploadResult.errors.length - 3} more errors</li>
                        )}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {uploadResult ? 'Close' : 'Cancel'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

