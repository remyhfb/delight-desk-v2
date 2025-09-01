import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Truck, Package, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface OrderInfo {
  orderNumber: string;
  status: string;
  orderDate: string;
  customerEmail: string;
  items: Array<{
    name: string;
    quantity: number;
    sku: string;
  }>;
  shipping: {
    method: string;
    trackingNumber?: string;
    carrier?: string;
    estimatedDelivery?: string;
  };
  billing: {
    total: string;
  };
}

export default function WidgetDemo() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null);
  const [error, setError] = useState('');

  const lookupOrder = async () => {
    if (!searchQuery.trim()) {
      setError('Please enter your order number or email address');
      return;
    }

    setIsLookingUp(true);
    setError('');

    try {
      const response = await fetch('/api/public/order-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchQuery: searchQuery.trim() })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Order not found');
      }

      const data = await response.json();
      setOrderInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to lookup order');
      setOrderInfo(null);
    } finally {
      setIsLookingUp(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'processing':
        return <Clock className="h-5 w-5 text-blue-500" />;
      case 'shipped':
      case 'in-transit':
        return <Truck className="h-5 w-5 text-orange-500" />;
      case 'delivered':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'cancelled':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Package className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'shipped':
      case 'in-transit':
        return 'bg-orange-100 text-orange-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-transparent py-6">
      <div className="max-w-2xl mx-auto px-4">


        <Card className="mb-6 shadow-sm border border-gray-200">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-gray-900">Track Your Order</CardTitle>
            <CardDescription className="text-sm text-gray-600">
              Enter your order number or email address to get real-time updates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div>
              <Input
                id="searchQuery"
                type="text"
                placeholder="Enter order number or email address"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && lookupOrder()}
                data-testid="input-search-query"
              />
            </div>
            <Button 
              onClick={lookupOrder} 
              disabled={isLookingUp}
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-900"
              data-testid="button-lookup-order"
            >
              {isLookingUp ? 'Looking up...' : 'Track Order'}
            </Button>
            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md" data-testid="error-message">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {orderInfo && (
          <Card data-testid="order-info-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Order #{orderInfo.orderNumber}</CardTitle>
                <Badge className={getStatusColor(orderInfo.status)}>
                  {orderInfo.status}
                </Badge>
              </div>
              <CardDescription>
                Placed on {new Date(orderInfo.orderDate).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Order Status */}
              <div className="flex items-center space-x-3">
                {getStatusIcon(orderInfo.status)}
                <div>
                  <h3 className="font-medium text-gray-900">Current Status</h3>
                  <p className="text-gray-600 capitalize">{orderInfo.status}</p>
                </div>
              </div>

              {/* Tracking Information */}
              {orderInfo.shipping.trackingNumber && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-2">Tracking Information</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Carrier:</span>
                      <span className="font-medium">{orderInfo.shipping.carrier}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tracking Number:</span>
                      <span className="font-medium font-mono">{orderInfo.shipping.trackingNumber}</span>
                    </div>
                    {orderInfo.shipping.estimatedDelivery && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Estimated Delivery:</span>
                        <span className="font-medium">
                          {new Date(orderInfo.shipping.estimatedDelivery).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}



              {/* Need Help Section */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">Need Help?</h3>
                <p className="text-sm text-gray-600 mb-3">
                  If you have questions about your order, our AI assistant can help.
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-800"
                  data-testid="button-contact-support"
                >
                  Contact Support
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Widget Info */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p className="mb-4">
            Powered by <a href="https://delightdesk.io" className="font-medium text-gray-900 hover:text-gray-700" target="_blank" rel="noopener noreferrer">Delight Desk</a>
          </p>
          
          {/* Embed Code */}
          <div className="bg-gray-100 rounded-lg p-4 text-left">
            <h3 className="font-medium text-gray-900 mb-2 text-center">Embed Code</h3>
            <div className="relative">
              <textarea
                className="w-full h-20 text-xs font-mono bg-white border border-gray-300 rounded p-2 resize-none"
                readOnly
                value={`<iframe src="https://delightdesk.io/widget" width="100%" height="350" frameborder="0" style="border: none; border-radius: 8px; max-width: 100%; min-height: 350px;" loading="lazy" title="Order Tracking Widget"></iframe>`}
                data-testid="embed-code-textarea"
              />
              <button
                className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded"
                onClick={() => {
                  const textarea = document.querySelector('[data-testid="embed-code-textarea"]') as HTMLTextAreaElement;
                  textarea.select();
                  document.execCommand('copy');
                  // Could add a toast notification here
                }}
                data-testid="copy-embed-code"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}