import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  Target,
  MessageSquare,
  Power,
  PowerOff,
  ChevronDown,
  ChevronUp
} from "lucide-react";
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
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  metadata?: any;
  createdAt: string;
}

export default function ApprovalQueue() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [processingItems, setProcessingItems] = useState<Set<string>>(new Set());
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [customReasonModes, setCustomReasonModes] = useState<Record<string, boolean>>({});
  const [showRejectionForm, setShowRejectionForm] = useState<Record<string, boolean>>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [approvalQueueEnabled, setApprovalQueueEnabled] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Common rejection reasons for transactional email automation
  const presetReasons = [
    { id: 'wrong_classification', label: 'Wrong Email Type', description: 'This should be handled by a person instead' },
    { id: 'incorrect_template', label: 'Wrong Message Template', description: 'The response doesn\'t fit this customer\'s request' },
    { id: 'missing_data', label: 'Missing Information', description: 'Can\'t find the order or customer details needed' },
    { id: 'policy_violation', label: 'Against Company Policy', description: 'This action isn\'t allowed by our business rules' },
    { id: 'timing_issue', label: 'Bad Timing', description: 'Too soon or too late to send this response' },
    { id: 'system_error', label: 'Technical Problem', description: 'Something went wrong with the automation' },
  ];
  const isMobile = useIsMobile();

  const { data: queueItems, isLoading } = useQuery({
    queryKey: [`/api/approval-queue/${user?.id}`],
    enabled: !!user?.id,
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/approval-queue/${user?.id}`);
      const data = await response.json() as ApprovalQueueItem[];
      return data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const approveMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const response = await apiRequest('POST', `/api/approval-queue/${itemId}/approve`);
      return response.json();
    },
    onSuccess: (data, itemId) => {
      setProcessingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
      queryClient.invalidateQueries({ queryKey: [`/api/approval-queue/${user?.id}`] });
      
      // Check workflow type for specific success messages
      const approvedItem = queueItems?.find(item => item.id === itemId);
      const classification = approvedItem?.classification;
      
      let successMessage = "The AI Agent action has been executed successfully.";
      if (classification === 'order_cancellation') {
        successMessage = "Order cancellation workflow initiated. Monitor progress on the Order Cancellation Agent page.";
      } else if (classification === 'promo_code') {
        successMessage = "Promo code request processed. Customer will receive their discount code.";
      }
      
      toast({
        title: "AI Agent Action Approved",
        description: successMessage,
      });
    },
    onError: (error, itemId) => {
      setProcessingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
      toast({
        title: "Approval Failed",
        description: "Failed to approve the AI Agent action. Please try again.",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ itemId, reason }: { itemId: string; reason: string }) => {
      const response = await apiRequest('POST', `/api/approval-queue/${itemId}/reject`, {
        rejectionReason: reason,
      });
      return response.json();
    },
    onSuccess: (data, { itemId }) => {
      setProcessingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
      setRejectionReasons(prev => {
        const newReasons = { ...prev };
        delete newReasons[itemId];
        return newReasons;
      });
      queryClient.invalidateQueries({ queryKey: [`/api/approval-queue/${user?.id}`] });
      toast({
        title: "AI Agent Action Rejected",
        description: "The AI Agent action has been rejected and will not be executed.",
      });
    },
    onError: (error, { itemId }) => {
      setProcessingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
      toast({
        title: "Rejection Failed", 
        description: "Failed to reject the AI Agent action. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleApprove = (itemId: string) => {
    setProcessingItems(prev => new Set(prev).add(itemId));
    approveMutation.mutate(itemId);
  };

  const handleReject = (itemId: string) => {
    const reason = rejectionReasons[itemId];
    if (!reason || reason.trim() === '') {
      toast({
        title: "Rejection Reason Required",
        description: "Please provide a reason for rejecting this AI Agent action.",
        variant: "destructive",
      });
      return;
    }
    setProcessingItems(prev => new Set(prev).add(itemId));
    rejectMutation.mutate({ itemId, reason });
  };

  const handleRejectionReasonChange = (itemId: string, reason: string) => {
    setRejectionReasons(prev => ({
      ...prev,
      [itemId]: reason,
    }));
  };

  const handlePresetReasonSelect = (itemId: string, reason: string, description: string) => {
    const fullReason = `${reason}: ${description}`;
    setRejectionReasons(prev => ({
      ...prev,
      [itemId]: fullReason
    }));
    // Exit custom mode when preset is selected
    setCustomReasonModes(prev => ({
      ...prev,
      [itemId]: false
    }));
  };

  const toggleCustomReasonMode = (itemId: string) => {
    setCustomReasonModes(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
    // Clear reason when switching modes
    setRejectionReasons(prev => ({
      ...prev,
      [itemId]: ''
    }));
  };

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

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600 dark:text-green-400';
    if (confidence >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const pendingItems = queueItems?.filter(item => item.status === 'pending') || [];

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
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Approval Queue</h1>
                    <p className="text-gray-600">
                      Review and approve AI Agent actions, such as sending responses, processing refunds, or changing subscriptions
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      {approvalQueueEnabled ? (
                        <Power className="h-5 w-5 text-green-600" />
                      ) : (
                        <PowerOff className="h-5 w-5 text-gray-400" />
                      )}
                      <span className="text-sm font-medium">
                        {approvalQueueEnabled ? 'Active' : 'Disabled'}
                      </span>
                      <Switch
                        checked={approvalQueueEnabled}
                        onCheckedChange={setApprovalQueueEnabled}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {!approvalQueueEnabled ? (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center">
                      <PowerOff className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold mb-2">Approval Queue Disabled</h3>
                      <p className="text-muted-foreground">
                        The approval queue is currently disabled. Enable it above to start reviewing automated actions before execution.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : pendingItems.length === 0 ? (
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

                  <div className="space-y-6">
                    {pendingItems.map((item) => {
                      const isProcessing = processingItems.has(item.id);
                      const isExpanded = expandedItems.has(item.id);
                      
                      return (
                        <Card key={item.id} className="border-l-4 border-l-orange-500">
                          <CardHeader className="pb-3">
                            <div 
                              className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 cursor-pointer"
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
                                  <div className="flex items-center gap-1">
                                    <Target className={`h-4 w-4 flex-shrink-0 ${getConfidenceColor(item.confidence)}`} />
                                    <span className={getConfidenceColor(item.confidence)}>
                                      {item.confidence}% confidence
                                    </span>
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
                          {isExpanded && (
                          <CardContent className="space-y-6">
                            {/* Original Customer Email */}
                            <div>
                              <Label className="text-sm font-medium text-muted-foreground">
                                Original Customer Email
                              </Label>
                              <div className="mt-2 p-4 bg-muted rounded-lg">
                                <p className="text-sm whitespace-pre-wrap">{item.body}</p>
                              </div>
                            </div>

                            {/* Order Cancellation Workflow Status */}
                            {item.classification === 'order_cancellation' && item.metadata && (
                              <div>
                                <Label className="text-sm font-medium text-muted-foreground">
                                  Order Cancellation Workflow Status
                                </Label>
                                <div className="mt-2 p-4 border rounded-lg bg-amber-50 dark:bg-amber-950/20">
                                  <div className="space-y-4">
                                    {/* Order Information */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                      <div className="space-y-2">
                                        <div className="flex justify-between">
                                          <span className="font-medium">Order Number:</span>
                                          <span className="font-mono">#{item.metadata.orderNumber}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="font-medium">Order Total:</span>
                                          <span>{item.metadata.orderTotal}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="font-medium">Fulfillment Method:</span>
                                          <span className="capitalize">{item.metadata.fulfillmentMethod?.replace('_', ' ')}</span>
                                        </div>
                                      </div>
                                      <div className="space-y-2">
                                        <div className="flex justify-between">
                                          <span className="font-medium">Cancellation Attempt:</span>
                                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                                            item.metadata.orderEligible 
                                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' 
                                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                          }`}>
                                            {item.metadata.orderEligible ? 'Attempt Possible' : 'Too Late'}
                                          </span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="font-medium">Reason:</span>
                                          <span className="text-right text-xs">{item.metadata.eligibilityReason}</span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Workflow Steps */}
                                    <div className="border-t pt-4">
                                      <h4 className="font-medium text-sm mb-3">Workflow Progress</h4>
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-3 text-sm">
                                          <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                                            <CheckCircle className="w-3 h-3 text-white" />
                                          </div>
                                          <span className="text-green-700 dark:text-green-400">✓ Order lookup completed from WooCommerce</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm">
                                          <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                                            <CheckCircle className="w-3 h-3 text-white" />
                                          </div>
                                          <span className="text-green-700 dark:text-green-400">✓ Cancellation attempt window evaluated</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm">
                                          <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                                            <CheckCircle className="w-3 h-3 text-white" />
                                          </div>
                                          <span className="text-green-700 dark:text-green-400">✓ Customer response drafted</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm">
                                          <div className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center">
                                            <Clock className="w-3 h-3 text-white" />
                                          </div>
                                          <span className="text-amber-700 dark:text-amber-400">⏳ Awaiting human approval (no actions taken yet)</span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* What Happens Upon Approval */}
                                    <div className="border-t pt-4">
                                      <h4 className="font-medium text-sm mb-3">Upon Approval, These Actions Will Execute:</h4>
                                      <div className="space-y-2">
                                        {item.metadata.orderEligible ? (
                                          <>
                                            <div className="flex items-center gap-3 text-sm">
                                              <div className="w-4 h-4 rounded-full bg-blue-200 flex items-center justify-center">
                                                <span className="text-blue-800 text-xs font-bold">1</span>
                                              </div>
                                              <span className="text-blue-700 dark:text-blue-400">Send initial response email to customer (acknowledging cancellation request)</span>
                                            </div>
                                            {item.metadata.fulfillmentMethod === 'warehouse_email' && (
                                              <div className="flex items-center gap-3 text-sm">
                                                <div className="w-4 h-4 rounded-full bg-blue-200 flex items-center justify-center">
                                                  <span className="text-blue-800 text-xs font-bold">2</span>
                                                </div>
                                                <span className="text-blue-700 dark:text-blue-400">Send cancellation request to warehouse team</span>
                                              </div>
                                            )}
                                            {item.metadata.fulfillmentMethod === 'shipbob' && (
                                              <div className="flex items-center gap-3 text-sm">
                                                <div className="w-4 h-4 rounded-full bg-blue-200 flex items-center justify-center">
                                                  <span className="text-blue-800 text-xs font-bold">2</span>
                                                </div>
                                                <span className="text-blue-700 dark:text-blue-400">Attempt to cancel shipment via ShipBob API</span>
                                              </div>
                                            )}
                                            {item.metadata.fulfillmentMethod === 'self_fulfillment' && (
                                              <div className="flex items-center gap-3 text-sm">
                                                <div className="w-4 h-4 rounded-full bg-blue-200 flex items-center justify-center">
                                                  <span className="text-blue-800 text-xs font-bold">2</span>
                                                </div>
                                                <span className="text-blue-700 dark:text-blue-400">Mark for manual cancellation processing</span>
                                              </div>
                                            )}
                                            <div className="flex items-center gap-3 text-sm">
                                              <div className="w-4 h-4 rounded-full bg-blue-200 flex items-center justify-center">
                                                <span className="text-blue-800 text-xs font-bold">3</span>
                                              </div>
                                              <span className="text-blue-700 dark:text-blue-400">IF cancellation successful → Cancel in WooCommerce + process refund</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-sm">
                                              <div className="w-4 h-4 rounded-full bg-blue-200 flex items-center justify-center">
                                                <span className="text-blue-800 text-xs font-bold">4</span>
                                              </div>
                                              <span className="text-blue-700 dark:text-blue-400">Send final outcome email to customer (success confirmation or return instructions)</span>
                                            </div>
                                          </>
                                        ) : (
                                          <div className="flex items-center gap-3 text-sm">
                                            <div className="w-4 h-4 rounded-full bg-blue-200 flex items-center justify-center">
                                              <span className="text-blue-800 text-xs font-bold">1</span>
                                            </div>
                                            <span className="text-blue-700 dark:text-blue-400">Send explanatory email to customer (order too late to attempt cancellation)</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>


                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Promo Code Workflow Status */}
                            {item.classification === 'promo_code' && item.metadata && (
                              <div>
                                <Label className="text-sm font-medium text-muted-foreground">
                                  Promo Code Request Workflow Status
                                </Label>
                                <div className="mt-2 p-4 border rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
                                  <div className="space-y-4">
                                    {/* Promo Code Information */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                      <div className="space-y-2">
                                        <div className="flex justify-between">
                                          <span className="font-medium">Requested Code:</span>
                                          <span className="font-mono">{item.metadata.requestedCode || 'General discount'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="font-medium">Request Type:</span>
                                          <span className="capitalize">{item.metadata.requestType || 'discount_request'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="font-medium">Customer Email:</span>
                                          <span>{item.customerEmail}</span>
                                        </div>
                                      </div>
                                      <div className="space-y-2">
                                        <div className="flex justify-between">
                                          <span className="font-medium">Eligibility:</span>
                                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                                            item.metadata.isEligible 
                                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' 
                                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                          }`}>
                                            {item.metadata.isEligible ? 'Eligible' : 'Not Eligible'}
                                          </span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="font-medium">Discount:</span>
                                          <span className="font-semibold text-emerald-600">{item.metadata.discountAmount || '10%'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="font-medium">Code to Send:</span>
                                          <span className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs">
                                            {item.metadata.promoCode || 'SAVE10'}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Workflow Steps */}
                                    <div className="border-t pt-4">
                                      <h4 className="font-medium text-sm mb-3">Workflow Progress</h4>
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-3 text-sm">
                                          <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                                            <CheckCircle className="w-3 h-3 text-white" />
                                          </div>
                                          <span className="text-green-700 dark:text-green-400">✓ Customer request analyzed and classified</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm">
                                          <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                                            <CheckCircle className="w-3 h-3 text-white" />
                                          </div>
                                          <span className="text-green-700 dark:text-green-400">✓ Promo code eligibility evaluated</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm">
                                          <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                                            <CheckCircle className="w-3 h-3 text-white" />
                                          </div>
                                          <span className="text-green-700 dark:text-green-400">✓ Appropriate discount code selected</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm">
                                          <div className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center">
                                            <Clock className="w-3 h-3 text-white" />
                                          </div>
                                          <span className="text-amber-700 dark:text-amber-400">⏳ Awaiting human approval (no code sent yet)</span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* What Happens Upon Approval */}
                                    <div className="border-t pt-4">
                                      <h4 className="font-medium text-sm mb-3">Upon Approval, These Actions Will Execute:</h4>
                                      <div className="space-y-2">
                                        {item.metadata.isEligible ? (
                                          <>
                                            <div className="flex items-center gap-3 text-sm">
                                              <div className="w-4 h-4 rounded-full bg-emerald-200 flex items-center justify-center">
                                                <span className="text-emerald-800 text-xs font-bold">1</span>
                                              </div>
                                              <span className="text-emerald-700 dark:text-emerald-400">Send promo code email to customer with discount instructions</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-sm">
                                              <div className="w-4 h-4 rounded-full bg-emerald-200 flex items-center justify-center">
                                                <span className="text-emerald-800 text-xs font-bold">2</span>
                                              </div>
                                              <span className="text-emerald-700 dark:text-emerald-400">Log promo code usage for analytics and tracking</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-sm">
                                              <div className="w-4 h-4 rounded-full bg-emerald-200 flex items-center justify-center">
                                                <span className="text-emerald-800 text-xs font-bold">3</span>
                                              </div>
                                              <span className="text-emerald-700 dark:text-emerald-400">Update customer service activity log for future reference</span>
                                            </div>
                                          </>
                                        ) : (
                                          <div className="flex items-center gap-3 text-sm">
                                            <div className="w-4 h-4 rounded-full bg-emerald-200 flex items-center justify-center">
                                              <span className="text-emerald-800 text-xs font-bold">1</span>
                                            </div>
                                            <span className="text-emerald-700 dark:text-emerald-400">Send polite declining email explaining promo code policy</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Automated Template Response */}
                            <div>
                              <Label className="text-sm font-medium text-muted-foreground">
                                Automated Template Response
                              </Label>
                              <div className="mt-2 p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
                                <p className="text-sm whitespace-pre-wrap">{item.proposedResponse}</p>
                                <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-800">
                                  <p className="text-xs text-blue-700 dark:text-blue-300 italic">
                                    Based on template with AI-generated delivery estimates
                                  </p>
                                </div>
                              </div>
                            </div>

                            <Separator />

                            {/* Action Buttons - Primary Actions First */}
                            <div className="space-y-4">
                              <div className="flex flex-col sm:flex-row gap-3 sm:justify-center">
                                {/* Primary Approve Button */}
                                <Button
                                  onClick={() => handleApprove(item.id)}
                                  disabled={isProcessing}
                                  size="lg"
                                  className="bg-green-600 hover:bg-green-700 text-white border-green-600 flex-1 sm:flex-none sm:min-w-[140px]"
                                >
                                  <CheckCircle className="w-5 h-5 mr-2" />
                                  {isProcessing ? 'Sending...' : 'Approve & Send'}
                                </Button>

                                {/* Secondary Reject Button */}
                                <Button
                                  variant="outline"
                                  size="lg"
                                  disabled={isProcessing}
                                  className="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/20 flex-1 sm:flex-none sm:min-w-[140px]"
                                  onClick={() => {
                                    setShowRejectionForm(prev => ({
                                      ...prev,
                                      [item.id]: !prev[item.id]
                                    }));
                                  }}
                                >
                                  <XCircle className="w-5 h-5 mr-2" />
                                  Reject
                                </Button>
                              </div>

                              {/* Contextual Rejection Form */}
                              {showRejectionForm[item.id] && (
                                <div className="border rounded-lg p-4 bg-red-50 dark:bg-red-950/10 space-y-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <AlertTriangle className="h-4 w-4 text-red-600" />
                                  <Label className="text-sm font-medium text-red-700 dark:text-red-400">
                                    Why are you rejecting this automation?
                                  </Label>
                                </div>
                                
                                {!customReasonModes[item.id] ? (
                                  <div className="space-y-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {presetReasons.map((reason) => (
                                        <Button
                                          key={reason.id}
                                          variant={rejectionReasons[item.id]?.startsWith(reason.label) ? "default" : "outline"}
                                          size="sm"
                                          onClick={() => handlePresetReasonSelect(item.id, reason.label, reason.description)}
                                          className={`h-auto p-3 text-left justify-start ${
                                            rejectionReasons[item.id]?.startsWith(reason.label) 
                                              ? "bg-red-600 text-white border-red-600" 
                                              : "text-gray-700 border-gray-200 hover:bg-gray-50"
                                          }`}
                                        >
                                          <div className="flex flex-col items-start">
                                            <span className="font-medium text-sm">{reason.label}</span>
                                            <span className="text-xs opacity-75 mt-1">{reason.description}</span>
                                          </div>
                                        </Button>
                                      ))}
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => toggleCustomReasonMode(item.id)}
                                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    >
                                      + Write custom reason
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    <Textarea
                                      id={`rejection-${item.id}`}
                                      placeholder="Explain why this automated response should not be sent..."
                                      value={rejectionReasons[item.id] || ''}
                                      onChange={(e) => handleRejectionReasonChange(item.id, e.target.value)}
                                      className="min-h-[80px]"
                                    />
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => toggleCustomReasonMode(item.id)}
                                      className="text-gray-600 hover:text-gray-700 hover:bg-gray-50"
                                    >
                                      ← Back to preset reasons
                                    </Button>
                                  </div>
                                )}

                                {/* Confirm Rejection Button */}
                                <div className="flex items-center justify-between pt-2 border-t">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setShowRejectionForm(prev => ({
                                        ...prev,
                                        [item.id]: false
                                      }));
                                      // Clear rejection reason when canceling
                                      setRejectionReasons(prev => ({
                                        ...prev,
                                        [item.id]: ''
                                      }));
                                    }}
                                    className="text-gray-600"
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    variant="outline"
                                    onClick={() => handleReject(item.id)}
                                    disabled={isProcessing || !rejectionReasons[item.id]?.trim()}
                                    className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/20"
                                  >
                                    <XCircle className="w-4 h-4 mr-2" />
                                    {isProcessing ? 'Processing...' : 'Confirm Rejection'}
                                  </Button>
                                </div>
                              </div>
                            )}
                          </CardContent>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}