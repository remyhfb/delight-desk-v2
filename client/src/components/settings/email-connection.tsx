import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// import { Progress } from "@/components/ui/progress"; // TODO: Add progress component
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertTriangle, Mail, Settings, Zap } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface EmailConnectionStatus {
  method: 'gmail' | 'outlook' | 'sendgrid' | 'none';
  email: string;
  verified: boolean;
  rateLimitInfo: {
    dailyCount: number;
    limit: number;
    percentUsed: number;
    approachingLimit: boolean;
  };
}

export function EmailConnection() {
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);

  const { data: connectionStatus, isLoading, refetch } = useQuery({
    queryKey: ['/api/email-connection/status'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/email-connection/status');
      return response.json() as Promise<EmailConnectionStatus>;
    },
  });

  const handleOAuthConnect = async (provider: 'gmail' | 'outlook') => {
    setConnectingProvider(provider);
    try {
      // Redirect to OAuth flow
      window.location.href = `/api/auth/${provider}/connect`;
    } catch (error) {
      console.error(`Error connecting ${provider}:`, error);
      setConnectingProvider(null);
    }
  };

  const handleDNSUpgrade = () => {
    // Navigate to DNS configuration
    window.location.href = '/settings?tab=advanced-email';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Connection
          </CardTitle>
          <CardDescription>
            Loading email connection status...
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const status = connectionStatus;
  const showUpgradePrompt = status?.rateLimitInfo?.approachingLimit && status?.method !== 'sendgrid';

  return (
    <div className="space-y-6">
      {/* Current Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Connection
          </CardTitle>
          <CardDescription>
            Choose how to send customer service emails from your brand
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status?.method === 'none' ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Connect your business email to start sending automated responses
              </AlertDescription>
            </Alert>
          ) : (
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium">
                    Connected via {status?.method === 'gmail' ? 'Gmail' : status?.method === 'outlook' ? 'Outlook' : 'Custom Domain'}
                  </p>
                  <p className="text-sm text-muted-foreground">{status?.email}</p>
                </div>
              </div>
              <Badge variant="secondary">
                {status?.verified ? 'Verified' : 'Pending'}
              </Badge>
            </div>
          )}

          {/* Rate Limit Status */}
          {status?.method !== 'none' && status?.method !== 'sendgrid' && status?.rateLimitInfo && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Daily Email Usage</span>
                <span>{status.rateLimitInfo.dailyCount} / {status.rateLimitInfo.limit}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full" 
                  style={{ width: `${status.rateLimitInfo.percentUsed}%` }}
                ></div>
              </div>
              {status.rateLimitInfo.approachingLimit && (
                <p className="text-sm text-amber-600">
                  Approaching daily limit. Consider upgrading to unlimited sending.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connection Options */}
      {status?.method === 'none' && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Gmail OAuth */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Mail className="h-5 w-5 text-red-600" />
                </div>
                Connect Gmail
              </CardTitle>
              <CardDescription>
                Send up to 500 emails per day from your Gmail address
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => handleOAuthConnect('gmail')}
                disabled={connectingProvider === 'gmail'}
                className="w-full"
                variant="outline"
              >
                {connectingProvider === 'gmail' ? 'Connecting...' : 'Connect Gmail Account'}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Perfect for small businesses • Instant setup • No DNS required
              </p>
            </CardContent>
          </Card>

          {/* Outlook OAuth */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Mail className="h-5 w-5 text-blue-600" />
                </div>
                Connect Outlook
              </CardTitle>
              <CardDescription>
                Send up to 10,000 emails per day from your Outlook address
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => handleOAuthConnect('outlook')}
                disabled={connectingProvider === 'outlook'}
                className="w-full"
                variant="outline"
              >
                {connectingProvider === 'outlook' ? 'Connecting...' : 'Connect Outlook Account'}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Higher volume • Enterprise ready • Instant setup • No DNS required
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* DNS Upgrade Option */}
      {showUpgradePrompt && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <Zap className="h-5 w-5" />
              Unlock Unlimited Sending
            </CardTitle>
            <CardDescription className="text-amber-700">
              You're approaching your daily email limit. Upgrade to custom domain sending for unlimited volume.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleDNSUpgrade} className="w-full" variant="default">
              <Settings className="h-4 w-4 mr-2" />
              Set Up Custom Domain
            </Button>
            <p className="text-xs text-amber-600 mt-2">
              Professional email addresses • Unlimited sending • Enhanced deliverability
            </p>
          </CardContent>
        </Card>
      )}

      {/* Alternative Options */}
      {status?.method !== 'none' && status?.method !== 'sendgrid' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Advanced Options
            </CardTitle>
            <CardDescription>
              Additional email sending configurations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleDNSUpgrade} variant="outline" className="w-full">
              Set Up Custom Domain Sending
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Configure custom email addresses like support@yourbrand.com
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}