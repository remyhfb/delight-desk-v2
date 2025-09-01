import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogTrigger 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { 
  Mail, 
  Package, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  XCircle,
  Info,
  Home
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface OrderCancellationWorkflow {
  id: string;
  userId: string;
  emailId: string;
  orderNumber: string;
  customerEmail: string;
  status: string;
  step: string;
  customerAcknowledgmentSent: boolean;
  warehouseEmailSent: boolean;
  refundProcessed: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TestData {
  customerEmail: string;
  subject: string;
  body: string;
}

const statusConfig = {
  processing: { 
    label: 'Processing', 
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    icon: Clock
  },
  awaiting_warehouse: { 
    label: 'Awaiting Response', 
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    icon: Mail
  },
  canceled: { 
    label: 'Completed', 
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    icon: CheckCircle
  },
  cannot_cancel: { 
    label: 'Too Late', 
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
    icon: AlertCircle
  },
  failed: { 
    label: 'Failed', 
    color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    icon: XCircle
  }
};

export default function OrderCancellationSelfFulfillmentCard({ userId }: { userId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isSetupDialogOpen, setIsSetupDialogOpen] = useState(false);
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
  const [testData, setTestData] = useState<TestData>({
    customerEmail: 'customer@example.com',
    subject: 'Cancel my order please',
    body: 'Hi, I need to cancel order #12345. Can you help me with this? I ordered yesterday but changed my mind.'
  });

  // Query for user settings
  const { data: settings, isLoading: isSettingsLoading } = useQuery({
    queryKey: ['/api/settings', userId],
    enabled: !!userId
  });

  // Query for active workflows
  const { data: workflows = [], isLoading: isWorkflowsLoading } = useQuery({
    queryKey: ['/api/order-cancellation/workflows', userId],
    refetchInterval: 30000, // Refresh every 30 seconds
    enabled: !!userId
  });

  const activeWorkflows = Array.isArray(workflows) 
    ? workflows.filter((w: OrderCancellationWorkflow) => 
        w.status === 'processing' || w.status === 'awaiting_warehouse'
      )
    : [];

  // Check if configured for self-fulfillment
  const isConfigured = (settings as any)?.fulfillmentMethod === 'self_fulfillment';
  const canConfigure = !!userId;
  const isLoading = isSettingsLoading || isWorkflowsLoading;
  const isEnabled = (settings as any)?.orderCancellationSelfFulfillmentEnabled ?? false;

  // Toggle self-fulfillment automation mutation
  const toggleSelfFulfillmentAutomationMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await fetch(`/api/settings/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          orderCancellationSelfFulfillmentEnabled: enabled
        })
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings', userId] });
      toast({
        title: isEnabled ? "Self-Fulfillment Automation Disabled" : "Self-Fulfillment Automation Enabled",
        description: isEnabled ? "Order cancellation automation is now disabled." : "Order cancellation automation is now enabled."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update automation status. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Enable self-fulfillment mutation
  const enableSelfFulfillmentMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/settings/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fulfillmentMethod: 'self_fulfillment'
        })
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings', userId] });
      setIsSetupDialogOpen(false);
      toast({
        title: "Self-Fulfillment Enabled",
        description: "Order cancellation automation is now configured for self-fulfilled orders."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Configuration Failed",
        description: error.message || "Failed to enable self-fulfillment. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Test workflow mutation
  const testWorkflowMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/order-cancellation/test-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          customerEmail: testData.customerEmail,
          subject: testData.subject,
          body: testData.body
        })
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/order-cancellation/workflows', userId] });
      setIsTestDialogOpen(false);
      toast({
        title: "Test Workflow Started",
        description: "Check the Active Workflows section below to see progress."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Test Failed",
        description: error.message || "Failed to start test workflow. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleToggleAutomation = (enabled: boolean) => {
    toggleSelfFulfillmentAutomationMutation.mutate(enabled);
  };

  const handleEnableSelfFulfillment = () => {
    enableSelfFulfillmentMutation.mutate();
  };

  const handleTestWorkflow = () => {
    testWorkflowMutation.mutate();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-medium flex items-center space-x-2">
            <Home className="h-4 w-4 text-green-500" />
            <span>Order Cancellation (Self-Fulfillment)</span>
            {isConfigured && (
              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                Configured
              </Badge>
            )}
          </CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Automated order cancellations for self-fulfilled WooCommerce orders
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Switch
              checked={isEnabled}
              onCheckedChange={handleToggleAutomation}
              disabled={!isConfigured || toggleSelfFulfillmentAutomationMutation.isPending}
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {isEnabled ? 'On' : 'Off'}
            </span>
          </div>
          <Dialog open={isSetupDialogOpen} onOpenChange={setIsSetupDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={!canConfigure}>
                {isConfigured ? 'Configured' : 'Enable'}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Self-Fulfillment Order Cancellation Setup</DialogTitle>
                <DialogDescription>
                  Configure direct WooCommerce cancellation for self-fulfilled orders
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* How It Works Section */}
                <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center">
                    <Info className="h-4 w-4 mr-2" />
                    How Self-Fulfillment Cancellation Works
                  </h3>
                  <div className="space-y-3 text-sm text-blue-800 dark:text-blue-200">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium">1</div>
                      <div>
                        <p className="font-medium">📧 AI detects cancellation request</p>
                        <p className="text-blue-700 dark:text-blue-300">Automatically classifies email and extracts order information</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium">2</div>
                      <div>
                        <p className="font-medium">🛒 Checks order status</p>
                        <p className="text-blue-700 dark:text-blue-300">Verifies order status and processing stage in WooCommerce</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium">3</div>
                      <div>
                        <p className="font-medium">✉️ Sends appropriate response</p>
                        <p className="text-blue-700 dark:text-blue-300">"We're on it — cancelling now" if eligible OR "Cannot cancel" if not eligible</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium">4</div>
                      <div>
                        <p className="font-medium">⚡ Immediate cancellation</p>
                        <p className="text-blue-700 dark:text-blue-300">Directly cancels order in WooCommerce without external coordination</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium">5</div>
                      <div>
                        <p className="font-medium">✅ Processes refund</p>
                        <p className="text-blue-700 dark:text-blue-300">Automatically processes full refund in WooCommerce</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium">6</div>
                      <div>
                        <p className="font-medium">🎯 Sends confirmation</p>
                        <p className="text-blue-700 dark:text-blue-300">Confirms successful cancellation with refund details</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Configuration Status */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">Configuration</h3>
                  
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="font-medium text-green-700 dark:text-green-300">Self-Fulfillment Ready</span>
                    </div>
                    <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                      <p className="text-sm text-green-800 dark:text-green-200">
                        No additional configuration needed. Orders will be immediately cancelled in WooCommerce without requiring external warehouse coordination.
                      </p>
                    </div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start space-x-2">
                      <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-blue-800 dark:text-blue-200">
                        <p className="font-medium">Self-Fulfillment Benefits</p>
                        <p>• Fastest possible cancellation processing</p>
                        <p>• No external coordination required</p>
                        <p>• Direct WooCommerce integration</p>
                        <p>• Immediate refund processing</p>
                      </div>
                    </div>
                  </div>

                  {!isConfigured && (
                    <Button 
                      onClick={handleEnableSelfFulfillment} 
                      disabled={enableSelfFulfillmentMutation.isPending}
                      className="w-full"
                    >
                      {enableSelfFulfillmentMutation.isPending ? 'Enabling...' : 'Enable Self-Fulfillment Cancellation'}
                    </Button>
                  )}
                </div>

                {/* FAQ Section */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">Frequently Asked Questions</h3>
                  
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">What's the cancellation time window?</p>
                      <p className="text-gray-600 dark:text-gray-400">Orders can be cancelled instantly unless already shipped. The system checks shipping status and either cancels immediately or offers return assistance.</p>
                    </div>
                    
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">How fast does the customer get their response?</p>
                      <p className="text-gray-600 dark:text-gray-400">Within 30-60 seconds. Since no external coordination is needed, the cancellation happens immediately in WooCommerce.</p>
                    </div>
                    
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">What if the order is already being prepared?</p>
                      <p className="text-gray-600 dark:text-gray-400">The system checks order status in real-time. If preparation has started, it explains the timing and offers return assistance instead.</p>
                    </div>
                    
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">Who should use self-fulfillment mode?</p>
                      <p className="text-gray-600 dark:text-gray-400">Perfect for businesses that pack and ship orders themselves or have immediate control over their fulfillment process.</p>
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={!isConfigured}>
                Test Workflow
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Test Self-Fulfillment Order Cancellation</DialogTitle>
                <DialogDescription>
                  Simulate a customer cancellation request to test your self-fulfillment setup
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                {/* Safety and Instructions Section */}
                <div className="space-y-3">
                  <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                    <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">🛡️ Safe Testing Mode</h4>
                    <div className="text-sm text-green-800 dark:text-green-200 space-y-1">
                      <p>• <strong>No real orders affected</strong> - Test mode prevents actual WooCommerce changes</p>
                      <p>• <strong>Clearly marked as [TEST]</strong> - All test communications include test indicators</p>
                      <p>• <strong>Safe to test</strong> - Use any email address without worrying about real customers</p>
                    </div>
                  </div>
                  
                  <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">📧 Email Address Guidelines</h4>
                    <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                      <p>• <strong>Use any test email</strong> - customer@example.com works perfectly</p>
                      <p>• <strong>No real customer impact</strong> - Test mode prevents any external communications</p>
                      <p>• <strong>Include order number</strong> - Add "#12345" or similar for realistic testing</p>
                    </div>
                  </div>

                  <div className="bg-orange-50 dark:bg-orange-950/20 p-3 rounded-lg border border-orange-200 dark:border-orange-800">
                    <h4 className="font-medium text-orange-900 dark:text-orange-100 mb-2">🔍 What You'll See</h4>
                    <div className="text-sm text-orange-800 dark:text-orange-200 space-y-1">
                      <p>• Real-time workflow progress in "Active Workflows" section below</p>
                      <p>• Test WooCommerce status checks in logs</p>
                      <p>• Customer response email to the test address you enter</p>
                      <p>• Full workflow simulation with progress tracking</p>
                    </div>
                  </div>
                </div>

                {/* Test Data Form */}
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="customerEmail">Customer Email Address</Label>
                    <Input
                      id="customerEmail"
                      type="email"
                      placeholder="customer@example.com"
                      value={testData.customerEmail}
                      onChange={(e) => setTestData(prev => ({ ...prev, customerEmail: e.target.value }))}
                    />
                    <p className="text-xs text-gray-500 mt-1">Use any test email - customer@example.com is perfect for testing</p>
                  </div>
                  <div>
                    <Label htmlFor="subject">Email Subject Line</Label>
                    <Input
                      id="subject"
                      placeholder="Cancel my order please"
                      value={testData.subject}
                      onChange={(e) => setTestData(prev => ({ ...prev, subject: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="body">Customer Message</Label>
                    <Textarea
                      id="body"
                      placeholder="Hi, I need to cancel order #12345. Can you help me with this? I ordered yesterday but changed my mind."
                      value={testData.body}
                      onChange={(e) => setTestData(prev => ({ ...prev, body: e.target.value }))}
                      rows={4}
                    />
                    <p className="text-xs text-gray-500 mt-1">Include an order number or details for realistic testing</p>
                  </div>
                </div>

                {/* Start Test Button */}
                <Button onClick={handleTestWorkflow} disabled={testWorkflowMutation.isPending} className="w-full">
                  {testWorkflowMutation.isPending ? 'Starting Test Workflow...' : 'Start Test Workflow'}
                </Button>
                
                {/* After Test Note */}
                <div className="text-xs text-gray-600 dark:text-gray-400 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                  <strong>After clicking "Start":</strong> Watch the "Active Workflows" section below for real-time progress. 
                  Check your email inboxes to see the automated responses.
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Active Workflows */}
            {activeWorkflows.length > 0 && (
              <div>
                <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">
                  Active Workflows ({activeWorkflows.length})
                </h4>
                <div className="space-y-2">
                  {activeWorkflows.map((workflow: any) => {
                    const config = statusConfig[workflow.status as keyof typeof statusConfig];
                    const StatusIcon = config?.icon || Clock;
                    
                    const timeElapsed = Date.now() - new Date(workflow.createdAt).getTime();
                    const hoursElapsed = Math.floor(timeElapsed / (1000 * 60 * 60));
                    const minutesElapsed = Math.floor((timeElapsed % (1000 * 60 * 60)) / (1000 * 60));
                    
                    // Calculate progress for self-fulfillment workflow
                    const getProgress = () => {
                      if (workflow.status === 'processing') {
                        if (workflow.customerAcknowledgmentSent && workflow.refundProcessed) return 83; // Almost done
                        if (workflow.customerAcknowledgmentSent) return 66; // Mid-process
                        return 33; // Just started
                      }
                      if (workflow.status === 'canceled') return 100; // All steps complete
                      if (workflow.status === 'cannot_cancel') return 100; // All steps complete
                      return 100;
                    };

                    const getStepDescription = () => {
                      if (workflow.status === 'processing') {
                        if (!workflow.customerAcknowledgmentSent) return 'Step 2: Sending instant customer response';
                        if (!workflow.refundProcessed) return 'Step 3-5: Processing direct WooCommerce cancellation';
                        return 'Step 6: Sending final confirmation';
                      }
                      if (workflow.status === 'canceled') {
                        return 'Completed: Order cancelled and refunded in WooCommerce';
                      }
                      if (workflow.status === 'cannot_cancel') {
                        return 'Completed: Order already shipped, return assistance provided';
                      }
                      return workflow.step;
                    };

                    return (
                      <div
                        key={workflow.id}
                        className="p-3 rounded-lg border bg-card space-y-3"
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <StatusIcon className="h-4 w-4 text-gray-500" />
                            <div>
                              <p className="font-medium text-sm">Order #{workflow.orderNumber}</p>
                              <p className="text-xs text-gray-500">{workflow.customerEmail}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge className={config.color}>{config.label}</Badge>
                            <span className="text-xs text-gray-500">
                              {formatDistanceToNow(new Date(workflow.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-600">{getStepDescription()}</span>
                            <span className="text-xs text-gray-500">{getProgress()}%</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                            <div 
                              className="bg-green-500 h-1.5 rounded-full transition-all duration-300" 
                              style={{ width: `${getProgress()}%` }}
                            />
                          </div>
                        </div>

                        {/* Step Indicators - Self-Fulfillment Specific */}
                        <div className="grid grid-cols-2 gap-1 text-xs">
                          <div className={`flex items-center space-x-1 ${workflow.customerAcknowledgmentSent ? 'text-green-600' : 'text-gray-400'}`}>
                            <Mail className="h-3 w-3" />
                            <span>Instant Response</span>
                          </div>
                          <div className={`flex items-center space-x-1 ${workflow.status === 'canceled' || workflow.status === 'cannot_cancel' ? 'text-green-600' : 'text-gray-400'}`}>
                            <Home className="h-3 w-3" />
                            <span>Direct Cancellation</span>
                          </div>
                          <div className={`flex items-center space-x-1 ${workflow.refundProcessed ? 'text-green-600' : 'text-gray-400'}`}>
                            <Package className="h-3 w-3" />
                            <span>Refund Processed</span>
                          </div>
                          <div className={`flex items-center space-x-1 ${workflow.status === 'canceled' || workflow.status === 'cannot_cancel' ? 'text-green-600' : 'text-gray-400'}`}>
                            <CheckCircle className="h-3 w-3" />
                            <span>Customer Notified</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Status Message */}
            {!isConfigured ? (
              <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                <Home className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Enable self-fulfillment mode for instant order cancellations</p>
              </div>
            ) : (
              <div className="text-center py-4 text-green-600 dark:text-green-400">
                <CheckCircle className="h-6 w-6 mx-auto mb-1" />
                <p className="text-sm font-medium">Self-fulfillment ready</p>
                <p className="text-xs text-gray-500">Orders will be cancelled instantly in WooCommerce</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}