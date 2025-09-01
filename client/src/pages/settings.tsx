import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Store, 
  Mail, 
  CheckCircle, 
  XCircle, 
  ExternalLink
} from 'lucide-react';
import Sidebar from '@/components/layout/sidebar';
import TopBar from '@/components/layout/topbar';
import { useIsMobile } from '@/hooks/use-mobile';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface SystemStatus {
  woocommerce: boolean;
  shopify: boolean;
  gmail: boolean;
  outlook: boolean;
}

export default function Settings() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();
  const { toast } = useToast();

  // Temporary hardcode for demo - will be replaced with real auth later
  const { data: systemStatus, isLoading: statusLoading } = useQuery({
    queryKey: [`/api/test-connections/user1`],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/test-connections/user1`);
      return response.json() as Promise<SystemStatus>;
    }
  });

  const handleStoreConnect = async (platform: 'woocommerce' | 'shopify') => {
    try {
      const response = await apiRequest('POST', `/api/auth/${platform}`);
      const data = await response.json();
      
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      toast({
        title: "Connection Error",
        description: `Failed to connect to ${platform}. Please try again.`,
        variant: "destructive",
      });
    }
  };

  const handleEmailConnect = async (provider: 'google' | 'microsoft') => {
    try {
      const response = await apiRequest('POST', `/api/auth/${provider}`);
      const data = await response.json();
      
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      toast({
        title: "Connection Error",
        description: `Failed to connect to ${provider}. Please try again.`,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (isConnected: boolean) => {
    return isConnected ? (
      <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
        <CheckCircle className="w-3 h-3 mr-1" />
        Connected
      </Badge>
    ) : (
      <Badge variant="secondary" className="bg-gray-100 text-gray-600">
        <XCircle className="w-3 h-3 mr-1" />
        Not Connected
      </Badge>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-6 max-w-4xl">
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">Settings</h1>
              <p className="text-muted-foreground">
                Connect your store and email accounts to get started
              </p>
            </div>

            <div className="space-y-6">
              {/* Store Connections */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Store className="w-5 h-5" />
                    Store Connection
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground mb-4">
                    Connect your e-commerce store to enable order lookup and customer management
                  </p>
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    {/* WooCommerce */}
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Store className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-medium">WooCommerce</h3>
                          <p className="text-sm text-muted-foreground">WordPress e-commerce</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(systemStatus?.woocommerce || false)}
                        {systemStatus?.woocommerce ? (
                          <Button variant="outline" size="sm">
                            <ExternalLink className="w-4 h-4 mr-1" />
                            Manage
                          </Button>
                        ) : (
                          <Button 
                            size="sm"
                            onClick={() => handleStoreConnect('woocommerce')}
                          >
                            Connect
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Shopify */}
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                          <Store className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <h3 className="font-medium">Shopify</h3>
                          <p className="text-sm text-muted-foreground">All-in-one commerce</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(systemStatus?.shopify || false)}
                        {systemStatus?.shopify ? (
                          <Button variant="outline" size="sm">
                            <ExternalLink className="w-4 h-4 mr-1" />
                            Manage
                          </Button>
                        ) : (
                          <Button 
                            size="sm"
                            onClick={() => handleStoreConnect('shopify')}
                          >
                            Connect
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Email Connections */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="w-5 h-5" />
                    Email Connection
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 bg-blue-50 border-l-4 border-blue-400 rounded-md mb-4">
                    <p className="text-sm font-medium text-blue-900 mb-1">📧 Two-Way Inbox Synchronization</p>
                    <p className="text-sm text-blue-800">
                      Connecting your email gives us permission to read, send, modify, and organize your emails. 
                      This enables real-time sync between your escalation queue actions and your actual inbox - 
                      when you mark emails as resolved or delete them here, the changes are automatically applied to your email account.
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Connect your business email account to send automated responses and manage inbox synchronization
                  </p>
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Gmail */}
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                          <Mail className="w-4 h-4 text-red-600" />
                        </div>
                        <div>
                          <h3 className="font-medium">Gmail</h3>
                          <p className="text-sm text-muted-foreground">Google Workspace</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(systemStatus?.gmail || false)}
                        {systemStatus?.gmail ? (
                          <Button variant="outline" size="sm">
                            <ExternalLink className="w-4 h-4 mr-1" />
                            Manage
                          </Button>
                        ) : (
                          <Button 
                            size="sm"
                            onClick={() => handleEmailConnect('google')}
                          >
                            Connect
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Microsoft Outlook */}
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Mail className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-medium">Outlook</h3>
                          <p className="text-sm text-muted-foreground">Microsoft 365</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(systemStatus?.outlook || false)}
                        {systemStatus?.outlook ? (
                          <Button variant="outline" size="sm">
                            <ExternalLink className="w-4 h-4 mr-1" />
                            Manage
                          </Button>
                        ) : (
                          <Button 
                            size="sm"
                            onClick={() => handleEmailConnect('microsoft')}
                          >
                            Connect
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}