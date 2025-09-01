import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import Sidebar from "@/components/layout/sidebar";
import TopBar from "@/components/layout/topbar";
import { CheckCircle, XCircle, Clock, Eye, Bot, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface AutomationApprovalItem {
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

const classifications = [
  { value: 'promo_refund', label: 'Promo/Refund Requests', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  { value: 'order_status', label: 'Order Status Inquiries', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  { value: 'return_request', label: 'Return Requests', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  { value: 'general', label: 'General Questions', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  { value: 'shipping_info', label: 'Shipping Information', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
];

export default function AutomationApprovalQueue() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [approvalEnabled, setApprovalEnabled] = useState(true);
  const [selectedItem, setSelectedItem] = useState<AutomationApprovalItem | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch approval queue items
  const { data: approvalQueue = [], isLoading } = useQuery({
    queryKey: ['/api/automation-approval-queue/user1'],
    queryFn: async () => {
      const response = await fetch('/api/automation-approval-queue/user1');
      if (!response.ok) throw new Error('Failed to fetch approval queue');
      return response.json();
    }
  });

  // Fetch system settings to get approval preference
  const { data: settings } = useQuery({
    queryKey: ['/api/settings/user1'],
    queryFn: async () => {
      const response = await fetch('/api/settings/user1');
      if (!response.ok) throw new Error('Failed to fetch settings');
      return response.json();
    }
  });

  // Update approval setting
  const updateApprovalSettingMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await fetch('/api/settings/user1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ automationApprovalRequired: enabled }),
      });
      if (!response.ok) throw new Error('Failed to update approval setting');
      return response.json();
    },
    onSuccess: () => {
      toast({ description: `Automation approval ${approvalEnabled ? 'enabled' : 'disabled'}` });
      queryClient.invalidateQueries({ queryKey: ['/api/settings/user1'] });
    },
    onError: () => {
      toast({ variant: "destructive", description: "Failed to update approval setting" });
    }
  });

  // Approve/Reject automation
  const processApprovalMutation = useMutation({
    mutationFn: async ({ id, status, rejectionReason }: { id: string; status: string; rejectionReason?: string }) => {
      const response = await fetch(`/api/automation-approval-queue/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status, 
          rejectionReason,
          reviewedBy: 'user1' // TODO: Get from session
        }),
      });
      if (!response.ok) throw new Error('Failed to process approval');
      return response.json();
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/automation-approval-queue/user1'] });
      toast({ 
        description: status === 'approved' ? 'Automation approved and executed' : 'Automation rejected',
        variant: status === 'approved' ? 'default' : 'destructive'
      });
      setSelectedItem(null);
      setIsPreviewOpen(false);
      setRejectionReason("");
    },
    onError: () => {
      toast({ variant: "destructive", description: "Failed to process approval" });
    }
  });

  const getClassificationInfo = (classification: string) => {
    return classifications.find(c => c.value === classification) || 
           { label: classification, color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-200"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge variant="outline" className="text-green-600 border-green-200"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="text-red-600 border-red-200"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      case 'executed':
        return <Badge variant="outline" className="text-blue-600 border-blue-200"><Bot className="h-3 w-3 mr-1" />Executed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleApprovalToggle = (enabled: boolean) => {
    setApprovalEnabled(enabled);
    updateApprovalSettingMutation.mutate(enabled);
  };

  const handleApprove = (item: AutomationApprovalItem) => {
    processApprovalMutation.mutate({ id: item.id, status: 'approved' });
  };

  const handleReject = (item: AutomationApprovalItem) => {
    if (!rejectionReason.trim()) {
      toast({ variant: "destructive", description: "Please provide a rejection reason" });
      return;
    }
    processApprovalMutation.mutate({ 
      id: item.id, 
      status: 'rejected', 
      rejectionReason: rejectionReason.trim()
    });
  };

  const pendingItems = approvalQueue.filter((item: AutomationApprovalItem) => item.status === 'pending');
  const processedItems = approvalQueue.filter((item: AutomationApprovalItem) => item.status !== 'pending');

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Automation Approval Queue</h1>
          <p className="text-muted-foreground">
            Review and approve AI automations before they execute
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Label htmlFor="approval-toggle" className="text-sm font-medium">
            Require Approval
          </Label>
          <Switch
            id="approval-toggle"
            checked={approvalEnabled}
            onCheckedChange={handleApprovalToggle}
            disabled={updateApprovalSettingMutation.isPending}
          />
        </div>
      </div>

      {!approvalEnabled && (
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Bot className="h-5 w-5 text-yellow-600" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Automation approval is disabled. AI automations will execute immediately without manual review.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Approvals */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Pending Approvals ({pendingItems.length})</h2>
        </div>

        {pendingItems.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <p className="text-lg font-medium">All caught up!</p>
                <p className="text-muted-foreground">No pending automations require approval.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {pendingItems.map((item: AutomationApprovalItem) => {
              const classificationInfo = getClassificationInfo(item.classification);
              return (
                <Card key={item.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center space-x-2">
                          <Badge className={classificationInfo.color}>
                            {classificationInfo.label}
                          </Badge>
                          {getStatusBadge(item.status)}
                        </div>
                        
                        <div>
                          <p className="font-medium text-sm">From: {item.customerEmail}</p>
                          <p className="text-sm text-muted-foreground">Subject: {item.subject}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        <Dialog open={isPreviewOpen && selectedItem?.id === item.id} 
                                onOpenChange={(open) => {
                                  setIsPreviewOpen(open);
                                  if (!open) {
                                    setSelectedItem(null);
                                    setRejectionReason("");
                                  }
                                }}>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setSelectedItem(item)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Review
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Review Automation</DialogTitle>
                              <DialogDescription>
                                Review the customer email and proposed template response
                              </DialogDescription>
                            </DialogHeader>
                            
                            {selectedItem && (
                              <div className="space-y-6">
                                <div>
                                  <h4 className="font-medium mb-2">Customer Email</h4>
                                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-2">
                                    <p><strong>From:</strong> {selectedItem.customerEmail}</p>
                                    <p><strong>Subject:</strong> {selectedItem.subject}</p>
                                    <div className="mt-3">
                                      <strong>Message:</strong>
                                      <p className="mt-1 whitespace-pre-wrap">{selectedItem.body}</p>
                                    </div>
                                  </div>
                                </div>
                                
                                <div>
                                  <h4 className="font-medium mb-2">Proposed Template Response</h4>
                                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                                    <div className="text-xs text-blue-600 dark:text-blue-400 mb-2 font-medium">
                                      TEMPLATE: Based on order lookup data for transactional response
                                    </div>
                                    <p className="whitespace-pre-wrap">{selectedItem.proposedResponse}</p>
                                  </div>
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                  <Badge className={getClassificationInfo(selectedItem.classification).color}>
                                    {getClassificationInfo(selectedItem.classification).label}
                                  </Badge>
                                </div>
                                
                                <div className="pt-4 border-t">
                                  <div className="space-y-4">
                                    <div>
                                      <Label htmlFor="rejection-reason">Rejection Reason (if rejecting)</Label>
                                      <Textarea
                                        id="rejection-reason"
                                        placeholder="Explain why this automation should be rejected..."
                                        value={rejectionReason}
                                        onChange={(e) => setRejectionReason(e.target.value)}
                                        className="mt-2"
                                      />
                                    </div>
                                    
                                    <div className="flex justify-end space-x-2">
                                      <Button
                                        variant="outline"
                                        onClick={() => handleReject(selectedItem)}
                                        disabled={processApprovalMutation.isPending}
                                      >
                                        <XCircle className="h-4 w-4 mr-1" />
                                        Reject
                                      </Button>
                                      <Button
                                        onClick={() => handleApprove(selectedItem)}
                                        disabled={processApprovalMutation.isPending}
                                      >
                                        <CheckCircle className="h-4 w-4 mr-1" />
                                        Approve & Execute
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                        
                        <Button
                          size="sm"
                          onClick={() => handleApprove(item)}
                          disabled={processApprovalMutation.isPending}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Quick Approve
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Processed Items History */}
      {processedItems.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Recent Activity ({processedItems.length})</h2>
          
          <div className="grid gap-3">
            {processedItems.slice(0, 10).map((item: AutomationApprovalItem) => {
              const classificationInfo = getClassificationInfo(item.classification);
              return (
                <Card key={item.id} className="opacity-75">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Badge className={classificationInfo.color} variant="outline">
                          {classificationInfo.label}
                        </Badge>
                        {getStatusBadge(item.status)}
                        <span className="text-sm text-muted-foreground">
                          {item.customerEmail}
                        </span>
                      </div>
                      
                      <div className="text-xs text-muted-foreground">
                        {item.reviewedAt && formatDistanceToNow(new Date(item.reviewedAt), { addSuffix: true })}
                      </div>
                    </div>
                    
                    {item.rejectionReason && (
                      <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                        <strong>Rejection reason:</strong> {item.rejectionReason}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
          </div>
        </main>
      </div>
    </div>
  );
}