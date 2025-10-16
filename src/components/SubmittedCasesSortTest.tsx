import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

/**
 * Test component to demonstrate submitted cases sorting
 * This component shows how the sorting works with mock data
 */
export const SubmittedCasesSortTest: React.FC = () => {
  const [testCases, setTestCases] = useState<any[]>([]);
  const [sortedCases, setSortedCases] = useState<any[]>([]);

  // Mock data with different submission times
  const mockCases = [
    {
      id: '1',
      case_number: 'BG-20250120-000001',
      candidate_name: 'John Doe',
      status: 'submitted',
      actual_submitted_at: '2025-01-20T10:30:00Z',
      due_at: '2025-01-20T18:00:00Z'
    },
    {
      id: '2',
      case_number: 'BG-20250120-000002',
      candidate_name: 'Jane Smith',
      status: 'submitted',
      actual_submitted_at: '2025-01-20T14:15:00Z',
      due_at: '2025-01-20T18:00:00Z'
    },
    {
      id: '3',
      case_number: 'BG-20250120-000003',
      candidate_name: 'Bob Johnson',
      status: 'submitted',
      actual_submitted_at: '2025-01-20T09:45:00Z',
      due_at: '2025-01-20T18:00:00Z'
    },
    {
      id: '4',
      case_number: 'BG-20250120-000004',
      candidate_name: 'Alice Brown',
      status: 'submitted',
      actual_submitted_at: '2025-01-20T16:20:00Z',
      due_at: '2025-01-20T18:00:00Z'
    },
    {
      id: '5',
      case_number: 'BG-20250120-000005',
      candidate_name: 'Charlie Wilson',
      status: 'submitted',
      actual_submitted_at: null, // No submission time, should fall back to due_at
      due_at: '2025-01-20T12:00:00Z'
    }
  ];

  useEffect(() => {
    setTestCases(mockCases);
    
    // Apply the same sorting logic as in GigWorkerDashboard
    const sorted = mockCases
      .filter(c => c.status === 'submitted')
      .sort((a, b) => {
        const aSubmittedAt = a.actual_submitted_at || a.due_at;
        const bSubmittedAt = b.actual_submitted_at || b.due_at;
        return new Date(bSubmittedAt).getTime() - new Date(aSubmittedAt).getTime();
      });
    
    setSortedCases(sorted);
  }, []);

  const resetTest = () => {
    // Shuffle the array to test sorting again
    const shuffled = [...mockCases].sort(() => Math.random() - 0.5);
    setTestCases(shuffled);
    
    const sorted = shuffled
      .filter(c => c.status === 'submitted')
      .sort((a, b) => {
        const aSubmittedAt = a.actual_submitted_at || a.due_at;
        const bSubmittedAt = b.actual_submitted_at || b.due_at;
        return new Date(bSubmittedAt).getTime() - new Date(aSubmittedAt).getTime();
      });
    
    setSortedCases(sorted);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Submitted Cases Sorting Test</CardTitle>
          <p className="text-sm text-gray-600">
            This demonstrates how submitted cases are sorted by their submitted_at field (most recent first)
          </p>
          <Button onClick={resetTest} variant="outline" size="sm" className="w-fit">
            Shuffle & Re-sort
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Original Order */}
            <div>
              <h3 className="font-semibold mb-4 text-lg">Original Order (Unsorted)</h3>
              <div className="space-y-3">
                {testCases.map((caseItem, index) => (
                  <div key={caseItem.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{caseItem.case_number}</span>
                      <Badge variant="outline">#{index + 1}</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">{caseItem.candidate_name}</p>
                    <p className="text-xs text-gray-500">
                      Submitted: {caseItem.actual_submitted_at 
                        ? format(new Date(caseItem.actual_submitted_at), 'PPpp')
                        : `Fallback to due: ${format(new Date(caseItem.due_at), 'PPpp')}`
                      }
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Sorted Order */}
            <div>
              <h3 className="font-semibold mb-4 text-lg">Sorted Order (Most Recent First)</h3>
              <div className="space-y-3">
                {sortedCases.map((caseItem, index) => (
                  <div key={caseItem.id} className="border rounded-lg p-3 bg-blue-50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{caseItem.case_number}</span>
                      <Badge variant="default">#{index + 1}</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">{caseItem.candidate_name}</p>
                    <p className="text-xs text-gray-500">
                      Submitted: {caseItem.actual_submitted_at 
                        ? format(new Date(caseItem.actual_submitted_at), 'PPpp')
                        : `Fallback to due: ${format(new Date(caseItem.due_at), 'PPpp')}`
                      }
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold mb-2">Sorting Logic:</h4>
            <pre className="text-sm text-gray-700 whitespace-pre-wrap">
{`// Sort by submitted_at field in descending order (most recent first)
const sortedCases = cases
  .filter(c => c.status === 'submitted')
  .sort((a, b) => {
    const aSubmittedAt = a.actual_submitted_at || a.due_at;
    const bSubmittedAt = b.actual_submitted_at || b.due_at;
    return new Date(bSubmittedAt).getTime() - new Date(aSubmittedAt).getTime();
  });`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
