import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';

// Smart subscription router component
// Routes users intelligently based on authentication status:
// - Authenticated users -> account settings (to see current plan and upgrade)
// - Non-authenticated users -> pricing page (to see plans and signup)
export default function Subscribe() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoading) return; // Wait for auth check to complete

    if (user) {
      // User is authenticated - send to account settings where they can see current plan and upgrade
      setLocation('/account-settings');
    } else {
      // User is not authenticated - send to pricing page for signup
      setLocation('/pricing');
    }
  }, [user, isLoading, setLocation]);

  // Show loading state while determining redirect
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting you to the right place...</p>
      </div>
    </div>
  );
}