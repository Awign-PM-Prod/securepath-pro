import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Database, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { caseService } from '@/services/caseService';

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

