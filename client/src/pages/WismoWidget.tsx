import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Truck, Package, CheckCircle, Clock, AlertCircle, ExternalLink, Code, Globe, Mail, Bot, Zap } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import Sidebar from '@/components/layout/sidebar';
import TopBar from '@/components/layout/topbar';
import { useState as useLayoutState } from 'react';

interface OrderInfo {
  id: string;
  status: string;
  orderDate: string;
  customer: {
    name: string;
    email: string;
  };
  shipping: {
    address: string;
    carrier?: string;
    trackingNumber?: string;
    estimatedDelivery?: string;
  };
  billing: {
    subtotal: string;
    tax: string;
    shipping: string;
    total: string;
  };
}

export default function WismoWidget() {
  const [sidebarOpen, setSidebarOpen] = useLayoutState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null);
  const [error, setError] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const { toast } = useToast();

  const handleLookup = async () => {
    if (!searchQuery.trim()) return;
    
    setIsLookingUp(true);
    setError('');
    setOrderInfo(null);
    
    try {
      const response = await fetch('/api/widget/lookup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery.trim()
        }),
      });

      if (!response.ok) {
        throw new Error('Order not found');
      }

      const data = await response.json();
      setOrderInfo(data);

      // Log WISMO widget activity
      try {
        await fetch('/api/activity-log', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'wismo_lookup',
            action: 'Order lookup via WISMO widget',
            details: {
              query: searchQuery.trim(),
              success: true,
              orderFound: !!data?.id
            }
          }),
        });
      } catch (logError) {
        console.warn('Failed to log WISMO activity:', logError);
      }
    } catch (err) {
      const errorMessage = 'Order not found. Please check your order number or email address.';
      setError(errorMessage);

      // Log failed lookup attempt
      try {
        await fetch('/api/activity-log', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'wismo_lookup',
            action: 'Order lookup via WISMO widget',
            details: {
              query: searchQuery.trim(),
              success: false,
              error: errorMessage
            }
          }),
        });
      } catch (logError) {
        console.warn('Failed to log WISMO activity:', logError);
      }
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

  // Send embed code email mutation
  const sendEmbedCodeMutation = useMutation({
    mutationFn: async (recipientEmail: string) => {
      const response = await fetch('/api/wismo/send-embed-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ recipientEmail }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send embed code email');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Email sent successfully",
        description: "The embed code has been sent to the provided email address.",
      });
      setEmailAddress('');
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send email",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSendEmbedCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailAddress.trim() && emailAddress.includes('@')) {
      sendEmbedCodeMutation.mutate(emailAddress.trim());
    }
  };

  return (
    <div className="h-screen flex bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col min-h-0 lg:ml-64">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto py-6">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Bot className="h-6 w-6 text-blue-600" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900">WISMO Widget</h1>
              </div>
              <p className="text-gray-600 mb-4">
                Self-service order tracking widget that <span className="font-semibold">embeds directly on your contact page or FAQ section</span>
              </p>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <Globe className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-amber-900 mb-1">Easy Website Integration</h3>
                    <p className="text-amber-800 text-sm">
                      Add this widget to your <span className="font-semibold">contact page, FAQ section, or support page</span> to let customers track orders instantly without contacting support.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Zap className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-blue-900 mb-1">AI-Powered Delivery Predictions</h3>
                    <p className="text-blue-800 text-sm">
                      Each lookup uses our AI delivery prediction engine with <span className="font-semibold">94% accuracy</span>. 
                      Costs 1 credit per customer use but prevents email support tickets, saving you email credits.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
              {/* Left Column - Information */}
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Globe className="h-5 w-5" />
                      What is WISMO?
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-gray-600">
                      WISMO (Where Is My Order) is a self-service widget that <span className="font-semibold">embeds directly on your contact page, FAQ section, or support page</span>. 
                      It allows your customers to track their orders without contacting support, reducing support tickets and improving customer satisfaction.
                    </p>
                    
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h3 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                        <Bot className="h-4 w-4" />
                        AI-Enhanced Benefits:
                      </h3>
                      <ul className="text-sm text-blue-800 space-y-1">
                        <li>• Reduces "where is my order" support tickets by 70%</li>
                        <li>• Provides instant order status with AI delivery predictions (94% accurate)</li>
                        <li>• Works 24/7 without human intervention</li>
                        <li>• Improves customer experience with intelligent self-service</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Code className="h-5 w-5" />
                      How to Use
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-medium text-gray-900 mb-2">1. Add to Your Contact or FAQ Page</h3>
                        <p className="text-sm text-gray-600">
                          Copy the embed code below and paste it anywhere on your website where customers might ask about their orders.
                        </p>
                      </div>
                      
                      <div>
                        <h3 className="font-medium text-gray-900 mb-2">2. Connect Your Store</h3>
                        <p className="text-sm text-gray-600">
                          The widget automatically connects to your WooCommerce store to fetch real-time order data.
                        </p>
                      </div>
                      
                      <div>
                        <h3 className="font-medium text-gray-900 mb-2">3. Customers Self-Serve</h3>
                        <p className="text-sm text-gray-600">
                          Customers enter their order number or email to instantly see order status, tracking info, and delivery estimates.
                        </p>
                      </div>
                    </div>

                    <div className="bg-gray-100 rounded-lg p-4">
                      <h3 className="font-medium text-gray-900 mb-2">Embed Code</h3>
                      <div className="relative">
                        <textarea
                          className="w-full h-16 text-xs font-mono bg-white border border-gray-300 rounded p-2 resize-none"
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
                          }}
                          data-testid="copy-embed-code"
                        >
                          Copy
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <Button variant="outline" className="w-full" asChild>
                        <a href="/widget" target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Widget in New Tab
                        </a>
                      </Button>
                      
                      <div className="border-t pt-3">
                        <h4 className="font-medium text-gray-900 mb-3 text-sm">Email to Team Member</h4>
                        <form onSubmit={handleSendEmbedCode} className="space-y-3">
                          <Input
                            type="email"
                            placeholder="Enter team member's email..."
                            value={emailAddress}
                            onChange={(e) => setEmailAddress(e.target.value)}
                            required
                            data-testid="team-email-input"
                          />
                          <Button 
                            type="submit" 
                            className="w-full bg-gray-600 hover:bg-gray-700 text-white"
                            disabled={sendEmbedCodeMutation.isPending || !emailAddress.trim()}
                            data-testid="send-embed-email-button"
                          >
                            {sendEmbedCodeMutation.isPending ? (
                              'Sending...'
                            ) : (
                              <>
                                <Mail className="h-4 w-4 mr-2" />
                                Send Embed Code
                              </>
                            )}
                          </Button>
                        </form>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column - Widget Preview */}
              <div className="lg:col-span-1 lg:sticky lg:top-6 self-start">
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">The Widget</h2>
                    <p className="text-sm text-gray-600 mb-2">Live preview of how it appears when embedded</p>
                    <div className="text-xs text-blue-600 mb-4 flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      AI delivery predictions • 94% accuracy
                    </div>
                  </div>
                  
                  {/* Widget Preview Container - simulating embedded appearance */}
                  <div className="bg-gradient-to-br from-gray-100 to-gray-200 p-4 rounded-lg border-2 border-dashed border-gray-300">
                    <p className="text-xs text-gray-500 mb-3 text-center font-medium">↓ Your Website Content ↓</p>
                    <div className="bg-white rounded-lg shadow-sm border p-4 space-y-4" style={{ minHeight: '350px' }}>
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <Bot className="h-4 w-4 text-blue-600" />
                          <h3 className="text-lg font-semibold text-gray-900">Track Your Order</h3>
                        </div>
                        <p className="text-gray-600 text-sm mb-2">Enter your order number or email to see your order status</p>
                        <p className="text-xs text-blue-600 mb-4 flex items-center justify-center gap-1">
                          <Zap className="h-3 w-3" />
                          AI-powered delivery predictions
                        </p>
                      </div>

                      <div className="space-y-3">
                        <Input
                          type="text"
                          placeholder="Enter order number or email..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                          data-testid="widget-search-input"
                          className="text-sm"
                        />

                        <Button 
                          onClick={handleLookup} 
                          disabled={isLookingUp || !searchQuery.trim()}
                          className="w-full bg-gray-600 hover:bg-gray-700 text-white text-sm"
                          size="sm"
                          data-testid="widget-search-button"
                        >
                          {isLookingUp ? 'Looking up...' : 'Track Order'}
                        </Button>

                        {error && (
                          <div className="p-3 bg-red-50 border border-red-200 rounded text-center">
                            <p className="text-xs text-red-600">{error}</p>
                          </div>
                        )}

                        {orderInfo && (
                          <div className="border-t pt-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {getStatusIcon(orderInfo.status)}
                                <span className="font-medium text-sm">Order #{orderInfo.id}</span>
                              </div>
                              <Badge className={`text-xs ${getStatusColor(orderInfo.status)}`}>
                                {orderInfo.status}
                              </Badge>
                            </div>
                            
                            <div className="text-xs text-gray-600 space-y-1">
                              <p><strong>Customer:</strong> {orderInfo.customer.email}</p>
                              {orderInfo.shipping?.trackingNumber && (
                                <p><strong>Tracking:</strong> {orderInfo.shipping.trackingNumber}</p>
                              )}
                              {orderInfo.shipping?.estimatedDelivery && (
                                <p><strong>Delivery:</strong> {new Date(orderInfo.shipping.estimatedDelivery).toLocaleDateString()}</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-3 text-center font-medium">↑ Your Website Content ↑</p>
                  </div>
                </div>
              </div>
            </div>


          </div>
        </main>
      </div>
    </div>
  );
}