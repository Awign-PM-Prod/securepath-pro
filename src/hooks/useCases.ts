import { useQuery, useQueryClient } from '@tanstack/react-query';
import { caseService, Case } from '@/services/caseService';

// Filter cases created after November 2nd, 2025
const CUTOFF_DATE = new Date('2025-11-02T00:00:00.000Z');

export interface UseCasesResult {
  cases: Case[];
  total: number;
  isLoading: boolean;
  error: Error | null;
}

export function useCases(page: number = 1, pageSize: number = 10): UseCasesResult {
  const query = useQuery({
    queryKey: ['cases', page, pageSize],
    queryFn: async () => {
      const result = await caseService.getCases(page, pageSize);
      // Filter cases created after November 2nd, 2025
      const filteredCases = result.cases.filter(caseItem => {
        const caseCreatedDate = new Date(caseItem.created_at);
        return caseCreatedDate >= CUTOFF_DATE;
      });
      // Note: We filter client-side but the total count is from server
      // This means pagination might show fewer items if many are filtered out
      // For accurate pagination, the date filter should be applied server-side
      return {
        cases: filteredCases,
        total: result.total,
      };
    },
    staleTime: 30000, // Consider data fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });

  return {
    cases: query.data?.cases || [],
    total: query.data?.total || 0,
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}

export function useCasesInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['cases'] });
  };
}

