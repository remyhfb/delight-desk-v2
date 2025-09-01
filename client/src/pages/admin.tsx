import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Sidebar from "@/components/layout/sidebar";
import TopBar from "@/components/layout/topbar";
import { Search, Users, Mail, Bot, ShoppingBag, Activity, Calendar, ChevronLeft, RefreshCw, Plus, AlertTriangle, Clock, DollarSign, TrendingUp, TrendingDown, Store, Zap, Download, Edit, Trash2, Send, FileText, UserCheck, TestTube, BarChart3, Settings, Check, X, ChevronUp, ChevronDown, Upload, Brain } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format, subDays, startOfDay } from "date-fns";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";

// System Emails interfaces and component
interface SystemEmail {
  id: string;
  name: string;
  description: string;
  templateFile: string;
  enabled: boolean;
  trigger: {
    type: 'schedule' | 'event' | 'condition';
    description: string;
    timing: string;
  };
  targeting: {
    audience: string;
    conditions: string[];
  };
  stats: {
    totalSent: number;
    sentToday: number;
    sentThisWeek: number;
    sentThisMonth: number;
    lastSent: string | null;
    successRate: number;
  };
  category: 'trial' | 'onboarding' | 'reports' | 'system';
  createdAt: string;
  updatedAt: string;
}

interface SystemEmailStats {
  totalEmails: number;
  enabledEmails: number;
  totalSentToday: number;
  totalSentThisWeek: number;
  totalSentThisMonth: number;
  averageSuccessRate: number;
}

// SendGrid Email Logs interfaces and component
interface SendGridEmailLog {
  id: string;
  userId: string | null;
  messageId: string | null;
  fromEmail: string;
  fromName: string | null;
  toEmail: string;
  toName: string | null;
  subject: string;
  htmlContent: string | null;
  textContent: string | null;
  emailType: string;
  status: 'sent' | 'failed';
  sendgridResponse: any;
  errorMessage: string | null;
  deliveryStatus: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  unsubscribedAt: string | null;
  spamReportedAt: string | null;
  metadata: any;
  sentAt: string;
  createdAt: string;
}

interface SendGridEmailStats {
  totalEmails: number;
  successfulSends: number;
  failedSends: number;
  deliveredEmails: number;
  openedEmails: number;
  clickedEmails: number;
  spamReports: number;
  unsubscribes: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  emailTypeBreakdown: Record<string, number>;
}


