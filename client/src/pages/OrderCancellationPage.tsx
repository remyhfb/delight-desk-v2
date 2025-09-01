import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import Sidebar from '@/components/layout/sidebar';
import TopBar from '@/components/layout/topbar';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Clock, 
  Mail, 
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  Settings,
  ChevronDown,
  ChevronUp,
  Package,
  Truck,
  Building,
  Zap,
  Eye,
  RefreshCw,
  Info,
  Warehouse,
  Bot
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { SystemSettings, OrderCancellationWorkflow } from '@shared/schema';





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
  },
  completed: {
    label: 'Completed',
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    icon: CheckCircle
  }
};

const fulfillmentMethods = [
  {
    id: 'warehouse_email',
    title: 'Warehouse Email Coordination',
    description: 'Send emails to your warehouse team for manual order cancellation',
    icon: Mail,
    color: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800',
    features: ['Email coordination', 'Manual warehouse workflow', 'Human oversight']
  },
  {
    id: 'shipbob',
    title: 'ShipBob API Integration',
    description: 'Automatically cancel orders through ShipBob API before fulfillment',
    icon: Package,
    color: 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800',
    features: ['Automatic API cancellation', 'Real-time inventory sync', 'Instant confirmation']
  },
  {
    id: 'self_fulfillment',
    title: 'Self-Fulfillment Management',
    description: 'Manage cancellations for orders you fulfill in-house',
    icon: Building,
    color: 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800',
    features: ['Direct WooCommerce integration', 'Automatic refund processing', 'Order status updates']
  },
  {
    id: 'shipstation',
    title: 'ShipStation API Integration',
    description: 'Automatically cancel orders through ShipStation before shipping',
    icon: Truck,
    color: 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800',
    features: ['Automatic API cancellation', 'Shipping workflow integration', 'Real-time status updates']
  }
];

