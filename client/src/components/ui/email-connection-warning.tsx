import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Mail, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";

interface ConnectionStatus {
  gmail: boolean;
  outlook: boolean;
  woocommerce: boolean;
  shopify: boolean;
  shipbob: boolean;
}

interface EmailAccount {
  id: string;
  userId: string;
  provider: string;
  email: string;
  isActive: boolean;
}

export function EmailConnectionWarning() {
  const { user } = useAuth();
  const [isDismissed, setIsDismissed] = useState(false);
  
  const { data: connectionStatus, isLoading: statusLoading } = useQuery<ConnectionStatus>({
    queryKey: ['/api/test-connections', user?.id],
    enabled: !!user?.id && !isDismissed,
    refetchInterval: 30000, // Check every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  });

  const { data: emailAccounts, isLoading: accountsLoading } = useQuery<EmailAccount[]>({
    queryKey: ['/api/email-accounts', user?.id],
    enabled: !!user?.id && !isDismissed,
    refetchInterval: 30000, // Check every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  });

  // Don't show anything if loading or dismissed
  if (statusLoading || accountsLoading || isDismissed || !connectionStatus || !emailAccounts) {
    return null;
  }

  // Check if any email accounts are disconnected
  const disconnectedAccounts: string[] = [];
  
  // Check Gmail
  const hasGmailAccount = emailAccounts.some(acc => acc.provider === 'gmail' && acc.isActive);
  if (hasGmailAccount && !connectionStatus.gmail) {
    disconnectedAccounts.push('Gmail');
  }
  
  // Check Outlook  
  const hasOutlookAccount = emailAccounts.some(acc => acc.provider === 'outlook' && acc.isActive);
  if (hasOutlookAccount && !connectionStatus.outlook) {
    disconnectedAccounts.push('Outlook');
  }

  // Don't show warning if no accounts are disconnected
  if (disconnectedAccounts.length === 0) {
    return null;
  }

  const handleReconnect = () => {
    // Navigate to connections page
    window.location.href = '/connections';
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  return (
    <Alert 
      className="border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200 mb-4 mx-4"
      data-testid="email-disconnection-warning"
    >
      <AlertTriangle className="h-5 w-5 text-red-600" />
      <div className="flex items-start justify-between w-full">
        <div className="flex-1">
          <AlertDescription className="text-sm">
            <div className="font-semibold mb-2">
              🚨 Email Processing Stopped - Action Required
            </div>
            <p className="mb-3">
              Your <strong>{disconnectedAccounts.join(' and ')}</strong> {disconnectedAccounts.length === 1 ? 'account is' : 'accounts are'} disconnected. 
              <strong className="text-red-800 dark:text-red-300">New customer emails are not being processed.</strong>
            </p>
            <div className="bg-red-100 dark:bg-red-900 p-3 rounded-md border border-red-200 dark:border-red-800 mb-3">
              <div className="text-xs font-medium mb-1">⚠️ Business Impact:</div>
              <ul className="text-xs space-y-1 ml-2">
                <li>• Customer emails are not being received or processed</li>
                <li>• AI responses are not being generated</li>
                <li>• You may be missing urgent customer inquiries</li>
              </ul>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button 
                onClick={handleReconnect}
                size="sm" 
                className="bg-red-600 hover:bg-red-700 text-white"
                data-testid="reconnect-email-button"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reconnect {disconnectedAccounts.join(' & ')} Now
              </Button>
              <Button 
                onClick={handleDismiss}
                variant="outline" 
                size="sm"
                className="border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900"
                data-testid="dismiss-warning-button"
              >
                Dismiss for now
              </Button>
            </div>
          </AlertDescription>
        </div>
        <Mail className="h-5 w-5 text-red-500 ml-4 flex-shrink-0" />
      </div>
    </Alert>
  );
}

export default EmailConnectionWarning;