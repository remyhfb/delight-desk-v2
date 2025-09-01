import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import Sidebar from '@/components/layout/sidebar';
import TopBar from '@/components/layout/topbar';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  Building,
  RefreshCw,
  Info,
  Bot,
  MapPin,
  AlertTriangle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { SystemSettings } from '@shared/schema';

interface AddressChangeWorkflow {
  id: string;
  orderNumber: string;
  customerEmail: string;
  status: string;
  step: string;
  isEligible: boolean;
  eligibilityReason: string;
  fulfillmentMethod: string;
  customerAcknowledgmentSent: boolean;
  warehouseEmailSent: boolean;
  warehouseReplyReceived: boolean;
  warehouseReply?: string;
  wasUpdated?: boolean;
  currentAddress?: any;
  requestedAddress?: any;
  createdAt: string;
  completedAt?: string;
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
  completed: { 
    label: 'Completed', 
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    icon: CheckCircle
  },
  cannot_change: { 
    label: 'Cannot Change', 
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
    icon: AlertCircle
  },
  failed: { 
    label: 'Failed', 
    color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    icon: XCircle
  },
  escalated: {
    label: 'Escalated',
    color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    icon: XCircle
  }
};

const fulfillmentMethods = [
  {
    id: 'warehouse_email',
    title: 'Warehouse Email Coordination',
    description: 'Send emails to your warehouse team for manual address changes',
    icon: Mail,
    color: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800',
    features: ['Email coordination', 'Manual warehouse workflow', 'Human oversight']
  },
  {
    id: 'shipbob',
    title: 'ShipBob API Integration',
    description: 'Automatically change addresses through ShipBob API before fulfillment',
    icon: Package,
    color: 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800',
    features: ['Automatic API updates', 'Real-time address sync', 'Instant confirmation']
  },
  {
    id: 'self_fulfillment',
    title: 'Self-Fulfillment Management',
    description: 'Manage address changes for orders you fulfill in-house',
    icon: Building,
    color: 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800',
    features: ['Direct WooCommerce integration', 'Automatic address updates', 'Order status sync']
  }
];

