import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { 
  Mail,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Trash2
} from "lucide-react";

interface EmailAccount {
  id: string;
  provider: string;
  email: string;
  isActive: boolean;
}

export function GmailConnectionCard() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: connections = [] } = useQuery({
    queryKey: ['/api/test-connections/user1'],
    retry: false,
  });

  const { data: emailAccounts = [] } = useQuery({
    queryKey: ['/api/email-accounts/user1'],
    retry: false,
  });

  const gmailAccounts = (emailAccounts as EmailAccount[]).filter((acc: EmailAccount) => acc.provider === 'gmail' && acc.isActive);
  const isConnected = gmailAccounts.length > 0;

  const handleConnect = async () => {
    try {
      setIsLoading(true);
      const response: any = await api.getGmailAuthUrl();
      
      // Redirect to Google OAuth with user ID in state parameter
      const authUrl = `${response.authUrl}&state=user1`;
      window.location.href = authUrl;
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: "Failed to initiate Gmail connection. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const handleDisconnect = async (accountId: string) => {
    try {
      await api.deleteEmailAccount(accountId);
      toast({
        title: "Gmail Disconnected",
        description: "Gmail account has been disconnected.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/email-accounts/user1'] });
      queryClient.invalidateQueries({ queryKey: ['/api/test-connections/user1'] });
    } catch (error) {
      toast({
        title: "Disconnect Failed",
        description: "Failed to disconnect Gmail account.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-red-100 rounded-lg flex items-center justify-center">
            <Mail className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h4 className="font-medium">Google / Gmail</h4>
            <p className="text-sm text-gray-600">Connect your Gmail account for email processing</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={
            isConnected 
              ? "bg-green-100 text-green-800" 
              : "bg-gray-100 text-gray-800"
          }>
            {isConnected ? (
              <>
                <CheckCircle className="h-3 w-3 mr-1" />
                Connected
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3 mr-1" />
                Not Connected
              </>
            )}
          </Badge>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleConnect}
            disabled={isLoading}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            {isConnected ? 'Add Account' : 'Connect'}
          </Button>
        </div>
      </div>
      
      {/* Show connected Gmail accounts */}
      {gmailAccounts.map((account: EmailAccount) => (
        <div key={account.id} className="ml-4 p-3 bg-gray-50 rounded-lg flex items-center justify-between">
          <div>
            <p className="font-medium">{account.email}</p>
            <p className="text-sm text-gray-600">Gmail Account</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDisconnect(account.id)}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

export function OutlookConnectionCard() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: emailAccounts = [] } = useQuery({
    queryKey: ['/api/email-accounts/user1'],
    retry: false,
  });

  const outlookAccounts = (emailAccounts as EmailAccount[]).filter((acc: EmailAccount) => acc.provider === 'outlook' && acc.isActive);
  const isConnected = outlookAccounts.length > 0;

  const handleConnect = async () => {
    try {
      setIsLoading(true);
      const response: any = await api.getOutlookAuthUrl();
      
      // Redirect to Microsoft OAuth with user ID in state parameter
      const authUrl = `${response.authUrl}&state=user1`;
      window.location.href = authUrl;
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: "Failed to initiate Outlook connection. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const handleDisconnect = async (accountId: string) => {
    try {
      await api.deleteEmailAccount(accountId);
      toast({
        title: "Outlook Disconnected",
        description: "Outlook account has been disconnected.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/email-accounts/user1'] });
      queryClient.invalidateQueries({ queryKey: ['/api/test-connections/user1'] });
    } catch (error) {
      toast({
        title: "Disconnect Failed",
        description: "Failed to disconnect Outlook account.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Mail className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h4 className="font-medium">Microsoft Outlook 365</h4>
            <p className="text-sm text-gray-600">Connect your Outlook account for email processing</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={
            isConnected 
              ? "bg-green-100 text-green-800" 
              : "bg-gray-100 text-gray-800"
          }>
            {isConnected ? (
              <>
                <CheckCircle className="h-3 w-3 mr-1" />
                Connected
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3 mr-1" />
                Not Connected
              </>
            )}
          </Badge>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleConnect}
            disabled={isLoading}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            {isConnected ? 'Add Account' : 'Connect'}
          </Button>
        </div>
      </div>
      
      {/* Show connected Outlook accounts */}
      {outlookAccounts.map((account: EmailAccount) => (
        <div key={account.id} className="ml-4 p-3 bg-gray-50 rounded-lg flex items-center justify-between">
          <div>
            <p className="font-medium">{account.email}</p>
            <p className="text-sm text-gray-600">Outlook Account</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDisconnect(account.id)}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}