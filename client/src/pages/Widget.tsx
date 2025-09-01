import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Truck, Package, CheckCircle, Clock, AlertCircle, Bot, Zap } from 'lucide-react';

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

export default function Widget() {
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
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'shipped':
      case 'in-transit':
        return <Truck className="h-4 w-4 text-orange-500" />;
      case 'delivered':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'cancelled':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Package className="h-4 w-4 text-gray-500" />;
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
    <div className="w-full max-w-2xl mx-auto p-4 font-sans">
      <Card className="shadow-sm border border-gray-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-600" />
            Track Your Order
          </CardTitle>
          <CardDescription className="text-sm text-gray-600 mb-2">
            Enter your order number or email address to get real-time updates
          </CardDescription>
          <p className="text-xs text-blue-600 flex items-center gap-1">
            <Zap className="h-3 w-3" />
            AI-powered delivery predictions • 94% accurate
          </p>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div>
            <Input
              type="text"
              placeholder="Enter order number or email address"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && lookupOrder()}
              className="w-full"
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
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md border border-red-200" data-testid="error-message">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {orderInfo && (
        <Card className="mt-4 shadow-sm border border-gray-200" data-testid="order-info-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Order #{orderInfo.orderNumber}</CardTitle>
              <Badge className={getStatusColor(orderInfo.status)}>
                {orderInfo.status}
              </Badge>
            </div>
            <CardDescription>
              Placed on {new Date(orderInfo.orderDate).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            {/* Order Status */}
            <div className="flex items-center space-x-3">
              {getStatusIcon(orderInfo.status)}
              <div>
                <h3 className="font-medium text-gray-900 text-sm">Current Status</h3>
                <p className="text-gray-600 text-sm capitalize">{orderInfo.status}</p>
              </div>
            </div>

            {/* Tracking Information */}
            {orderInfo.shipping.trackingNumber && (
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                <h3 className="font-medium text-gray-900 mb-2 text-sm">Tracking Information</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Carrier:</span>
                    <span className="font-medium">{orderInfo.shipping.carrier}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tracking:</span>
                    <span className="font-medium font-mono text-xs">{orderInfo.shipping.trackingNumber}</span>
                  </div>
                  {orderInfo.shipping.estimatedDelivery && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Est. Delivery:</span>
                      <span className="font-medium">
                        {new Date(orderInfo.shipping.estimatedDelivery).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}



            {/* Need Help */}
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
              <p className="text-sm text-gray-600 mb-2">Need help with your order?</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="text-xs border-gray-300 text-gray-700 hover:bg-gray-100"
                data-testid="button-contact-support"
              >
                Contact Support
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Powered by */}
      <div className="text-center mt-4">
        <p className="text-xs text-gray-500">
          Powered by <a href="https://delightdesk.io" className="font-medium text-gray-700 hover:text-gray-900" target="_blank" rel="noopener noreferrer">Delight Desk</a>
        </p>
      </div>
    </div>
  );
}