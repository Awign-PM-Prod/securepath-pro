import { useQuery, useQueryClient } from '@tanstack/react-query';
import { caseService, Case } from '@/services/caseService';

// Filter cases created after November 2nd, 2025
const CUTOFF_DATE = new Date('2025-11-02T00:00:00.000Z');

export function useCases() {
  return useQuery({
    queryKey: ['cases'],
    queryFn: async () => {
      const casesData = await caseService.getCases();
      // Filter cases created after November 2nd, 2025
      const filteredCases = casesData.filter(caseItem => {
        const caseCreatedDate = new Date(caseItem.created_at);
        return caseCreatedDate >= CUTOFF_DATE;
      });
      return filteredCases;
    },
    staleTime: 30000, // Consider data fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });
}

export function useCasesInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['cases'] });
  };
}

