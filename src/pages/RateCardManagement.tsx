/**
 * DEPRECATED: Rate Cards functionality has been replaced by Client Contracts
 * The rate_cards table no longer exists in the database.
 * All rate configuration is now done through client_contracts table.
 * 
 * This page is temporarily disabled and should be removed or refactored
 * to work with the new client_contracts structure.
 */

export default function RateCardManagement() {
  return (
    <div className="container mx-auto py-8">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">Rate Card Management</h1>
        <p className="text-muted-foreground">
          This feature has been deprecated. Please use Client Contract Management instead.
        </p>
      </div>
    </div>
  );
}