export default function OrderCancellationPage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [isEditingMethod, setIsEditingMethod] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<{[key: string]: string}>({});
  const [isWarehouseDialogOpen, setIsWarehouseDialogOpen] = useState(false);
  const [warehouseEmail, setWarehouseEmail] = useState('');
  const [isShipBobDialogOpen, setIsShipBobDialogOpen] = useState(false);
  const [isSelfFulfillmentDialogOpen, setIsSelfFulfillmentDialogOpen] = useState(false);
  const [isShipStationDialogOpen, setIsShipStationDialogOpen] = useState(false);

  if (!user) {
    return <div>Loading...</div>;
  }

  const userId = user.id;

  // Mutation for updating agent settings  
  const updateAgentSettingsMutation = useMutation({
    mutationFn: async (updates: { orderCancellationEnabled?: boolean; orderCancellationRequiresApproval?: boolean }) => {
      return await apiRequest('PUT', `/api/settings/${userId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings', userId] });
      queryClient.invalidateQueries({ queryKey: [`/api/agents/${userId}/overview`] });
      queryClient.invalidateQueries({ queryKey: [`/api/agents/cancellation/${userId}/settings`] });
      toast({
        title: "Agent Settings Updated",
        description: "Order cancellation agent settings have been saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: "Failed to update agent settings. Please try again.",
        variant: "destructive",
      });
      console.error('Failed to update agent settings:', error);
    },
  });

  // Mutation for updating fulfillment method
  const updateFulfillmentMethodMutation = useMutation({
    mutationFn: async ({ method, enabled }: { method: string; enabled: boolean }) => {
      const updateData: any = {
        fulfillmentMethod: method,
      };
      
      // Set the specific enabled flag for the method
      if (method === 'warehouse_email') {
        updateData.warehouseEmailEnabled = enabled;
      } else if (method === 'shipbob') {
        updateData.shipbobEnabled = enabled;
      } else if (method === 'self_fulfillment') {
        updateData.selfFulfillmentEnabled = enabled;
      } else if (method === 'shipstation') {
        updateData.shipstationEnabled = enabled;
      }

      return await apiRequest('PUT', `/api/settings/${userId}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings', userId] });
      queryClient.invalidateQueries({ queryKey: [`/api/agents/${userId}/overview`] });
      queryClient.invalidateQueries({ queryKey: [`/api/agents/cancellation/${userId}/settings`] });
      toast({
        title: "Settings Updated",
        description: "Fulfillment method has been updated successfully.",
      });
      setSelectedMethod(null);
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: "Failed to update fulfillment method. Please try again.",
        variant: "destructive",
      });
      console.error('Failed to update fulfillment method:', error);
    },
  });

  // Mutation for updating method configuration
  const updateMethodConfigMutation = useMutation({
    mutationFn: async (updateData: any) => {
      return await apiRequest('PUT', `/api/settings/${userId}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings', userId] });
      queryClient.invalidateQueries({ queryKey: [`/api/agents/${userId}/overview`] });
      queryClient.invalidateQueries({ queryKey: [`/api/agents/cancellation/${userId}/settings`] });
      toast({
        title: "Configuration Updated",
        description: "Method configuration has been saved successfully.",
      });
      setIsEditingMethod(null);
      setEditingValues({});
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: "Failed to update configuration. Please try again.",
        variant: "destructive",
      });
      console.error('Failed to update configuration:', error);
    },
  });

  // Mutation for updating warehouse email
  const updateWarehouseEmailMutation = useMutation({
    mutationFn: async () => {
      if (!warehouseEmail.trim()) {
        throw new Error('Please enter a warehouse email address');
      }

      return await apiRequest('PUT', `/api/settings/${userId}`, { 
        warehouseEmail: warehouseEmail.trim(),
        fulfillmentMethod: 'warehouse_email'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings', userId] });
      queryClient.invalidateQueries({ queryKey: [`/api/agents/${userId}/overview`] });
      queryClient.invalidateQueries({ queryKey: [`/api/agents/cancellation/${userId}/settings`] });
      setIsWarehouseDialogOpen(false);
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

  // Query for user settings
  const { data: settings, isLoading: isSettingsLoading } = useQuery<SystemSettings>({
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

  const completedWorkflows = workflows.filter((w: OrderCancellationWorkflow) => 
    w.status === 'canceled' || w.status === 'cannot_cancel' || w.status === 'failed' || w.status === 'completed'
  );

  // Determine current fulfillment method
  const currentMethod = settings?.fulfillmentMethod || null;
  const hasSelectedMethod = !!currentMethod;

  // Auto-expand configuration on first visit if no method selected
  React.useEffect(() => {
    if (!hasSelectedMethod && !isSettingsLoading) {
      setIsConfigOpen(true);
    }
  }, [hasSelectedMethod, isSettingsLoading]);

  const getMethodConfig = (methodId: string) => {
    return fulfillmentMethods.find(m => m.id === methodId);
  };

  const isMethodEnabled = (methodId: string) => {
    switch (methodId) {
      case 'warehouse_email':
        return settings?.warehouseEmailEnabled ?? false;
      case 'shipbob':
        return settings?.shipbobEnabled ?? false;
      case 'self_fulfillment':
        return settings?.selfFulfillmentEnabled ?? false;
      case 'shipstation':
        return settings?.shipstationEnabled ?? false;
      default:
        return false;
    }
  };

  const getMethodStatus = (methodId: string) => {
    if (currentMethod === methodId) {
      return isMethodEnabled(methodId) ? 'Active' : 'Configured';
    }
    return 'Available';
  };

  // DYNAMIC Step configurations - shows different history based on actual outcome
  const getStepConfig = (fulfillmentMethod: string, workflow?: OrderCancellationWorkflow) => {
    if (fulfillmentMethod === 'warehouse_email') {
      // For completed workflows, show dynamic history based on actual outcome
      if (workflow && (workflow.status === 'completed' || workflow.status === 'canceled')) {
        const wasSuccessful = workflow.wasCanceled === true;
        
        return {
          identify_order: { label: 'Order Identified', order: 1, description: 'AI extracted order details from customer email' },
          check_eligibility: { label: 'Eligibility Verified', order: 2, description: 'Order was eligible for cancellation' },
          acknowledge_customer: { label: 'Customer Acknowledged', order: 3, description: 'Confirmation email sent to customer' },
          email_warehouse: { label: 'Warehouse Contacted', order: 4, description: 'Cancellation request sent to warehouse team' },
          await_warehouse: { 
            label: wasSuccessful ? 'Request Accepted' : 'Request Declined', 
            order: 5, 
            description: wasSuccessful ? 'Warehouse accepted cancellation request' : 'Warehouse declined cancellation request' 
          },
          warehouse_received: { 
            label: wasSuccessful ? 'Cancellation Confirmed' : 'Decline Confirmed', 
            order: 6, 
            description: wasSuccessful ? 'Warehouse confirmed order cancellation' : 'Warehouse confirmed order cannot be cancelled' 
          },
          process_result: { 
            label: wasSuccessful ? 'Refund Processed' : 'Customer Notified', 
            order: 7, 
            description: wasSuccessful ? 'Cancellation completed and refund processed' : 'Customer notified that order cannot be cancelled' 
          }
        };
      } else {
        // For active workflows, show generic future-tense steps
        return {
          identify_order: { label: 'Identify Order', order: 1, description: 'AI analyzes email to extract order details' },
          check_eligibility: { label: 'Check Eligibility', order: 2, description: 'Verify order can be cancelled based on timing' },
          acknowledge_customer: { label: 'Acknowledge Customer', order: 3, description: 'Send confirmation email to customer' },
          email_warehouse: { label: 'Email Warehouse', order: 4, description: 'Send cancellation request to warehouse team' },
          await_warehouse: { label: 'Awaiting Warehouse Response', order: 5, description: 'Will accept or reject cancellation request' },
          warehouse_received: { label: 'Warehouse Received', order: 6, description: 'Warehouse team has acknowledged the request' },
          process_result: { label: 'Process Result', order: 7, description: 'Finalize cancellation and process refund' }
        };
      }
    } else {
      // For automated methods (ShipBob, self-fulfillment, ShipStation)  
      return {
        identify_order: { label: 'Identify Order', order: 1, description: 'AI analyzes email to extract order details' },
        check_eligibility: { label: 'Check Eligibility', order: 2, description: 'Verify order can be cancelled based on timing' },
        acknowledge_customer: { label: 'Acknowledge Customer', order: 3, description: 'Send confirmation email to customer' },
        process_cancellation: { label: 'Process Cancellation', order: 4, description: 'Automatically cancel order via API' },
        process_result: { label: 'Process Result', order: 5, description: 'Process refund and finalize' },
        completed: { label: 'Complete', order: 6, description: 'Workflow completed successfully' }
      };
    }
  };

  const getWorkflowProgress = (workflow: OrderCancellationWorkflow) => {
    const currentStep = getCurrentStep(workflow);
    
    if (workflow.fulfillmentMethod === 'warehouse_email') {
      // 7-step warehouse workflow progress
      return Math.min(((currentStep - 1) / 6) * 100, 100);
    } else {
      // 6-step automated workflow progress  
      return Math.min(((currentStep - 1) / 5) * 100, 100);
    }
  };

  const getStepDescription = (workflow: OrderCancellationWorkflow) => {
    const timeElapsed = workflow.createdAt ? Date.now() - new Date(workflow.createdAt).getTime() : 0;
    const hoursElapsed = Math.floor(timeElapsed / (1000 * 60 * 60));
    const minutesElapsed = Math.floor((timeElapsed % (1000 * 60 * 60)) / (1000 * 60));

    if (workflow.fulfillmentMethod === 'warehouse_email') {
      // Warehouse email coordination workflow - aligned with backend steps
      switch (workflow.step) {
        case 'identify_order':
          return 'Extracting order details from customer email';
        case 'check_eligibility':
          return 'Verifying order can be cancelled';
        case 'acknowledge_customer':
          return 'Sending confirmation to customer';
        case 'email_warehouse':
          return 'Sending cancellation request to warehouse team';
        case 'await_warehouse':
          if (workflow.warehouseReplyReceived) {
            return 'Warehouse has acknowledged request, processing result';
          }
          return `Awaiting warehouse response (${hoursElapsed}h ${minutesElapsed}m elapsed)`;
        case 'process_result':
          return 'Processing cancellation result and finalizing';
        default:
          return 'Processing workflow';
      }
    } else {
      // Automated fulfillment workflows  
      switch (workflow.step) {
        case 'identify_order':
          return 'Extracting order details from customer email';
        case 'check_eligibility':
          return 'Verifying order can be cancelled';
        case 'acknowledge_customer':
          return 'Sending confirmation to customer';
        case 'process_shipbob':
        case 'process_cancellation':
          return 'Processing automatic cancellation via API';
        case 'process_result':
          return 'Processing refund and finalizing cancellation';
        case 'completed':
          return 'Workflow completed successfully';
        default:
          return 'Processing workflow';
      }
    }

    if (workflow.status === 'canceled') {
      return 'Cancellation completed successfully';
    }
    if (workflow.status === 'cannot_cancel') {
      return 'Order already shipped, customer notified';
    }
    if (workflow.status === 'failed') {
      return 'Workflow failed, requires manual intervention';
    }
    return workflow.step;
  };

  const handleMethodSelection = (methodId: string) => {
    setSelectedMethod(methodId);
  };

  const handleMethodActivation = (methodId: string) => {
    // Activate the selected fulfillment method
    updateFulfillmentMethodMutation.mutate({ method: methodId, enabled: true });
  };

  const handleEditMethod = (methodId: string) => {
    if (methodId === 'warehouse_email') {
      setWarehouseEmail(settings?.warehouseEmail || '');
      setIsWarehouseDialogOpen(true);
    } else if (methodId === 'shipbob') {
      setIsShipBobDialogOpen(true);
    } else if (methodId === 'self_fulfillment') {
      setIsSelfFulfillmentDialogOpen(true);
    } else if (methodId === 'shipstation') {
      setIsShipStationDialogOpen(true);
    } else {
      setIsEditingMethod(methodId);
    }
  };

  const handleWarehouseDialogOpen = (open: boolean) => {
    if (open && settings) {
      setWarehouseEmail(settings.warehouseEmail || '');
    }
    setIsWarehouseDialogOpen(open);
  };

  const handleSaveConfiguration = () => {
    if (!isEditingMethod) return;
    
    let updateData: any = {};
    
    if (isEditingMethod === 'warehouse_email') {
      updateData.warehouseEmail = editingValues.warehouseEmail;
    }
    // Add configuration saving for other methods
    
    updateMethodConfigMutation.mutate(updateData);
  };

  const handleCancelEdit = () => {
    setIsEditingMethod(null);
    setEditingValues({});
  };

  const handleUpdateWarehouseEmail = () => {
    updateWarehouseEmailMutation.mutate();
  };

  const handleShipBobConnect = () => {
    window.location.href = '/api/auth/shipbob';
  };

  // Get workflow steps based on fulfillment method
  const getWorkflowSteps = (fulfillmentMethod: string) => {
    switch (fulfillmentMethod) {
      case 'warehouse_email':
        return [
          { id: 1, title: "AI Detection", description: "Email classified & order extracted", icon: "📧" },
          { id: 2, title: "Order Check", description: "Eligibility verified in WooCommerce", icon: "🛒" },
          { id: 3, title: "Initial Response", description: "Customer acknowledgment sent", icon: "✉️" },
          { id: 4, title: "Warehouse Email", description: "Cancellation request sent to warehouse", icon: "📫" },
          { id: 5, title: "Await Receipt", description: "Waiting for warehouse to receive email", icon: "⏳" },
          { id: 6, title: "Warehouse Received", description: "Warehouse team has acknowledged request", icon: "✅" },
          { id: 7, title: "Process & Complete", description: "Cancellation processed & customer notified", icon: "🎯" }
        ];
      case 'shipbob':
        return [
          { id: 1, title: "AI Detection", description: "Email classified & order extracted", icon: "📧" },
          { id: 2, title: "Order Check", description: "Status verified in WooCommerce & ShipBob", icon: "🛒" },
          { id: 3, title: "Customer Response", description: "Processing confirmation sent", icon: "✉️" },
          { id: 4, title: "ShipBob API", description: "Shipment cancelled via API", icon: "📦" },
          { id: 5, title: "Cancellation & Refund", description: "Order cancelled & refund processed", icon: "✅" },
          { id: 6, title: "Confirmation", description: "Customer notified with refund details", icon: "🎯" }
        ];
      case 'self_fulfillment':
        return [
          { id: 1, title: "AI Detection", description: "Email classified & order extracted", icon: "📧" },
          { id: 2, title: "Order Check", description: "Fulfillment status verified", icon: "🛒" },
          { id: 3, title: "Immediate Response", description: "Cancellation confirmation sent", icon: "✉️" },
          { id: 4, title: "Status Update", description: "Order marked as cancelled", icon: "📋" },
          { id: 5, title: "Refund Processing", description: "Full refund processed automatically", icon: "✅" },
          { id: 6, title: "Final Notification", description: "Refund timeline confirmed", icon: "🎯" }
        ];
      case 'shipstation':
        return [
          { id: 1, title: "AI Detection", description: "Email classified & order extracted", icon: "📧" },
          { id: 2, title: "Order Check", description: "Status verified in WooCommerce & ShipStation", icon: "🛒" },
          { id: 3, title: "Customer Response", description: "Processing confirmation sent", icon: "✉️" },
          { id: 4, title: "ShipStation API", description: "Shipment cancelled via API", icon: "📦" },
          { id: 5, title: "Cancellation & Refund", description: "Order cancelled & refund processed", icon: "✅" },
          { id: 6, title: "Confirmation", description: "Customer notified with refund details", icon: "🎯" }
        ];
      default:
        return [];
    }
  };

  // Get current step based on workflow status and step - ALIGNED WITH BACKEND TRACKING
  const getCurrentStep = (workflow: OrderCancellationWorkflow) => {
    if (workflow.fulfillmentMethod === 'warehouse_email') {
      // 7-step warehouse workflow - map actual backend steps to display steps
      if (workflow.status === 'completed' || workflow.status === 'canceled') return 7;
      if (workflow.status === 'failed') return workflow.customerAcknowledgmentSent ? 3 : 1;
      
      // Map backend workflow step to frontend display step
      switch (workflow.step) {
        case 'identify_order': return 1;
        case 'check_eligibility': return 2;
        case 'acknowledge_customer': return 3;
        case 'email_warehouse': return 4;
        case 'await_warehouse': 
          // In await_warehouse step, check if warehouse replied to show step 6
          return workflow.warehouseReplyReceived ? 6 : 5;
        case 'process_result': return 7;
        default: return 1;
      }
    } else {
      // 6-step automated workflow
      if (workflow.status === 'completed' || workflow.status === 'canceled') return 6;
      if (workflow.status === 'failed') return 1;
      
      // Map backend workflow step to frontend display step
      switch (workflow.step) {
        case 'identify_order': return 1;
        case 'check_eligibility': return 2;
        case 'acknowledge_customer': return 3;
        case 'process_shipbob':
        case 'process_cancellation': return 4;
        case 'process_result': return 5;
        case 'completed': return 6;
        default: return 1;
      }
    }
  };

  const WorkflowCard = ({ workflow }: { workflow: OrderCancellationWorkflow }) => {
    const config = statusConfig[workflow.status as keyof typeof statusConfig] || statusConfig.processing;
    const StatusIcon = config.icon;
    const methodConfig = getMethodConfig(workflow.fulfillmentMethod);
    const stepConfig = getStepConfig(workflow.fulfillmentMethod, workflow);
    const steps = Object.values(stepConfig).sort((a, b) => a.order - b.order);
    const currentStep = getCurrentStep(workflow);

    return (
      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              <StatusIcon className="h-5 w-5 text-gray-500" />
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-semibold">Order #{workflow.orderNumber}</h3>
                  {methodConfig && (
                    <Badge variant="outline" className="text-xs">
                      <methodConfig.icon className="h-3 w-3 mr-1" />
                      {methodConfig.title}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{workflow.customerEmail}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge className={config.color}>{config.label}</Badge>
              <span className="text-xs text-gray-500">
                {workflow.createdAt ? formatDistanceToNow(new Date(workflow.createdAt), { addSuffix: true }) : 'Unknown'}
              </span>
            </div>
          </div>

          {/* Workflow Timeline */}
          <div className="mt-4">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
              Current Step: {steps[currentStep - 1]?.label || 'Processing'}
            </div>
            
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 dark:bg-gray-700"></div>
              
              {/* Steps */}
              <div className="relative flex justify-between">
                {steps.map((step, index) => {
                  const stepNumber = step.order;
                  const isCompleted = stepNumber < currentStep;
                  const isCurrent = stepNumber === currentStep;
                  const isUpcoming = stepNumber > currentStep;
                  const isFailed = workflow.status === 'failed' && stepNumber === currentStep;
                  
                  return (
                    <div key={`${workflow.id}-step-${step.order}`} className="flex flex-col items-center relative">
                      {/* Step circle */}
                      <div className={`
                        w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold border-2 relative z-10
                        ${isCompleted 
                          ? 'bg-green-500 border-green-500 text-white' 
                          : isCurrent && !isFailed
                          ? 'bg-blue-500 border-blue-500 text-white animate-pulse' 
                          : isFailed
                          ? 'bg-red-500 border-red-500 text-white'
                          : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                        }
                      `}>
                        {isCompleted ? (
                          <CheckCircle className="h-5 w-5" />
                        ) : isFailed ? (
                          <XCircle className="h-5 w-5" />
                        ) : (
                          <span>{step.order}</span>
                        )}
                      </div>
                      
                      {/* Step content */}
                      <div className="mt-3 text-center max-w-24">
                        <div className={`text-xs font-medium ${
                          isCompleted || isCurrent ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {step.label}
                        </div>
                        <div className={`text-xs mt-1 leading-tight ${
                          isCompleted || isCurrent ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'
                        }`}>
                          {step.description}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Final Outcome Banner - Only show for completed workflows */}
          {(workflow.status === 'completed' || workflow.status === 'canceled' || workflow.status === 'cannot_cancel') && (
            <div className="mt-6">
              {workflow.wasCanceled === true ? (
                <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                    <div>
                      <div className="font-medium text-green-900 dark:text-green-100">Order Successfully Cancelled</div>
                      <div className="text-sm text-green-700 dark:text-green-300">
                        {workflow.refundProcessed 
                          ? `Refund of $${workflow.refundAmount} has been processed`
                          : 'Order cancelled, refund will be processed separately'
                        }
                      </div>
                    </div>
                  </div>
                </div>
              ) : workflow.wasCanceled === false ? (
                <div className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <AlertCircle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                    <div>
                      <div className="font-medium text-orange-900 dark:text-orange-100">Cancellation Not Possible</div>
                      <div className="text-sm text-orange-700 dark:text-orange-300">
                        {workflow.warehouseReply 
                          ? `Warehouse response: ${workflow.warehouseReply}`
                          : 'Order could not be cancelled due to fulfillment timing'
                        }
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {workflow.status === 'failed' && (
            <div className="mt-4 flex space-x-2">
              <Button size="sm" variant="outline">
                <RefreshCw className="h-4 w-4 mr-1" />
                Retry
              </Button>
              <Button size="sm" variant="outline">
                <Eye className="h-4 w-4 mr-1" />
                View Details
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar isOpen={true} onClose={() => {}} />
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-64">
        <TopBar onMenuClick={() => {}} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Order Cancellation Management</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Automate and monitor order cancellation workflows
          </p>
        </div>
        <div className="flex items-center space-x-4">
          {activeWorkflows.length > 0 && (
            <Badge variant="secondary" className="px-3 py-1">
              {activeWorkflows.length} Active
            </Badge>
          )}
          <Button
            variant="outline"
            onClick={() => setIsConfigOpen(!isConfigOpen)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Configuration
          </Button>
        </div>
      </div>

      {/* Agent Controls */}
      <Card data-testid="card-agent-controls">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-600" />
            Order Cancellation Agent
          </CardTitle>
          <CardDescription>
            Enable automatic order cancellation handling for incoming customer emails. The agent will process cancellation requests based on your configured fulfillment method.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <h3 className="font-medium">Enable Agent</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Process order cancellation requests automatically
              </p>
            </div>
            <Switch
              data-testid="switch-agent-enabled"
              checked={settings?.orderCancellationEnabled ?? false}
              onCheckedChange={(checked) => 
                updateAgentSettingsMutation.mutate({ orderCancellationEnabled: checked })
              }
              disabled={updateAgentSettingsMutation.isPending}
            />
          </div>

          {settings?.orderCancellationEnabled && (
            <div className="flex items-center justify-between p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
              <div className="space-y-1">
                <h3 className="font-medium">Require Approval</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Send cancellation requests to approval queue before processing
                </p>
              </div>
              <Switch
                data-testid="switch-require-approval"
                checked={settings?.orderCancellationRequiresApproval ?? true}
                onCheckedChange={(checked) => 
                  updateAgentSettingsMutation.mutate({ orderCancellationRequiresApproval: checked })
                }
                disabled={updateAgentSettingsMutation.isPending}
              />
            </div>
          )}

          {settings?.orderCancellationEnabled && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-amber-600 mt-0.5" />
                <div className="space-y-2">
                  <h4 className="font-medium text-amber-800 dark:text-amber-200">Agent Status: Active</h4>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    The order cancellation agent is monitoring incoming emails and will automatically process 
                    cancellation requests {settings?.orderCancellationRequiresApproval ? 'after approval' : 'immediately'} 
                    using your configured fulfillment method.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Section */}
      <Collapsible open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <CollapsibleContent>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Fulfillment Method Configuration
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    {isConfigOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
              </CardTitle>
              <CardDescription>
                Choose how you want to handle order cancellation requests. Once selected, this will run in the background.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fulfillmentMethods.map((method) => {
                  const MethodIcon = method.icon;
                  const isCurrentMethod = currentMethod === method.id;
                  const isSelected = selectedMethod === method.id;
                  const isEnabled = isMethodEnabled(method.id);
                  const status = getMethodStatus(method.id);

                  return (
                    <Card 
                      key={method.id} 
                      className={`cursor-pointer transition-all hover:shadow-md ${method.color} ${isSelected ? 'ring-2 ring-blue-500' : ''} ${isCurrentMethod ? 'ring-2 ring-green-500' : ''}`}
                      onClick={() => handleMethodSelection(method.id)}
                    >
                      <CardContent className="pt-4">
                        <div className="flex items-start space-x-3">
                          <MethodIcon className="h-6 w-6 mt-1" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="font-semibold">{method.title}</h3>
                              <Badge 
                                variant={status === 'Active' ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {status}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                              {method.description}
                            </p>
                            
                            {/* Show current configuration */}
                            {isCurrentMethod && method.id === 'warehouse_email' && settings?.warehouseEmail && (
                              <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs">
                                <span className="font-medium">Warehouse Email:</span> {settings.warehouseEmail}
                              </div>
                            )}
                            <ul className="text-xs space-y-1">
                              {method.features.map((feature, index) => (
                                <li key={`${method.id}-feature-${index}`} className="flex items-center">
                                  <CheckCircle className="h-3 w-3 mr-2 text-green-500" />
                                  {feature}
                                </li>
                              ))}
                            </ul>
                            {/* Configuration interface when editing */}
                            {isEditingMethod === method.id && (
                              <div className="mt-3 pt-3 border-t space-y-3">
                                {method.id === 'warehouse_email' && (
                                  <div>
                                    <Label htmlFor="warehouse-email">Warehouse Email Address</Label>
                                    <Input
                                      id="warehouse-email"
                                      type="email"
                                      placeholder="warehouse@company.com"
                                      value={editingValues.warehouseEmail || ''}
                                      onChange={(e) => setEditingValues({...editingValues, warehouseEmail: e.target.value})}
                                      className="mt-1"
                                    />
                                  </div>
                                )}
                                <div className="flex space-x-2">
                                  <Button 
                                    size="sm" 
                                    onClick={handleSaveConfiguration}
                                    disabled={updateMethodConfigMutation.isPending}
                                    className="flex-1"
                                  >
                                    {updateMethodConfigMutation.isPending ? 'Saving...' : 'Save'}
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={handleCancelEdit}
                                    className="flex-1"
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            )}

                            {/* Action buttons when not editing */}
                            {!isEditingMethod && (
                              <div className="mt-3 pt-3 border-t">
                                {isCurrentMethod ? (
                                  <div className="space-y-2">
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      className="w-full"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditMethod(method.id);
                                      }}
                                    >
                                      <Settings className="h-4 w-4 mr-2" />
                                      Configure {method.title}
                                    </Button>
                                  </div>
                                ) : isSelected ? (
                                  <Button 
                                    size="sm" 
                                    className="w-full"
                                    onClick={(e) => {
                                      e.stopPropagation(); // Prevent card click
                                      handleMethodActivation(method.id);
                                    }}
                                    disabled={updateFulfillmentMethodMutation.isPending}
                                  >
                                    <Settings className="h-4 w-4 mr-2" />
                                    {updateFulfillmentMethodMutation.isPending ? 'Activating...' : `Activate ${method.title}`}
                                  </Button>
                                ) : null}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Active Workflows Feed */}
      {activeWorkflows.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Active Workflows</h2>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary">{activeWorkflows.length} in progress</Badge>
              <Button variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
          <div className="space-y-4">
            {activeWorkflows.map((workflow) => (
              <WorkflowCard key={workflow.id} workflow={workflow} />
            ))}
          </div>
        </div>
      )}

      {/* Empty State for Active Workflows */}
      {activeWorkflows.length === 0 && hasSelectedMethod && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Zap className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Active Workflows</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Order cancellation automation is running in the background. 
                New workflows will appear here when customers request cancellations.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completed Workflows */}
      {completedWorkflows.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Recent Completed Workflows</h2>
          <div className="space-y-4">
            {completedWorkflows.slice(0, 5).map((workflow) => (
              <WorkflowCard key={workflow.id} workflow={workflow} />
            ))}
          </div>
          {completedWorkflows.length > 5 && (
            <div className="text-center mt-4">
              <Button variant="outline">
                View All Completed Workflows
              </Button>
            </div>
          )}
        </div>
      )}

      {/* First-time setup state */}
      {!hasSelectedMethod && !isSettingsLoading && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Settings className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Choose Your Fulfillment Method</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Select how you want to handle order cancellations to get started with automation.
              </p>
              <Button onClick={() => setIsConfigOpen(true)}>
                Configure Fulfillment Method
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Warehouse Email Configuration Dialog */}
      <Dialog open={isWarehouseDialogOpen} onOpenChange={handleWarehouseDialogOpen}>
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

      {/* ShipBob Configuration Dialog */}
      <Dialog open={isShipBobDialogOpen} onOpenChange={setIsShipBobDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ShipBob Integration Setup</DialogTitle>
            <DialogDescription>
              Configure ShipBob API integration for automated order cancellations
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* How It Works Section */}
            <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center">
                <Info className="h-4 w-4 mr-2" />
                How the ShipBob Order Cancellation Workflow Works
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
                    <p className="text-blue-700 dark:text-blue-300">Looks up order in WooCommerce and ShipBob, verifies shipping status</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium">3</div>
                  <div>
                    <p className="font-medium">✉️ Sends appropriate response</p>
                    <p className="text-blue-700 dark:text-blue-300">"We're processing your cancellation" if eligible OR "Cannot cancel" if shipped</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium">4</div>
                  <div>
                    <p className="font-medium">📦 Cancels shipment via ShipBob API</p>
                    <p className="text-blue-700 dark:text-blue-300">Automatically cancels unfulfilled orders directly in ShipBob</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium">5</div>
                  <div>
                    <p className="font-medium">✅ Processes cancellation & refund</p>
                    <p className="text-blue-700 dark:text-blue-300">Cancels order in WooCommerce and processes full refund automatically</p>
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

            {/* ShipBob Configuration */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">ShipBob API Integration</h3>
              
              {settings?.shipbobAccessToken ? (
                <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-900 dark:text-green-100">
                      ShipBob Connected Successfully
                    </span>
                  </div>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    Your ShipBob integration is active and ready for automated order cancellations.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      Connect your ShipBob account to enable automated order cancellations through their API.
                    </p>
                  </div>
                  
                  <Button onClick={handleShipBobConnect} className="w-full">
                    Connect to ShipBob
                  </Button>
                </div>
              )}
            </div>

            {/* FAQ Section */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Frequently Asked Questions</h3>
              
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">How does ShipBob integration work?</p>
                  <p className="text-gray-600 dark:text-gray-400">The AI connects directly to ShipBob's API to check fulfillment status and cancel orders before they ship. This eliminates delays and manual coordination.</p>
                </div>
                
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">What if an order has already shipped?</p>
                  <p className="text-gray-600 dark:text-gray-400">The AI automatically detects shipped orders and responds with return instructions instead of cancellation. No manual intervention needed.</p>
                </div>
                
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">Is this secure?</p>
                  <p className="text-gray-600 dark:text-gray-400">Yes, we use OAuth 2.0 authentication with ShipBob. Your credentials are encrypted and we only access order cancellation functions.</p>
                </div>
                
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">How fast are cancellations processed?</p>
                  <p className="text-gray-600 dark:text-gray-400">Typically within 2-3 minutes. The API connection allows instant order cancellation without waiting for human coordination.</p>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Self-Fulfillment Configuration Dialog */}
      <Dialog open={isSelfFulfillmentDialogOpen} onOpenChange={setIsSelfFulfillmentDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Self-Fulfillment Setup</DialogTitle>
            <DialogDescription>
              Configure automated cancellations for self-fulfilled orders
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* How It Works Section */}
            <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center">
                <Info className="h-4 w-4 mr-2" />
                How the Self-Fulfillment Cancellation Workflow Works
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
                    <p className="text-blue-700 dark:text-blue-300">Looks up order in WooCommerce, verifies it hasn't been fulfilled yet</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium">3</div>
                  <div>
                    <p className="font-medium">✉️ Sends immediate response</p>
                    <p className="text-blue-700 dark:text-blue-300">"Cancellation processed" if eligible OR "Cannot cancel" if already fulfilled</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium">4</div>
                  <div>
                    <p className="font-medium">📋 Updates order status</p>
                    <p className="text-blue-700 dark:text-blue-300">Marks order as cancelled in WooCommerce to prevent fulfillment</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium">5</div>
                  <div>
                    <p className="font-medium">✅ Processes refund</p>
                    <p className="text-blue-700 dark:text-blue-300">Automatically processes full refund through WooCommerce</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium">6</div>
                  <div>
                    <p className="font-medium">🎯 Sends confirmation</p>
                    <p className="text-blue-700 dark:text-blue-300">Confirms cancellation with refund timeline and details</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Self-Fulfillment Configuration */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Self-Fulfillment Configuration</h3>
              
              <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-900 dark:text-green-100">
                    Self-Fulfillment Ready
                  </span>
                </div>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  Your self-fulfillment setup is configured and ready for automated order cancellations.
                </p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Configuration Summary</h4>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                  <li>• Automated cancellation for unfulfilled orders</li>
                  <li>• Instant refund processing through WooCommerce</li>
                  <li>• Real-time order status updates</li>
                  <li>• Professional customer communication</li>
                </ul>
              </div>
            </div>

            {/* FAQ Section */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Frequently Asked Questions</h3>
              
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">How does it know if an order can be cancelled?</p>
                  <p className="text-gray-600 dark:text-gray-400">The AI checks the order status in WooCommerce. Orders marked as "processing" or "pending" can be cancelled, while "shipped" or "completed" orders cannot.</p>
                </div>
                
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">What about partial fulfillments?</p>
                  <p className="text-gray-600 dark:text-gray-400">The AI detects partial shipments and handles them appropriately - cancelling unfulfilled items and processing partial refunds as needed.</p>
                </div>
                
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">How fast are the responses?</p>
                  <p className="text-gray-600 dark:text-gray-400">Customers receive confirmation within 30-60 seconds. The entire process from request to refund completion typically takes 2-3 minutes.</p>
                </div>
                
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">What if something goes wrong?</p>
                  <p className="text-gray-600 dark:text-gray-400">All automated actions are logged and can be reversed. Failed automations are escalated to human review automatically.</p>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ShipStation Configuration Dialog */}
      <Dialog open={isShipStationDialogOpen} onOpenChange={setIsShipStationDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ShipStation Integration Setup</DialogTitle>
            <DialogDescription>
              Configure ShipStation API integration for automated order cancellations
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* How It Works Section */}
            <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center">
                <Info className="h-4 w-4 mr-2" />
                How the ShipStation Order Cancellation Workflow Works
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
                    <p className="text-blue-700 dark:text-blue-300">Looks up order in WooCommerce and ShipStation, verifies shipping status</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium">3</div>
                  <div>
                    <p className="font-medium">✉️ Sends appropriate response</p>
                    <p className="text-blue-700 dark:text-blue-300">"We're processing your cancellation" if eligible OR "Cannot cancel" if shipped</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium">4</div>
                  <div>
                    <p className="font-medium">📦 Cancels shipment via ShipStation API</p>
                    <p className="text-blue-700 dark:text-blue-300">Automatically cancels unfulfilled orders directly in ShipStation</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium">5</div>
                  <div>
                    <p className="font-medium">✅ Processes cancellation & refund</p>
                    <p className="text-blue-700 dark:text-blue-300">Cancels order in WooCommerce and processes full refund automatically</p>
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

            {/* ShipStation Configuration */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">ShipStation API Integration</h3>
              
              <div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                  <span className="font-medium text-yellow-900 dark:text-yellow-100">
                    ShipStation Integration Coming Soon
                  </span>
                </div>
                <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                  ShipStation API integration is in development. Use ShipBob or warehouse email coordination for now.
                </p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Planned Features</h4>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                  <li>• Direct API connection to ShipStation</li>
                  <li>• Real-time order status checking</li>
                  <li>• Automated shipment cancellation</li>
                  <li>• Seamless WooCommerce integration</li>
                </ul>
              </div>
            </div>

            {/* FAQ Section */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Frequently Asked Questions</h3>
              
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">When will ShipStation integration be available?</p>
                  <p className="text-gray-600 dark:text-gray-400">We're working on ShipStation API integration. In the meantime, consider using ShipBob integration or warehouse email coordination for automated cancellations.</p>
                </div>
                
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">How will it compare to other methods?</p>
                  <p className="text-gray-600 dark:text-gray-400">Similar to ShipBob - direct API integration for instant cancellations without manual coordination. Very fast and reliable.</p>
                </div>
                
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">What should I use for now?</p>
                  <p className="text-gray-600 dark:text-gray-400">If you use ShipBob, choose that integration. Otherwise, warehouse email coordination works excellently with any 3PL or internal fulfillment team.</p>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
          </div>
        </main>
      </div>
    </div>
  );
}