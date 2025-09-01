import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Settings, Mail, Calendar, BarChart3, Trash2, Edit, Activity, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { AutomatedOrderCampaign, StoreConnection } from "@shared/schema";
import Sidebar from "@/components/layout/sidebar";
import TopBar from "@/components/layout/topbar";
import { useIsMobile } from "@/hooks/use-mobile";

// Helper function to get user-friendly template descriptions
const getTemplateDescription = (template: string): string => {
  const descriptions: Record<string, string> = {
    'order_status': 'Order Status Update',
    'shipping_update': 'Shipping Notification', 
    'delivery_reminder': 'Delivery Reminder',
    'order_I': 'Order Status Update',
    'shipment_tracking': 'Tracking Information',
    'delivery_confirmation': 'Delivery Confirmation'
  };
  return descriptions[template] || 'Order Update';
};

interface EmailInterval {
  days: number;
  template: string;
}

interface AutomationFormData {
  name: string;
  storeConnectionId: string;
  emailIntervals: EmailInterval[];
  emailTemplate: string;
  includeAiPredictions: boolean;
}

export default function AutomatedCampaigns() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Use authenticated user ID, fallback to user1 for demo purposes
  const userId = user?.id || "user1";
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<AutomatedOrderCampaign | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Fetch campaigns
  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: [`/api/automated-campaigns/${userId}`],
  });

  // Fetch store connections for dropdown
  const { data: storeConnections = [] } = useQuery<StoreConnection[]>({
    queryKey: [`/api/store-connections/${userId}`],
  });



  // Mutations for creating, updating, deleting campaigns

  // Basic stats for campaign overview cards
  const campaignStats = {
    totalCampaigns: Array.isArray(campaigns) ? campaigns.length : 0,
    activeCampaigns: Array.isArray(campaigns) ? campaigns.filter((c: AutomatedOrderCampaign) => c.isActive).length : 0,
    totalEmailsSent: Array.isArray(campaigns) ? campaigns.reduce((sum: number, c: AutomatedOrderCampaign) => sum + (c.totalEmailsSent || 0), 0) : 0
  };

  // Create automation mutation
  const createAutomationMutation = useMutation({
    mutationFn: async (data: AutomationFormData) =>
      apiRequest("POST", "/api/automated-campaigns", { ...data, userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/automated-campaigns/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/automated-campaigns/${userId}/stats`] });
      setIsCreateDialogOpen(false);
      toast({ title: "Email automation created successfully!" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create automation", description: error.message, variant: "destructive" });
    },
  });

  // Toggle automation mutation
  const toggleAutomationMutation = useMutation({
    mutationFn: async ({ campaignId, isActive }: { campaignId: string; isActive: boolean }) =>
      apiRequest("POST", `/api/automated-campaigns/${userId}/${campaignId}/toggle`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/automated-campaigns/${userId}`] });
      toast({ title: "Automation updated successfully!" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update automation", description: error.message, variant: "destructive" });
    },
  });

  // Delete automation mutation
  const deleteAutomationMutation = useMutation({
    mutationFn: async (campaignId: string) =>
      apiRequest("DELETE", `/api/automated-campaigns/${userId}/${campaignId}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/automated-campaigns/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/automated-campaigns/${userId}/stats`] });
      toast({ title: "Automation deleted successfully!" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete automation", description: error.message, variant: "destructive" });
    },
  });

  const handleToggleAutomation = async (campaignId: string, isActive: boolean) => {
    toggleAutomationMutation.mutate({ campaignId, isActive });
  };

  const handleDeleteAutomation = async (campaignId: string) => {
    if (confirm("Are you sure you want to delete this automation? This action cannot be undone.")) {
      deleteAutomationMutation.mutate(campaignId);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex bg-gray-50">
        <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
        <div className="lg:pl-64 flex flex-col flex-1">
          <TopBar onMenuClick={() => setIsMobileMenuOpen(true)} />
          <div className="p-6">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      
      <div className="lg:pl-64 flex flex-col flex-1">
        <TopBar onMenuClick={() => setIsMobileMenuOpen(true)} />
        
        <main className="flex-1 p-6">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Email Automations</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Proactively send order status emails to customers automatically
                </p>
              </div>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Automation
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create New Email Automation</DialogTitle>
                  </DialogHeader>
                  <AutomationForm
                    storeConnections={storeConnections}
                    onSubmit={(data) => createAutomationMutation.mutate(data)}
                    isLoading={createAutomationMutation.isPending}
                  />
                </DialogContent>
              </Dialog>
            </div>

            {/* Stats Overview */}
            {campaignStats && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Automations</p>
                        <p className="text-2xl font-bold">{campaignStats.totalCampaigns}</p>
                      </div>
                      <Settings className="w-8 h-8 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Automations</p>
                        <p className="text-2xl font-bold text-green-600">{campaignStats.activeCampaigns}</p>
                      </div>
                      <Calendar className="w-8 h-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Emails Sent</p>
                        <p className="text-2xl font-bold text-purple-600">{campaignStats.totalEmailsSent}</p>
                      </div>
                      <Mail className="w-8 h-8 text-purple-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Open Rate</p>
                        <p className="text-2xl font-bold text-orange-600">89%</p>
                      </div>
                      <BarChart3 className="w-8 h-8 text-orange-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Automation Logs */}
            <AutomationLogs userId={userId} />

            {/* Campaigns List */}
            <div className="space-y-4">
              {!Array.isArray(campaigns) || campaigns.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center">
                    <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No email automations yet</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Create your first email automation to start sending proactive order status emails to customers.
                    </p>
                    <Button onClick={() => setIsCreateDialogOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Your First Automation
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                Array.isArray(campaigns) && campaigns.map((campaign: AutomatedOrderCampaign) => (
                  <AutomationCard
                    key={campaign.id}
                    campaign={campaign}
                    storeConnections={storeConnections}
                    onToggle={(isActive) => handleToggleAutomation(campaign.id, isActive)}
                    onDelete={() => handleDeleteAutomation(campaign.id)}
                    onEdit={() => setEditingCampaign(campaign)}
                  />
                ))
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

interface AutomationCardProps {
  campaign: AutomatedOrderCampaign;
  storeConnections: StoreConnection[];
  onToggle: (isActive: boolean) => void;
  onDelete: () => void;
  onEdit: () => void;
}

function AutomationCard({ campaign, storeConnections, onToggle, onDelete }: AutomationCardProps) {
  const storeConnection = storeConnections.find(sc => sc.id === campaign.storeConnectionId);
  const intervals = campaign.emailIntervals as EmailInterval[];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div>
              <CardTitle className="text-lg">{campaign.name}</CardTitle>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Connected to {storeConnection?.platform} store: {storeConnection?.storeUrl || 'Unknown'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant={campaign.isActive ? "default" : "secondary"}>
              {campaign.isActive ? "Active" : "Inactive"}
            </Badge>
            <Switch
              checked={campaign.isActive || false}
              onCheckedChange={onToggle}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Email Schedule</p>
            <div className="space-y-1">
              {intervals.map((interval, idx) => (
                <p key={idx} className="text-sm">
                  Day {interval.days}: {getTemplateDescription(interval.template || campaign.emailTemplate || 'default')}
                </p>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">AI Predictions</p>
            <p className="text-sm">
              {campaign.includeAiPredictions ? "✅ Enabled" : "❌ Disabled"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Emails Sent</p>
            <p className="text-sm font-bold">{campaign.totalEmailsSent || 0}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Open Rate</p>
            <p className="text-sm font-bold text-green-600">{campaign.openRate || '0'}%</p>
          </div>
        </div>
        <div className="flex items-center justify-end space-x-2 mt-4 pt-4 border-t">
          <Button variant="outline" size="sm">
            <Edit className="w-4 h-4 mr-1" />
            Edit
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onDelete}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface AutomationFormProps {
  storeConnections: StoreConnection[];
  onSubmit: (data: AutomationFormData) => void;
  isLoading: boolean;
  initialData?: Partial<AutomationFormData>;
}

function AutomationForm({ storeConnections, onSubmit, isLoading }: AutomationFormProps) {
  const [formData, setFormData] = useState<AutomationFormData>({
    name: "",
    storeConnectionId: "",
    emailIntervals: [{ days: 3, template: "order_status" }],
    emailTemplate: "order_status",
    includeAiPredictions: true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.storeConnectionId) {
      return;
    }
    onSubmit(formData);
  };

  const addInterval = () => {
    setFormData(prev => ({
      ...prev,
      emailIntervals: [...prev.emailIntervals, { days: 7, template: "order_status" }]
    }));
  };

  const removeInterval = (index: number) => {
    setFormData(prev => ({
      ...prev,
      emailIntervals: prev.emailIntervals.filter((_, i) => i !== index)
    }));
  };

  const updateInterval = (index: number, field: keyof EmailInterval, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      emailIntervals: prev.emailIntervals.map((interval, i) =>
        i === index ? { ...interval, [field]: value } : interval
      )
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Automation Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="e.g., 3-Day Order Follow-up"
          required
        />
      </div>

      <div>
        <Label htmlFor="store">Store Connection</Label>
        <Select
          value={formData.storeConnectionId}
          onValueChange={(value) => setFormData(prev => ({ ...prev, storeConnectionId: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a store" />
          </SelectTrigger>
          <SelectContent>
            {storeConnections.map((store) => (
              <SelectItem key={store.id} value={store.id}>
                {store.platform} - {store.storeUrl}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Email Schedule</Label>
        <div className="space-y-2 mt-2">
          {formData.emailIntervals.map((interval, index) => (
            <div key={index} className="flex items-center space-x-2">
              <Input
                type="number"
                value={interval.days}
                onChange={(e) => updateInterval(index, 'days', Number(e.target.value))}
                placeholder="Days"
                className="w-20"
                min="1"
              />
              <span className="text-sm">days after order</span>
              <Select
                value={interval.template}
                onValueChange={(value) => updateInterval(index, 'template', value)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="order_status">Order Status</SelectItem>
                  <SelectItem value="shipping_update">Shipping Update</SelectItem>
                  <SelectItem value="delivery_reminder">Delivery Reminder</SelectItem>
                </SelectContent>
              </Select>
              {formData.emailIntervals.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeInterval(index)}
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addInterval}>
            Add Another Email
          </Button>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="ai-predictions"
          checked={formData.includeAiPredictions}
          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, includeAiPredictions: checked }))}
        />
        <Label htmlFor="ai-predictions">Include Delight Desk AI delivery predictions</Label>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="submit" disabled={isLoading}>
        {isLoading ? "Creating..." : "Create Automation"}
        </Button>
      </div>
    </form>
  );
}

// Automation Logs Component
function AutomationLogs({ userId }: { userId: string }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: [`/api/automation-logs/${userId}`],
    refetchInterval: 10000, // Refresh every 10 seconds for real-time monitoring
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Automation Activity Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Automation Activity Log
        </CardTitle>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Real-time monitoring of email automation activity
        </p>
      </CardHeader>
      <CardContent>
        {!Array.isArray(logs) || logs.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No automation activity yet</p>
            <p className="text-sm text-gray-500">Logs will appear here when email automations are triggered</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {logs.map((log: any) => (
              <div key={log.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex-shrink-0">
                  {log.action.includes('campaign') ? (
                    <Mail className="w-4 h-4 text-blue-500 mt-0.5" />
                  ) : (
                    <Activity className="w-4 h-4 text-green-500 mt-0.5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {log.action}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                    {log.details}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={log.status === 'completed' ? 'default' : log.status === 'failed' ? 'destructive' : 'secondary'}>
                      {log.status}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}