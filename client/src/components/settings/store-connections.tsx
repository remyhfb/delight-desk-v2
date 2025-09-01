import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { 
  ShoppingCart, 
  Store,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Plus,
  Trash2,
  TestTube
} from "lucide-react";

interface StoreConnection {
  id: string;
  platform: string;
  storeUrl: string;
  apiKey: string;
  apiSecret?: string;
  isActive: boolean;
  storeName?: string;
  connectionMethod?: 'oauth' | 'api_key';
}

export default function StoreConnectionsManager() {
  const [connections, setConnections] = useState<StoreConnection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<'woocommerce' | 'shopify'>('woocommerce');
  const [formData, setFormData] = useState({
    storeName: '',
    storeUrl: '',
    apiKey: '',
    apiSecret: '',
    connectionMethod: 'api_key' as 'oauth' | 'api_key'
  });
  const [oauthLoading, setOauthLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadConnections();
    
    // Listen for OAuth popup messages
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'oauth-success') {
        toast({
          title: "Store Connected",
          description: `Successfully connected your ${event.data.platform} store via OAuth.`,
        });
        setShowAddDialog(false);
        setFormData({ storeName: '', storeUrl: '', apiKey: '', apiSecret: '', connectionMethod: 'oauth' });
        
        // Add a small delay to ensure backend has processed all OAuth requests
        setTimeout(() => {
          loadConnections();
        }, 1000);
      } else if (event.data.type === 'oauth-error') {
        toast({
          title: "OAuth Failed",
          description: event.data.error || "Authentication failed. Please try again.",
          variant: "destructive",
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const loadConnections = async () => {
    try {
      const data: any = await api.getStoreConnections('user1');

      setConnections(data || []);
    } catch (error) {

    }
  };

  const handleWooCommerceOAuth = async () => {
    try {
      setOauthLoading(true);
      
      if (!formData.storeUrl) {
        toast({
          title: "Store URL Required",
          description: "Please enter your WooCommerce store URL first.",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch('/api/oauth/woocommerce/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ storeUrl: formData.storeUrl }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate auth URL');
      }

      const data = await response.json();
      
      // Open WooCommerce OAuth in a new window
      window.open(data.authUrl, 'woocommerce-oauth', 'width=600,height=700');
      
      toast({
        title: "OAuth Started",
        description: "Please complete the authorization in the new window.",
      });
      
    } catch (error) {
      toast({
        title: "OAuth Failed",
        description: "Failed to start WooCommerce OAuth. Please try again.",
        variant: "destructive",
      });
    } finally {
      setOauthLoading(false);
    }
  };

  const handleShopifyOAuth = async () => {
    try {
      setOauthLoading(true);
      
      if (!formData.storeUrl) {
        toast({
          title: "Shop Domain Required",
          description: "Please enter your Shopify store domain first.",
          variant: "destructive",
        });
        return;
      }

      // Normalize shop domain
      const shopDomain = formData.storeUrl.replace('https://', '').replace('http://', '');
      const normalizedDomain = shopDomain.includes('.myshopify.com') ? shopDomain : `${shopDomain}.myshopify.com`;

      const response = await fetch('/api/oauth/shopify/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shopDomain: normalizedDomain, userId: 'user1' }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate auth URL');
      }

      const data = await response.json();
      
      // Open Shopify OAuth in a new window
      window.open(data.authUrl, 'shopify-oauth', 'width=600,height=700');
      
      toast({
        title: "OAuth Started",
        description: "Please complete the authorization in the new window.",
      });
      
    } catch (error) {
      toast({
        title: "OAuth Failed",
        description: "Failed to start Shopify OAuth. Please try again.",
        variant: "destructive",
      });
    } finally {
      setOauthLoading(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setIsLoading(true);
      const testData = {
        platform: selectedPlatform,
        storeUrl: formData.storeUrl,
        apiKey: formData.apiKey,
        apiSecret: formData.apiSecret
      };
      
      const result: any = await api.testStoreConnection(testData);
      
      if (result.success) {
        toast({
          title: "Connection Successful",
          description: "Your store connection is working correctly.",
        });
      } else {
        toast({
          title: "Connection Failed",
          description: result.message || "Unable to connect to your store.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Connection Error",
        description: "Failed to test store connection. Please check your credentials.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddConnection = async () => {
    try {
      setIsLoading(true);
      
      // WooCommerce manual connection (only used as fallback)
      const connectionData = {
        userId: 'user1',
        platform: selectedPlatform,
        storeName: formData.storeName,
        storeUrl: formData.storeUrl,
        apiKey: formData.apiKey,
        apiSecret: formData.apiSecret,
        connectionMethod: formData.connectionMethod,
        isActive: true
      };
      
      await api.createStoreConnection(connectionData);
      
      toast({
        title: "Store Connected",
        description: "Successfully connected your store manually.",
      });
      
      setShowAddDialog(false);
      setFormData({ storeName: '', storeUrl: '', apiKey: '', apiSecret: '', connectionMethod: 'oauth' });
      loadConnections();
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: "Failed to save store connection. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteConnection = async (id: string) => {
    try {
      await api.deleteStoreConnection(id);
      toast({
        title: "Connection Removed",
        description: "Store connection has been deleted.",
      });
      loadConnections();
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: "Failed to remove store connection.",
        variant: "destructive",
      });
    }
  };

  const getConnectionsByPlatform = (platform: string) => {
    return Array.isArray(connections) ? connections.filter(conn => conn.platform === platform) : [];
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          E-commerce Platform Connections
        </CardTitle>
        <CardDescription>
          Connect your online stores to access order and customer data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* WooCommerce Connections */}
        <div className="space-y-2">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Store className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h4 className="font-medium">WooCommerce</h4>
                <p className="text-sm text-gray-600">Connect to WooCommerce with OAuth authentication or with API keys. You can get API keys via WooCommerce Settings > Advanced > REST API. Permissions must be Read/Write.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className={
                getConnectionsByPlatform('woocommerce').length > 0 
                  ? "bg-green-100 text-green-800" 
                  : "bg-gray-100 text-gray-800"
              }>
                {getConnectionsByPlatform('woocommerce').length > 0 ? (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {getConnectionsByPlatform('woocommerce').length} Connected
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Not Connected
                  </>
                )}
              </Badge>
              <Dialog open={showAddDialog && selectedPlatform === 'woocommerce'} onOpenChange={(open) => {
                setShowAddDialog(open);
                if (open) setSelectedPlatform('woocommerce');
              }}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Connect
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Connect WooCommerce Store</DialogTitle>
                    <DialogDescription>
                      Choose how you'd like to connect your WooCommerce store.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-6 py-4">
                    {/* Store URL - always required */}
                    <div>
                      <Label htmlFor="woo-url">Store URL</Label>
                      <Input
                        id="woo-url"
                        placeholder="https://yourstore.com"
                        value={formData.storeUrl}
                        onChange={(e) => setFormData({...formData, storeUrl: e.target.value})}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Your WooCommerce store's main URL
                      </p>
                    </div>

                    {/* Connection Method Selection */}
                    <div>
                      <Label className="text-sm font-medium">Connection Method</Label>
                      <RadioGroup 
                        value={formData.connectionMethod} 
                        onValueChange={(value: 'oauth' | 'api_key') => 
                          setFormData({...formData, connectionMethod: value})
                        }
                        className="mt-2"
                      >
                        <div className="space-y-3">
                          {/* OAuth Option */}
                          <div className="flex items-start space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-gray-50" 
                               onClick={() => setFormData({...formData, connectionMethod: 'oauth'})}>
                            <RadioGroupItem value="oauth" id="oauth" className="mt-1" />
                            <div className="flex-1">
                              <Label htmlFor="oauth" className="font-medium cursor-pointer">
                                OAuth Authentication (Recommended)
                              </Label>
                              <p className="text-sm text-gray-600 mt-1">
                                Secure one-click connection without sharing API credentials. Works for most WooCommerce stores.
                              </p>
                              <div className="flex items-center text-xs text-green-600 mt-2">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Most secure • Easy setup • Automatic renewal
                              </div>
                            </div>
                          </div>

                          {/* API Key Option */}
                          <div className="flex items-start space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-gray-50"
                               onClick={() => setFormData({...formData, connectionMethod: 'api_key'})}>
                            <RadioGroupItem value="api_key" id="api_key" className="mt-1" />
                            <div className="flex-1">
                              <Label htmlFor="api_key" className="font-medium cursor-pointer">
                                API Key Authentication
                              </Label>
                              <p className="text-sm text-gray-600 mt-1">
                                Direct connection using WooCommerce REST API credentials. Use when OAuth isn't available.
                              </p>
                              <div className="flex items-center text-xs text-blue-600 mt-2">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Requires manual setup • More reliable for some setups
                              </div>
                            </div>
                          </div>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* OAuth Connection */}
                    {formData.connectionMethod === 'oauth' && (
                      <div className="border-t pt-4">
                        <Button 
                          onClick={handleWooCommerceOAuth}
                          disabled={oauthLoading || !formData.storeUrl}
                          className="w-full"
                          data-testid="button-oauth-connect"
                        >
                          {oauthLoading ? (
                            "Starting OAuth..."
                          ) : (
                            <>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Connect with OAuth
                            </>
                          )}
                        </Button>
                        <p className="text-xs text-gray-500 mt-2 text-center">
                          You'll be redirected to your store to authorize the connection
                        </p>
                      </div>
                    )}

                    {/* API Key Connection */}
                    {formData.connectionMethod === 'api_key' && (
                      <div className="border-t pt-4 space-y-4">
                        <div>
                          <Label htmlFor="woo-name">Store Name (Optional)</Label>
                          <Input
                            id="woo-name"
                            placeholder="My Store"
                            value={formData.storeName}
                            onChange={(e) => setFormData({...formData, storeName: e.target.value})}
                            data-testid="input-store-name"
                          />
                        </div>
                        <div>
                          <Label htmlFor="woo-key">Consumer Key</Label>
                          <Input
                            id="woo-key"
                            placeholder="ck_..."
                            value={formData.apiKey}
                            onChange={(e) => setFormData({...formData, apiKey: e.target.value})}
                            data-testid="input-consumer-key"
                          />
                        </div>
                        <div>
                          <Label htmlFor="woo-secret">Consumer Secret</Label>
                          <Input
                            id="woo-secret"
                            placeholder="cs_..."
                            type="password"
                            value={formData.apiSecret}
                            onChange={(e) => setFormData({...formData, apiSecret: e.target.value})}
                            data-testid="input-consumer-secret"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            onClick={handleTestConnection}
                            disabled={isLoading || !formData.apiKey || !formData.apiSecret}
                            className="flex-1"
                            data-testid="button-test-connection"
                          >
                            <TestTube className="h-4 w-4 mr-2" />
                            Test Connection
                          </Button>
                          <Button 
                            onClick={handleAddConnection}
                            disabled={isLoading || !formData.apiKey || !formData.apiSecret}
                            className="flex-1"
                            data-testid="button-add-connection"
                          >
                            Add Connection
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500">
                          Get your API credentials from WooCommerce Settings > Advanced > REST API. Set permissions to Read/Write.
                        </p>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          
          {/* Show WooCommerce connections */}
          {getConnectionsByPlatform('woocommerce').map((connection) => (
            <div key={connection.id} className="ml-4 p-3 bg-gray-50 rounded-lg flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{connection.storeName || 'WooCommerce Store'}</p>
                  <Badge variant="outline" className="text-xs">
                    {connection.connectionMethod === 'oauth' ? 'OAuth' : 'API Key'}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">{connection.storeUrl}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteConnection(connection.id)}
                className="text-red-600 hover:text-red-700"
                data-testid={`button-delete-${connection.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* Shopify Connections */}
        <div className="space-y-2">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Store className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h4 className="font-medium">Shopify</h4>
                <p className="text-sm text-gray-600">Connect your Shopify stores</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className={
                getConnectionsByPlatform('shopify').length > 0 
                  ? "bg-green-100 text-green-800" 
                  : "bg-gray-100 text-gray-800"
              }>
                {getConnectionsByPlatform('shopify').length > 0 ? (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {getConnectionsByPlatform('shopify').length} Connected
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Not Connected
                  </>
                )}
              </Badge>
              <Dialog open={showAddDialog && selectedPlatform === 'shopify'} onOpenChange={(open) => {
                setShowAddDialog(open);
                if (open) setSelectedPlatform('shopify');
              }}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Connect
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Connect Shopify Store</DialogTitle>
                    <DialogDescription>
                      Connect your Shopify store using secure OAuth authentication.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label htmlFor="shopify-url">Shop Domain</Label>
                      <Input
                        id="shopify-url"
                        placeholder="mystore.myshopify.com"
                        value={formData.storeUrl}
                        onChange={(e) => setFormData({...formData, storeUrl: e.target.value})}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Enter your shop's domain (with or without .myshopify.com)
                      </p>
                    </div>
                    
                    <div className="border-t pt-4">
                      <Button 
                        onClick={handleShopifyOAuth}
                        disabled={oauthLoading || !formData.storeUrl}
                        className="w-full"
                      >
                        {oauthLoading ? (
                          "Starting OAuth..."
                        ) : (
                          <>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Connect with OAuth
                          </>
                        )}
                      </Button>
                      <p className="text-xs text-gray-500 mt-2 text-center">
                        Secure authentication - no need to manually enter API keys
                      </p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          
          {/* Show Shopify connections */}
          {getConnectionsByPlatform('shopify').map((connection) => (
            <div key={connection.id} className="ml-4 p-3 bg-gray-50 rounded-lg flex items-center justify-between">
              <div>
                <p className="font-medium">{connection.storeName}</p>
                <p className="text-sm text-gray-600">{connection.storeUrl}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteConnection(connection.id)}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* Connection Instructions */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Setup Instructions</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• <strong>WooCommerce:</strong> Use OAuth (recommended) or generate API keys in WooCommerce → Settings → Advanced → REST API</li>
            <li>• <strong>Shopify:</strong> Use OAuth for secure authentication - no manual API setup required</li>
            <li>• Full connections enable automatic order lookup and customer support features</li>
          </ul>
        </div>

      </CardContent>
    </Card>
  );
}