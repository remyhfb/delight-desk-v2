import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  Store, 
  Mail, 
  CheckCircle, 
  XCircle,
  Settings,
  Bot,
  ExternalLink,
  TestTube,
  RefreshCw,
  Unlink,
  Info,
  Calendar,
  Shield,
  AlertCircle
} from 'lucide-react';
import Sidebar from '@/components/layout/sidebar';
import TopBar from '@/components/layout/topbar';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { TestEmailConnection } from '@/components/test-email-connection';

interface ConnectionStatus {
  woocommerce: boolean;
  // shopify: boolean; // Removed for MVP focus
  gmail: boolean;
  outlook: boolean;
  shipbob: boolean;
}

export default function Connections() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [wooStoreUrl, setWooStoreUrl] = useState('');
  const [showWooDialog, setShowWooDialog] = useState(false);
  const [showGmailManageDialog, setShowGmailManageDialog] = useState(false);
  const [wooConnectionMethod, setWooConnectionMethod] = useState<'oauth' | 'api_key'>('oauth');
  const [wooApiKey, setWooApiKey] = useState('');
  const [wooApiSecret, setWooApiSecret] = useState('');
  const [showWooManageDialog, setShowWooManageDialog] = useState(false);
  // Shopify state removed for MVP focus
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Get user ID for API calls
  const userId = user?.id || 'user1'; // Fallback to user1 for now

  // Handle OAuth popup messages
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      if (event.data?.type === 'oauth-success' && event.data?.platform === 'woocommerce') {
        toast({
          title: "WooCommerce Connected!",
          description: `Successfully connected to ${event.data.storeUrl}`,
        });
        
        // Refresh connection status
        queryClient.invalidateQueries({ queryKey: [`/api/test-connections/${userId}`] });
        setShowWooDialog(false);
      } else if (event.data?.type === 'oauth-error') {
        toast({
          title: "Connection Failed",
          description: event.data.error || "Failed to connect store",
          variant: "destructive"
        });
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [toast, userId]);

  const { data: connections, isLoading } = useQuery({
    queryKey: [`/api/test-connections/${userId}`],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/test-connections/${userId}`);
      return response.json() as Promise<ConnectionStatus>;
    },
    enabled: !!userId // Only run query when we have a user ID
  });

  // Gmail connection details query
  const { data: gmailDetails } = useQuery({
    queryKey: [`/api/email-accounts/${userId}`],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/email-accounts/${userId}`);
      const accounts = await response.json();
      return accounts.find((acc: any) => acc.provider === 'gmail');
    },
    enabled: !!userId && connections?.gmail
  });

  // Gmail refresh mutation
  const refreshGmailMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/oauth/gmail/refresh`, { userId });
      if (!response.ok) throw new Error('Failed to refresh token');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/test-connections/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/email-accounts/${userId}`] });
      toast({
        title: "Token Refreshed",
        description: "Gmail connection has been refreshed successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Refresh Failed",
        description: "Unable to refresh Gmail token. Try reconnecting.",
        variant: "destructive",
      });
    }
  });

  // Gmail disconnect mutation
  const disconnectGmailMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('DELETE', `/api/email-accounts/${userId}/gmail`);
      if (!response.ok) throw new Error('Failed to disconnect');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/test-connections/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/email-accounts/${userId}`] });
      setShowGmailManageDialog(false);
      toast({
        title: "Gmail Disconnected",
        description: "Gmail account has been disconnected successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Disconnect Failed",
        description: "Unable to disconnect Gmail. Please try again.",
        variant: "destructive",
      });
    }
  });



  const handleConnect = async (service: string) => {
    try {
      if (service === 'gmail' || service === 'outlook') {
        const response = await apiRequest('POST', `/api/auth/${service}/connect`, {});
        const data = await response.json();
        
        if (data.authUrl) {
          window.location.href = data.authUrl;
        }
      } else if (service === 'woocommerce') {
        setShowWooDialog(true);
      } else if (service === 'shipbob') {
        const response = await apiRequest('GET', `/api/oauth/shipbob/auth`);
        const data = await response.json();
        
        if (data.authUrl) {
          // Open ShipBob OAuth in popup for better UX
          const popup = window.open(
            data.authUrl,
            'shipbob-oauth',
            'width=600,height=700,scrollbars=yes,resizable=yes,location=yes'
          );
          
          if (popup) {
            popup.focus();
            
            // Monitor popup for closure
            const checkClosed = setInterval(() => {
              if (popup.closed) {
                clearInterval(checkClosed);
                // Refresh connection status when popup closes
                setTimeout(() => {
                  queryClient.invalidateQueries({ queryKey: [`/api/test-connections/${userId}`] });
                }, 1000);
              }
            }, 1000);
          } else {
            // Fallback to full redirect if popup blocked
            window.location.href = data.authUrl;
          }
        }
      // Shopify connection removed for MVP focus
      }
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: `Unable to connect to ${service}. Please try again.`,
        variant: "destructive",
      });
    }
  };

  const handleWooCommerceConnect = async () => {
    if (!wooStoreUrl.trim()) {
      toast({
        title: "Store URL Required",
        description: "Please enter your WooCommerce store URL",
        variant: "destructive",
      });
      return;
    }

    try {
      // Clean up the URL - ensure it has https:// 
      let cleanUrl = wooStoreUrl.trim();
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = 'https://' + cleanUrl;
      }

      const response = await apiRequest('POST', '/api/oauth/woocommerce/auth', {
        storeUrl: cleanUrl
      });
      const data = await response.json();
      
      if (data.authUrl) {
        setShowWooDialog(false);
        // Open OAuth in popup window for better UX
        const popup = window.open(
          data.authUrl,
          'woocommerce-oauth',
          'width=600,height=700,scrollbars=yes,resizable=yes,location=yes'
        );
        
        if (popup) {
          // Focus the popup
          popup.focus();
          
          // Monitor popup for closure and messages
          const checkClosed = setInterval(() => {
            if (popup.closed) {
              clearInterval(checkClosed);
              // Refresh connection status when popup closes
              setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: [`/api/test-connections/user1`] });
              }, 1000);
            }
          }, 1000);
        } else {
          // Fallback to full redirect if popup blocked
          window.location.href = data.authUrl;
        }
      }
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: "Unable to connect to WooCommerce. Please check your store URL.",
        variant: "destructive",
      });
    }
  };

  const handleWooCommerceAPIConnect = async () => {
    if (!wooStoreUrl.trim() || !wooApiKey.trim() || !wooApiSecret.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      // Clean up the URL - ensure it has https:// 
      let cleanUrl = wooStoreUrl.trim();
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = 'https://' + cleanUrl;
      }

      const response = await apiRequest('POST', '/api/woocommerce/connect', {
        storeUrl: cleanUrl,
        consumerKey: wooApiKey.trim(),
        consumerSecret: wooApiSecret.trim()
      });
      
      if (response.ok) {
        toast({
          title: "WooCommerce Connected!",
          description: `Successfully connected to ${cleanUrl}`,
        });
        
        // Refresh connection status
        queryClient.invalidateQueries({ queryKey: [`/api/test-connections/${userId}`] });
        setShowWooDialog(false);
        
        // Clear form
        setWooStoreUrl('');
        setWooApiKey('');
        setWooApiSecret('');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Connection failed');
      }
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Unable to connect to WooCommerce. Please check your credentials.",
        variant: "destructive",
      });
    }
  };

  // handleShopifyConnect removed for MVP focus

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-900">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="lg:pl-64 flex flex-col flex-1">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-8">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
              
              {/* Header */}
              <div className="mb-6 md:mb-8">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">Connections</h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Connect your store and email to start automating customer service
                </p>
              </div>

              {/* Store Connections */}
              <Card className="w-full">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Store className="w-5 h-5" />
                    E-commerce Store
                  </CardTitle>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Connect one store to manage orders and customer data
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    
                    {/* WooCommerce */}
                    <div className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                            <Store className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">WooCommerce</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">WordPress store</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {connections?.woocommerce ? (
                            <Badge className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Connected
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                              <XCircle className="w-3 h-3 mr-1" />
                              Not Connected
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="mt-3">
                        {connections?.woocommerce ? (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full"
                            onClick={() => setShowWooManageDialog(true)}
                          >
                            <Settings className="w-4 h-4 mr-2" />
                            Manage Connection
                          </Button>
                        ) : (
                          <Button 
                            size="sm" 
                            className="w-full"
                            onClick={() => setShowWooDialog(true)}
                          >
                            Connect WooCommerce
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Shopify section removed for MVP focus */}
                </div>
              </CardContent>
            </Card>

              {/* Email Connections */}
              <Card className="w-full">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Mail className="w-5 h-5" />
                    Business Email
                  </CardTitle>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Connect your business email account to send automated replies
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                  
                  {/* Gmail */}
                  <div className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center">
                          <Mail className="w-5 h-5 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">Gmail</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Google Workspace</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {connections?.gmail ? (
                          <Badge className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Connected
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                            <XCircle className="w-3 h-3 mr-1" />
                            Not Connected
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="mt-3">
                      {connections?.gmail ? (
                        <Dialog open={showGmailManageDialog} onOpenChange={setShowGmailManageDialog}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="w-full">
                              <Settings className="w-4 h-4 mr-2" />
                              Manage Connection
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                <Mail className="w-5 h-5" />
                                Gmail Connection
                              </DialogTitle>
                            </DialogHeader>
                            
                            <div className="space-y-4">
                              {/* Connection Details */}
                              <div className="space-y-3">
                                <div className="flex items-center gap-2 text-sm font-medium">
                                  <Info className="w-4 h-4" />
                                  Connection Details
                                </div>
                                
                                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-2">
                                  <div className="flex justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">Email:</span>
                                    <span className="font-medium">{gmailDetails?.email || 'Loading...'}</span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">Status:</span>
                                    <Badge className="bg-green-100 text-green-800 border-green-200">
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      Active
                                    </Badge>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">Last Sync:</span>
                                    <span className="font-medium">
                                      {gmailDetails?.createdAt 
                                        ? new Date(gmailDetails.createdAt).toLocaleDateString()
                                        : 'Recently'
                                      }
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">Token Status:</span>
                                    <Badge variant="outline" className="text-green-600 border-green-300">
                                      <Shield className="w-3 h-3 mr-1" />
                                      Valid
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Action Buttons */}
                              <div className="space-y-2">
                                <Button
                                  variant="outline"
                                  className="w-full justify-start"
                                  onClick={() => refreshGmailMutation.mutate()}
                                  disabled={refreshGmailMutation.isPending}
                                >
                                  <RefreshCw className={`w-4 h-4 mr-2 ${refreshGmailMutation.isPending ? 'animate-spin' : ''}`} />
                                  {refreshGmailMutation.isPending ? 'Refreshing...' : 'Refresh Token'}
                                </Button>
                                
                                <Button
                                  variant="destructive"
                                  className="w-full justify-start"
                                  onClick={() => disconnectGmailMutation.mutate()}
                                  disabled={disconnectGmailMutation.isPending}
                                >
                                  <Unlink className="w-4 h-4 mr-2" />
                                  {disconnectGmailMutation.isPending ? 'Disconnecting...' : 'Disconnect Account'}
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      ) : (
                        <Button 
                          size="sm" 
                          className="w-full"
                          onClick={() => handleConnect('gmail')}
                        >
                          Connect Gmail
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Outlook */}
                  <div className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                          <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">Outlook</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Microsoft 365</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {connections?.outlook ? (
                          <Badge className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Connected
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                            <XCircle className="w-3 h-3 mr-1" />
                            Not Connected
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="mt-3">
                      {connections?.outlook ? (
                        <Button variant="outline" size="sm" className="w-full">
                          <Settings className="w-4 h-4 mr-2" />
                          Manage Connection
                        </Button>
                      ) : (
                        <Button 
                          size="sm" 
                          className="w-full"
                          onClick={() => handleConnect('outlook')}
                        >
                          Connect Outlook
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Fulfillment Integration */}
              <Card className="w-full">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                    </svg>
                    Fulfillment Partners
                  </CardTitle>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Connect your 3PL or fulfillment service for automated order cancellations
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    
                    {/* ShipBob */}
                    <div className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">ShipBob</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">3PL Fulfillment</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {connections?.shipbob ? (
                            <Badge className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Connected
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                              <XCircle className="w-3 h-3 mr-1" />
                              Not Connected
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="mt-3">
                        {connections?.shipbob ? (
                          <Button variant="outline" size="sm" className="w-full">
                            <Settings className="w-4 h-4 mr-2" />
                            Manage Connection
                          </Button>
                        ) : (
                          <Button 
                            size="sm" 
                            className="w-full"
                            onClick={() => handleConnect('shipbob')}
                          >
                            Connect ShipBob
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Placeholder for future 3PL integrations */}
                    <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800 opacity-60">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-500 dark:text-gray-400">More 3PLs</h3>
                            <p className="text-sm text-gray-400 dark:text-gray-500">Coming Soon</p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                          Coming Soon
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Email Testing Section */}
              <Card className="w-full">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TestTube className="w-5 h-5" />
                    Test Email Connection
                  </CardTitle>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Test your complete email workflow with real order data - sends test email to your connected account
                  </p>
                </CardHeader>
                <CardContent>
                  <TestEmailConnection />
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>

      {/* WooCommerce Connection Dialog */}
      <Dialog open={showWooDialog} onOpenChange={setShowWooDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Connect WooCommerce Store</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Store URL - always required */}
            <div>
              <Label htmlFor="store-url">Store URL</Label>
              <Input
                id="store-url"
                placeholder="https://your-store.com"
                value={wooStoreUrl}
                onChange={(e) => setWooStoreUrl(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter your WooCommerce store URL (e.g., yourstore.com)
              </p>
            </div>

            {/* Connection Method Selection */}
            <div>
              <Label className="text-sm font-medium">Connection Method</Label>
              <RadioGroup 
                value={wooConnectionMethod} 
                onValueChange={(value: 'oauth' | 'api_key') => setWooConnectionMethod(value)}
                className="mt-2"
              >
                <div className="space-y-3">
                  {/* OAuth Option - Now First */}
                  <div className="flex items-start space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-gray-50" 
                       onClick={() => setWooConnectionMethod('oauth')}>
                    <RadioGroupItem value="oauth" id="oauth" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="oauth" className="font-medium cursor-pointer">
                        Direct Authentication
                      </Label>
                      <p className="text-sm text-gray-600 mt-1">
                        One-click secure connection. Works for most WooCommerce stores.
                      </p>
                    </div>
                  </div>

                  {/* API Key Option */}
                  <div className="flex items-start space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-gray-50"
                       onClick={() => setWooConnectionMethod('api_key')}>
                    <RadioGroupItem value="api_key" id="api_key" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="api_key" className="font-medium cursor-pointer">
                        API Key Authentication
                      </Label>
                      <p className="text-sm text-gray-600 mt-1">
                        Fallback option using WooCommerce REST API credentials if direct authentication has issues with your site.
                      </p>
                    </div>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* API Key Fields */}
            {wooConnectionMethod === 'api_key' && (
              <div className="border-t pt-4 space-y-4">
                <div>
                  <Label htmlFor="woo-key">Consumer Key</Label>
                  <Input
                    id="woo-key"
                    placeholder="ck_..."
                    value={wooApiKey}
                    onChange={(e) => setWooApiKey(e.target.value)}
                    data-testid="input-consumer-key"
                  />
                </div>
                <div>
                  <Label htmlFor="woo-secret">Consumer Secret</Label>
                  <Input
                    id="woo-secret"
                    placeholder="cs_..."
                    type="password"
                    value={wooApiSecret}
                    onChange={(e) => setWooApiSecret(e.target.value)}
                    data-testid="input-consumer-secret"
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Get your API credentials from WooCommerce Settings → Advanced → REST API. Set permissions to Read/Write.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowWooDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              {wooConnectionMethod === 'oauth' ? (
                <Button
                  onClick={handleWooCommerceConnect}
                  className="flex-1"
                  disabled={!wooStoreUrl.trim()}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Connect with OAuth
                </Button>
              ) : (
                <Button
                  onClick={handleWooCommerceAPIConnect}
                  className="flex-1"
                  disabled={!wooStoreUrl.trim() || !wooApiKey.trim() || !wooApiSecret.trim()}
                >
                  Connect with API Key
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* WooCommerce Manage Connection Dialog */}
      <Dialog open={showWooManageDialog} onOpenChange={setShowWooManageDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="w-5 h-5" />
              WooCommerce Connection
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Connection Status */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Info className="w-4 h-4" />
                Connection Details
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Status:</span>
                  <Badge className="bg-green-100 text-green-800 border-green-200">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Connected
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Platform:</span>
                  <span className="font-medium">WooCommerce</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowWooManageDialog(false)}
                className="flex-1"
              >
                Close
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={async () => {
                  try {
                    const response = await apiRequest('DELETE', `/api/woocommerce/disconnect/${userId}`);
                    
                    if (response.ok) {
                      toast({
                        title: "WooCommerce Disconnected",
                        description: "Your WooCommerce store has been disconnected successfully.",
                      });
                      
                      // Refresh connection status
                      queryClient.invalidateQueries({ queryKey: [`/api/test-connections/${userId}`] });
                      setShowWooManageDialog(false);
                    } else {
                      throw new Error('Failed to disconnect');
                    }
                  } catch (error) {
                    toast({
                      title: "Disconnect Failed",
                      description: "Unable to disconnect WooCommerce store. Please try again.",
                      variant: "destructive",
                    });
                  }
                }}
              >
                <Unlink className="w-4 h-4 mr-2" />
                Disconnect
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Shopify Connection Dialog removed for MVP focus */}
    </div>
  );
}