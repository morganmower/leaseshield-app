import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
}

/**
 * Reusable loading spinner component
 */
export function LoadingSpinner({ size = 'md', text, className = '' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <Loader2 className={`${sizeClasses[size]} animate-spin text-primary`} />
      {text && <p className="text-sm text-muted-foreground">{text}</p>}
    </div>
  );
}

interface ErrorDisplayProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Reusable error display component
 */
export function ErrorDisplay({ 
  title = 'Something went wrong',
  message = 'An error occurred while loading this content.',
  onRetry,
  className = ''
}: ErrorDisplayProps) {
  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="mt-2">
        {message}
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="mt-3"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

interface LoadingStateProps {
  isLoading: boolean;
  error?: Error | null;
  onRetry?: () => void;
  loadingText?: string;
  errorTitle?: string;
  errorMessage?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Wrapper component that handles loading and error states
 */
export function LoadingState({
  isLoading,
  error,
  onRetry,
  loadingText,
  errorTitle,
  errorMessage,
  children,
  className = ''
}: LoadingStateProps) {
  if (isLoading) {
    return (
      <div className={`py-8 ${className}`}>
        <LoadingSpinner text={loadingText} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`py-8 ${className}`}>
        <ErrorDisplay
          title={errorTitle}
          message={errorMessage || error.message}
          onRetry={onRetry}
        />
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Full page loading spinner
 */
export function PageLoader({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size="lg" text={text} />
    </div>
  );
}

/**
 * Inline loading skeleton for cards/lists
 */
export function SkeletonCard() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
    </div>
  );
}

/**
 * Empty state component
 */
export function EmptyState({ 
  title, 
  description, 
  action 
}: { 
  title: string; 
  description?: string; 
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-12">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}

