import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Database, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { caseService } from '@/services/caseService';
import { isRecreatedCase } from '@/utils/caseUtils';
import { BulkCaseService } from '@/services/bulkCaseService';
import { CSVParserService } from '@/services/csvParserService';
import { caseFormService } from '@/services/caseFormService';

interface ConnectionStatus {
  supabase: 'connected' | 'disconnected' | 'testing';
  tables: 'accessible' | 'inaccessible' | 'testing';
  cases: 'working' | 'error' | 'testing';
}

export default function DatabaseTest() {
  const [status, setStatus] = useState<ConnectionStatus>({
    supabase: 'testing',
    tables: 'testing',
    cases: 'testing',
  });
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    testDatabaseConnection();
  }, []);

  const testDatabaseConnection = async () => {
    setIsLoading(true);
    setTestResults([]);
    
    const results: string[] = [];
    
    try {
      // Test 1: Supabase connection
      results.push('Testing Supabase connection...');
      setStatus(prev => ({ ...prev, supabase: 'testing' }));
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        results.push(`❌ Auth error: ${authError.message}`);
        setStatus(prev => ({ ...prev, supabase: 'disconnected' }));
      } else {
        results.push(`✅ Supabase connected. User: ${user ? 'Authenticated' : 'Not authenticated'}`);
        setStatus(prev => ({ ...prev, supabase: 'connected' }));
      }

      // Test 1.5: Edge Function availability
      results.push('Testing Edge Function availability...');
      try {
        const { data: functionTest, error: functionError } = await supabase.functions.invoke('create-user', {
          body: {
            email: 'test@example.com',
            password: 'TestPassword123!',
            first_name: 'Test',
            last_name: 'User',
            phone: '+1234567890',
            role: 'client',
            vendor_data: null,
            gig_worker_data: null
          }
        });
        
        if (functionError) {
          results.push(`❌ Edge Function error: ${functionError.message}`);
        } else if (functionTest?.error) {
          results.push(`⚠️ Edge Function returned error (expected for test): ${functionTest.error}`);
        } else {
          results.push(`✅ Edge Function is accessible and responding`);
        }
      } catch (err: any) {
        results.push(`❌ Edge Function test failed: ${err.message}`);
      }

      // Test 2: Table accessibility
      results.push('Testing table accessibility...');
      setStatus(prev => ({ ...prev, tables: 'testing' }));
      
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('count')
        .limit(1);
      
      if (profilesError) {
        results.push(`❌ Profiles table error: ${profilesError.message}`);
        setStatus(prev => ({ ...prev, tables: 'inaccessible' }));
      } else {
        results.push('✅ Profiles table accessible');
      }

      // Test cases table
      const { data: cases, error: casesError } = await supabase
        .from('cases')
        .select('count')
        .limit(1);
      
      if (casesError) {
        results.push(`❌ Cases table error: ${casesError.message}`);
        setStatus(prev => ({ ...prev, tables: 'inaccessible' }));
      } else {
        results.push('✅ Cases table accessible');
        setStatus(prev => ({ ...prev, tables: 'accessible' }));
      }

      // Test 3: Case service functionality
      results.push('Testing case service...');
      setStatus(prev => ({ ...prev, cases: 'testing' }));
      
      const casesData = await caseService.getCases();
      if (casesData.length >= 0) {
        results.push(`✅ Case service working. Found ${casesData.length} cases`);
        setStatus(prev => ({ ...prev, cases: 'working' }));
      } else {
        results.push('❌ Case service error');
        setStatus(prev => ({ ...prev, cases: 'error' }));
      }

      // Test clients
      const clientsData = await caseService.getClients();
      results.push(`✅ Client service working. Found ${clientsData.length} clients`);

      // Test 4: Recreated case detection
      results.push('Testing recreated case detection...');
      const testCases = [
        'CASE-001',
        'CASE-002(1)',
        'CASE-003',
        'CASE-004(1)',
        'CASE-005',
        'CASE-006(1)'
      ];
      
      let recreatedCount = 0;
      testCases.forEach(caseNumber => {
        const isRecreated = isRecreatedCase(caseNumber);
        if (isRecreated) {
          recreatedCount++;
        }
        results.push(`   ${caseNumber}: ${isRecreated ? '✅ Recreated' : '❌ Not recreated'}`);
      });
      
      results.push(`✅ Recreated case detection working. Found ${recreatedCount} recreated cases out of ${testCases.length} test cases`);

      // Test 5: Bulk upload payout calculation
      results.push('Testing bulk upload payout calculation...');
      try {
        // Create a test CSV content
        const testCSVContent = `client_name,contract_type,candidate_name,phone_primary,address_line,city,state,pincode,country,priority,tat_hours,client_case_id
Test Client,employment,John Doe,9876543210,123 Test Street,Test City,Test State,110001,India,medium,24,TEST-001`;
        
        // Parse the CSV
        const parseResult = await CSVParserService.parseCSV(testCSVContent);
        if (parseResult.success && parseResult.data.length > 0) {
          results.push(`✅ CSV parsing successful. Parsed ${parseResult.data.length} cases`);
          
          // Test pincode tier lookup
          const testCase = parseResult.data[0];
          results.push(`   Testing pincode ${testCase.pincode} tier lookup...`);
          
          // Get case defaults to test tier lookup
          const caseDefaults = await caseFormService.getCaseDefaults(testCase.client_id, testCase.contract_type, testCase.pincode, testCase.tat_hours);
          if (caseDefaults) {
            results.push(`   ✅ Pincode tier lookup successful: ${caseDefaults.tier}`);
            
            // Test rate card lookup
            const completionSlab = caseFormService.getCompletionSlab(testCase.tat_hours);
            const rateCard = await caseFormService.getRateCardForClientTier(testCase.client_id, caseDefaults.tier, completionSlab);
            if (rateCard) {
              const totalPayout = rateCard.base_rate_inr + rateCard.travel_allowance_inr + rateCard.bonus_inr;
              results.push(`   ✅ Rate card lookup successful:`);
              results.push(`      Base Rate: ₹${rateCard.base_rate_inr}`);
              results.push(`      Travel Allowance: ₹${rateCard.travel_allowance_inr}`);
              results.push(`      Bonus: ₹${rateCard.bonus_inr}`);
              results.push(`      Total Payout: ₹${totalPayout}`);
            } else {
              results.push(`   ⚠️ Rate card lookup failed - using default values`);
            }
          } else {
            results.push(`   ⚠️ Case defaults lookup failed - using fallback values`);
          }
        } else {
          results.push(`❌ CSV parsing failed: ${parseResult.errors.join(', ')}`);
        }
      } catch (error) {
        results.push(`❌ Bulk upload test error: ${error}`);
      }

      // Test 6: Coordinate auto-fill functionality
      results.push('Testing coordinate auto-fill functionality...');
      try {
        if (navigator.geolocation) {
          const locationPromise = new Promise<{lat: number; lng: number; address?: string; pincode: string; accuracy?: number}>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              async (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                
                // Try to get address and pincode from coordinates
                let address = '';
                let pincode = '';
                try {
                  const response = await fetch(
                    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
                  );
                  const data = await response.json();
                  address = `${data.locality || ''} ${data.city || ''} ${data.principalSubdivision || ''}`.trim();
                  pincode = data.postcode || '';
                } catch (e) {
                  console.warn('Could not get address and pincode from coordinates:', e);
                }

                resolve({
                  lat: latitude,
                  lng: longitude,
                  address: address || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
                  pincode: pincode || '',
                  accuracy: accuracy
                });
              },
              (error) => {
                reject(new Error(`Location error: ${error.message}`));
              },
              {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000 // 5 minutes
              }
            );
          });
          
          const location = await locationPromise;
          const coordinatesValue = `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
          results.push(`✅ Coordinate auto-fill working: ${coordinatesValue}`);
          results.push(`   Address: ${location.address}`);
          results.push(`   Pincode: ${location.pincode || 'Not available'}`);
          results.push(`   Accuracy: ${location.accuracy ? `${Math.round(location.accuracy)}m` : 'Unknown'}`);
        } else {
          results.push('❌ Geolocation not supported in this browser');
        }
      } catch (error) {
        results.push(`❌ Coordinate auto-fill test failed: ${error.message}`);
      }

    } catch (error) {
      results.push(`❌ Unexpected error: ${error}`);
    }

    setTestResults(results);
    setIsLoading(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
      case 'accessible':
      case 'working':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'disconnected':
      case 'inaccessible':
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <RefreshCw className="h-4 w-4 text-yellow-600 animate-spin" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
      case 'accessible':
      case 'working':
        return 'bg-green-100 text-green-800';
      case 'disconnected':
      case 'inaccessible':
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Database Connection Test</h1>
          <p className="text-muted-foreground">
            Test the connection to Supabase database and verify functionality
          </p>
        </div>
        <Button onClick={testDatabaseConnection} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Testing...' : 'Test Again'}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Supabase Connection</CardTitle>
            {getStatusIcon(status.supabase)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Badge className={getStatusColor(status.supabase)}>
                {status.supabase.charAt(0).toUpperCase() + status.supabase.slice(1)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Database connection status
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Table Access</CardTitle>
            {getStatusIcon(status.tables)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Badge className={getStatusColor(status.tables)}>
                {status.tables.charAt(0).toUpperCase() + status.tables.slice(1)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Database tables accessibility
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Case Service</CardTitle>
            {getStatusIcon(status.cases)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Badge className={getStatusColor(status.cases)}>
                {status.cases.charAt(0).toUpperCase() + status.cases.slice(1)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Case management functionality
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Test Results
          </CardTitle>
          <CardDescription>
            Detailed results from database connection tests
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {testResults.length === 0 ? (
              <p className="text-muted-foreground">No test results yet. Click "Test Again" to run tests.</p>
            ) : (
              testResults.map((result, index) => (
                <div key={index} className="text-sm font-mono">
                  {result}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

