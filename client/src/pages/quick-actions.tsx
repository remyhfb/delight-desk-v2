import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Sidebar from "@/components/layout/sidebar";
import TopBar from "@/components/layout/topbar";
import { 
  Mail, 
  Search,
  RefreshCw,
  CreditCard,
  Zap,
  Clock,
  Package,
  MapPin,
  Calendar,
  Truck,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  User,
  Building,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  X
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

export default function QuickActions() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    document.title = "Quick Actions - Delight Desk";
  }, []);
  
  // State for each action
  const [orderSearch, setOrderSearch] = useState('');
  const [refundSearch, setRefundSearch] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [subscriptionSearch, setSubscriptionSearch] = useState('');
  const [subscriptionAction, setSubscriptionAction] = useState('');
  const [lookupSearch, setLookupSearch] = useState('');
  const [lookupType, setLookupType] = useState('order');
  const [lookupResults, setLookupResults] = useState<any>(null);
  
  const { toast } = useToast();

  // Send Order Info
  const orderMutation = useMutation({
    mutationFn: async (searchTerm: string) => {
      const response = await fetch('/api/quick-actions/send-order-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchTerm, userId: user?.id }),
      });
      if (!response.ok) throw new Error('Failed to send order info');
      return response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Order info email sent successfully",
        description: `Sent to ${data.customerEmail} for order #${data.orderNumber}`
      });
      setOrderSearch('');
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  // Process Refund
  const refundMutation = useMutation({
    mutationFn: async ({ searchTerm, amount }: { searchTerm: string; amount: string }) => {
      const response = await fetch('/api/quick-actions/process-refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchTerm, amount, userId: user?.id }),
      });
      if (!response.ok) throw new Error('Failed to process refund');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Refund processed successfully" });
      setRefundSearch('');
      setRefundAmount('');
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  // Manage Subscription
  const subscriptionMutation = useMutation({
    mutationFn: async ({ searchTerm, action }: { searchTerm: string; action: string }) => {
      const response = await fetch('/api/quick-actions/manage-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchTerm, action, userId: user?.id }),
      });
      if (!response.ok) throw new Error('Failed to manage subscription');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Subscription updated successfully" });
      setSubscriptionSearch('');
      setSubscriptionAction('');
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  // Smart Lookup
  const lookupMutation = useMutation({
    mutationFn: async ({ searchTerm, type }: { searchTerm: string; type: string }) => {
      // Clear previous results to force re-render
      setLookupResults(null);
      
      const response = await fetch('/api/quick-actions/lookup-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchTerm, type, userId: user?.id }),
      });
      if (!response.ok) throw new Error('Failed to lookup details');
      return response.json();
    },
    onSuccess: (data) => {
      console.log('Smart Lookup Response:', data); // Debug logging
      toast({ title: "Lookup completed successfully" });
      setLookupResults(data);
      setLookupSearch('');
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  // Email Order Update mutation
  const emailOrderMutation = useMutation({
    mutationFn: async ({ orderData, customerEmail }: { orderData: any; customerEmail: string }) => {
      const response = await fetch('/api/quick-actions/send-order-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderData, customerEmail, userId: user?.id }),
      });
      if (!response.ok) throw new Error('Failed to send order update email');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Order update email sent successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  // Handle sending order update email
  const handleSendOrderUpdate = (order: any) => {
    // Prepare order data for email template
    const orderData = {
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      trackingNumber: order.trackingNumber,
      shippingCarrier: order.shippingCarrier,
      deliveryStatus: order.deliveryStatus,
      aiPredictedDelivery: order.aiPredictedDelivery,
      trackingUrl: order.trackingUrl,
      checkpointTimeline: order.checkpointTimeline
    };

    emailOrderMutation.mutate({
      orderData,
      customerEmail: order.customerEmail
    });
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      
      <div className="lg:pl-64 flex flex-col flex-1">
        <TopBar 
          onMenuClick={() => setIsMobileMenuOpen(true)}
        />
        
        <main className="flex-1 p-6">
          <div className="max-w-4xl mx-auto">
            
            {/* Header */}
            <div className="mb-8 text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Quick Actions</h1>
              <p className="text-gray-600">Fast tools for common customer service tasks</p>
            </div>

            {/* Actions Grid - 2x2 layout for optimal efficiency */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Send Order Info - AI-POWERED */}
              <Card className="hover:shadow-lg transition-shadow border-blue-200">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-3 text-lg">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Mail className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      Send Order Info
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                          <Zap className="h-3 w-3" />
                          AI-Powered
                        </div>
                        <div className="text-xs text-gray-500">Uses 1 credit</div>
                      </div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Input
                      placeholder="Order number or customer email"
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && orderSearch.trim() && orderMutation.mutate(orderSearch.trim())}
                      className="h-12 text-base"
                    />
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Includes AI-predicted delivery date
                    </div>
                  </div>
                  <Button 
                    onClick={() => orderSearch.trim() && orderMutation.mutate(orderSearch.trim())}
                    disabled={orderMutation.isPending || !orderSearch.trim()}
                    className="w-full h-12 text-base font-medium"
                    size="lg"
                  >
                    {orderMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4 mr-2" />
                        Send Order Status
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Process Refund */}
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-3 text-lg">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <CreditCard className="h-5 w-5 text-green-600" />
                    </div>
                    Process Refund
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    placeholder="Order number or customer email"
                    value={refundSearch}
                    onChange={(e) => setRefundSearch(e.target.value)}
                    className="h-12 text-base"
                  />
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <span className="text-gray-500 text-base">$</span>
                    </div>
                    <Input
                      placeholder="Amount"
                      value={refundAmount}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9.]/g, '');
                        const parts = value.split('.');
                        if (parts.length <= 2 && (!parts[1] || parts[1].length <= 2)) {
                          setRefundAmount(value);
                        }
                      }}
                      onKeyPress={(e) => e.key === 'Enter' && refundSearch.trim() && refundAmount && refundMutation.mutate({ searchTerm: refundSearch.trim(), amount: refundAmount })}
                      className="pl-8 h-12 text-base"
                      type="text"
                    />
                  </div>
                  <Button 
                    onClick={() => refundSearch.trim() && refundAmount && refundMutation.mutate({ searchTerm: refundSearch.trim(), amount: refundAmount })}
                    disabled={refundMutation.isPending || !refundSearch.trim() || !refundAmount}
                    className="w-full h-12 text-base font-medium"
                    size="lg"
                  >
                    {refundMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4 mr-2" />
                        Issue Refund
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Manage Subscription */}
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-3 text-lg">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <RefreshCw className="h-5 w-5 text-purple-600" />
                    </div>
                    Change Subscription
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    placeholder="Customer email or subscription ID"
                    value={subscriptionSearch}
                    onChange={(e) => setSubscriptionSearch(e.target.value)}
                    className="h-12 text-base"
                  />
                  <Select value={subscriptionAction} onValueChange={setSubscriptionAction}>
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue placeholder="Select action" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pause">Pause Subscription</SelectItem>
                      <SelectItem value="reactivate">Reactivate Subscription</SelectItem>
                      <SelectItem value="cancel">Cancel Subscription</SelectItem>
                      <SelectItem value="renew">Renew Subscription</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={() => subscriptionSearch.trim() && subscriptionAction && subscriptionMutation.mutate({ searchTerm: subscriptionSearch.trim(), action: subscriptionAction })}
                    disabled={subscriptionMutation.isPending || !subscriptionSearch.trim() || !subscriptionAction}
                    className="w-full h-12 text-base font-medium"
                    size="lg"
                  >
                    {subscriptionMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Update Subscription
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Smart Lookup - AI-POWERED for Order lookups */}
              <Card className="hover:shadow-lg transition-shadow border-orange-200">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-3 text-lg">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <Search className="h-5 w-5 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      Smart Lookup
                      {lookupType === 'order' && (
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                            <Zap className="h-3 w-3" />
                            AI-Powered
                          </div>
                          <div className="text-xs text-gray-500">Order lookups use 1 credit</div>
                        </div>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-1 p-1 bg-gray-100 rounded-lg">
                    <Button
                      size="sm"
                      variant={lookupType === 'order' ? 'default' : 'ghost'}
                      onClick={() => setLookupType('order')}
                      className="text-sm h-9"
                    >
                      Order
                    </Button>
                    <Button
                      size="sm"
                      variant={lookupType === 'subscription' ? 'default' : 'ghost'}
                      onClick={() => setLookupType('subscription')}
                      className="text-sm h-9"
                    >
                      Subscription
                    </Button>
                    <Button
                      size="sm"
                      variant={lookupType === 'customer' ? 'default' : 'ghost'}
                      onClick={() => setLookupType('customer')}
                      className="text-sm h-9"
                    >
                      Customer
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Input
                      placeholder={
                        lookupType === 'customer' 
                          ? "Customer email" 
                          : lookupType === 'subscription'
                          ? "Subscription ID or email"
                          : "Order number or email"
                      }
                      value={lookupSearch}
                      onChange={(e) => setLookupSearch(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && lookupSearch.trim() && lookupMutation.mutate({ searchTerm: lookupSearch.trim(), type: lookupType })}
                      className="h-12 text-base"
                    />
                    {lookupType === 'order' && (
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Includes AI-predicted delivery tracking
                      </div>
                    )}
                  </div>
                  <Button 
                    onClick={() => lookupSearch.trim() && lookupMutation.mutate({ searchTerm: lookupSearch.trim(), type: lookupType })}
                    disabled={lookupMutation.isPending || !lookupSearch.trim()}
                    className="w-full h-12 text-base font-medium"
                    size="lg"
                  >
                    {lookupMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4 mr-2" />
                        Find Details
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Professional Lookup Results */}
            {lookupResults && lookupResults.orders && lookupResults.orders.length > 0 && (
              <div className="mt-8 space-y-6">
                {/* Header with Clear Button */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Search className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">
                        {lookupType === 'customer' ? 'Customer Profile' : 'Order Details'}
                      </h2>
                      <p className="text-sm text-gray-500">
                        {lookupResults.orders.length} {lookupResults.orders.length === 1 ? 'result' : 'results'} found
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => setLookupResults(null)}
                    className="gap-2"
                    data-testid="button-clear-results"
                  >
                    <X className="h-4 w-4" />
                    Clear Results
                  </Button>
                </div>

                {/* Customer Analytics - Clean and Professional */}
                {lookupType === 'customer' && lookupResults.customerAnalytics && (
                  <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100/50">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <TrendingUp className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg text-blue-900">Customer Analytics</h3>
                          <p className="text-sm text-blue-700">Performance insights and metrics</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-6">
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <DollarSign className="h-4 w-4 text-blue-600" />
                            <span className="text-2xl font-bold text-blue-600">
                              ${lookupResults.customerAnalytics.lifetimeValue}
                            </span>
                          </div>
                          <div className="text-sm font-medium text-blue-800">Lifetime Value</div>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <ShoppingBag className="h-4 w-4 text-blue-600" />
                            <span className="text-2xl font-bold text-blue-600">
                              {lookupResults.customerAnalytics.totalOrders}
                            </span>
                          </div>
                          <div className="text-sm font-medium text-blue-800">Total Orders</div>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <TrendingUp className="h-4 w-4 text-blue-600" />
                            <span className="text-2xl font-bold text-blue-600">
                              ${lookupResults.customerAnalytics.averageOrderValue}
                            </span>
                          </div>
                          <div className="text-sm font-medium text-blue-800">Average Order Value</div>
                        </div>
                      </div>
                      
                      {lookupResults.customerAnalytics.wooCommerceCustomerUrl && (
                        <div className="mt-6 text-center">
                          <Button 
                            asChild
                            className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                          >
                            <a 
                              href={lookupResults.customerAnalytics.wooCommerceCustomerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Building className="h-4 w-4" />
                              View in WooCommerce
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Orders - Clean Professional Layout */}
                <div className="space-y-6">
                  {lookupResults.orders.map((order: any, index: number) => (
                    <Card key={index} className="overflow-hidden border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                      {/* Order Header */}
                      <div className="bg-gray-50 px-6 py-4 border-b border-gray-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="p-2 bg-white rounded-lg shadow-sm">
                              <Package className="h-5 w-5 text-gray-600" />
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900">Order #{order.orderNumber}</h3>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-sm text-gray-600 capitalize">{order.platform}</span>
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                  {order.status}
                                </span>
                                <span className="text-sm text-gray-500">
                                  {new Date(order.dateCreated).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-gray-900">${order.total}</div>
                            <Button
                              onClick={() => handleSendOrderUpdate(order)}
                              disabled={emailOrderMutation.isPending}
                              size="sm"
                              className="mt-2 gap-2"
                              data-testid={`button-email-customer-${order.orderNumber}`}
                            >
                              {emailOrderMutation.isPending ? (
                                <>
                                  <RefreshCw className="h-3 w-3 animate-spin" />
                                  Sending...
                                </>
                              ) : (
                                <>
                                  <Mail className="h-3 w-3" />
                                  Email Customer
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>

                      <CardContent className="p-6">
                        {/* Customer & Shipping Info + Order Items */}
                        <div className="grid md:grid-cols-3 gap-6 mb-6">
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <User className="h-4 w-4 text-gray-500" />
                              <div>
                                <div className="font-medium text-gray-900">{order.customerName}</div>
                                <div className="text-sm text-gray-600">{order.customerEmail}</div>
                              </div>
                            </div>
                            {order.shippingAddress && (
                              <div className="flex items-center gap-3">
                                <MapPin className="h-4 w-4 text-gray-500" />
                                <div className="text-sm text-gray-600">
                                  {order.shippingAddress.city}, {order.shippingAddress.state}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <div className="space-y-3">
                            {order.trackingNumber && (
                              <div className="flex items-center gap-3">
                                <Package className="h-4 w-4 text-gray-500" />
                                <div>
                                  <div className="font-medium text-gray-900">{order.trackingNumber}</div>
                                  <div className="text-sm text-gray-600">{order.shippingCarrier || 'Carrier not specified'}</div>
                                </div>
                              </div>
                            )}
                            {order.deliveryStatus && (
                              <div className="flex items-center gap-3">
                                <Truck className="h-4 w-4 text-gray-500" />
                                <div className="text-sm text-gray-600">{order.deliveryStatus}</div>
                              </div>
                            )}
                          </div>

                          {/* Order Items - Now prominently displayed */}
                          {order.lineItems && order.lineItems.length > 0 && (
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <ShoppingBag className="h-4 w-4 text-gray-500" />
                                <span className="font-medium text-gray-900">Order Items</span>
                              </div>
                              <div className="space-y-2">
                                {order.lineItems.map((item: any, itemIndex: number) => (
                                  <div key={itemIndex} className="flex justify-between items-center text-sm">
                                    <span className="text-gray-700">{item.name} (x{item.quantity})</span>
                                    <span className="font-medium text-gray-900">${item.price}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Status Alerts */}
                        <div className="space-y-3 mb-6">
                          {order.customerActionRequired && order.customerActionMessage && (
                            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                              <div>
                                <div className="font-medium text-red-800">Customer Action Required</div>
                                <div className="text-sm text-red-700 mt-1">{order.customerActionMessage}</div>
                              </div>
                            </div>
                          )}
                          {order.deliveryAttemptFailed && (
                            <div className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                              <AlertCircle className="h-5 w-5 text-orange-500 mt-0.5" />
                              <div>
                                <div className="font-medium text-orange-800">Delivery Attempt Failed</div>
                                <div className="text-sm text-orange-700 mt-1">Package delivery was unsuccessful</div>
                              </div>
                            </div>
                          )}
                          {order.availableForPickup && (
                            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                              <Package className="h-5 w-5 text-blue-500 mt-0.5" />
                              <div>
                                <div className="font-medium text-blue-800">Available for Pickup</div>
                                <div className="text-sm text-blue-700 mt-1">Package is ready for customer pickup</div>
                              </div>
                            </div>
                          )}
                          {order.deliveryException && (
                            <div className="flex items-start gap-3 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                              <AlertCircle className="h-5 w-5 text-purple-500 mt-0.5" />
                              <div>
                                <div className="font-medium text-purple-800">Delivery Exception</div>
                                <div className="text-sm text-purple-700 mt-1">Unexpected delivery issue occurred</div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* AI Delivery Prediction and AfterShip Status */}
                        {console.log('Order data in render:', { 
                          orderNumber: order.orderNumber, 
                          trackingNumber: order.trackingNumber, 
                          deliveryStatus: order.deliveryStatus, 
                          aiPredictedDelivery: order.aiPredictedDelivery,
                          checkpointTimeline: order.checkpointTimeline 
                        })}
                        {order.aiPredictedDelivery ? (
                          <div className={`p-4 rounded-lg border mb-6 ${
                            order.aiPredictedDelivery.source === 'actual_delivery' 
                              ? 'bg-green-50 border-green-200' 
                              : 'bg-amber-50 border-amber-200'
                          }`}>
                            <div className="flex items-center gap-3">
                              {order.aiPredictedDelivery.source === 'actual_delivery' ? (
                                <CheckCircle className="h-5 w-5 text-green-600" />
                              ) : (
                                <Zap className="h-5 w-5 text-amber-600" />
                              )}
                              <div>
                                <div className={`font-medium ${
                                  order.aiPredictedDelivery.source === 'actual_delivery'
                                    ? 'text-green-800'
                                    : 'text-amber-800'
                                }`}>
                                  {order.aiPredictedDelivery.source === 'actual_delivery' ? 'Delivered' : 'AI Predicted Delivery'}: {new Date(order.aiPredictedDelivery.estimatedDate).toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    month: 'short', 
                                    day: 'numeric'
                                  })}
                                </div>
                                <div className={`text-sm ${
                                  order.aiPredictedDelivery.source === 'actual_delivery'
                                    ? 'text-green-600'
                                    : 'text-amber-600'
                                }`}>
                                  {order.aiPredictedDelivery.confidence}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : order.trackingNumber ? (
                          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-6">
                            <div className="flex items-center gap-3">
                              <Truck className="h-5 w-5 text-blue-600" />
                              <div>
                                <div className="font-medium text-blue-800">AfterShip Tracking Status</div>
                                <div className="text-sm text-blue-700 mt-1">
                                  {order.deliveryStatus || 'Status pending'}
                                  {order.deliveryStatus?.toLowerCase().includes('pending') && ' - Package is being prepared for shipment'}
                                </div>
                                {order.checkpointTimeline && order.checkpointTimeline.length > 0 && (
                                  <div className="text-xs text-blue-600 mt-2">
                                    Latest: {order.checkpointTimeline[0].message} ({order.checkpointTimeline[0].location || 'Unknown location'})
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : !order.trackingNumber && (order.status === 'processing' || order.status === 'pending') ? (
                          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg mb-6">
                            <div className="flex items-center gap-3">
                              <Clock className="h-5 w-5 text-gray-500" />
                              <div>
                                <div className="font-medium text-gray-700">AI Estimated Delivery Date</div>
                                <div className="text-sm text-gray-600 mt-1">
                                  Available once tracking number is assigned
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {/* Track Package Link */}
                        {order.trackingUrl && (
                          <div className="mb-6">
                            <Button variant="outline" size="sm" asChild>
                              <a 
                                href={order.trackingUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="gap-2"
                              >
                                <ExternalLink className="h-4 w-4" />
                                Track Package
                              </a>
                            </Button>
                          </div>
                        )}

                        {/* Delivery Performance Dashboard */}
                        {order.deliveryPerformance && (order.deliveryPerformance.onTimeStatus !== null || order.deliveryPerformance.actualDelivery || order.deliveryPerformance.estimatedDelivery) && (
                          <div className="bg-gray-50 p-4 rounded-lg mb-6">
                            <div className="flex items-center gap-2 mb-4">
                              <TrendingUp className="h-4 w-4 text-gray-600" />
                              <h4 className="font-medium text-gray-900">Delivery Performance</h4>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {order.deliveryPerformance.onTimeStatus !== null && (
                                <div className="text-center">
                                  <div className={`text-2xl font-bold mb-1 ${order.deliveryPerformance.onTimeStatus ? 'text-green-600' : 'text-red-600'}`}>
                                    {order.deliveryPerformance.onTimeStatus ? (
                                      <CheckCircle className="h-6 w-6 mx-auto" />
                                    ) : (
                                      <AlertCircle className="h-6 w-6 mx-auto" />
                                    )}
                                  </div>
                                  <div className="text-sm font-medium text-gray-600">On Time</div>
                                </div>
                              )}
                              {order.deliveryPerformance.onTimeDifference !== null && order.deliveryPerformance.onTimeDifference !== undefined && (
                                <div className="text-center">
                                  <div className="text-xl font-bold text-gray-800 mb-1">
                                    {order.deliveryPerformance.onTimeDifference > 0 ? '+' : ''}{order.deliveryPerformance.onTimeDifference}d
                                  </div>
                                  <div className="text-sm font-medium text-gray-600">Difference</div>
                                </div>
                              )}
                              {order.deliveryPerformance.estimatedDelivery && (
                                <div className="text-center">
                                  <div className="text-sm font-bold text-gray-800 mb-1">
                                    {new Date(order.deliveryPerformance.estimatedDelivery).toLocaleDateString()}
                                  </div>
                                  <div className="text-sm font-medium text-gray-600">Estimated</div>
                                </div>
                              )}
                              {order.deliveryPerformance.actualDelivery && (
                                <div className="text-center">
                                  <div className="text-sm font-bold text-gray-800 mb-1">
                                    {new Date(order.deliveryPerformance.actualDelivery).toLocaleDateString()}
                                  </div>
                                  <div className="text-sm font-medium text-gray-600">Delivered</div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Tracking Timeline */}
                        {order.checkpointTimeline && order.checkpointTimeline.length > 0 && (
                          <div className="bg-gray-50 p-4 rounded-lg mb-6">
                            <div className="flex items-center gap-2 mb-4">
                              <Clock className="h-4 w-4 text-gray-600" />
                              <h4 className="font-medium text-gray-900">Tracking Timeline</h4>
                            </div>
                            <div className="space-y-3 max-h-64 overflow-y-auto">
                              {order.checkpointTimeline.map((checkpoint: any, checkpointIndex: number) => (
                                <div key={checkpointIndex} className="flex items-start gap-3">
                                  <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium text-gray-900 text-sm">{checkpoint.status}</span>
                                      <span className="text-xs text-gray-500 flex-shrink-0">
                                        {new Date(checkpoint.timestamp).toLocaleDateString('en-US', {
                                          month: 'short',
                                          day: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })}
                                      </span>
                                    </div>
                                    <div className="text-sm text-gray-600 mt-1">{checkpoint.message}</div>
                                    {checkpoint.location && (
                                      <div className="text-xs text-gray-500 mt-1">
                                        {checkpoint.location} • {checkpoint.carrier}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}


                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}