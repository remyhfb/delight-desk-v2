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
  Warehouse
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

interface Settings {
  warehouseEmail?: string;
  fulfillmentMethod?: string;
  warehouseEmailEnabled?: boolean;
}

interface TestData {
  customerEmail: string;
  warehouseTestEmail: string;
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

export default function OrderCancellationWarehouseCard({ userId }: { userId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isSetupDialogOpen, setIsSetupDialogOpen] = useState(false);
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
  const [warehouseEmail, setWarehouseEmail] = useState('');
  const [testData, setTestData] = useState<TestData>({
    customerEmail: '',
    warehouseTestEmail: '',
    subject: 'Cancel my order please',
    body: 'Hi, I need to cancel order #12345. Can you help me with this? I ordered yesterday but changed my mind.'
  });

  // Query for user settings
  const { data: settings, isLoading: isSettingsLoading } = useQuery<Settings>({
    queryKey: ['/api/settings', userId],
    enabled: !!userId
  });

  // Query for active workflows
  const { data: workflows = [], isLoading: isWorkflowsLoading } = useQuery<OrderCancellationWorkflow[]>({
    queryKey: ['/api/order-cancellation/workflows', userId],
    refetchInterval: 30000, // Refresh every 30 seconds
    enabled: !!userId
  });

  const activeWorkflows = workflows.filter((w: OrderCancellationWorkflow) => 
    w.status === 'processing' || w.status === 'awaiting_warehouse'
  );

  // Check if configured for warehouse email
  const isConfigured = settings?.warehouseEmail && settings?.fulfillmentMethod === 'warehouse_email';
  const canConfigure = !!userId;
  const isLoading = isSettingsLoading || isWorkflowsLoading;
  const currentWarehouseEmail = settings?.warehouseEmail || '';
  const isEnabled = settings?.warehouseEmailEnabled ?? false;

  // Toggle warehouse automation mutation
  const toggleWarehouseAutomationMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      return apiRequest('PATCH', `/api/settings/${userId}`, { 
        warehouseEmailEnabled: enabled
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings', userId] });
      toast({
        title: isEnabled ? "Warehouse Automation Disabled" : "Warehouse Automation Enabled",
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

  // Update warehouse email mutation
  const updateWarehouseEmailMutation = useMutation({
    mutationFn: async () => {
      if (!warehouseEmail.trim()) {
        throw new Error('Please enter a warehouse email address');
      }

      return apiRequest('PATCH', `/api/settings/${userId}`, { 
        warehouseEmail: warehouseEmail.trim(),
        fulfillmentMethod: 'warehouse_email'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings', userId] });
      setIsSetupDialogOpen(false);
      toast({
        title: "Warehouse Email Saved",
        description: "Order cancellation automation is now configured for warehouse coordination."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Configuration Failed",
        description: error.message || "Failed to save warehouse email. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Test workflow mutation
  const testWorkflowMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/order-cancellation/test-workflow', {
        userId,
        customerEmail: testData.customerEmail,
        warehouseTestEmail: testData.warehouseTestEmail,
        subject: testData.subject,
        body: testData.body
      });
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
    toggleWarehouseAutomationMutation.mutate(enabled);
  };

  const handleUpdateWarehouseEmail = () => {
    updateWarehouseEmailMutation.mutate();
  };

  const handleTestWorkflow = () => {
    testWorkflowMutation.mutate();
  };

  // Load current settings when dialog opens
  const handleSetupDialogOpen = (open: boolean) => {
    if (open && settings) {
      setWarehouseEmail(settings.warehouseEmail || '');
    }
    setIsSetupDialogOpen(open);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-medium flex items-center space-x-2">
            <Warehouse className="h-4 w-4 text-blue-500" />
            <span>Order Cancellation (Warehouse Email)</span>
            {isConfigured && (
              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                Configured
              </Badge>
            )}
          </CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Automated order cancellations with warehouse team coordination
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Switch
              checked={isEnabled}
              onCheckedChange={handleToggleAutomation}
              disabled={!isConfigured || toggleWarehouseAutomationMutation.isPending}
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {isEnabled ? 'On' : 'Off'}
            </span>
          </div>
          <Dialog open={isSetupDialogOpen} onOpenChange={handleSetupDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={!canConfigure}>
                {isConfigured ? 'Reconfigure' : 'Setup Required'}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Order Cancellation Setup</DialogTitle>
                <DialogDescription>
                  Configure warehouse coordination for automated order cancellations
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* How It Works Section */}
                <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center">
                    <Info className="h-4 w-4 mr-2" />
                    How the Order Cancellation Workflow Works
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
                        <p className="font-medium">🛒 Checks order eligibility</p>
                        <p className="text-blue-700 dark:text-blue-300">Looks up order in WooCommerce, verifies shipping status</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium">3</div>
                      <div>
                        <p className="font-medium">✉️ Sends appropriate response</p>
                        <p className="text-blue-700 dark:text-blue-300">"We're on it — checking with warehouse" if eligible OR "Cannot cancel" if not eligible</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium">4</div>
                      <div>
                        <p className="font-medium">📫 Coordinates with warehouse</p>
                        <p className="text-blue-700 dark:text-blue-300">Emails warehouse team for confirmation if order hasn't shipped</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium">5</div>
                      <div>
                        <p className="font-medium">✅ Processes cancellation & refund</p>
                        <p className="text-blue-700 dark:text-blue-300">Automatically cancels order in WooCommerce and processes full refund</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium">6</div>
                      <div>
                        <p className="font-medium">🎯 Sends final notification</p>
                        <p className="text-blue-700 dark:text-blue-300">Confirms successful cancellation with refund details OR explains if too late</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Warehouse Email Configuration */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">Warehouse Email Configuration</h3>
                  
                  <div>
                    <Label htmlFor="warehouseEmail">Warehouse Email Address</Label>
                    <Input
                      id="warehouseEmail"
                      type="email"
                      placeholder="warehouse@yourcompany.com"
                      value={warehouseEmail}
                      onChange={(e) => setWarehouseEmail(e.target.value)}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Email address for your warehouse team or 3PL provider
                    </p>
                  </div>

                  <Button 
                    onClick={handleUpdateWarehouseEmail} 
                    disabled={updateWarehouseEmailMutation.isPending}
                    className="w-full"
                  >
                    {updateWarehouseEmailMutation.isPending ? 'Saving...' : 'Save Configuration'}
                  </Button>
                </div>

                {/* FAQ Section */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">Frequently Asked Questions</h3>
                  
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">What's the cancellation time window?</p>
                      <p className="text-gray-600 dark:text-gray-400">Weekday orders: 24 hours. Friday after 12 PM + weekend orders: eligible until Monday 12 PM. Beyond this window, the AI offers return assistance and exits - human takes over for return processing.</p>
                    </div>
                    
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">How fast does the customer get their first response?</p>
                      <p className="text-gray-600 dark:text-gray-400">Within 30-60 seconds. The AI immediately sends "We're on it" while working on the cancellation in the background.</p>
                    </div>
                    
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">What if the warehouse doesn't respond?</p>
                      <p className="text-gray-600 dark:text-gray-400">Professional 3PLs are very reliable with cancellation requests (it's their business). If no response in 8 hours, it escalates to manual handling. This is extremely rare.</p>
                    </div>
                    
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">Can customers tell this is automated?</p>
                      <p className="text-gray-600 dark:text-gray-400">All emails include "Automated by DelightDesk AI for expediency. A human is monitoring." to set clear expectations.</p>
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
                <DialogTitle>Test Order Cancellation Workflow</DialogTitle>
                <DialogDescription>
                  Simulate a customer cancellation request to test your automation setup
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                {/* Safety and Instructions Section */}
                <div className="space-y-3">
                  <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">📧 Two-Email Testing Experience</h4>
                    <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                      <p>• <strong>Customer Email:</strong> You'll receive the instant acknowledgment email</p>
                      <p>• <strong>Warehouse Email:</strong> You'll receive the coordination request (marked with [TEST])</p>
                      <p>• <strong>Use different emails you control</strong> to see both sides of the automation</p>
                    </div>
                  </div>
                  
                  <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                    <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">🛡️ Safe Testing Mode</h4>
                    <div className="text-sm text-green-800 dark:text-green-200 space-y-1">
                      <p>• <strong>Clearly marked as [TEST]</strong> - All warehouse emails include test indicators</p>
                      <p>• <strong>No action required</strong> - Test emails clearly state no action needed</p>
                      <p>• <strong>Safe to test</strong> - Use any email addresses you control</p>
                    </div>
                  </div>

                  <div className="bg-orange-50 dark:bg-orange-950/20 p-3 rounded-lg border border-orange-200 dark:border-orange-800">
                    <h4 className="font-medium text-orange-900 dark:text-orange-100 mb-2">🔍 What You'll See</h4>
                    <div className="text-sm text-orange-800 dark:text-orange-200 space-y-1">
                      <p>• Real-time workflow progress in "Active Workflows" section below</p>
                      <p>• Customer acknowledgment in your first email inbox</p>
                      <p>• Warehouse coordination request in your second email inbox</p>
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
                      placeholder="your.personal.email@gmail.com"
                      value={testData.customerEmail}
                      onChange={(e) => setTestData(prev => ({ ...prev, customerEmail: e.target.value }))}
                    />
                    <p className="text-xs text-gray-500 mt-1">Use an email you can access to see the customer acknowledgment email</p>
                  </div>
                  <div>
                    <Label htmlFor="warehouseTestEmail">Warehouse Email Address</Label>
                    <Input
                      id="warehouseTestEmail"
                      type="email"
                      placeholder="your.work.email@company.com"
                      value={testData.warehouseTestEmail}
                      onChange={(e) => setTestData(prev => ({ ...prev, warehouseTestEmail: e.target.value }))}
                    />
                    <p className="text-xs text-gray-500 mt-1">Use a different email you can access to see the warehouse coordination email</p>
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
                  Check both email addresses to see the customer acknowledgment and warehouse coordination emails.
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
                  {activeWorkflows.map((workflow: OrderCancellationWorkflow) => {
                    const config = statusConfig[workflow.status as keyof typeof statusConfig] || statusConfig.processing;
                    const StatusIcon = config.icon;
                    
                    const timeElapsed = Date.now() - new Date(workflow.createdAt).getTime();
                    const hoursElapsed = Math.floor(timeElapsed / (1000 * 60 * 60));
                    const minutesElapsed = Math.floor((timeElapsed % (1000 * 60 * 60)) / (1000 * 60));
                    
                    // Calculate progress for warehouse workflow
                    const getProgress = () => {
                      if (workflow.status === 'processing') {
                        if (workflow.customerAcknowledgmentSent) return 50; // Steps 1-3 complete
                        return 25; // Step 1-2 complete
                      }
                      if (workflow.status === 'awaiting_warehouse') return 75; // Waiting for warehouse
                      if (workflow.status === 'canceled') return 100; // All steps complete
                      if (workflow.status === 'cannot_cancel') return 100; // All steps complete
                      return 100;
                    };

                    const getStepDescription = () => {
                      if (workflow.status === 'processing') {
                        if (!workflow.customerAcknowledgmentSent) return 'Step 2: Sending instant customer response';
                        return 'Step 3-4: Checking order eligibility and contacting warehouse';
                      }
                      if (workflow.status === 'awaiting_warehouse') {
                        return `Step 4: Waiting for warehouse response (${hoursElapsed}h ${minutesElapsed}m elapsed)`;
                      }
                      if (workflow.status === 'canceled') {
                        return 'Step 5 & 6: Completed cancellation and refund via warehouse coordination';
                      }
                      if (workflow.status === 'cannot_cancel') {
                        return 'Step 6: Order already shipped, customer notified with return assistance';
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
                              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300" 
                              style={{ width: `${getProgress()}%` }}
                            />
                          </div>
                        </div>

                        {/* Step Indicators - Warehouse Specific */}
                        <div className="grid grid-cols-2 gap-1 text-xs">
                          <div className={`flex items-center space-x-1 ${workflow.customerAcknowledgmentSent ? 'text-green-600' : 'text-gray-400'}`}>
                            <Mail className="h-3 w-3" />
                            <span>Instant Response</span>
                          </div>
                          <div className={`flex items-center space-x-1 ${workflow.warehouseEmailSent ? 'text-green-600' : 'text-gray-400'}`}>
                            <Warehouse className="h-3 w-3" />
                            <span>Warehouse Contacted</span>
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
                <Warehouse className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Configure your warehouse email to enable automated order cancellations</p>
              </div>
            ) : (
              <div className="text-center py-4 text-green-600 dark:text-green-400">
                <CheckCircle className="h-6 w-6 mx-auto mb-1" />
                <p className="text-sm font-medium">Warehouse coordination ready</p>
                <p className="text-xs text-gray-500">Configured warehouse: {currentWarehouseEmail}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}