import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface ConnectionStatus {
  woocommerce: boolean;
  shopify: boolean;
  gmail: boolean;
  outlook: boolean;
}

interface EmailAccount {
  id: string;
  email: string;
  provider: 'gmail' | 'outlook';
  isActive: boolean;
}

export function TestEmailConnection() {
  const [testData, setTestData] = useState({
    orderNumber: '',
    customerEmail: '',
    platform: '' as 'woocommerce' | 'shopify' | ''
  });
  const { toast } = useToast();

  // Get connection status
  const { data: connections } = useQuery({
    queryKey: ['/api/test-connections/user1'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/test-connections/user1');
      return response.json() as Promise<ConnectionStatus>;
    }
  });

  // Get connected email accounts
  const { data: emailAccounts = [] } = useQuery({
    queryKey: ['/api/email-accounts/user1'],
    retry: false,
  });

  const connectedEmailAccounts = (emailAccounts as EmailAccount[]).filter(acc => acc.isActive);
  const hasEmailConnection = connectedEmailAccounts.length > 0;
  const hasStoreConnection = connections?.woocommerce || connections?.shopify;

  const sendTestEmailMutation = useMutation({
    mutationFn: async (data: typeof testData) => {
      const response = await apiRequest('POST', '/api/test-email-connection/user1', {
        orderNumber: data.orderNumber,
        customerEmail: data.customerEmail,
        platform: data.platform
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Test Email Sent Successfully!",
          description: `Test email sent to ${connectedEmailAccounts[0]?.email || 'your connected account'}. Check your inbox to see exactly what your customers will receive.`,
        });
        // Clear form
        setTestData({
          orderNumber: '',
          customerEmail: '',
          platform: '' as 'woocommerce' | 'shopify' | ''
        });
      } else {
        toast({
          title: "Test Email Failed",
          description: data.message || "Failed to send test email. Please check your connections and try again.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Test Email Failed",
        description: error.message || "An error occurred while sending the test email.",
        variant: "destructive",
      });
    },
  });

  const handleSendTest = () => {
    if (!testData.orderNumber || !testData.customerEmail || !testData.platform) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields to send a test email.",
        variant: "destructive",
      });
      return;
    }

    sendTestEmailMutation.mutate(testData);
  };

  const canSendTest = hasEmailConnection && hasStoreConnection;

  return (
    <Card className="p-4 space-y-4">
      {/* Status Indicators */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="flex items-center gap-2">
          {hasEmailConnection ? (
            <Badge className="bg-green-100 text-green-800 border-green-200">
              <CheckCircle className="w-3 h-3 mr-1" />
              Email Connected
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-red-100 text-red-800 border-red-200">
              <AlertCircle className="w-3 h-3 mr-1" />
              No Email Connection
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasStoreConnection ? (
            <Badge className="bg-green-100 text-green-800 border-green-200">
              <CheckCircle className="w-3 h-3 mr-1" />
              Store Connected
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-red-100 text-red-800 border-red-200">
              <AlertCircle className="w-3 h-3 mr-1" />
              No Store Connection
            </Badge>
          )}
        </div>
      </div>

      {!canSendTest && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Setup Required:</strong> Connect both your email account and e-commerce store above to test the complete workflow.
          </p>
        </div>
      )}

      {canSendTest && (
        <>
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>How it works:</strong> We'll fetch real order data from your store, get tracking info from AfterShip, and send a professional email to your own inbox so you can see exactly what your customers receive.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="platform">E-commerce Platform</Label>
              <Select 
                value={testData.platform} 
                onValueChange={(value: 'woocommerce' | 'shopify') => 
                  setTestData(prev => ({ ...prev, platform: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  {connections?.woocommerce && (
                    <SelectItem value="woocommerce">WooCommerce</SelectItem>
                  )}
                  {connections?.shopify && (
                    <SelectItem value="shopify">Shopify</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="order-number">Real Order Number</Label>
              <Input
                id="order-number"
                placeholder="Enter order #"
                value={testData.orderNumber}
                onChange={(e) => setTestData(prev => ({ ...prev, orderNumber: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-email">Customer Email (from that order)</Label>
            <Input
              id="customer-email"
              type="email"
              placeholder="customer@example.com"
              value={testData.customerEmail}
              onChange={(e) => setTestData(prev => ({ ...prev, customerEmail: e.target.value }))}
            />
            <p className="text-xs text-gray-500">
              This verifies the order belongs to this email, but the test email will be sent to your connected account: {connectedEmailAccounts[0]?.email}
            </p>
          </div>

          <Button 
            onClick={handleSendTest}
            disabled={sendTestEmailMutation.isPending}
            className="w-full"
          >
            {sendTestEmailMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending Test Email...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send Test Email
              </>
            )}
          </Button>
        </>
      )}
    </Card>
  );
}