function SystemEmailsTab() {
  const queryClient = useQueryClient();
  
  const { data: systemEmailsData, isLoading: systemEmailsLoading } = useQuery({
    queryKey: ['/api/admin/system-emails'],
    refetchInterval: 30000,
  });

  const { data: systemEmailStatsData, isLoading: systemEmailStatsLoading } = useQuery({
    queryKey: ['/api/admin/system-emails/stats'],
    refetchInterval: 30000,
  });

  const toggleEmailMutation = useMutation({
    mutationFn: async ({ emailId, enabled }: { emailId: string; enabled: boolean }) => {
      return fetch(`/api/admin/system-emails/${emailId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/system-emails'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/system-emails/stats'] });
    },
  });

  const testEmailMutation = useMutation({
    mutationFn: async (emailId: string) => {
      const response = await fetch(`/api/admin/system-emails/${emailId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        throw new Error(`Test email failed: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: (data, emailId) => {
      // Refresh statistics to show updated send counts
      queryClient.invalidateQueries({ queryKey: ['/api/admin/system-emails'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/system-emails/stats'] });
      
      console.log('Test email sent successfully:', data);
    },
    onError: (error) => {
      console.error('Failed to send test email:', error);
    },
  });

  const emails: SystemEmail[] = (systemEmailsData as SystemEmail[]) || [];
  const stats: SystemEmailStats = (systemEmailStatsData as SystemEmailStats) || {
    totalEmails: 0,
    enabledEmails: 0,
    totalSentToday: 0,
    totalSentThisWeek: 0,
    totalSentThisMonth: 0,
    averageSuccessRate: 0,
  };

  const handleToggleEmail = async (emailId: string, enabled: boolean) => {
    try {
      await toggleEmailMutation.mutateAsync({ emailId, enabled });
    } catch (error) {
      console.error('Failed to toggle email:', error);
    }
  };

  const handleTestEmail = async (emailId: string) => {
    try {
      await testEmailMutation.mutateAsync(emailId);
    } catch (error) {
      console.error('Failed to send test email:', error);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'trial':
        return <Clock className="h-4 w-4" />;
      case 'onboarding':
        return <Users className="h-4 w-4" />;
      case 'reports':
        return <BarChart3 className="h-4 w-4" />;
      case 'system':
        return <Settings className="h-4 w-4" />;
      default:
        return <Mail className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'trial':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'onboarding':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'reports':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'system':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const emailsByCategory = emails.reduce((acc, email) => {
    if (!acc[email.category]) {
      acc[email.category] = [];
    }
    acc[email.category].push(email);
    return acc;
  }, {} as Record<string, SystemEmail[]>);

  if (systemEmailsLoading || systemEmailStatsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                </CardTitle>
                <div className="h-4 w-4 bg-gray-200 rounded animate-pulse"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded animate-pulse mb-2"></div>
                <div className="h-3 bg-gray-200 rounded animate-pulse"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Emails</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEmails}</div>
            <p className="text-xs text-muted-foreground">
              {stats.enabledEmails} enabled
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sent Today</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSentToday}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalSentThisWeek} this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSentThisMonth}</div>
            <p className="text-xs text-muted-foreground">
              Total emails sent
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.enabledEmails}</div>
            <p className="text-xs text-muted-foreground">
              Out of {stats.totalEmails} total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Email Management */}
      <Card>
        <CardHeader>
          <CardTitle>Email Campaigns</CardTitle>
          <CardDescription>
            Configure and monitor automated email campaigns by category
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {emails.map((email) => (
              <div key={email.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(email.category)}
                      <h3 className="font-medium">{email.name}</h3>
                      <Badge className={getCategoryColor(email.category)}>
                        {email.category}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{email.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={email.enabled}
                      onCheckedChange={(enabled) => handleToggleEmail(email.id, enabled)}
                      disabled={toggleEmailMutation.isPending}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestEmail(email.id)}
                      disabled={!email.enabled || testEmailMutation.isPending}
                    >
                      Test
                    </Button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total Sent:</span>
                    <div className="font-medium">{email.stats.totalSent.toLocaleString()}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">This Week:</span>
                    <div className="font-medium">{email.stats.sentThisWeek.toLocaleString()}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last Sent:</span>
                    <div className="font-medium">{formatDate(email.stats.lastSent)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Trigger:</span>
                    <div className="font-medium">{email.trigger.type}</div>
                  </div>
                </div>
                
                <div className="text-xs text-muted-foreground">
                  <strong>Timing:</strong> {email.trigger.timing} • <strong>Audience:</strong> {email.targeting.audience}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SendGridEmailLogsTab() {
  const [timeframe, setTimeframe] = useState('30d');
  const [emailType, setEmailType] = useState('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);

  const { data: sendgridLogsData, isLoading: sendgridLogsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ['/api/admin/sendgrid-email-logs', { timeframe, emailType: emailType === 'all' ? undefined : emailType }],
    refetchInterval: 30000,
  });

  const { data: sendgridStatsData, isLoading: sendgridStatsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['/api/admin/sendgrid-email-logs/stats', { timeframe }],
    refetchInterval: 30000,
  });

  const importHistoricalLogs = async () => {
    setIsImporting(true);
    try {
      const response = await apiRequest('POST', '/api/admin/sendgrid-email-logs/import', {
        timeframe: '2d'
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Import successful:', data);
        
        // Refresh the data
        await refetchLogs();
        await refetchStats();
        
        // Show success message
        alert(`Successfully imported ${data.imported} email logs from the last 2 days`);
      } else {
        const error = await response.json();
        console.error('Import failed:', error);
        alert(`Import failed: ${error.message}`);
      }
    } catch (error) {
      console.error('Import error:', error);
      alert('Import failed: Network error');
    } finally {
      setIsImporting(false);
    }
  };

  const logs: SendGridEmailLog[] = Array.isArray((sendgridLogsData as any)?.logs) ? (sendgridLogsData as any).logs : [];
  const stats: SendGridEmailStats = (sendgridStatsData as any)?.stats || {
    totalEmails: 0,
    successfulSends: 0,
    failedSends: 0,
    deliveredEmails: 0,
    openedEmails: 0,
    clickedEmails: 0,
    spamReports: 0,
    unsubscribes: 0,
    deliveryRate: 0,
    openRate: 0,
    clickRate: 0,
    emailTypeBreakdown: {},
  };

  const toggleRowExpansion = (logId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getEmailTypeColor = (emailType: string) => {
    switch (emailType) {
      case 'welcome':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'trial_expiration':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'weekly_report':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'password_reset':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'wismo_embed':
        return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (sendgridLogsLoading || sendgridStatsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                </CardTitle>
                <div className="h-4 w-4 bg-gray-200 rounded animate-pulse"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded animate-pulse mb-2"></div>
                <div className="h-3 bg-gray-200 rounded animate-pulse"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Emails</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEmails}</div>
            <p className="text-xs text-muted-foreground">
              {stats.successfulSends} sent, {stats.failedSends} failed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.deliveryRate}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.deliveredEmails} of {stats.totalEmails} delivered
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.openRate}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.openedEmails} opened
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Click Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.clickRate}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.clickedEmails} clicked
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Issues</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.spamReports + stats.unsubscribes}</div>
            <p className="text-xs text-muted-foreground">
              {stats.spamReports} spam, {stats.unsubscribes} unsubscribes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <div className="flex gap-4 items-center justify-between">
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <Label htmlFor="timeframe">Timeframe:</Label>
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Select timeframe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="emailType">Email Type:</Label>
            <Select value={emailType} onValueChange={setEmailType}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select email type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="welcome">Welcome</SelectItem>
                <SelectItem value="trial_expiration">Trial Expiration</SelectItem>
                <SelectItem value="weekly_report">Weekly Report</SelectItem>
                <SelectItem value="password_reset">Password Reset</SelectItem>
                <SelectItem value="wismo_embed">WISMO Widget</SelectItem>
                <SelectItem value="system_notification">System Notification</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button 
          onClick={importHistoricalLogs}
          disabled={isImporting}
          variant="outline"
          className="flex items-center gap-2"
        >
          {isImporting ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Import Last 2 Days
            </>
          )}
        </Button>
      </div>

      {/* Email Type Breakdown */}
      {Object.keys(stats.emailTypeBreakdown).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Email Type Breakdown</CardTitle>
            <CardDescription>Distribution of emails by type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-5">
              {Object.entries(stats.emailTypeBreakdown).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between p-2 border rounded">
                  <Badge variant="secondary" className={getEmailTypeColor(type)}>
                    {type.replace(/_/g, ' ')}
                  </Badge>
                  <span className="font-bold">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Email Logs</CardTitle>
          <CardDescription>
            Detailed log of all SendGrid email sends ({logs.length} emails)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No email logs found for the selected timeframe and filters.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div key={log.id} className="border rounded-lg">
                  <div
                    className="p-4 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer"
                    onClick={() => toggleRowExpansion(log.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge className={getStatusColor(log.status)}>
                          {log.status}
                        </Badge>
                        <Badge variant="outline" className={getEmailTypeColor(log.emailType)}>
                          {log.emailType.replace(/_/g, ' ')}
                        </Badge>
                        <div>
                          <div className="font-medium">{log.subject}</div>
                          <div className="text-sm text-gray-500">
                            To: {log.toEmail} • From: {log.fromEmail}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-sm text-gray-500 text-right">
                          <div>{formatDate(log.sentAt)}</div>
                          {log.messageId && (
                            <div className="text-xs">ID: {log.messageId.substring(0, 12)}...</div>
                          )}
                        </div>
                        {expandedRows.has(log.id) ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                    </div>
                  </div>

                  {expandedRows.has(log.id) && (
                    <div className="border-t px-4 py-3 bg-gray-50 dark:bg-gray-900">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <h4 className="font-medium mb-2">Email Details</h4>
                          <div className="space-y-1 text-sm">
                            <div><strong>Message ID:</strong> {log.messageId || 'N/A'}</div>
                            <div><strong>From Name:</strong> {log.fromName || 'N/A'}</div>
                            <div><strong>To Name:</strong> {log.toName || 'N/A'}</div>
                            <div><strong>User ID:</strong> {log.userId || 'System'}</div>
                            {log.errorMessage && (
                              <div><strong>Error:</strong> <span className="text-red-600">{log.errorMessage}</span></div>
                            )}
                          </div>
                        </div>

                        <div>
                          <h4 className="font-medium mb-2">Engagement</h4>
                          <div className="space-y-1 text-sm">
                            <div><strong>Delivery Status:</strong> {log.deliveryStatus || 'Unknown'}</div>
                            <div><strong>Opened:</strong> {log.openedAt ? formatDate(log.openedAt) : 'Not opened'}</div>
                            <div><strong>Clicked:</strong> {log.clickedAt ? formatDate(log.clickedAt) : 'No clicks'}</div>
                            {log.unsubscribedAt && (
                              <div><strong>Unsubscribed:</strong> <span className="text-orange-600">{formatDate(log.unsubscribedAt)}</span></div>
                            )}
                            {log.spamReportedAt && (
                              <div><strong>Spam Reported:</strong> <span className="text-red-600">{formatDate(log.spamReportedAt)}</span></div>
                            )}
                          </div>
                        </div>
                      </div>

                      {log.htmlContent && (
                        <div className="mt-4">
                          <h4 className="font-medium mb-2">Email Content Preview</h4>
                          <div className="text-sm bg-white dark:bg-gray-800 border rounded p-3 max-h-40 overflow-y-auto">
                            <div dangerouslySetInnerHTML={{ __html: log.htmlContent.substring(0, 500) + (log.htmlContent.length > 500 ? '...' : '') }} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface AdminUser {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  createdAt: string;
  lastLogin?: string;
  isActive: boolean;
  profile?: {
    displayName?: string;
    name?: string;
  };
  subscription?: {
    plan: string;
    status: string;
    trialEndsAt?: string;
    isBetaTester?: boolean;
    betaTesterGrantedAt?: string;
    betaTesterGrantedBy?: string;
    billing?: {
      plan: string;
      status: string;
    };
  };
  usage: {
    emailsProcessed: number;
    automationTriggers: number;
    quickActionsUsed: number;
    escalatedEmails: number;
    pendingEscalations: number;
    lastActivity?: string;
  };
  integrations: {
    emailProvider?: 'gmail' | 'outlook';
    storeType?: 'woocommerce' | 'shopify';
    storeDomain?: string;
  };
  automations: Array<{
    id: string;
    name: string;
    classification: string;
    triggerCount: number;
    isActive: boolean;
  }>;
  loginHistory: Array<{
    timestamp: string;
    ipAddress?: string;
    userAgent?: string;
  }>;
}

interface SystemAnalytics {
  dateRange: string;
  totalUsers: number;
  activeUsers: number;
  totalStores: number;
  woocommerceStores: number;
  shopifyStores: number;
  totalRevenue: number;
  weeklyLoginAverage: number;
  emailsProcessed: number;
  automationTriggers: number;
  quickActionsUsed: number;
  escalatedEmails: number;
  pendingEscalations: number;
  
  profitMetrics: {
    totalRevenue: number;
    totalCosts: number;
    grossProfit: number;
    profitMargin: number;
    costBreakdown: {
      aftershipCosts: number;
      sendgridCosts: number;
      infrastructureCosts: number;
    };
    averageRevenuePerUser: number;
    averageCostPerUser: number;
    averageProfitPerUser: number;
    monthlyProjections: {
      estimatedRevenue: number;
      estimatedCosts: number;
      estimatedProfit: number;
      profitGrowthRate: number;
    };
  };
  
  revenueData: Array<{
    date: string;
    revenue: number;
  }>;
  
  trialFunnelMetrics: {
    trialEngagementScore: number;
    averageDaysToConvert: number;
    revenuePerTrialUser: number;
    planConversions: {
      starter: { rate: number; totalTrials: number; conversions: number; };
      growth: { rate: number; totalTrials: number; conversions: number; };
      scale: { rate: number; totalTrials: number; conversions: number; };
    };
    clvByPlan: {
      starter: { clv: number; retentionMonths: number; };
      growth: { clv: number; retentionMonths: number; };
      scale: { clv: number; retentionMonths: number; };
    };
  };
  
  retentionMetrics?: {
    monthlyRetention: number;
    churnRate: number;
    monthlyChurnRate: number;
    lifetimeValue: number;
    engagementScore: number;
    supportTickets: number;
    userSatisfaction: number;
    avgTimeToValue: number;
    automationAdoptionRate: number;
    integrationAdoptionRate: number;
    netRevenueRetention: number;
    clvByPlan: {
      starter: { clv: number; retentionMonths: number; };
      growth: { clv: number; retentionMonths: number; };
      scale: { clv: number; retentionMonths: number; };
    };
  };
  trialMetrics: {
    totalFreeTrials: number;
    freeTrialConversions: number;
    conversionRate: number;
    trialEngagementScore: number;
    averageDaysToConvert: number;
    revenuePerTrialUser: number;
    tierConversions: {
      starter: number;
      growth: number;
      scale: number;
    };
    tierTrials: {
      starter: number;
      growth: number;
      scale: number;
    };
    tierConversionRates: {
      starter: number;
      growth: number;
      scale: number;
    };
    customerLifetimeValue: {
      starter: number;
      growth: number;
      scale: number;
    };
  };
  revenueByPeriod: Array<{
    period: string;
    revenue: number;
  }>;
}

interface OnboardingEmail {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  delayHours: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const onboardingEmailSchema = z.object({
  name: z.string().min(1, "Name is required"),
  subject: z.string().min(1, "Subject is required"),
  htmlContent: z.string().min(1, "Content is required"),
  delayHours: z.number().min(0, "Delay must be 0 or more hours"),
  isActive: z.boolean().default(true),
});

type OnboardingEmailForm = z.infer<typeof onboardingEmailSchema>;

// Weekly Reports Stats Component with real data
function WeeklyReportsStatsContent() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['/api/admin/weekly-reports/stats'],
    queryFn: async () => {
      const response = await fetch('/api/admin/weekly-reports/stats', {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch weekly report stats');
      }
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="text-center">
            <div className="h-8 bg-gray-200 rounded animate-pulse mb-2"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse mb-1"></div>
            <div className="h-3 bg-gray-200 rounded animate-pulse"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No weekly report statistics available</p>
        <p className="text-sm text-gray-400 mt-1">Reports will appear here once the system starts generating them</p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="text-3xl font-bold text-blue-600">{stats.totalSent}</div>
      <div className="text-lg text-gray-600 mt-2">Weekly Reports Sent</div>
      <div className="text-sm text-gray-500 mt-1">Via SendGrid to Delight Desk customers</div>
      
      {stats.totalSent === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4">
          <p className="text-gray-600">No weekly reports have been sent yet</p>
          <p className="text-sm text-gray-500 mt-1">Reports will appear here once the system starts sending on Monday mornings</p>
        </div>
      )}
    </div>
  );
}

// OnboardingEmailManager Component
function OnboardingEmailManager() {
  const [editingEmail, setEditingEmail] = useState<OnboardingEmail | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: emails, isLoading } = useQuery({
    queryKey: ['/api/admin/onboarding-emails'],
    queryFn: () => fetch('/api/admin/onboarding-emails').then(res => res.json()),
  });

  const { data: stats } = useQuery({
    queryKey: ['/api/admin/onboarding-email-stats'],
    queryFn: () => fetch('/api/admin/onboarding-email-stats').then(res => res.json()),
  });

  const form = useForm<OnboardingEmailForm>({
    resolver: zodResolver(onboardingEmailSchema),
    defaultValues: {
      name: "",
      subject: "",
      htmlContent: "",
      delayHours: 0,
      isActive: true,
    },
  });

  const createEmailMutation = useMutation({
    mutationFn: (data: OnboardingEmailForm) =>
      apiRequest("POST", "/api/admin/onboarding-emails", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/onboarding-emails'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/onboarding-email-stats'] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Onboarding email created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create onboarding email",
        variant: "destructive",
      });
    },
  });

  const updateEmailMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<OnboardingEmail> }) =>
      apiRequest("PUT", `/api/admin/onboarding-emails/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/onboarding-emails'] });
      setEditingEmail(null);
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Onboarding email updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update onboarding email",
        variant: "destructive",
      });
    },
  });

  const deleteEmailMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/admin/onboarding-emails/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/onboarding-emails'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/onboarding-email-stats'] });
      toast({
        title: "Success",
        description: "Onboarding email deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete onboarding email",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (email: OnboardingEmail) => {
    setEditingEmail(email);
    form.reset({
      name: email.name,
      subject: email.subject,
      htmlContent: email.htmlContent,
      delayHours: email.delayHours,
      isActive: email.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (data: OnboardingEmailForm) => {
    if (editingEmail) {
      updateEmailMutation.mutate({ id: editingEmail.id, data });
    } else {
      createEmailMutation.mutate(data);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this onboarding email?")) {
      deleteEmailMutation.mutate(id);
    }
  };

  const formatDelayHours = (hours: number) => {
    if (hours === 0) return "Immediately";
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''}`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Onboarding Email Campaign</h2>
          <p className="text-gray-600">Manage the automated drip campaign for new users</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingEmail(null);
            form.reset();
          }
        }}>
          <DialogTrigger asChild>
            <Button className="w-full lg:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Email
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingEmail ? "Edit Onboarding Email" : "Create Onboarding Email"}
              </DialogTitle>
              <DialogDescription>
                Configure an email for the onboarding sequence. Emails are sent based on delay hours after user signup.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Welcome Email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject Line</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Welcome to Delight Desk! 🎉" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="delayHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Send Delay</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          placeholder="0" 
                        />
                      </FormControl>
                      <FormDescription>
                        Hours after signup to send this email (0 = immediately)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="htmlContent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Content</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          rows={8}
                          placeholder="Welcome to Delight Desk!..."
                        />
                      </FormControl>
                      <FormDescription>
                        Use HTML for formatting (optional)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Active</FormLabel>
                        <FormDescription>
                          Email will be sent as part of the drip campaign
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createEmailMutation.isPending || updateEmailMutation.isPending}>
                    {createEmailMutation.isPending || updateEmailMutation.isPending ? "Saving..." : "Save Email"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Total Sent</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalSent.toLocaleString()}</p>
                </div>
                <Send className="h-6 w-6 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Sent Today</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.sentToday.toLocaleString()}</p>
                </div>
                <Calendar className="h-6 w-6 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Active Emails</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {emails?.filter((e: OnboardingEmail) => e.isActive).length || 0}
                  </p>
                </div>
                <Mail className="h-6 w-6 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Email Campaign List */}
      <Card>
        <CardHeader>
          <CardTitle>Email Campaign Sequence</CardTitle>
          <CardDescription>
            Configure the automated email sequence for new users
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : emails?.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p>No onboarding emails configured yet</p>
              <p className="text-sm">Create your first email to start engaging new users</p>
            </div>
          ) : (
            <div className="space-y-3">
              {emails?.sort((a: OnboardingEmail, b: OnboardingEmail) => a.delayHours - b.delayHours)
                .map((email: OnboardingEmail) => (
                <div key={email.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium">{email.subject}</h3>
                      <Badge variant={email.isActive ? "default" : "secondary"}>
                        {email.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="outline">
                        {formatDelayHours(email.delayHours)}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {email.htmlContent ? email.htmlContent.replace(/<[^>]*>/g, '').substring(0, 150) : email.name}...
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(email)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(email.id)}
                      disabled={deleteEmailMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Manual Rejections Analytics Component
function ManualRejectionsAnalytics() {
  const [timeframe, setTimeframe] = useState('30d');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  
  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ['/api/admin/manual-rejection-analytics', timeframe],
    queryFn: () => fetch(`/api/admin/manual-rejection-analytics?timeframe=${timeframe}`).then(res => res.json()),
    refetchInterval: 30000,
  });

  const toggleRowExpansion = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Manual Rejection Analytics</h2>
          <p className="text-gray-600">Track why users reject automated responses in the approval queue</p>
        </div>
        <div className="flex gap-3">
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : analyticsData ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Total Rejections</p>
                    <p className="text-2xl font-bold text-gray-900">{analyticsData.totalRejections}</p>
                  </div>
                  <TrendingDown className="h-8 w-8 text-red-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Top Reason</p>
                    <p className="text-lg font-bold text-gray-900">
                      {analyticsData.topRejectionReasons?.[0]?.reason || 'N/A'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {analyticsData.topRejectionReasons?.[0]?.count || 0} occurrences
                    </p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Most Problematic</p>
                    <p className="text-lg font-bold text-gray-900">
                      {Object.entries(analyticsData.classificationCounts || {})
                        .sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0] || 'N/A'}
                    </p>
                    <p className="text-xs text-gray-500">Email type</p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Rejection Reasons */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Top Rejection Reasons</CardTitle>
              <CardDescription>Why users are rejecting automated responses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData.topRejectionReasons?.map((reason: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{index + 1}</Badge>
                      <div>
                        <p className="font-medium text-gray-900">{reason.reason}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">{reason.count}</p>
                      <p className="text-xs text-gray-500">rejections</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Rejections */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Rejections</CardTitle>
              <CardDescription>Latest manual rejections from the approval queue - click to view details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData.recentRejections?.map((rejection: any) => (
                  <div key={rejection.id} className="border rounded-lg">
                    <div 
                      className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      onClick={() => toggleRowExpansion(rejection.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="text-xs text-gray-500 min-w-[80px]">
                            {new Date(rejection.createdAt).toLocaleDateString()}
                          </div>
                          <Badge variant="secondary">{rejection.emailClassification}</Badge>
                          <Badge variant="outline" className="max-w-[200px] truncate">
                            {rejection.rejectionReason}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm max-w-[300px] truncate">
                            {rejection.originalSubject}
                          </span>
                          {expandedRows.has(rejection.id) ? (
                            <ChevronUp className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {expandedRows.has(rejection.id) && (
                      <div className="px-4 pb-4 border-t bg-gray-50 dark:bg-gray-800/50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                          <div>
                            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Original Email
                            </Label>
                            <div className="mt-2 p-3 bg-white dark:bg-gray-900 border rounded-md">
                              <div className="text-sm font-medium mb-2">Subject: {rejection.originalSubject}</div>
                              <div className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                                {rejection.originalBody || 'Email body not available'}
                              </div>
                            </div>
                          </div>
                          
                          <div>
                            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Automated Response (Rejected)
                            </Label>
                            <div className="mt-2 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md">
                              <div className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                                {rejection.automatedResponse}
                              </div>
                            </div>
                            
                            <div className="mt-3">
                              <Label className="text-sm font-medium text-red-700 dark:text-red-400">
                                Rejection Reason
                              </Label>
                              <div className="mt-1 text-sm text-red-600 dark:text-red-400">
                                {rejection.rejectionReason}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="p-6">
            <p className="text-gray-500">No rejection data available for the selected timeframe.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function Admin() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [analyticsDateRange, setAnalyticsDateRange] = useState("7");
  const [revenueGroupBy, setRevenueGroupBy] = useState("week");
  const [analyticsTab, setAnalyticsTab] = useState("overview");
  
  // Order status email test form state
  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Export analytics data to CSV
  const handleExportAnalytics = async () => {
    try {
      const response = await fetch(`/api/admin/analytics/export/${analyticsDateRange}/${revenueGroupBy}`);
      
      if (!response.ok) {
        throw new Error('Failed to export analytics data');
      }
      
      // Get the filename from the response headers
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') 
        : `analytics-export-${new Date().toISOString().split('T')[0]}.csv`;
      
      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export Successful",
        description: "Analytics data has been downloaded as CSV file.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export analytics data. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Impersonation mutation
  const impersonateMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Get current user info to use as admin
      const authResponse = await fetch('/api/auth/me', { credentials: 'include' });
      if (!authResponse.ok) throw new Error('Must be logged in as admin');
      const currentUser = await authResponse.json();
      
      const response = await fetch(`/api/admin/impersonate/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminUserId: currentUser.id })
      });
      if (!response.ok) throw new Error('Failed to start impersonation');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Impersonation Started",
        description: `Now viewing as ${data.targetUser.username}`,
      });
      // Redirect to dashboard as the user
      window.location.href = '/dashboard';
    },
    onError: (error) => {
      toast({
        title: "Impersonation Failed",
        description: error instanceof Error ? error.message : "Failed to start impersonation",
        variant: "destructive",
      });
    }
  });

  const handleImpersonateUser = (userId: string) => {
    impersonateMutation.mutate(userId);
  };

  // Beta tester management mutations
  const grantBetaTesterMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch('/api/admin/grant-beta-tester', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, adminUserId: "ceb72e63-02e7-4f82-9d8e-59b4e8b6e0f0" }) // Remy's admin ID for MVP
      });
      if (!response.ok) throw new Error('Failed to grant beta tester access');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users', selectedUser] });
      toast({ title: "Success", description: "Beta tester access granted successfully" });
    },
    onError: (error) => {
      toast({
        title: "Failed to Grant Beta Access",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  });

  const revokeBetaTesterMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch('/api/admin/revoke-beta-tester', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, adminUserId: "ceb72e63-02e7-4f82-9d8e-59b4e8b6e0f0" }) // Remy's admin ID for MVP
      });
      if (!response.ok) throw new Error('Failed to revoke beta tester access');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users', selectedUser] });
      toast({ title: "Success", description: "Beta tester access revoked successfully" });
    },
    onError: (error) => {
      toast({
        title: "Failed to Revoke Beta Access",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  });

  const demoUserMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/create-demo-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to create demo user');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: "Demo User Created",
        description: `Created demo user: ${data.user.email}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to Create Demo User",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  });

  // Order Status Email Test mutation
  const testOrderEmailMutation = useMutation({
    mutationFn: async (searchTerm: string) => {
      const response = await apiRequest('POST', '/api/admin/order-emails/test', { searchTerm });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Test Email Sent",
        description: "Order status test email sent to remy@delightdesk.io successfully",
      });
      // Reset form
      setOrderSearchTerm('');
    },
    onError: (error) => {
      toast({
        title: "Failed to Send Test Email",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });

  // Delete User mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to delete user');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setSelectedUser(''); // Clear selected user
      toast({
        title: "User Deleted",
        description: "User account and all associated data have been permanently deleted",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to Delete User",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  });

  const createDemoUser = () => {
    demoUserMutation.mutate();
  };

  const handleGrantBetaTester = (userId: string) => {
    grantBetaTesterMutation.mutate(userId);
  };

  const handleRevokeBetaTester = (userId: string) => {
    revokeBetaTesterMutation.mutate(userId);
  };

  const handleDeleteUser = (userId: string) => {
    deleteUserMutation.mutate(userId);
  };

  const handleSendTestOrderEmail = () => {
    if (!orderSearchTerm.trim()) {
      toast({
        title: "Missing Order Information",
        description: "Please enter an order number or customer email.",
        variant: "destructive",
      });
      return;
    }
    testOrderEmailMutation.mutate(orderSearchTerm.trim());
  };

  // Fetch all users
  const { data: users = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ['/api/admin/users'],
    refetchInterval: 30000,
  });

  // Fetch system analytics
  const { data: analytics, isLoading: analyticsLoading } = useQuery<SystemAnalytics>({
    queryKey: ['/api/admin/analytics', analyticsDateRange, revenueGroupBy],
    refetchInterval: 60000, // Refresh every minute
  });



  // Fetch selected user details
  const { data: userDetails } = useQuery<AdminUser>({
    queryKey: ['/api/admin/users', selectedUser],
    enabled: !!selectedUser,
  });

  // Filter users based on search
  const filteredUsers = users.filter((user: AdminUser) =>
    (user.username?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (user.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const getClassificationBadgeVariant = (classification: string) => {
    switch (classification) {
      case 'promo_refund': return 'destructive';
      case 'order_status': return 'default';
      case 'return_request': return 'secondary';
      case 'shipping_info': return 'outline';
      default: return 'secondary';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy HH:mm');
    } catch {
      return 'Never';
    }
  };



  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="lg:pl-64 flex flex-col flex-1">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">Admin Panel</h1>
                  <p className="text-gray-600">Manage users and view system analytics</p>
                </div>
              </div>

            <Tabs defaultValue="analytics" className="w-full">
              <TabsList className="grid w-full grid-cols-10">
                <TabsTrigger value="analytics" className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Analytics
                </TabsTrigger>
                <TabsTrigger value="manual-rejections" className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Rejections
                </TabsTrigger>
                <TabsTrigger value="sentiment-analysis" className="flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  Sentiment
                </TabsTrigger>
                <TabsTrigger value="system-emails" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  System Emails
                </TabsTrigger>
                <TabsTrigger value="sendgrid-logs" className="flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Email Logs
                </TabsTrigger>
                <TabsTrigger value="onboarding" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Onboarding
                </TabsTrigger>
                <TabsTrigger value="reports" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Reports
                </TabsTrigger>
                <TabsTrigger value="order-emails" className="flex items-center gap-2">
                  <TestTube className="h-4 w-4" />
                  Tests
                </TabsTrigger>
                <TabsTrigger value="users" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Users
                </TabsTrigger>
              </TabsList>

              <TabsContent value="analytics" className="space-y-6">
                {/* System Analytics Section */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">System Analytics</h2>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Select value={analyticsDateRange} onValueChange={setAnalyticsDateRange}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Date Range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Today</SelectItem>
                        <SelectItem value="7">Last 7 Days</SelectItem>
                        <SelectItem value="30">Last 30 Days</SelectItem>
                        <SelectItem value="180">Last 180 Days</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={revenueGroupBy} onValueChange={setRevenueGroupBy}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Revenue Grouping" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">By Day</SelectItem>
                        <SelectItem value="week">By Week</SelectItem>
                        <SelectItem value="month">By Month</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleExportAnalytics}
                      variant="outline"
                      className="w-full sm:w-auto"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
                  </div>
                </div>

                {/* Analytics Sub-Navigation */}
                <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={analyticsTab === 'overview' ? 'default' : 'ghost'}
                      onClick={() => setAnalyticsTab('overview')}
                      size="sm"
                    >
                      Overview
                    </Button>
                    <Button
                      variant={analyticsTab === 'profit' ? 'default' : 'ghost'}
                      onClick={() => setAnalyticsTab('profit')}
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      Profit Analytics
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700">NEW</Badge>
                    </Button>
                    <Button
                      variant={analyticsTab === 'trials' ? 'default' : 'ghost'}
                      onClick={() => setAnalyticsTab('trials')}
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      Trial Funnel
                      <Badge variant="secondary" className="text-xs">BETA</Badge>
                    </Button>
                    <Button
                      variant={analyticsTab === 'lifecycle' ? 'default' : 'ghost'}
                      onClick={() => setAnalyticsTab('lifecycle')}
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      Lifecycle
                      <Badge variant="secondary" className="text-xs">BETA</Badge>
                    </Button>
                  </div>
                </div>

                {/* Analytics Content Based on Selected Tab */}
                {analyticsTab === 'overview' && (
                  <div className="space-y-6">
                    {analyticsLoading ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        {[...Array(8)].map((_, i) => (
                          <Card key={i}>
                            <CardContent className="p-6">
                              <div className="animate-pulse">
                                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : analytics ? (
                <>
                  {/* Core Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600 mb-1">Total Users</p>
                            <p className="text-2xl font-bold text-gray-900">{analytics.totalUsers}</p>
                            <p className="text-xs text-gray-500">{analytics.activeUsers} active</p>
                          </div>
                          <Users className="h-8 w-8 text-blue-600" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600 mb-1">Total Stores</p>
                            <p className="text-2xl font-bold text-gray-900">{analytics.totalStores}</p>
                            <p className="text-xs text-gray-500">
                              {analytics.woocommerceStores} WooCommerce, {analytics.shopifyStores} Shopify
                            </p>
                          </div>
                          <Store className="h-8 w-8 text-green-600" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600 mb-1">Total Revenue</p>
                            <p className="text-2xl font-bold text-gray-900">${analytics.totalRevenue.toLocaleString()}</p>
                            <p className="text-xs text-gray-500">Last {analyticsDateRange} days</p>
                          </div>
                          <DollarSign className="h-8 w-8 text-green-600" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600 mb-1">Avg Weekly Logins</p>
                            <p className="text-2xl font-bold text-gray-900">{analytics.weeklyLoginAverage?.toFixed(1) || '0.0'}</p>
                            <p className="text-xs text-gray-500">per user</p>
                          </div>
                          <TrendingUp className="h-8 w-8 text-purple-600" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>



                  {/* Activity Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600 mb-1">Emails Processed</p>
                            <p className="text-2xl font-bold text-gray-900">{analytics.emailsProcessed?.toLocaleString() || '0'}</p>
                          </div>
                          <Mail className="h-6 w-6 text-blue-600" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600 mb-1">Automation Triggers</p>
                            <p className="text-2xl font-bold text-gray-900">{analytics.automationTriggers?.toLocaleString() || '0'}</p>
                          </div>
                          <Bot className="h-6 w-6 text-green-600" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600 mb-1">Quick Actions</p>
                            <p className="text-2xl font-bold text-gray-900">{analytics.quickActionsUsed?.toLocaleString() || '0'}</p>
                          </div>
                          <Zap className="h-6 w-6 text-yellow-600" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600 mb-1">Escalated Emails</p>
                            <p className="text-2xl font-bold text-gray-900">{analytics.escalatedEmails?.toLocaleString() || '0'}</p>
                          </div>
                          <AlertTriangle className="h-6 w-6 text-orange-600" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600 mb-1">Pending Escalations</p>
                            <p className="text-2xl font-bold text-gray-900">{analytics.pendingEscalations?.toLocaleString() || '0'}</p>
                          </div>
                          <Clock className="h-6 w-6 text-red-600" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Revenue Chart */}
                  {analytics.revenueData?.length > 0 && (
                    <Card className="mb-6">
                      <CardHeader>
                        <CardTitle>Revenue Trend ({revenueGroupBy})</CardTitle>
                        <CardDescription>Revenue breakdown over the selected period</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                          {analytics.revenueData?.map((period, index) => (
                            <div key={index} className="text-center p-3 bg-gray-50 rounded-lg">
                              <p className="text-xs text-gray-600 mb-1">{period.date}</p>
                              <p className="text-lg font-semibold text-gray-900">${period.revenue?.toLocaleString() || 0}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    Failed to load analytics data
                  </div>
                )}
                  </div>
                )}

                {analyticsTab === 'profit' && (
                  <div className="space-y-6">
                    {analyticsLoading ? (
                      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                        {[...Array(4)].map((_, i) => (
                          <Card key={i}>
                            <CardContent className="p-6">
                              <div className="animate-pulse">
                                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : analytics?.profitMetrics ? (
                      <>
                        {/* Profit Analytics Overview */}
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                          <Card>
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-600">Gross Profit</p>
                              <p className="text-2xl font-bold text-green-600">
                                ${analytics.profitMetrics?.grossProfit?.toLocaleString() || '0'}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {analytics.profitMetrics?.profitMargin || 0}% margin
                              </p>
                            </div>
                            <div className="h-6 w-6 bg-green-100 rounded-full flex items-center justify-center">
                              <TrendingUp className="h-3 w-3 text-green-600" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-600">AfterShip Costs</p>
                              <p className="text-2xl font-bold text-orange-600">
                                ${analytics.profitMetrics?.costBreakdown?.aftershipCosts?.toLocaleString() || '0'}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {((analytics.profitMetrics?.costBreakdown?.aftershipCosts || 0) / (analytics.profitMetrics?.totalRevenue || 1) * 100).toFixed(1)}% of revenue
                              </p>
                            </div>
                            <div className="h-6 w-6 bg-orange-100 rounded-full flex items-center justify-center">
                              <AlertTriangle className="h-3 w-3 text-orange-600" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-600">Profit Per User</p>
                              <p className="text-2xl font-bold text-blue-600">
                                ${analytics.profitMetrics?.averageProfitPerUser?.toFixed(2) || '0'}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                After all costs
                              </p>
                            </div>
                            <div className="h-6 w-6 bg-blue-100 rounded-full flex items-center justify-center">
                              <Users className="h-3 w-3 text-blue-600" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-600">Monthly Projection</p>
                              <p className="text-2xl font-bold text-purple-600">
                                ${analytics.profitMetrics?.monthlyProjections?.estimatedProfit?.toLocaleString() || '0'}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {analytics.profitMetrics?.monthlyProjections?.profitGrowthRate || 0}% growth
                              </p>
                            </div>
                            <div className="h-6 w-6 bg-purple-100 rounded-full flex items-center justify-center">
                              <Calendar className="h-3 w-3 text-purple-600" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                        </div>

                        {/* Cost Breakdown Chart */}
                        <div className="grid gap-6 md:grid-cols-2">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg font-semibold">Cost Breakdown</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">AfterShip API</span>
                              <span className="text-sm font-medium">${analytics.profitMetrics?.costBreakdown?.aftershipCosts?.toLocaleString() || '0'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">SendGrid Email</span>
                              <span className="text-sm font-medium">${analytics.profitMetrics?.costBreakdown?.sendgridCosts?.toLocaleString() || '0'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">Infrastructure</span>
                              <span className="text-sm font-medium">${analytics.profitMetrics?.costBreakdown?.infrastructureCosts?.toLocaleString() || '0'}</span>
                            </div>
                            <div className="border-t pt-2 mt-2">
                              <div className="flex items-center justify-between font-medium">
                                <span>Total Costs</span>
                                <span>${analytics.profitMetrics?.totalCosts?.toLocaleString() || '0'}</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg font-semibold">Business Health</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">Revenue</span>
                              <span className="text-sm font-medium text-green-600">${analytics.profitMetrics?.totalRevenue?.toLocaleString() || '0'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">Total Costs</span>
                              <span className="text-sm font-medium text-red-600">-${analytics.profitMetrics?.totalCosts?.toLocaleString() || '0'}</span>
                            </div>
                            <div className="border-t pt-2 mt-2">
                              <div className="flex items-center justify-between font-medium text-lg">
                                <span>Net Profit</span>
                                <span className="text-green-600">${analytics.profitMetrics?.grossProfit?.toLocaleString() || '0'}</span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                Sustainable business model with {analytics.profitMetrics?.profitMargin || 0}% margins
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-gray-500">No profit metrics data available</p>
                      </div>
                    )}
                  </div>
                )}

                {analyticsTab === 'trials' && (
                  <div className="space-y-6">
                    {analyticsLoading ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        {[...Array(8)].map((_, i) => (
                          <Card key={i}>
                            <CardContent className="p-6">
                              <div className="animate-pulse">
                                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : analytics ? (
                      <>
                        {/* Free Trial & Conversion Metrics */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                          <Card>
                            <CardContent className="p-6">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-gray-600">Total Free Trials</p>
                                  <p className="text-2xl font-bold text-gray-900">{analytics.trialFunnelMetrics?.planConversions?.starter?.totalTrials + analytics.trialFunnelMetrics?.planConversions?.growth?.totalTrials + analytics.trialFunnelMetrics?.planConversions?.scale?.totalTrials || 0}</p>
                                </div>
                                <Users className="h-6 w-6 text-blue-600" />
                              </div>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardContent className="p-6">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-gray-600">Trial Conversions</p>
                                  <p className="text-2xl font-bold text-gray-900">{analytics.trialFunnelMetrics?.planConversions?.starter?.conversions + analytics.trialFunnelMetrics?.planConversions?.growth?.conversions + analytics.trialFunnelMetrics?.planConversions?.scale?.conversions || 0}</p>
                                </div>
                                <TrendingUp className="h-6 w-6 text-green-600" />
                              </div>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardContent className="p-6">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-gray-600">Conversion Rate</p>
                                  <p className="text-2xl font-bold text-gray-900">{((analytics.trialFunnelMetrics?.planConversions?.starter?.conversions + analytics.trialFunnelMetrics?.planConversions?.growth?.conversions + analytics.trialFunnelMetrics?.planConversions?.scale?.conversions) / (analytics.trialFunnelMetrics?.planConversions?.starter?.totalTrials + analytics.trialFunnelMetrics?.planConversions?.growth?.totalTrials + analytics.trialFunnelMetrics?.planConversions?.scale?.totalTrials) * 100).toFixed(1) || '0.0'}%</p>
                                </div>
                                <Activity className="h-6 w-6 text-purple-600" />
                              </div>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardContent className="p-6">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-gray-600">Trial Engagement</p>
                                  <p className="text-2xl font-bold text-gray-900">{analytics.trialFunnelMetrics?.trialEngagementScore || 0}%</p>
                                  <p className="text-xs text-gray-500 mt-1">Complete onboarding</p>
                                </div>
                                <Zap className="h-6 w-6 text-blue-600" />
                              </div>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardContent className="p-6">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-gray-600">Avg. Days to Convert</p>
                                  <p className="text-2xl font-bold text-gray-900">{analytics.trialFunnelMetrics?.averageDaysToConvert || 0}</p>
                                  <p className="text-xs text-gray-500 mt-1">Trial to paid</p>
                                </div>
                                <Clock className="h-6 w-6 text-amber-600" />
                              </div>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardContent className="p-6">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-gray-600">Revenue per Trial</p>
                                  <p className="text-2xl font-bold text-gray-900">${analytics.trialFunnelMetrics?.revenuePerTrialUser?.toFixed(2) || '0.00'}</p>
                                  <p className="text-xs text-gray-500 mt-1">Including non-converters</p>
                                </div>
                                <DollarSign className="h-6 w-6 text-green-600" />
                              </div>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardContent className="p-6">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-gray-600">Trial Revenue</p>
                                  <p className="text-2xl font-bold text-gray-900">${analytics.totalRevenue.toLocaleString()}</p>
                                </div>
                                <DollarSign className="h-6 w-6 text-green-600" />
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Pricing Tier Conversions */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                          <Card>
                            <CardContent className="p-6">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-gray-600">Solopreneur ($9)</p>
                                  <p className="text-2xl font-bold text-gray-900">{analytics.trialFunnelMetrics?.planConversions?.starter?.rate || 0}%</p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {analytics.trialFunnelMetrics?.planConversions?.starter?.conversions || 0} of {analytics.trialFunnelMetrics?.planConversions?.starter?.totalTrials || 0} trials
                                  </p>
                                </div>
                                <div className="h-6 w-6 bg-blue-100 rounded-full flex items-center justify-center">
                                  <div className="h-3 w-3 bg-blue-600 rounded-full"></div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardContent className="p-6">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-gray-600">Growth ($45)</p>
                                  <p className="text-2xl font-bold text-gray-900">{analytics.trialFunnelMetrics?.planConversions?.growth?.rate || 0}%</p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {analytics.trialFunnelMetrics?.planConversions?.growth?.conversions || 0} of {analytics.trialFunnelMetrics?.planConversions?.growth?.totalTrials || 0} trials
                                  </p>
                                </div>
                                <div className="h-6 w-6 bg-purple-100 rounded-full flex items-center justify-center">
                                  <div className="h-3 w-3 bg-purple-600 rounded-full"></div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardContent className="p-6">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-gray-600">Scale ($80)</p>
                                  <p className="text-2xl font-bold text-gray-900">{analytics.trialFunnelMetrics?.planConversions?.scale?.rate || 0}%</p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {analytics.trialFunnelMetrics?.planConversions?.scale?.conversions || 0} of {analytics.trialFunnelMetrics?.planConversions?.scale?.totalTrials || 0} trials
                                  </p>
                                </div>
                                <div className="h-6 w-6 bg-amber-100 rounded-full flex items-center justify-center">
                                  <div className="h-3 w-3 bg-amber-600 rounded-full"></div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        Failed to load trial analytics data
                      </div>
                    )}
                  </div>
                )}

                {analyticsTab === 'lifecycle' && (
                  <div className="space-y-6">
                    {analyticsLoading ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        {[...Array(3)].map((_, i) => (
                          <Card key={i}>
                            <CardContent className="p-6">
                              <div className="animate-pulse">
                                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : analytics ? (
                      <>
                        {/* Core Retention Metrics */}
                        <div className="bg-white rounded-lg border p-6 mb-6">
                          <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Retention & Lifecycle Metrics</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                            <Card>
                              <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-medium text-gray-600">Monthly Churn</p>
                                    <p className="text-2xl font-bold text-red-600">{analytics.retentionMetrics?.monthlyChurnRate || 0}%</p>
                                    <p className="text-xs text-gray-500 mt-1">Users who canceled</p>
                                  </div>
                                  <TrendingUp className="h-6 w-6 text-red-600" />
                                </div>
                              </CardContent>
                            </Card>

                            <Card>
                              <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-medium text-gray-600">Time to Value</p>
                                    <p className="text-2xl font-bold text-blue-600">{analytics.retentionMetrics?.avgTimeToValue || 0}</p>
                                    <p className="text-xs text-gray-500 mt-1">Days to first automation</p>
                                  </div>
                                  <Clock className="h-6 w-6 text-blue-600" />
                                </div>
                              </CardContent>
                            </Card>

                            <Card>
                              <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-medium text-gray-600">Automation Adoption</p>
                                    <p className="text-2xl font-bold text-green-600">{analytics.retentionMetrics?.automationAdoptionRate || 0}%</p>
                                    <p className="text-xs text-gray-500 mt-1">Users with active automations</p>
                                  </div>
                                  <Bot className="h-6 w-6 text-green-600" />
                                </div>
                              </CardContent>
                            </Card>

                            <Card>
                              <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-medium text-gray-600">Integration Adoption</p>
                                    <p className="text-2xl font-bold text-purple-600">{analytics.retentionMetrics?.integrationAdoptionRate || 0}%</p>
                                    <p className="text-xs text-gray-500 mt-1">Users with store connections</p>
                                  </div>
                                  <Store className="h-6 w-6 text-purple-600" />
                                </div>
                              </CardContent>
                            </Card>

                            <Card>
                              <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-medium text-gray-600">Net Revenue Retention</p>
                                    <p className="text-2xl font-bold text-orange-600">{analytics.retentionMetrics?.netRevenueRetention || 100}%</p>
                                    <p className="text-xs text-gray-500 mt-1">Revenue growth rate</p>
                                  </div>
                                  <DollarSign className="h-6 w-6 text-orange-600" />
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        </div>

                        {/* Customer Lifetime Value by Plan */}
                        <div className="bg-white rounded-lg border p-6 mb-6">
                          <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Lifetime Value (CLV) by Plan</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card>
                              <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-medium text-gray-600">Solopreneur ($9/mo)</p>
                                    <p className="text-2xl font-bold text-gray-900">${analytics.retentionMetrics?.clvByPlan?.starter?.clv || 232}</p>
                                    <p className="text-xs text-green-600 mt-1">8 month average retention</p>
                                  </div>
                                  <div className="p-3 bg-blue-100 rounded-full">
                                    <DollarSign className="h-6 w-6 text-blue-600" />
                                  </div>
                                </div>
                              </CardContent>
                            </Card>

                            <Card>
                              <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-medium text-gray-600">Growth ($45/mo)</p>
                                    <p className="text-2xl font-bold text-gray-900">${analytics.retentionMetrics?.clvByPlan?.growth?.clv || 948}</p>
                                    <p className="text-xs text-green-600 mt-1">12 month average retention</p>
                                  </div>
                                  <div className="p-3 bg-green-100 rounded-full">
                                    <DollarSign className="h-6 w-6 text-green-600" />
                                  </div>
                                </div>
                              </CardContent>
                            </Card>

                            <Card>
                              <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-medium text-gray-600">Scale ($80/mo)</p>
                                    <p className="text-2xl font-bold text-gray-900">${analytics.retentionMetrics?.clvByPlan?.scale?.clv || 3582}</p>
                                    <p className="text-xs text-green-600 mt-1">18 month average retention</p>
                                  </div>
                                  <div className="p-3 bg-purple-100 rounded-full">
                                    <DollarSign className="h-6 w-6 text-purple-600" />
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        Failed to load lifecycle analytics data
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="manual-rejections" className="space-y-6">
                <ManualRejectionsAnalytics />
              </TabsContent>

              <TabsContent value="sentiment-analysis" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-4 w-4" />
                      Amazon Comprehend Sentiment Analysis
                    </CardTitle>
                    <CardDescription>
                      Test and monitor AI guard rails using Amazon Comprehend sentiment analysis
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8">
                      <p className="text-gray-600 mb-4">
                        The sentiment analysis test interface allows you to validate AI guard rails and monitor sentiment scoring.
                      </p>
                      <Button
                        onClick={() => window.open('/admin/sentiment-test', '_blank')}
                        className="flex items-center gap-2"
                      >
                        <Brain className="h-4 w-4" />
                        Open Sentiment Test Interface
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="system-emails" className="space-y-6">
                <SystemEmailsTab />
              </TabsContent>

              <TabsContent value="sendgrid-logs" className="space-y-6">
                <SendGridEmailLogsTab />
              </TabsContent>



              <TabsContent value="users" className="space-y-6">
                {/* User Management Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* User List */}
              <div className="lg:col-span-1">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Users ({filteredUsers.length})
                    </CardTitle>
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                          placeholder="Search users..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <Button 
                        onClick={createDemoUser} 
                        disabled={demoUserMutation.isPending}
                        size="sm"
                        variant="outline"
                        className="w-full"
                      >
                        {demoUserMutation.isPending ? (
                          <>
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-900 mr-2"></div>
                            Creating Demo User...
                          </>
                        ) : (
                          <>
                            <Users className="h-3 w-3 mr-2" />
                            Create Demo User
                          </>
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="max-h-96 overflow-y-auto">
                      {isLoading ? (
                        <div className="p-4 text-center text-gray-500">Loading users...</div>
                      ) : filteredUsers.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">No users found</div>
                      ) : (
                        <div className="divide-y">
                          {filteredUsers.map((user: AdminUser) => (
                            <div
                              key={user.id}
                              className={`p-4 cursor-pointer hover:bg-gray-50 ${
                                selectedUser === user.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                              }`}
                              onClick={() => setSelectedUser(user.id)}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-sm">{user.username}</p>
                                  <p className="text-xs text-gray-500">{user.email}</p>
                                </div>
                                <Badge variant={user.isActive ? 'default' : 'secondary'}>
                                  {user.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                              </div>
                              <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                                <Calendar className="h-3 w-3" />
                                Last: {user.lastLogin ? formatDate(user.lastLogin) : 'Never'}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* User Details */}
              <div className="lg:col-span-2">
                {selectedUser && userDetails ? (
                  <Tabs defaultValue="overview" className="space-y-4">
                    <TabsList>
                      <TabsTrigger value="overview">Overview</TabsTrigger>
                      <TabsTrigger value="automations">Automations</TabsTrigger>
                      <TabsTrigger value="activity">Login History</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-4">
                      {/* Account Info */}
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                          <CardTitle>Account Information</CardTitle>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleImpersonateUser((userDetails.profile as any)?.id || '')}
                              variant="outline"
                              size="sm"
                              className="text-blue-600 border-blue-600 hover:bg-blue-50"
                            >
                              View as User
                            </Button>
                            {(userDetails as any)?.subscription?.isBetaTester ? (
                              <Button
                                onClick={() => handleRevokeBetaTester((userDetails.profile as any)?.id || '')}
                                variant="outline"
                                size="sm"
                                className="text-red-600 border-red-600 hover:bg-red-50"
                              >
                                Revoke Beta Access
                              </Button>
                            ) : (
                              <Button
                                onClick={() => handleGrantBetaTester((userDetails.profile as any)?.id || '')}
                                variant="outline"
                                size="sm"
                                className="text-green-600 border-green-600 hover:bg-green-50"
                              >
                                Grant Beta Access
                              </Button>
                            )}
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-red-600 border-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Delete User
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Delete User Account</DialogTitle>
                                  <DialogDescription>
                                    This action will permanently delete the user account and all associated data. This cannot be undone.
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                    <div className="flex items-start gap-3">
                                      <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                                      <div className="space-y-2">
                                        <p className="text-sm font-medium text-red-800">
                                          This will permanently delete:
                                        </p>
                                        <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
                                          <li>User profile and account data</li>
                                          <li>All automation rules and settings</li>
                                          <li>Email accounts and store connections</li>
                                          <li>Activity logs and usage history</li>
                                          <li>Billing information and subscription data</li>
                                        </ul>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="bg-gray-50 border rounded-lg p-4">
                                    <p className="text-sm font-medium text-gray-700 mb-2">User Details:</p>
                                    <p className="text-sm text-gray-600">Email: {(userDetails.profile as any)?.email || 'N/A'}</p>
                                    <p className="text-sm text-gray-600">Plan: {(userDetails.subscription?.plan as any)?.displayName || 'Free'}</p>
                                    <p className="text-sm text-gray-600">Status: {userDetails.subscription?.billing?.status || 'inactive'}</p>
                                  </div>
                                </div>
                                <div className="flex justify-end gap-3">
                                  <DialogTrigger asChild>
                                    <Button variant="outline">Cancel</Button>
                                  </DialogTrigger>
                                  <Button
                                    onClick={() => handleDeleteUser((userDetails.profile as any)?.id || '')}
                                    variant="destructive"
                                    disabled={deleteUserMutation.isPending}
                                  >
                                    {deleteUserMutation.isPending ? "Deleting..." : "Delete User"}
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm font-medium">Username</Label>
                            <p className="text-sm text-gray-600">{(userDetails.profile as any)?.email || 'N/A'}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Email</Label>
                            <p className="text-sm text-gray-600">{(userDetails.profile as any)?.email || 'N/A'}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Created</Label>
                            <p className="text-sm text-gray-600">{formatDate(userDetails.createdAt)}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Last Login</Label>
                            <p className="text-sm text-gray-600">
                              {userDetails.lastLogin ? formatDate(userDetails.lastLogin) : 'Never'}
                            </p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Subscription</Label>
                            <div className="flex items-center gap-2">
                              <Badge variant={userDetails.subscription?.status === 'active' ? 'default' : 'secondary'}>
                                {typeof userDetails.subscription?.plan === 'object' && userDetails.subscription.plan
                                  ? ((userDetails.subscription.plan as any).displayName || (userDetails.subscription.plan as any).name || 'Free')
                                  : (userDetails.subscription?.plan || 'Free')} - {userDetails.subscription?.status || 'inactive'}
                              </Badge>
                              {userDetails.subscription?.isBetaTester && (
                                <Badge variant="outline" className="text-purple-600 border-purple-600">
                                  Beta Tester
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Status</Label>
                            <Badge variant={userDetails.isActive ? 'default' : 'secondary'}>
                              {userDetails.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Usage Stats */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              Emails Processed
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-2xl font-bold">{userDetails.usage?.emailsProcessed || 0}</p>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Bot className="h-4 w-4" />
                              Automation Triggers
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-2xl font-bold">{userDetails.usage?.automationTriggers || 0}</p>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Activity className="h-4 w-4" />
                              Quick Actions Used
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-2xl font-bold">{userDetails.usage?.quickActionsUsed || 0}</p>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4" />
                              Escalated Emails
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-2xl font-bold">{userDetails.usage?.escalatedEmails || 0}</p>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              Pending Escalations
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-2xl font-bold text-orange-600">{userDetails.usage?.pendingEscalations || 0}</p>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Integrations */}
                      <Card>
                        <CardHeader>
                          <CardTitle>Connected Integrations</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              <span className="text-sm">Email Provider</span>
                            </div>
                            <Badge variant="outline">
                              {userDetails.integrations?.emailProvider || 'None'}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <ShoppingBag className="h-4 w-4" />
                              <span className="text-sm">Store Platform</span>
                            </div>
                            <Badge variant="outline">
                              {userDetails.integrations?.storeType || 'None'}
                            </Badge>
                          </div>
                          {userDetails.integrations?.storeDomain && (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-sm ml-6">Store Domain</span>
                              </div>
                              <span className="text-sm text-gray-600">
                                {userDetails.integrations?.storeDomain}
                              </span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="automations">
                      <Card>
                        <CardHeader>
                          <CardTitle>Automation Rules</CardTitle>
                          <CardDescription>
                            Active automation rules and their usage statistics
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {!userDetails.automations || userDetails.automations.length === 0 ? (
                            <p className="text-center text-gray-500 py-4">No automation rules configured</p>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Rule Name</TableHead>
                                  <TableHead>Classification</TableHead>
                                  <TableHead>Triggers</TableHead>
                                  <TableHead>Status</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {userDetails.automations?.map((automation: any) => (
                                  <TableRow key={automation.id}>
                                    <TableCell className="font-medium">{automation.name}</TableCell>
                                    <TableCell>
                                      <Badge variant={getClassificationBadgeVariant(automation.classification)}>
                                        {automation.classification.replace('_', ' ')}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>{automation.triggerCount}</TableCell>
                                    <TableCell>
                                      <Badge variant={automation.isActive ? 'default' : 'secondary'}>
                                        {automation.isActive ? 'Active' : 'Inactive'}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="activity">
                      <Card>
                        <CardHeader>
                          <CardTitle>Login History</CardTitle>
                          <CardDescription>
                            Recent login activity for this user
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {userDetails.loginHistory.length === 0 ? (
                            <p className="text-center text-gray-500 py-4">No login history available</p>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Date & Time</TableHead>
                                  <TableHead>IP Address</TableHead>
                                  <TableHead>User Agent</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {userDetails.loginHistory.slice(0, 10).map((login: any, index: number) => (
                                  <TableRow key={index}>
                                    <TableCell>{formatDate(login.timestamp)}</TableCell>
                                    <TableCell className="font-mono text-xs">
                                      {login.ipAddress || 'Unknown'}
                                    </TableCell>
                                    <TableCell className="text-xs max-w-xs truncate">
                                      {login.userAgent || 'Unknown'}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                ) : (
                  <Card>
                    <CardContent className="flex items-center justify-center h-64">
                      <div className="text-center">
                        <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500">Select a user to view details</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
                </div>
                </div>
              </TabsContent>



              {/* Onboarding Emails Tab */}
              <TabsContent value="onboarding" className="space-y-6">
                <OnboardingEmailManager />
              </TabsContent>

              {/* Weekly Reports Tab */}
              <TabsContent value="reports" className="space-y-6">
                <div className="space-y-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">Weekly Reports Management</h2>
                      <p className="text-gray-600">Configure automatic weekly performance reports</p>
                    </div>
                  </div>

                  {/* Global Toggle */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Global Settings
                      </CardTitle>
                      <CardDescription>
                        Enable or disable weekly reports for all users. When disabled, no automatic reports will be sent on Monday mornings.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">Weekly Reports Feature</h3>
                          <p className="text-sm text-gray-600">Automatically send performance summaries every Monday</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-600">Disabled</span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={true} disabled={true} className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                          <span className="text-sm text-gray-600">Enabled</span>
                        </div>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-sm text-blue-800">
                          ✓ Weekly reports are currently enabled globally. Reports automatically generate and send Monday mornings at 9 AM for all users who have the feature enabled.
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Test Report Generation */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TestTube className="h-5 w-5" />
                        Test Report Generation
                      </CardTitle>
                      <CardDescription>
                        Generate a sample weekly report for any user and send it to your admin email for review.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium mb-2">Search and Select User</label>
                          <Input
                            placeholder="Search users by email..."
                            value={searchTerm}
                            onChange={(e) => {
                              setSearchTerm(e.target.value);
                              setSelectedUser(null); // Reset selection when searching
                            }}
                            className="w-full"
                          />
                        </div>
                        
                        {searchTerm.length > 0 && (
                          <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                            {(users || [])
                              .filter(user => 
                                user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                (user.firstName && user.firstName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                                (user.lastName && user.lastName.toLowerCase().includes(searchTerm.toLowerCase()))
                              )
                              .slice(0, 10) // Limit to first 10 results
                              .map(user => (
                                <div 
                                  key={user.id}
                                  className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                                    selectedUser === user.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                                  }`}
                                  onClick={() => {
                                    setSelectedUser(user.id);
                                    setSearchTerm(user.email); // Show selected user's email in search
                                  }}
                                >
                                  <div className="font-medium">{user.email}</div>
                                  {(user.firstName || user.lastName) && (
                                    <div className="text-sm text-gray-600">
                                      {user.firstName} {user.lastName}
                                    </div>
                                  )}
                                  <div className="text-xs text-gray-500">
                                    User ID: {user.id}
                                  </div>
                                </div>
                              ))}
                            {(users || [])
                              .filter(user => 
                                user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                (user.firstName && user.firstName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                                (user.lastName && user.lastName.toLowerCase().includes(searchTerm.toLowerCase()))
                              ).length === 0 && (
                              <div className="p-3 text-gray-500 text-center">
                                No users found matching "{searchTerm}"
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <Button
                          onClick={async () => {
                            if (!selectedUser) {
                              toast({
                                title: "Error",
                                description: "Please select a user first",
                                variant: "destructive",
                              });
                              return;
                            }
                            try {
                              const response = await fetch(`/api/admin/weekly-reports/test/${selectedUser}`, {
                                method: 'POST',
                                credentials: 'include',
                              });
                              if (response.ok) {
                                const data = await response.json();
                                toast({
                                  title: "Success",
                                  description: `Test report sent to ${data.adminEmail}`,
                                });
                              } else {
                                throw new Error('Failed to send test report');
                              }
                            } catch (error) {
                              toast({
                                title: "Error",
                                description: "Failed to generate test report",
                                variant: "destructive",
                              });
                            }
                          }}
                          className="flex items-center gap-2"
                          disabled={!selectedUser}
                        >
                          <Send className="h-4 w-4" />
                          Send Test Report to Admin
                        </Button>
                      </div>
                      {selectedUser && (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <p className="text-sm text-gray-700">
                            A sample weekly report will be generated for the selected user and sent to your admin email address for review. This helps you see exactly what users receive.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Report Statistics */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Report Delivery Statistics
                      </CardTitle>
                      <CardDescription>
                        Real-time weekly report delivery performance and user engagement
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <WeeklyReportsStatsContent />
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Order Status Email Testing Tab */}
              <TabsContent value="order-emails" className="space-y-6">
                <div className="space-y-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">Order Status Email Testing</h2>
                      <p className="text-gray-600">Test order status email templates and functionality</p>
                    </div>
                  </div>

                  {/* Test Order Status Email */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TestTube className="h-5 w-5" />
                        Test Order Status Email
                      </CardTitle>
                      <CardDescription>
                        Send a test order status email to remy@delightdesk.io for template verification
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="orderSearch">Order Number or Customer Email</Label>
                        <Input
                          id="orderSearch"
                          placeholder="Order number or customer email"
                          className="mt-1 h-12 text-base"
                          value={orderSearchTerm}
                          onChange={(e) => setOrderSearchTerm(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && orderSearchTerm.trim() && handleSendTestOrderEmail()}
                        />
                      </div>

                      <Button 
                        onClick={handleSendTestOrderEmail}
                        disabled={testOrderEmailMutation.isPending || !orderSearchTerm.trim()}
                        className="w-full h-12 text-base font-medium"
                        size="lg"
                      >
                        {testOrderEmailMutation.isPending ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                            Sending Test Email...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Send Test Order Status Email
                          </>
                        )}
                      </Button>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-sm text-blue-800">
                          <strong>Test Email Destination:</strong> All test emails are hardcoded to send to remy@delightdesk.io for template verification. This simulates the order status email that would normally be sent to customers via OAuth email accounts.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}