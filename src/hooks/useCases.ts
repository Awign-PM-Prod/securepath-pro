import { useQuery, useQueryClient } from '@tanstack/react-query';
import { caseService, Case } from '@/services/caseService';

// Filter cases created after November 2nd, 2025
const CUTOFF_DATE = new Date('2025-11-02T00:00:00.000Z');

export interface UseCasesFilters {
  statusFilter?: string[];
  clientFilter?: string;
  dateFilter?: { from?: Date; to?: Date };
  tatExpiryFilter?: { from?: Date; to?: Date };
  tierFilter?: string;
  searchTerm?: string;
  qcResponseTab?: string;
}

export interface UseCasesResult {
  cases: Case[];
  total: number;
  isLoading: boolean;
  error: Error | null;
}

export function useCases(page: number = 1, pageSize: number = 10, filters?: UseCasesFilters): UseCasesResult {
  const query = useQuery({
    queryKey: ['cases', page, pageSize, filters],
    queryFn: async () => {
      const result = await caseService.getCases(page, pageSize, filters);
      // Cutoff date filter is now applied server-side in caseService.getCases
      // No need to filter client-side anymore
      return {
        cases: result.cases,
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

