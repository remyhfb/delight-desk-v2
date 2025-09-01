import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Sidebar from "@/components/layout/sidebar";
import TopBar from "@/components/layout/topbar";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Mail, 
  AlertTriangle,
  User,
  Calendar,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Package,
  ArrowRight,
  Warehouse,
  CreditCard,
  FileText,
  Bot,
  Search,
  Zap,
  CheckCircle2,
  History,
  Edit3,
  Send,
  RefreshCw,
  GitBranch,
  ThumbsUp,
  ThumbsDown
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatDistanceToNow } from "date-fns";

interface ApprovalQueueItem {
  id: string;
  userId: string;
  emailId: string;
  ruleId: string;
  customerEmail: string;
  subject: string;
  body: string;
  classification: string;
  confidence: number;
  proposedResponse: string;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'edited';
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  originalResponse?: string;  // For storing original AI response when edited
  editedResponse?: string;    // For storing human-edited version
  wasEdited?: boolean;        // Flag to track if response was edited
  editedAt?: string;         // When the edit was made
  metadata?: any;
  createdAt: string;
}

interface CompletedAction {
  id: string;
  userId: string;
  action: string;
  category: string;
  customerEmail: string;
  details: string;
  executedBy: string;
  createdAt: string;
}

export default function ApprovalQueue() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [processingItems, setProcessingItems] = useState<Set<string>>(new Set());
  const [feedbackStatus, setFeedbackStatus] = useState<Record<string, { rating?: 'thumbs_up' | 'thumbs_down', submitted?: boolean }>>({});
  const [showEditForm, setShowEditForm] = useState<Record<string, boolean>>({});
  const [editedResponses, setEditedResponses] = useState<Record<string, string>>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [expandedCompletedItems, setExpandedCompletedItems] = useState<Set<string>>(new Set());
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [selectedCompletedFilter, setSelectedCompletedFilter] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isMobile = useIsMobile();

  // Get planned workflow steps - what WILL happen when approved
  const getPlannedWorkflowSteps = (classification: string, metadata: any) => {
    switch (classification) {
      case 'order_status':
        return [
          { label: 'Send Status Update', icon: Mail, description: 'Email customer with order status and tracking info' },
        ];

      case 'order_cancellation':
        return [
          { label: 'Cancel Order', icon: XCircle, description: 'Process cancellation in fulfillment system' },
          { label: 'Process Refund', icon: CreditCard, description: 'Refund payment to original method' },
          { label: 'Send Confirmation', icon: Mail, description: 'Email customer with cancellation confirmation' }
        ];

      case 'subscription_changes':
        return [
          { label: 'Pause Subscription', icon: Clock, description: 'Pause subscription in WooCommerce' },
          { label: 'Send Confirmation', icon: Mail, description: 'Email customer with pause confirmation and reactivation options' }
        ];

      case 'promo_refund':
        return [
          { label: 'Process Refund', icon: CreditCard, description: `Refund ${metadata.promoRefundData?.refundAmount || 'calculated amount'}` },
          { label: 'Send Confirmation', icon: Mail, description: 'Email customer with refund confirmation' },
          { label: 'Log Transaction', icon: FileText, description: 'Record refund in accounting system' }
        ];

      case 'product':
        return [
          { label: 'Send Answer', icon: Mail, description: metadata.productData?.hasRealData ? 'Email detailed product information from knowledge base' : 'Email acknowledgment and escalate to human' }
        ];

      default:
        return [
          { label: 'Send Response', icon: Mail, description: 'Email AI-generated response to customer' }
        ];
    }
  };

  // Show preparation status - only drafting is complete at this stage
  const getPreparationStatus = (classification: string, metadata: any) => {
    return {
      draftComplete: true, // Response has been drafted
      dataReady: metadata && Object.keys(metadata).length > 0, // Real data was found
      readyToExecute: true // Always ready since draft is complete
    };
  };

  // Format metadata into user-friendly action details
  const formatActionDetails = (metadata: any, classification: string): string => {
    if (!metadata) return 'No additional details available.';

    try {
      switch (classification) {
        case 'promo_code':
        case 'promo_refund':
          // Show real refund workflow if available
          if (metadata.promoRefundData) {
            const actions = metadata.promoRefundData.plannedActions || [];
            return [
              `Refund Type: ${metadata.promoRefundData.refundType}`,
              `Refund Amount: ${metadata.promoRefundData.refundAmount}`,
              metadata.promoRefundData.refundCap ? `Maximum Cap: $${metadata.promoRefundData.refundCap}` : '',
              '',
              '💳 Planned Actions:',
              ...actions.map((action: string, index: number) => `${index + 1}. ${action}`)
            ].filter(Boolean).join('\n');
          }
          return [
            metadata.promoCode ? `Promo Code: ${metadata.promoCode}` : '',
            metadata.discountAmount ? `Discount: ${metadata.discountAmount}` : '',
            metadata.urgency ? `Priority: ${metadata.urgency === 'low' ? 'Standard' : metadata.urgency.charAt(0).toUpperCase() + metadata.urgency.slice(1)}` : '',
            metadata.requestType ? `Request Type: ${metadata.requestType.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}` : '',
            metadata.eligibilityReason ? `Eligibility: ${metadata.eligibilityReason}` : '',
            metadata.expirationDays ? `Valid for: ${metadata.expirationDays} days` : ''
          ].filter(Boolean).join('\n');

        case 'order_cancellation':
          // Show real cancellation workflow if available
          if (metadata.cancellationData) {
            const actions = metadata.cancellationData.plannedActions || [];
            return [
              `Order: #${metadata.cancellationData.orderNumber}`,
              `Order Total: $${metadata.cancellationData.orderTotal}`,
              `Order Status: ${metadata.cancellationData.orderStatus}`,
              `Refund Amount: $${metadata.cancellationData.refundAmount}`,
              '',
              '🔄 Planned Actions:',
              ...actions.map((action: string, index: number) => `${index + 1}. ${action}`)
            ].filter(Boolean).join('\n');
          }
          return [
            metadata.orderId ? `Order: #${metadata.orderId}` : '',
            metadata.reason ? `Reason: ${metadata.reason}` : '',
            metadata.refundAmount ? `Refund Amount: $${metadata.refundAmount}` : '',
            metadata.cancellationType ? `Type: ${metadata.cancellationType.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}` : ''
          ].filter(Boolean).join('\n');

        case 'subscription_management':
          return [
            metadata.subscriptionId ? `Subscription: ${metadata.subscriptionId}` : '',
            metadata.action ? `Action: ${metadata.action.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}` : '',
            metadata.newPlan ? `New Plan: ${metadata.newPlan}` : '',
            metadata.effectiveDate ? `Effective: ${metadata.effectiveDate}` : ''
          ].filter(Boolean).join('\n');

        case 'wismo':
        case 'order_status':
          // Show real order data if available
          if (metadata.orderData) {
            return [
              `Order Status: ${metadata.orderData.status}`,
              `Tracking: ${metadata.orderData.trackingNumber}`,
              `Estimated Delivery: ${metadata.orderData.estimatedDelivery}`,
              metadata.orderData.trackingUrl !== '#' ? `Tracking URL Available: Yes` : ''
            ].filter(Boolean).join('\n');
          }
          return [
            metadata.orderId ? `Order: #${metadata.orderId}` : '',
            metadata.trackingNumber ? `Tracking: ${metadata.trackingNumber}` : '',
            metadata.carrier ? `Carrier: ${metadata.carrier}` : '',
            metadata.status ? `Status: ${metadata.status.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}` : '',
            metadata.estimatedDelivery ? `Estimated Delivery: ${metadata.estimatedDelivery}` : ''
          ].filter(Boolean).join('\n');

        case 'returns':
          return [
            metadata.orderId ? `Order: #${metadata.orderId}` : '',
            metadata.returnReason ? `Reason: ${metadata.returnReason}` : '',
            metadata.refundAmount ? `Refund: $${metadata.refundAmount}` : '',
            metadata.returnMethod ? `Method: ${metadata.returnMethod.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}` : ''
          ].filter(Boolean).join('\n');

        case 'product':
          // Show real product knowledge if available
          if (metadata.productData) {
            const actions = metadata.productData.plannedActions || [];
            if (metadata.productData.hasRealData) {
              return [
                '✅ Real Product Knowledge Available',
                `Relevant Info: ${metadata.productData.relevantInfo?.length || 0} knowledge base entries`,
                '',
                '🧠 Planned Actions:',
                ...actions.map((action: string, index: number) => `${index + 1}. ${action}`)
              ].filter(Boolean).join('\n');
            } else {
              return [
                '⚠️ Limited Product Knowledge',
                metadata.productData.message || 'No specific product information available',
                '',
                '🔄 Planned Actions:',
                ...actions.map((action: string, index: number) => `${index + 1}. ${action}`)
              ].filter(Boolean).join('\n');
            }
          }
          return 'Product inquiry - will use available training data';

        case 'address_change':
          // Show real address change workflow if available
          if (metadata.addressChangeData) {
            const actions = metadata.addressChangeData.plannedActions || [];
            return [
              `Order: #${metadata.addressChangeData.orderNumber}`,
              `Order Status: ${metadata.addressChangeData.orderStatus}`,
              `Current Address: ${metadata.addressChangeData.currentAddress}`,
              `Warehouse Notification: ${metadata.addressChangeData.warehouseNotificationEnabled ? 'Enabled' : 'Disabled'}`,
              `Fulfillment Method: ${metadata.addressChangeData.fulfillmentMethod}`,
              '',
              '📦 Planned Actions:',
              ...actions.map((action: string, index: number) => `${index + 1}. ${action}`)
            ].filter(Boolean).join('\n');
          }
          return 'Address change request - will update shipping information';

        default:
          // For any other classification, format key-value pairs nicely
          return Object.entries(metadata)
            .map(([key, value]) => {
              const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
              return `${formattedKey}: ${value}`;
            })
            .join('\n');
      }
    } catch (error) {
      return 'Action details unavailable.';
    }
  };

  const { data: queueItems, isLoading, refetch: refetchQueue } = useQuery({
    queryKey: [`/api/approval-queue/${user?.id}`],
    enabled: !!user?.id,
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/approval-queue/${user?.id}`);
      const data = await response.json() as ApprovalQueueItem[];
      return data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: completedActions = [], refetch: refetchCompleted } = useQuery({
    queryKey: [`/api/approval-queue/${user?.id}/completed`],
    enabled: !!user?.id,
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/approval-queue/${user?.id}/completed`);
      const data = await response.json() as CompletedAction[];
      return data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const toggleItemExpansion = (itemId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const toggleCompletedItemExpansion = (actionId: string) => {
    setExpandedCompletedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(actionId)) {
        newSet.delete(actionId);
      } else {
        newSet.add(actionId);
      }
      return newSet;
    });
  };

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('POST', `/api/approval-queue/${id}/approve`, {});
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to approve item');
      }
      return response.json();
    },
    onMutate: (id) => {
      setProcessingItems(prev => new Set(prev).add(id));
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [`/api/approval-queue/${user?.id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/approval-queue/${user?.id}/completed`] });
      toast({
        title: "Approved",
        description: "The automation has been approved and executed successfully.",
      });
    },
    onError: (error: Error, id) => {
      toast({
        title: "Approval Failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: (_, __, id) => {
      setProcessingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('POST', `/api/approval-queue/${id}/reject`, { rejectionReason: 'User rejected' });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to reject item');
      }
      return response.json();
    },
    onMutate: (id) => {
      setProcessingItems(prev => new Set(prev).add(id));
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [`/api/approval-queue/${user?.id}`] });
      toast({
        title: "Rejected",
        description: "The automation has been rejected and will not be executed.",
      });
    },
    onError: (error: Error, id) => {
      toast({
        title: "Rejection Failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: (_, __, id) => {
      setProcessingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    },
  });

  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchQueue(),
        refetchCompleted()
      ]);
      toast({
        title: "Refreshed",
        description: "Data has been refreshed successfully.",
      });
    } catch (error) {
      console.error('Refresh error:', error);
      toast({
        title: "Error",
        description: "Failed to refresh data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Feedback mutation for thumbs up/down
  const feedbackMutation = useMutation({
    mutationFn: async ({ approvalItemId, rating, agentType }: { approvalItemId: string; rating: 'thumbs_up' | 'thumbs_down'; agentType: string }) => {
      const response = await apiRequest('POST', '/api/agent-feedback', {
        approvalItemId,
        rating,
        agentType,
        userId: user?.id
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to submit feedback');
      }
      return response.json();
    },
    onSuccess: (_, { approvalItemId, rating }) => {
      setFeedbackStatus(prev => ({
        ...prev,
        [approvalItemId]: { rating, submitted: true }
      }));
      toast({
        title: "Feedback Submitted",
        description: `Thank you for your ${rating === 'thumbs_up' ? 'positive' : 'negative'} feedback!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Feedback Failed", 
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleFeedback = (approvalItemId: string, rating: 'thumbs_up' | 'thumbs_down', agentType: string) => {
    feedbackMutation.mutate({ approvalItemId, rating, agentType });
  };

  const editMutation = useMutation({
    mutationFn: async ({ id, editedResponse }: { id: string; editedResponse: string }) => {
      const response = await apiRequest('POST', `/api/approval-queue/${id}/edit`, { editedResponse });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to edit and send response');
      }
      return response.json();
    },
    onMutate: ({ id }) => {
      setProcessingItems(prev => new Set(prev).add(id));
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [`/api/approval-queue/${user?.id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/approval-queue/${user?.id}/completed`] });
      setShowEditForm(prev => ({ ...prev, [id]: false }));
      setEditedResponses(prev => ({ ...prev, [id]: '' }));
      toast({
        title: "Response Edited & Sent",
        description: "Your edited response has been sent to the customer successfully.",
      });
    },
    onError: (error: Error, { id }) => {
      toast({
        title: "Edit Failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: (_, __, { id }) => {
      setProcessingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    },
  });

  const handleApprove = (id: string) => {
    approveMutation.mutate(id);
  };

  const handleReject = (id: string) => {
    rejectMutation.mutate(id);
  };

  const handleEdit = (id: string) => {
    const editedResponse = editedResponses[id];
    if (!editedResponse?.trim()) {
      toast({
        title: "Edited Response Required",
        description: "Please provide an edited response before sending.",
        variant: "destructive",
      });
      return;
    }
    editMutation.mutate({ id, editedResponse });
  };

  const handleStartEdit = (id: string, originalResponse: string) => {
    setEditedResponses(prev => ({ ...prev, [id]: originalResponse }));
    setShowEditForm(prev => ({ ...prev, [id]: true }));
  };

  const getClassificationBadgeColor = (classification: string) => {
    switch (classification) {
      case 'order_status': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'promo_refund': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'promo_code': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200';
      case 'order_cancellation': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'return_request': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'shipping_info': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'subscription_management': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };


  const pendingItems = queueItems?.filter(item => item.status === 'pending') || [];

  
  // Filter items based on selected filter
  const filteredItems = selectedFilter === 'all' 
    ? pendingItems 
    : pendingItems.filter(item => item.classification === selectedFilter);

  // Filter completed actions based on selected filter
  const filteredCompletedActions = selectedCompletedFilter === 'all' 
    ? completedActions 
    : completedActions.filter(action => action.category === selectedCompletedFilter);

  // Get unique classifications for filter buttons
  const availableClassifications = Array.from(new Set(pendingItems.map(item => item.classification).filter(Boolean)));
  const availableCompletedClassifications = Array.from(new Set(completedActions.map(action => action.category).filter(Boolean)));

  const getClassificationDisplayName = (classification: string) => {
    switch (classification) {
      case 'order_cancellation': return 'Order Cancellations';
      case 'order_status': return 'Order Status';
      case 'promo_refund': return 'Promo Refunds';
      case 'promo_code': return 'Promo Codes';
      case 'subscription_management': return 'Subscriptions';
      case 'return_request': return 'Returns';
      case 'shipping_info': return 'Shipping';
      default: return classification ? classification.replace('_', ' ') : 'Unknown';
    }
  };

  const getClassificationCount = (classification: string) => {
    return pendingItems.filter(item => item.classification === classification).length;
  };

  const getCompletedClassificationCount = (classification: string) => {
    return completedActions.filter(action => action.category === classification).length;
  };

  if (isLoading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <TopBar onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-y-auto">
            <div className="container mx-auto p-6 max-w-6xl">
              <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Approval Queue</h1>
                <p className="text-muted-foreground">Loading pending automation approvals...</p>
              </div>
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="lg:pl-64 flex flex-col flex-1">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-8">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
              {/* Header */}
              <div className="mb-6 md:mb-8">
                <div className="mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Approval Queue</h1>
                      <p className="text-gray-600">
                        Review and approve AI Agent actions, such as sending responses, processing refunds, or changing subscriptions
                      </p>
                    </div>
                    <Button
                      onClick={refreshData}
                      disabled={isRefreshing}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                      data-testid="refresh-button"
                    >
                      <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </div>
                </div>
              </div>

              <Tabs defaultValue="pending" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="pending" className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Pending Actions
                    <Badge variant="secondary" className="ml-1">
                      {pendingItems.length}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="completed" className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Completed Actions
                    <Badge variant="secondary" className="ml-1">
                      {completedActions.length}
                    </Badge>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="mt-6">
                  {filteredItems.length === 0 && pendingItems.length === 0 ? (
                    <Card>
                      <CardContent className="py-12">
                        <div className="text-center">
                          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                          <h3 className="text-xl font-semibold mb-2">All Caught Up!</h3>
                          <p className="text-muted-foreground">
                            There are no pending automated actions requiring approval at this time.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      <Alert className="mb-6 relative">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>{pendingItems.length} AI Agent action{pendingItems.length !== 1 ? 's' : ''}</strong> waiting for approval. 
                      Review each action carefully before approving or rejecting.
                    </AlertDescription>
                  </Alert>

                  {/* Filter Buttons */}
                  <div className="mb-6">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={selectedFilter === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedFilter('all')}
                        className="flex items-center gap-2"
                      >
                        All Items
                        <Badge variant="secondary" className="ml-1 px-2 py-0 text-xs">
                          {pendingItems.length}
                        </Badge>
                      </Button>
                      
                      {availableClassifications.map(classification => (
                        <Button
                          key={classification}
                          variant={selectedFilter === classification ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedFilter(classification)}
                          className="flex items-center gap-2"
                        >
                          {getClassificationDisplayName(classification)}
                          <Badge variant="secondary" className="ml-1 px-2 py-0 text-xs">
                            {getClassificationCount(classification)}
                          </Badge>
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* No filtered results */}
                  {filteredItems.length === 0 && selectedFilter !== 'all' ? (
                    <Card>
                      <CardContent className="py-12">
                        <div className="text-center">
                          <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                          <h3 className="text-xl font-semibold mb-2">No {getClassificationDisplayName(selectedFilter)} Items</h3>
                          <p className="text-muted-foreground mb-4">
                            There are no pending {getClassificationDisplayName(selectedFilter).toLowerCase()} items at this time.
                          </p>
                          <Button 
                            variant="outline" 
                            onClick={() => setSelectedFilter('all')}
                          >
                            View All Items
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {filteredItems.map((item) => {
                      const isProcessing = processingItems.has(item.id);
                      const isExpanded = expandedItems.has(item.id);
                      
                      return (
                        <Card key={item.id} className="border-l-4 border-l-orange-500">
                          {/* Collapsible Header */}
                          <CardHeader className="pb-3">
                            <div 
                              className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 -m-2 rounded-md transition-colors"
                              onClick={() => toggleItemExpansion(item.id)}
                            >
                              <div className="space-y-2 min-w-0 flex-1">
                                <CardTitle className="flex items-center gap-2 text-lg">
                                  <Mail className="h-5 w-5 flex-shrink-0" />
                                  <span className="truncate">{item.subject}</span>
                                  {isExpanded ? (
                                    <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                  )}
                                </CardTitle>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <User className="h-4 w-4 flex-shrink-0" />
                                    <span className="truncate">{item.customerEmail}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-4 w-4 flex-shrink-0" />
                                    <span>{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <Badge className={getClassificationBadgeColor(item.classification)}>
                                  {item.classification.replace('_', ' ')}
                                </Badge>
                                <Badge variant="outline">
                                  <Clock className="w-3 h-3 mr-1" />
                                  Pending
                                </Badge>
                              </div>
                            </div>
                          </CardHeader>
                          
                          {/* Expandable Content */}
                          {isExpanded && (
                            <CardContent className="pt-0 space-y-6">
                              {/* Original Customer Email */}
                              <div>
                                <Label className="text-sm font-medium text-muted-foreground">
                                  Original Customer Email
                                </Label>
                                <div className="mt-2 p-4 bg-muted rounded-lg">
                                  <p className="text-sm whitespace-pre-wrap">{item.body}</p>
                                </div>
                              </div>

                              {/* Proposed Response */}
                              <div>
                                <Label className="text-sm font-medium text-muted-foreground">
                                  Proposed AI Response
                                </Label>
                                <div className="mt-2 p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
                                  <p className="text-sm whitespace-pre-wrap">{item.proposedResponse}</p>
                                </div>
                              </div>

                              {/* What Will Happen When Approved */}
                              <div>
                                <Label className="text-sm font-medium text-muted-foreground">
                                  Planned Actions (Will Execute When Approved)
                                </Label>
                                <div className="mt-3 p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20 space-y-3">
                                  {(() => {
                                    const plannedSteps = getPlannedWorkflowSteps(item.classification, item.metadata);
                                    const status = getPreparationStatus(item.classification, item.metadata);
                                    
                                    return (
                                      <>
                                        {/* Preparation Status */}
                                        <div className="space-y-2">
                                          <div className="flex items-center justify-between">
                                            <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                                              ✅ Response Drafted - Ready to Execute
                                            </span>
                                            <span className="text-xs text-blue-600 dark:text-blue-400">
                                              {status.dataReady ? 'Real Data Found' : 'Draft Complete'}
                                            </span>
                                          </div>
                                        </div>
                                        
                                        {/* Planned Action Steps */}
                                        <div className="space-y-2">
                                          <h4 className="text-xs font-medium text-blue-700 dark:text-blue-300">
                                            Actions to Execute:
                                          </h4>
                                          {plannedSteps.map((step, index) => {
                                            const Icon = step.icon;
                                            return (
                                              <div key={index} className="flex items-start space-x-2 text-xs text-blue-600 dark:text-blue-400">
                                                <Icon className="h-3 w-3 flex-shrink-0 mt-0.5" />
                                                <div>
                                                  <span className="font-medium">{step.label}</span>
                                                  <p className="text-blue-500 dark:text-blue-500 mt-1">{step.description}</p>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>

                              {/* Action Details */}
                              {item.metadata && (
                                <div>
                                  <Label className="text-sm font-medium text-muted-foreground">
                                    Action Details
                                  </Label>
                                  <div className="mt-2 p-4 border rounded-lg bg-gray-50 dark:bg-gray-900">
                                    <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
                                      {formatActionDetails(item.metadata, item.classification)}
                                    </div>
                                  </div>
                                </div>
                              )}

                              <Separator />

                              {/* Action Buttons */}
                              {!showEditForm[item.id] ? (
                                <div className="flex flex-col sm:flex-row gap-3">
                                  <Button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleApprove(item.id);
                                    }}
                                    disabled={isProcessing}
                                    size="lg"
                                    className="bg-green-600 hover:bg-green-700 text-white flex-1"
                                    data-testid={`button-approve-${item.id}`}
                                  >
                                    <CheckCircle className="w-5 h-5 mr-2" />
                                    {isProcessing ? 'Processing...' : 'Approve & Execute'}
                                  </Button>

                                  <Button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStartEdit(item.id, item.proposedResponse);
                                    }}
                                    disabled={isProcessing}
                                    size="lg"
                                    variant="outline"
                                    className="border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/20 flex-1"
                                    data-testid={`button-edit-${item.id}`}
                                  >
                                    <Edit3 className="w-5 h-5 mr-2" />
                                    Edit Response
                                  </Button>
                                  
                                  <Button
                                    variant="outline"
                                    size="lg"
                                    disabled={isProcessing}
                                    className="text-red-600 border-red-300 hover:bg-red-50 flex-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleReject(item.id);
                                    }}
                                  >
                                    <XCircle className="w-5 h-5 mr-2" />
                                    Reject
                                  </Button>
                                </div>
                              ) : showEditForm[item.id] ? (
                                <div className="space-y-4">
                                  <div>
                                    <Label htmlFor={`edited-response-${item.id}`} className="text-sm font-medium">
                                      Edit the response below, then send to customer:
                                    </Label>
                                    <div className="mt-2">
                                      <Textarea
                                        id={`edited-response-${item.id}`}
                                        placeholder="Edit the AI-generated response..."
                                        value={editedResponses[item.id] || ''}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          setEditedResponses(prev => ({
                                            ...prev,
                                            [item.id]: e.target.value
                                          }));
                                        }}
                                        className="min-h-[120px]"
                                        onClick={(e) => e.stopPropagation()}
                                        data-testid={`textarea-edit-${item.id}`}
                                      />
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Make your changes above. The edited response will be sent directly to the customer.
                                    </p>
                                  </div>

                                  <div className="flex gap-3">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setShowEditForm(prev => ({ ...prev, [item.id]: false }));
                                        setEditedResponses(prev => ({ ...prev, [item.id]: '' }));
                                      }}
                                      className="text-gray-600"
                                      data-testid={`button-cancel-edit-${item.id}`}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEdit(item.id);
                                      }}
                                      disabled={isProcessing || !editedResponses[item.id]?.trim()}
                                      className="bg-blue-600 hover:bg-blue-700 text-white"
                                      data-testid={`button-send-edit-${item.id}`}
                                    >
                                      <Send className="w-4 h-4 mr-2" />
                                      {isProcessing ? 'Sending...' : 'Send & Execute'}
                                    </Button>
                                  </div>
                                </div>
                              ) : null}
                            </CardContent>
                          )}
                        </Card>
                        );
                      })}
                      </div>
                    )}
                  </>
                  )}
                </TabsContent>


                <TabsContent value="completed" className="mt-6">
                  {completedActions.length === 0 ? (
                    <Card>
                      <CardContent className="py-12">
                        <div className="text-center">
                          <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                          <h3 className="text-xl font-semibold mb-2">No Completed Actions</h3>
                          <p className="text-muted-foreground">
                            Approved agent actions will appear here with details about what was executed.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      {/* Filter Buttons for Completed Actions */}
                      {availableCompletedClassifications.length > 0 && (
                        <div className="mb-6">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant={selectedCompletedFilter === 'all' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setSelectedCompletedFilter('all')}
                              className="flex items-center gap-2"
                              data-testid="filter-completed-all"
                            >
                              All Completed
                              <Badge variant="secondary" className="ml-1 px-2 py-0 text-xs">
                                {completedActions.length}
                              </Badge>
                            </Button>
                            
                            {availableCompletedClassifications.map(classification => (
                              <Button
                                key={classification}
                                variant={selectedCompletedFilter === classification ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setSelectedCompletedFilter(classification)}
                                className="flex items-center gap-2"
                                data-testid={`filter-completed-${classification}`}
                              >
                                {getClassificationDisplayName(classification)}
                                <Badge variant="secondary" className="ml-1 px-2 py-0 text-xs">
                                  {getCompletedClassificationCount(classification)}
                                </Badge>
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* No filtered results */}
                      {filteredCompletedActions.length === 0 && selectedCompletedFilter !== 'all' ? (
                        <Card>
                          <CardContent className="py-12">
                            <div className="text-center">
                              <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                              <h3 className="text-xl font-semibold mb-2">No {getClassificationDisplayName(selectedCompletedFilter)} Actions</h3>
                              <p className="text-muted-foreground mb-4">
                                There are no completed {getClassificationDisplayName(selectedCompletedFilter).toLowerCase()} actions at this time.
                              </p>
                              <Button 
                                variant="outline" 
                                onClick={() => setSelectedCompletedFilter('all')}
                                data-testid="button-view-all-completed"
                              >
                                View All Completed Actions
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="space-y-4">
                          {filteredCompletedActions.map((action) => {
                        const isExpanded = expandedCompletedItems.has(action.id);
                        
                        return (
                          <Card key={action.id} className="border-l-4 border-l-green-500">
                            {/* Collapsible Header */}
                            <CardHeader className="pb-3">
                              <div 
                                className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 -m-2 rounded-md transition-colors"
                                onClick={() => toggleCompletedItemExpansion(action.id)}
                                data-testid={`completed-action-${action.id}`}
                              >
                                <div className="space-y-2 min-w-0 flex-1">
                                  <CardTitle className="flex items-center gap-2 text-lg">
                                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                                    <span className="truncate">{action.action.replace(/_/g, ' ')}</span>
                                    {isExpanded ? (
                                      <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                    )}
                                  </CardTitle>
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-1">
                                      <User className="h-4 w-4 flex-shrink-0" />
                                      <span className="truncate">{action.customerEmail}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Calendar className="h-4 w-4 flex-shrink-0" />
                                      <span>{formatDistanceToNow(new Date(action.createdAt), { addSuffix: true })}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Bot className="h-4 w-4 flex-shrink-0 text-green-600" />
                                      <span>Executed by {action.executedBy}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <Badge variant="secondary" className="text-xs">
                                    {action.category}
                                  </Badge>
                                  <Badge variant="outline" className="text-green-600 border-green-200">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Completed
                                  </Badge>
                                </div>
                              </div>
                            </CardHeader>

                            {/* Expandable Content - Complete Details */}
                            {isExpanded && (
                              <CardContent className="pt-0 space-y-6">
                                {/* Action Summary */}
                                <div>
                                  <Label className="text-sm font-medium text-muted-foreground">
                                    Action Summary
                                  </Label>
                                  <div className="mt-2 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                                    <div className="flex items-start gap-3">
                                      <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                                      <div>
                                        <p className="font-medium text-green-900 dark:text-green-100">
                                          {action.action.replace(/_/g, ' ')}
                                        </p>
                                        <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                                          This action was successfully executed for {action.customerEmail}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Original Email */}
                                {(action as any).originalEmail && (
                                  <div>
                                    <Label className="text-sm font-medium text-muted-foreground">
                                      Original Email
                                    </Label>
                                    <div className="mt-2 space-y-3">
                                      <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                        <div className="space-y-3">
                                          <div className="flex items-center gap-2 text-sm">
                                            <Mail className="h-4 w-4 text-blue-600" />
                                            <span className="font-medium">From:</span>
                                            <span>{(action as any).originalEmail.fromEmail}</span>
                                          </div>
                                          <div className="flex items-center gap-2 text-sm">
                                            <Calendar className="h-4 w-4 text-blue-600" />
                                            <span className="font-medium">Received:</span>
                                            <span>{new Date((action as any).originalEmail.receivedAt).toLocaleString()}</span>
                                          </div>
                                          <div>
                                            <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">Subject:</p>
                                            <p className="text-sm bg-white dark:bg-gray-800 p-3 rounded border">{(action as any).originalEmail.subject}</p>
                                          </div>
                                          <div>
                                            <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">Message:</p>
                                            <div className="text-sm bg-white dark:bg-gray-800 p-3 rounded border max-h-32 overflow-y-auto">
                                              <p className="whitespace-pre-wrap">{(action as any).originalEmail.body}</p>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Email Classification */}
                                <div>
                                  <Label className="text-sm font-medium text-muted-foreground">
                                    Email Classification
                                  </Label>
                                  <div className="mt-2 p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                                    <div className="flex items-center gap-3">
                                      <Search className="h-5 w-5 text-purple-600" />
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-medium">Classification:</span>
                                          <Badge className={getClassificationBadgeColor((action as any).classification)}>
                                            {(action as any).classification?.replace('_', ' ') || 'unknown'}
                                          </Badge>
                                          <span className="text-xs text-gray-600">
                                            ({Math.round(((action as any).confidence || 0) * 100)}% confidence)
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* AI Response Sent */}
                                {(action as any).actualResponse && (
                                  <div>
                                    <Label className="text-sm font-medium text-muted-foreground">
                                      AI Response Sent to Customer
                                    </Label>
                                    <div className="mt-2 p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                                      <div className="flex items-start gap-3">
                                        <Send className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                                        <div className="flex-1">
                                          <div className="text-sm bg-white dark:bg-gray-800 p-3 rounded border max-h-40 overflow-y-auto">
                                            <p className="whitespace-pre-wrap">{(action as any).actualResponse}</p>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Agent Workflow Process */}
                                {(action as any).metadata?.workflowSteps && (
                                  <div>
                                    <Label className="text-sm font-medium text-muted-foreground">
                                      Agent Workflow Process
                                    </Label>
                                    <div className="mt-2 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                      <div className="flex items-start gap-3">
                                        <GitBranch className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                                        <div className="flex-1 space-y-3">
                                          <div className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-3">
                                            Step-by-Step Process Execution:
                                          </div>
                                          {(action as any).metadata.workflowSteps.map((step: string, index: number) => (
                                            <div key={index} className="flex items-start gap-3 text-sm">
                                              <div className="flex items-center justify-center w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium flex-shrink-0 mt-0.5">
                                                {index + 1}
                                              </div>
                                              <span className="text-blue-900 dark:text-blue-100 leading-relaxed">{step.replace(/^\d+\.\s*/, '')}</span>
                                            </div>
                                          ))}
                                          {(action as any).metadata?.apiCallsMade && (action as any).metadata.apiCallsMade.length > 0 && (
                                            <div className="mt-4 pt-3 border-t border-blue-200 dark:border-blue-700">
                                              <div className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-2">API Integrations Used:</div>
                                              <div className="flex gap-2">
                                                {(action as any).metadata.apiCallsMade.map((api: string, idx: number) => (
                                                  <span key={idx} className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">
                                                    {api === 'woocommerce' ? 'WooCommerce' : api === 'aftership' ? 'AfterShip' : api}
                                                  </span>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Actions Taken */}
                                {(action as any).actionsTaken && (
                                  <div>
                                    <Label className="text-sm font-medium text-muted-foreground">
                                      Actions Taken
                                    </Label>
                                    <div className="mt-2 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                                      <div className="flex items-start gap-3">
                                        <Zap className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                                        <div className="flex-1 space-y-2">
                                          {(action as any).actionsTaken.map((actionItem: string, index: number) => (
                                            <div key={index} className="flex items-start gap-2 text-sm">
                                              <span className="font-medium text-amber-700 dark:text-amber-300 min-w-[20px]">{index + 1}.</span>
                                              <span className="text-amber-900 dark:text-amber-100">{actionItem}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Execution Details */}
                                {action.details && (
                                  <div>
                                    <Label className="text-sm font-medium text-muted-foreground">
                                      Execution Details
                                    </Label>
                                    <div className="mt-2 p-4 bg-muted rounded-lg">
                                      <p className="text-sm whitespace-pre-wrap">{action.details}</p>
                                    </div>
                                  </div>
                                )}

                                {/* Audit Trail */}
                                <div>
                                  <Label className="text-sm font-medium text-muted-foreground">
                                    Audit Trail
                                  </Label>
                                  <div className="mt-2 space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-900">
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-sm">
                                          <Calendar className="h-4 w-4 text-gray-500" />
                                          <span className="font-medium">Executed:</span>
                                          <span>{new Date(action.createdAt).toLocaleString()}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                          <Bot className="h-4 w-4 text-gray-500" />
                                          <span className="font-medium">Executed by:</span>
                                          <span>{action.executedBy}</span>
                                        </div>
                                      </div>
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-sm">
                                          <User className="h-4 w-4 text-gray-500" />
                                          <span className="font-medium">Customer:</span>
                                          <span>{action.customerEmail}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                          <FileText className="h-4 w-4 text-gray-500" />
                                          <span className="font-medium">Category:</span>
                                          <span>{action.category}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Success Indicator */}
                                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                                  <CheckCircle className="h-5 w-5 text-green-600" />
                                  <span className="text-sm font-medium text-green-900 dark:text-green-100">
                                    Action completed successfully
                                  </span>
                                </div>

                                {/* Feedback Section */}
                                <Separator />
                                <div>
                                  <Label className="text-sm font-medium text-muted-foreground">
                                    Performance Feedback
                                  </Label>
                                  <div className="mt-3 flex items-center justify-between">
                                    <p className="text-sm text-muted-foreground">
                                      How well did the AI agent handle this action?
                                    </p>
                                    <div className="flex items-center gap-2">
                                      {feedbackStatus[action.id]?.submitted ? (
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                          {feedbackStatus[action.id]?.rating === 'thumbs_up' ? (
                                            <ThumbsUp className="h-4 w-4 text-green-600" />
                                          ) : (
                                            <ThumbsDown className="h-4 w-4 text-red-600" />
                                          )}
                                          <span>Feedback submitted</span>
                                        </div>
                                      ) : (
                                        <>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleFeedback(action.id, 'thumbs_up', action.category);
                                            }}
                                            disabled={feedbackMutation.isPending}
                                            className="text-green-600 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-950/20"
                                            data-testid={`button-thumbs-up-${action.id}`}
                                          >
                                            <ThumbsUp className="h-4 w-4 mr-1" />
                                            Good
                                          </Button>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleFeedback(action.id, 'thumbs_down', action.category);
                                            }}
                                            disabled={feedbackMutation.isPending}
                                            className="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/20"
                                            data-testid={`button-thumbs-down-${action.id}`}
                                          >
                                            <ThumbsDown className="h-4 w-4 mr-1" />
                                            Needs Work
                                          </Button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            )}
                          </Card>
                        );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}