import { useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';

interface AuthRouteGuardProps {
  children: React.ReactNode;
}

export default function AuthRouteGuard({ children }: AuthRouteGuardProps) {
  const { user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    // Only run the check if we're not loading
    if (!isLoading && !user) {
      // Redirect to login page, preserving the current path as a redirect parameter
      const currentPath = location !== '/' ? `?redirect=${encodeURIComponent(location)}` : '';
      setLocation(`/login${currentPath}`);
    }
  }, [user, isLoading, location, setLocation]);

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render protected content for unauthenticated users
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // Render protected content for authenticated users
  return <>{children}</>;
}