const getAddressChangeSteps = (fulfillmentMethod: string, workflow?: AddressChangeWorkflow) => {
  const isEligible = workflow?.isEligible;
  const wasUpdated = workflow?.wasUpdated;
  const status = workflow?.status;
  
  if (fulfillmentMethod === 'warehouse_email') {
    if (status === 'completed' || status === 'cannot_change') {
      // Show completed workflow with past-tense descriptions
      return {
        identify_order: { 
          label: 'Extract Order', 
          order: 1, 
          description: 'AI analyzed email and extracted order details' 
        },
        check_eligibility: { 
          label: 'Check Eligibility', 
          order: 2, 
          description: isEligible ? 'Order was eligible for address change' : 'Order was not eligible for address change'
        },
        acknowledge_customer: { 
          label: 'Notify Customer', 
          order: 3, 
          description: 'Customer was notified about address change request'
        },
        email_warehouse: { 
          label: 'Email Warehouse', 
          order: 4, 
          description: isEligible ? 'Warehouse team was notified of address change' : 'No warehouse email sent - not eligible'
        },
        await_warehouse: { 
          label: 'Await Response', 
          order: 5, 
          description: isEligible ? (wasUpdated ? 'Warehouse confirmed address update' : 'Warehouse unable to update address') : 'Skipped - not eligible'
        },
        process_result: { 
          label: 'Process Result', 
          order: 6, 
          description: wasUpdated ? 'Address successfully updated' : 'Address could not be updated'
        }
      };
    } else {
      // Active workflow with future-tense descriptions
      return {
        identify_order: { 
          label: 'Extract Order', 
          order: 1, 
          description: 'AI analyzes email to extract order details' 
        },
        check_eligibility: { 
          label: 'Check Eligibility', 
          order: 2, 
          description: 'Verify order can have address changed based on timing' 
        },
        acknowledge_customer: { 
          label: 'Notify Customer', 
          order: 3, 
          description: 'Send confirmation email to customer' 
        },
        email_warehouse: { 
          label: 'Email Warehouse', 
          order: 4, 
          description: 'Send address change request to warehouse team' 
        },
        await_warehouse: { 
          label: 'Await Response', 
          order: 5, 
          description: 'Wait for warehouse confirmation of address update' 
        },
        process_result: { 
          label: 'Process Result', 
          order: 6, 
          description: 'Process warehouse response and update customer' 
        }
      };
    }
  } else {
    // Automated fulfillment methods (ShipBob, Self-fulfillment)
    if (status === 'completed' || status === 'cannot_change') {
      return {
        identify_order: { 
          label: 'Extract Order', 
          order: 1, 
          description: 'AI analyzed email and extracted order details' 
        },
        check_eligibility: { 
          label: 'Check Eligibility', 
          order: 2, 
          description: isEligible ? 'Order was eligible for address change' : 'Order was not eligible for address change'
        },
        acknowledge_customer: { 
          label: 'Notify Customer', 
          order: 3, 
          description: 'Customer was notified about address change request'
        },
        update_address: { 
          label: 'Update Address', 
          order: 4, 
          description: isEligible ? (wasUpdated ? 'Address updated successfully via API' : 'Address update failed') : 'Skipped - not eligible'
        },
        complete: { 
          label: 'Complete', 
          order: 5, 
          description: wasUpdated ? 'Address change completed successfully' : 'Address change could not be completed'
        }
      };
    } else {
      return {
        identify_order: { 
          label: 'Extract Order', 
          order: 1, 
          description: 'AI analyzes email to extract order details' 
        },
        check_eligibility: { 
          label: 'Check Eligibility', 
          order: 2, 
          description: 'Verify order can have address changed based on timing' 
        },
        acknowledge_customer: { 
          label: 'Notify Customer', 
          order: 3, 
          description: 'Send confirmation email to customer' 
        },
        update_address: { 
          label: 'Update Address', 
          order: 4, 
          description: 'Process address change via automated system' 
        },
        complete: { 
          label: 'Complete', 
          order: 5, 
          description: 'Finalize address change and notify customer' 
        }
      };
    }
  }
};

const getCurrentStep = (workflow: AddressChangeWorkflow) => {
  if (workflow.fulfillmentMethod === 'warehouse_email') {
    if (workflow.status === 'completed' || workflow.status === 'cannot_change') return 6;
    
    switch (workflow.step) {
      case 'identify_order': return 1;
      case 'check_eligibility': return 2;
      case 'acknowledge_customer': return 3;
      case 'email_warehouse': return 4;
      case 'await_warehouse': return 5;
      case 'process_result': return 6;
      default: return 1;
    }
  } else {
    if (workflow.status === 'completed' || workflow.status === 'cannot_change') return 5;
    
    switch (workflow.step) {
      case 'identify_order': return 1;
      case 'check_eligibility': return 2;
      case 'acknowledge_customer': return 3;
      case 'update_address': return 4;
      case 'complete': return 5;
      default: return 1;
    }
  }
};

