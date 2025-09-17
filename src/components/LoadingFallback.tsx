import React from 'react';

export function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

export function ErrorFallback({ error }: { error: Error }) {
  console.error('App Error:', error);
  
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-2xl font-bold text-destructive">Something went wrong</h1>
        <p className="text-muted-foreground">
          The application encountered an error. Please refresh the page or check the console for details.
        </p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Refresh Page
        </button>
        <details className="text-left">
          <summary className="cursor-pointer text-sm text-muted-foreground">
            Technical Details
          </summary>
          <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">
            {error.message}
            {error.stack}
          </pre>
        </details>
      </div>
    </div>
  );
}