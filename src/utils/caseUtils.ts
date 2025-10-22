/**
 * Utility functions for case-related operations
 */

/**
 * Checks if a case is recreated based on its case number
 * A case is considered recreated if its case number ends with "(1)"
 * @param caseNumber - The case number to check
 * @returns true if the case is recreated, false otherwise
 */
export const isRecreatedCase = (caseNumber: string): boolean => {
  return caseNumber.endsWith('(1)');
};

/**
 * Gets the base case number without the recreated suffix
 * @param caseNumber - The case number to process
 * @returns The base case number without "(1)" suffix
 */
export const getBaseCaseNumber = (caseNumber: string): string => {
  return caseNumber.replace(/\(1\)$/, '');
};
