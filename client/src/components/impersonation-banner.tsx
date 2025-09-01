import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ImpersonationStatus {
  isImpersonating: boolean;
  adminUserId?: string;
  targetUser?: {
    id: string;
    email: string;
    username: string;
  };
  startedAt?: string;
}

export default function ImpersonationBanner() {
  const [impersonationStatus, setImpersonationStatus] = useState<ImpersonationStatus>({ isImpersonating: false });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check impersonation status on component mount
    checkImpersonationStatus();
    
    // Set up interval to periodically check status
    const interval = setInterval(checkImpersonationStatus, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  const checkImpersonationStatus = async () => {
    try {
      const response = await fetch('/api/admin/impersonation-status');
      if (response.ok) {
        const status = await response.json();
        setImpersonationStatus(status);
      }
    } catch (error) {
      // Silently fail - not critical
    }
  };

  const handleStopImpersonation = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/stop-impersonation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        setImpersonationStatus({ isImpersonating: false });
        toast({
          title: "Impersonation Ended",
          description: "Returned to admin view",
        });
        // Redirect back to admin panel
        window.location.href = '/admin';
      } else {
        throw new Error('Failed to stop impersonation');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to stop impersonation",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!impersonationStatus.isImpersonating) {
    return null;
  }

  return (
    <div className="bg-orange-500 text-white px-4 py-2 relative z-50">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <Shield className="h-4 w-4" />
          <span className="font-medium text-sm">
            Admin View: You are viewing as {impersonationStatus.targetUser?.username || 'user'}
          </span>
          <span className="text-xs opacity-75">
            ({impersonationStatus.targetUser?.email})
          </span>
        </div>
        <Button
          onClick={handleStopImpersonation}
          disabled={isLoading}
          variant="ghost"
          size="sm"
          className="text-white hover:bg-orange-600 hover:text-white"
        >
          {isLoading ? (
            "Ending..."
          ) : (
            <>
              <X className="h-4 w-4 mr-1" />
              Exit Admin View
            </>
          )}
        </Button>
      </div>
    </div>
  );
}