export default function AddressChangePage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [isEditingMethod, setIsEditingMethod] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<{[key: string]: string}>({});

  // Fetch system settings
  const { data: settings, isLoading: settingsLoading } = useQuery<SystemSettings>({
    queryKey: [`/api/system-settings/${user?.id}`],
    enabled: !!user?.id,
  });

  // Fetch address change workflows
  const { data: workflows = [], isLoading: workflowsLoading, refetch: refetchWorkflows } = useQuery<AddressChangeWorkflow[]>({
    queryKey: [`/api/address-change/workflows/${user?.id}`],
    enabled: !!user?.id,
  });

  // Get active workflows (processing or awaiting warehouse)
  const activeWorkflows = workflows.filter(w => 
    ['processing', 'awaiting_warehouse'].includes(w.status)
  );

  // Get current method and status
  const currentMethod = settings?.fulfillmentMethod || 'warehouse_email';

  const isMethodEnabled = (methodId: string) => {
    switch (methodId) {
      case 'warehouse_email':
        return settings?.warehouseEmailEnabled ?? true;
      case 'shipbob':
        return settings?.shipbobEnabled ?? false;
      case 'self_fulfillment':
        return settings?.selfFulfillmentEnabled ?? true;
      default:
        return false;
    }
  };

  const getMethodStatus = (methodId: string) => {
    if (currentMethod === methodId) {
      return 'Active';
    }
    if (isMethodEnabled(methodId)) {
      return 'Available';
    }
    return 'Setup Required';
  };

  // Update agent settings mutation 
  const updateAgentSettingsMutation = useMutation({
    mutationFn: async (updates: any) => {
      const response = await apiRequest('PUT', `/api/system-settings/${user?.id}`, updates);
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to update agent settings');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/system-settings/${user?.id}`] });
      toast({
        title: 'Settings Updated',
        description: 'Address change agent settings have been saved successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update settings. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Update fulfillment method mutation
  const updateFulfillmentMethodMutation = useMutation({
    mutationFn: async (method: string) => {
      const response = await apiRequest('PUT', `/api/system-settings/${user?.id}`, {
        fulfillmentMethod: method
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to update fulfillment method');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/system-settings/${user?.id}`] });
      setSelectedMethod(null);
      toast({
        title: 'Fulfillment Method Updated',
        description: 'Address change fulfillment method has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update fulfillment method.',
        variant: 'destructive',
      });
    },
  });

  // Update method configuration mutation
  const updateMethodConfigMutation = useMutation({
    mutationFn: async (config: any) => {
      const response = await apiRequest('PUT', `/api/system-settings/${user?.id}`, config);
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to update method configuration');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/system-settings/${user?.id}`] });
      setIsEditingMethod(null);
      setEditingValues({});
      toast({
        title: 'Configuration Updated',
        description: 'Method configuration has been saved successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update configuration.',
        variant: 'destructive',
      });
    },
  });

  // Handle method selection
  const handleMethodSelection = (methodId: string) => {
    if (currentMethod === methodId) {
      return; // Already active
    }
    setSelectedMethod(methodId);
  };

  // Handle method activation
  const handleMethodActivation = (methodId: string) => {
    updateFulfillmentMethodMutation.mutate(methodId);
  };

  // Handle edit method
  const handleEditMethod = (methodId: string) => {
    setIsEditingMethod(methodId);
    // Pre-populate existing values
    if (methodId === 'warehouse_email') {
      setEditingValues({ 
        warehouseEmail: settings?.warehouseEmail || ''
      });
    }
  };

  // Handle save configuration
  const handleSaveConfiguration = () => {
    if (isEditingMethod === 'warehouse_email') {
      updateMethodConfigMutation.mutate({
        warehouseEmail: editingValues.warehouseEmail
      });
    }
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setIsEditingMethod(null);
    setEditingValues({});
  };

  const WorkflowCard = ({ workflow }: { workflow: AddressChangeWorkflow }) => {
    const config = statusConfig[workflow.status as keyof typeof statusConfig] || statusConfig.processing;
    const StatusIcon = config.icon;
    const methodConfig = fulfillmentMethods.find(m => m.id === workflow.fulfillmentMethod);
    const stepConfig = getAddressChangeSteps(workflow.fulfillmentMethod, workflow);
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
          {(workflow.status === 'completed' || workflow.status === 'cannot_change') && (
            <div className="mt-6">
              {workflow.wasUpdated === true ? (
                <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                    <div>
                      <div className="font-medium text-green-900 dark:text-green-100">Address Successfully Updated</div>
                      <div className="text-sm text-green-700 dark:text-green-300">
                        {workflow.warehouseReply || 'The shipping address has been updated for this order'}
                      </div>
                      {workflow.requestedAddress && (
                        <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                          New address: {workflow.requestedAddress.address_1}, {workflow.requestedAddress.city}, {workflow.requestedAddress.state} {workflow.requestedAddress.postcode}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : workflow.wasUpdated === false || workflow.status === 'cannot_change' ? (
                <div className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                    <div>
                      <div className="font-medium text-orange-900 dark:text-orange-100">Address Change Not Possible</div>
                      <div className="text-sm text-orange-700 dark:text-orange-300">
                        {workflow.warehouseReply || workflow.eligibilityReason || 'Address could not be changed due to fulfillment timing'}
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
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (settingsLoading) {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        <Sidebar isOpen={true} onClose={() => {}} />
        <div className="flex-1 flex flex-col overflow-hidden lg:ml-64">
          <TopBar onMenuClick={() => {}} />
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-gray-900">
            <div className="max-w-7xl mx-auto p-6 space-y-6">
              <div className="flex items-center justify-center h-64">
                <Clock className="h-8 w-8 animate-spin" />
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

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
                <h1 className="text-3xl font-bold">Address Change Management</h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Automate and monitor address change workflows
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
                  Address Change Agent
                </CardTitle>
                <CardDescription>
                  Enable automatic address change handling for incoming customer emails. The agent will process address change requests based on your configured fulfillment method.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <h3 className="font-medium">Enable Agent</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Process address change requests automatically
                    </p>
                  </div>
                  <Switch
                    data-testid="switch-agent-enabled"
                    checked={settings?.addressChangeEnabled ?? false}
                    onCheckedChange={(checked) => 
                      updateAgentSettingsMutation.mutate({ addressChangeEnabled: checked })
                    }
                    disabled={updateAgentSettingsMutation.isPending}
                  />
                </div>

                {settings?.addressChangeEnabled && (
                  <div className="flex items-center justify-between p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
                    <div className="space-y-1">
                      <h3 className="font-medium">Require Approval</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Send address change requests to approval queue before processing
                      </p>
                    </div>
                    <Switch
                      data-testid="switch-require-approval"
                      checked={settings?.addressChangeRequiresApproval ?? true}
                      onCheckedChange={(checked) => 
                        updateAgentSettingsMutation.mutate({ addressChangeRequiresApproval: checked })
                      }
                      disabled={updateAgentSettingsMutation.isPending}
                    />
                  </div>
                )}

                {settings?.addressChangeEnabled && (
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Info className="h-5 w-5 text-amber-600 mt-0.5" />
                      <div className="space-y-2">
                        <h4 className="font-medium text-amber-800 dark:text-amber-200">Agent Status: Active</h4>
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                          The address change agent is monitoring incoming emails and will automatically process 
                          address change requests {settings?.addressChangeRequiresApproval ? 'after approval' : 'immediately'} 
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
                      Choose how you want to handle address change requests. Once selected, this will run in the background.
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
                  <h2 className="text-lg font-semibold">Active Workflows</h2>
                  <Button variant="outline" size="sm" onClick={() => refetchWorkflows()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
                <div className="space-y-4">
                  {activeWorkflows.map((workflow) => (
                    <WorkflowCard key={workflow.id} workflow={workflow} />
                  ))}
                </div>
              </div>
            )}

            {/* Completed Workflows */}
            {workflows.length > activeWorkflows.length && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Recent Workflows</h2>
                  <span className="text-sm text-gray-500">
                    {workflows.filter(w => !['processing', 'awaiting_warehouse'].includes(w.status)).length} completed
                  </span>
                </div>
                <div className="space-y-4">
                  {workflows
                    .filter(w => !['processing', 'awaiting_warehouse'].includes(w.status))
                    .slice(0, 5)
                    .map((workflow) => (
                      <WorkflowCard key={workflow.id} workflow={workflow} />
                    ))}
                </div>
              </div>
            )}

            {workflows.length === 0 && !workflowsLoading && (
              <Card>
                <CardContent className="text-center py-8">
                  <MapPin className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Address Change Workflows Yet</h3>
                  <p className="text-gray-500 mb-4">
                    Once enabled, your address change agent will automatically process incoming customer address change requests.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}