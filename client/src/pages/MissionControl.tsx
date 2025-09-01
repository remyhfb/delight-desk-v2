import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Sidebar from "@/components/layout/sidebar";
import TopBar from "@/components/layout/topbar";
import { 
  Bot, 
  User, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Mail, 
  Search,
  ExternalLink,
  RefreshCw,
  TrendingUp,
  Zap,
  CreditCard,
  Settings,
  Power,
  PowerOff,
  Globe,
  Package,
  Tag,
  MapPin,
  Truck,
  Brain
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";

interface DashboardStats {
  aiAgentActionsCompleted: string;
  aiAssistantTicketsResolved: string;
  totalEmailsReceived: string;
  timeSaved: string;
}

interface ActivityLogEntry {
  id: string;
  action: string;
  type: string;
  executedBy: 'human' | 'ai';
  customerEmail: string;
  details: string;
  status: 'completed' | 'pending' | 'failed';
  createdAt: string;
  metadata?: any;
}

interface EscalationItem {
  id: string;
  emailId: string;
  userId: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  reason: string;
  status: 'pending' | 'in_progress' | 'resolved';
  customerEmail: string;
  subject: string;
  createdAt: string;
}

interface OrderData {
  id: string;
  platform: 'woocommerce' | 'shopify';
  orderNumber: string;
  status: string;
  customerEmail: string;
  customerName: string;
  total: string;
  dateCreated: string;
  trackingNumber?: string;
}

interface AutomationRule {
  id: string;
  name: string;
  description: string;
  classification: string;
  isActive: boolean;
  triggerCount: number;
  lastTriggered: string | null;
  template: string;
}

type AgentStatus = {
  id: string;
  name: string;
  isEnabled: boolean;
  requiresModeration: boolean;
  ruleCount: number;
};

const agentConfig = [
  {
    id: "wismo",
    name: "WISMO Agent",
    icon: Truck,
    href: "/wismo-agent"
  },
  {
    id: "subscription",
    name: "Subscription Agent",
    icon: Bot,
    href: "/subscription-agent"
  },
  {
    id: "returns",
    name: "Returns Agent", 
    icon: Package,
    href: "/returns-agent"
  },
  {
    id: "promo-code",
    name: "Promo Code Agent",
    icon: Tag,
    href: "/promo-code-agent"
  },
  {
    id: "product",
    name: "Product Agent",
    icon: Brain,
    href: "/product-agent"
  },
  {
    id: "address-change",
    name: "Address Change Agent",
    icon: MapPin,
    href: "/address-change"
  },
  {
    id: "cancellation",
    name: "Cancellation Agent",
    icon: Package,
    href: "/order-cancellations"
  }
];

export default function MissionControl() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    document.title = "Dashboard - Delight Desk";
  }, []);
  const [timeRange, setTimeRange] = useState('today');
  const [orderSearch, setOrderSearch] = useState('');
  const [searchResults, setSearchResults] = useState<OrderData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [queuePriorityFilter, setQueuePriorityFilter] = useState('all');
  

  
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Auto-refresh activity log every 10 seconds
  const { data: activityLog = [], isLoading: activityLoading } = useQuery({
    queryKey: ['/api/activity-logs', user?.id],
    queryFn: async () => {
      const response = await fetch(`/api/activity-logs/${user?.id || 'user1'}`);
      if (!response.ok) throw new Error('Failed to fetch activity log');
      return response.json();
    },
    enabled: !!user?.id,
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });

  // Escalation queue data
  const { data: escalations = [], isLoading: escalationsLoading } = useQuery({
    queryKey: ['/api/escalation-queue', user?.id],
    queryFn: async () => {
      const response = await fetch(`/api/escalation-queue/${user?.id || 'user1'}`);
      if (!response.ok) throw new Error('Failed to fetch escalations');
      return response.json();
    },
    enabled: !!user?.id,
    refetchInterval: 15000, // Auto-refresh every 15 seconds
  });

  // Dashboard stats with time range
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/dashboard/stats/user1', timeRange],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/stats/user1?range=${timeRange}`);
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Automation rules data
  const { data: automations = [], isLoading: automationsLoading } = useQuery({
    queryKey: ['/api/auto-responder-rules/user1'],
    queryFn: async () => {
      const response = await fetch('/api/auto-responder-rules/user1');
      if (!response.ok) throw new Error('Failed to fetch automations');
      return response.json();
    },
    refetchInterval: 60000, // Auto-refresh every minute
  });

  // AI Agents data
  const { data: agentStatuses = [], isLoading: agentsLoading } = useQuery({
    queryKey: [`/api/agents/${user?.id}/overview`],
    queryFn: async () => {
      const response = await fetch(`/api/agents/${user?.id}/overview`);
      if (!response.ok) throw new Error('Failed to fetch agent statuses');
      return response.json();
    },
    enabled: !!user?.id,
    refetchInterval: 60000, // Auto-refresh every minute
  });

  // Pending approvals data
  const { data: pendingApprovals = [], isLoading: approvalsLoading } = useQuery({
    queryKey: [`/api/automation-approval-queue/${user?.id}/pending`],
    queryFn: async () => {
      const response = await fetch(`/api/automation-approval-queue/${user?.id}/pending`);
      if (!response.ok) throw new Error('Failed to fetch pending approvals');
      return response.json();
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Toggle agent mutation
  const toggleAgentMutation = useMutation({
    mutationFn: async ({ agentId, enabled }: { agentId: string; enabled: boolean }) => {
      return apiRequest('POST', `/api/agents/${agentId}/${user?.id}/toggle`, {
        isEnabled: enabled,
        requiresModeration: false // Default to false for dashboard toggles
      });
    },
    onSuccess: (_, { agentId }) => {
      // Invalidate all agent-related caches for synchronization
      queryClient.invalidateQueries({ queryKey: [`/api/agents/${user?.id}/overview`] });
      queryClient.invalidateQueries({ queryKey: [`/api/agents/${agentId}/${user?.id}/settings`] });
      toast({
        title: "Agent Updated",
        description: "Agent status has been updated successfully.",
      });
    },
    onError: (error: any, { agentId }) => {
      toast({
        title: "Error",
        description: `Failed to update ${agentId} agent: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    },
  });

  const handleToggle = (agentId: string) => {
    const currentStatus = agentStatuses.find((status: AgentStatus) => status.id === agentId);
    if (currentStatus) {
      toggleAgentMutation.mutate({ 
        agentId, 
        enabled: !currentStatus.isEnabled 
      });
    }
  };

  // Order search functionality
  const searchOrders = async () => {
    if (!orderSearch.trim()) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(`/api/orders/search?q=${encodeURIComponent(orderSearch)}&userId=user1`);
      if (response.ok) {
        const results = await response.json();
        setSearchResults(results);
      } else {
        setSearchResults([]);
        toast({ variant: "destructive", description: "No orders found" });
      }
    } catch (error) {
      toast({ variant: "destructive", description: "Search failed" });
    } finally {
      setIsSearching(false);
    }
  };


  // Send quick email action
  const sendQuickEmailMutation = useMutation({
    mutationFn: async ({ customerEmail, template, subject }: { customerEmail: string; template: string; subject: string }) => {
      const response = await fetch('/api/quick-actions/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'user1',
          customerEmail,
          template,
          subject,
          actionType: 'manual_response'
        }),
      });
      if (!response.ok) throw new Error('Failed to send email');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/activity-logs', user?.id] });
      toast({ description: "Email sent successfully" });
    },
  });





  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      case 'low': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getActionIcon = (executedBy: string) => {
    return executedBy === 'ai' ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />;
  };

  const timeRangeOptions = [
    { value: 'today', label: 'Today' },
    { value: '7days', label: 'Last 7 Days' },
    { value: '30days', label: 'Last 30 Days' },
    { value: '365days', label: 'Last 365 Days' },
  ];

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      
      <div className="lg:pl-64 flex flex-col flex-1">
        <TopBar 
          onMenuClick={() => setIsMobileMenuOpen(true)}
        />
        
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              
              {/* Header with time range selector */}
              <div className="mb-6">
                <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Mission Control</h1>
                    <p className="mt-2 text-sm sm:text-lg text-gray-600">
                      Advanced command center for intelligent email automation and escalation management
                    </p>
                  </div>
                  <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-4">
                    <Select value={timeRange} onValueChange={setTimeRange}>
                      <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {timeRangeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        queryClient.invalidateQueries();
                      }}
                      className="w-full sm:w-auto"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh
                    </Button>
                  </div>
                </div>
              </div>

              {/* Metrics Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">AI Agent Actions Completed</p>
                        <p className="text-2xl font-bold text-green-600">{stats?.aiAgentActionsCompleted || '0'}</p>
                      </div>
                      <Bot className="h-8 w-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">AI Assistant Tickets Resolved</p>
                        <p className="text-2xl font-bold text-blue-600">{stats?.aiAssistantTicketsResolved || '0'}</p>
                      </div>
                      <User className="h-8 w-8 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Total Emails Received</p>
                        <p className="text-2xl font-bold text-gray-900">{stats?.totalEmailsReceived || '0'}</p>
                      </div>
                      <Mail className="h-8 w-8 text-gray-500" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Time Saved</p>
                        <p className="text-2xl font-bold text-purple-600">{stats?.timeSaved || '0h'}</p>
                      </div>
                      <Clock className="h-8 w-8 text-purple-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>



              {/* AI Agents */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bot className="h-5 w-5" />
                      AI Agents
                    </div>
                    <Badge variant="secondary">{pendingApprovals.length}</Badge>
                  </CardTitle>
                  <CardDescription>Manage your specialized AI agents for automated customer support</CardDescription>
                </CardHeader>
                <CardContent>
                  {agentsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin text-gray-400 mr-2" />
                      <span className="text-gray-500">Loading agents...</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {agentConfig.map((agent) => {
                        const Icon = agent.icon;
                        const agentStatus = agentStatuses.find((status: AgentStatus) => status.id === agent.id);
                        const isEnabled = agentStatus?.isEnabled || false;
                        const isToggling = toggleAgentMutation.isPending;
                        
                        return (
                          <Card key={agent.id} className={`relative ${isEnabled ? 'ring-2 ring-primary/20' : ''}`}>
                            <CardHeader className="pb-3">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className={`p-2 rounded-lg ${isEnabled ? 'bg-primary/10' : 'bg-gray-100'}`}>
                                    <Icon className={`h-5 w-5 ${isEnabled ? 'text-primary' : 'text-gray-400'}`} />
                                  </div>
                                  <div>
                                    <CardTitle className="text-lg">{agent.name}</CardTitle>
                                  </div>
                                </div>
                                <Switch
                                  checked={isEnabled}
                                  onCheckedChange={() => handleToggle(agent.id)}
                                  disabled={isToggling}
                                  data-testid={`switch-${agent.id}`}
                                />
                              </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {agentStatus?.ruleCount > 0 && (
                                    <Badge variant="secondary" className="text-xs">
                                      {agentStatus.ruleCount} rules
                                    </Badge>
                                  )}
                                </div>
                                <Link href={agent.href}>
                                  <span className="text-sm text-primary hover:text-primary/80 cursor-pointer">
                                    Configure →
                                  </span>
                                </Link>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Bottom Two-Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* AI Assistant Queue */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between mb-2">
                      <CardTitle className="flex items-center gap-2">
                        <span>AI Assistant Queue</span>
                        <Badge variant="secondary">{
                          queuePriorityFilter === 'all' 
                            ? escalations.length 
                            : escalations.filter(e => e.priority === queuePriorityFilter).length
                        }</Badge>
                      </CardTitle>
                      <Select value={queuePriorityFilter} onValueChange={setQueuePriorityFilter}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="urgent">🔴 Urgent</SelectItem>
                          <SelectItem value="high">🟠 High</SelectItem>
                          <SelectItem value="medium">🟡 Medium</SelectItem>
                          <SelectItem value="low">🔵 Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <CardDescription>Items requiring human attention</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="max-h-96 overflow-y-auto">
                      {escalationsLoading ? (
                        <div className="p-4 text-center text-gray-500">Loading...</div>
                      ) : escalations.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                          <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                          All caught up!
                        </div>
                      ) : (
                        <div className="space-y-3 p-4">
                          {escalations
                            .filter(escalation => queuePriorityFilter === 'all' || escalation.priority === queuePriorityFilter)
                            .map((escalation: EscalationItem) => (
                            <div key={escalation.id} className="p-3 border rounded-lg bg-white">
                              <div className="flex items-center justify-between mb-2">
                                <Badge className={getPriorityColor(escalation.priority)}>
                                  {escalation.priority.toUpperCase()}
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  asChild
                                >
                                  <Link href={`/ai-assistant?email=${escalation.id}`}>
                                    <ExternalLink className="h-4 w-4 mr-1" />
                                    Reply in AI Assistant
                                  </Link>
                                </Button>
                              </div>
                              <p className="text-sm font-medium text-gray-900 mb-1">
                                {escalation.subject}
                              </p>
                              <p className="text-xs text-gray-600 mb-2">
                                {escalation.customerEmail}
                              </p>
                              <p className="text-xs text-gray-500">
                                {escalation.reason}
                              </p>
                              <p className="text-xs text-gray-400 mt-2">
                                {new Date(escalation.createdAt).toLocaleString()}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Activity Log */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      Activity Log
                    </CardTitle>
                    <CardDescription>Real-time ticket processing activity</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="max-h-96 overflow-y-auto">
                      {activityLoading ? (
                        <div className="p-4 text-center text-gray-500">Loading...</div>
                      ) : activityLog.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">No recent activity</div>
                      ) : (
                        <div className="space-y-3 p-4">
                          {activityLog.slice(0, 10).map((entry: ActivityLogEntry) => (
                            <div key={entry.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                              <div className="flex-shrink-0 mt-1">
                                {getActionIcon(entry.executedBy)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant={entry.executedBy === 'ai' ? 'default' : 'secondary'}>
                                    {entry.executedBy === 'ai' ? 'AI' : 'Human'}
                                  </Badge>
                                  <Badge variant={entry.status === 'completed' ? 'default' : 'destructive'}>
                                    {entry.status}
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-900">{entry.details}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {entry.customerEmail} • {new Date(entry.createdAt).toLocaleTimeString()}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}