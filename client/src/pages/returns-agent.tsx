import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { RotateCcw, Shield, Bot, CheckCircle, Save } from "lucide-react";
import { insertReturnsAgentConfigSchema, type ReturnsAgentConfig, type InsertReturnsAgentConfig } from "@shared/schema";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import Sidebar from "@/components/layout/sidebar";
import TopBar from "@/components/layout/topbar";
import { AgentEmailPreview } from "@/components/agent-email-preview";

const formSchema = insertReturnsAgentConfigSchema;
type FormData = z.infer<typeof formSchema>;

const returnsEmailTemplate = `I understand you'd like to return your recent order.

Based on our return policy, your order #12345 is eligible for a full refund. Here's what you need to do:

1. Pack your items in their original packaging
2. Print the prepaid return label: [Return Label Link]
3. Drop off at any USPS location

Your refund will be processed within 3-5 business days once we receive your return.

Is there anything else I can help you with regarding your return?`;

export default function ReturnsAgent() {
  const { user: currentUser } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      userId: currentUser?.id || "",
      isEnabled: false,
      requiresApproval: true,
      enableAutoApproval: false,
      autoApprovalDays: 30,
      enableAutoRefund: false,
      refundProcessingMethod: "manual",
      returnPolicyText: "",
      returnInstructions: "",
      enableSmartFollowUp: true,
      maxFollowUpAttempts: 2,
      requirePhotosForDamaged: false,
      requireReasonForReturn: false,
    },
  });

  // Fetch returns agent configuration
  const { data: config, isLoading } = useQuery({
    queryKey: ["/api/returns-agent", currentUser?.id],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/returns-agent/${currentUser?.id}`);
      return response.json() as Promise<ReturnsAgentConfig>;
    },
    enabled: !!currentUser?.id,
  });

  // Update form when config loads
  useEffect(() => {
    if (config) {
      form.reset({
        userId: config.userId,
        isEnabled: config.isEnabled,
        requiresApproval: config.requiresApproval,
        enableAutoApproval: config.enableAutoApproval,
        autoApprovalDays: config.autoApprovalDays,
        enableAutoRefund: config.enableAutoRefund,
        refundProcessingMethod: config.refundProcessingMethod || "manual",
        returnPolicyText: config.returnPolicyText || "",
        returnInstructions: config.returnInstructions || "",
        enableSmartFollowUp: config.enableSmartFollowUp ?? true,
        maxFollowUpAttempts: config.maxFollowUpAttempts || 2,
        requirePhotosForDamaged: config.requirePhotosForDamaged || false,
        requireReasonForReturn: config.requireReasonForReturn || false,
      });
    }
  }, [config, form]);

  // Save configuration mutation
  const saveMutation = useMutation({
    mutationFn: (data: InsertReturnsAgentConfig) => 
      apiRequest("POST", "/api/returns-agent", data).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/returns-agent", currentUser?.id] });
      toast({
        title: "Success",
        description: "Returns agent configuration saved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save configuration",
        variant: "destructive",
      });
    },
  });

  // Toggle agent enabled mutation
  const toggleAgentMutation = useMutation({
    mutationFn: ({ isEnabled }: { isEnabled: boolean }) =>
      apiRequest("PUT", `/api/returns-agent/${config?.id}`, { isEnabled }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/returns-agent", currentUser?.id] });
      toast({
        title: "Success",
        description: "Returns agent settings updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update settings",
        variant: "destructive",
      });
    },
  });

  // Toggle moderation mutation
  const toggleModerationMutation = useMutation({
    mutationFn: ({ requiresApproval }: { requiresApproval: boolean }) =>
      apiRequest("PUT", `/api/returns-agent/${config?.id}`, { requiresApproval }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/returns-agent", currentUser?.id] });
      toast({
        title: "Success",
        description: "Moderation settings updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update moderation setting",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    saveMutation.mutate(data);
  };

  const handleToggleAgent = (isEnabled: boolean) => {
    toggleAgentMutation.mutate({ isEnabled });
  };

  const handleToggleModeration = (requiresApproval: boolean) => {
    toggleModerationMutation.mutate({ requiresApproval });
  };

  if (!currentUser || isLoading) {
    return (
      <div className="h-screen flex items-center justify-center" data-testid="loading-spinner">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading"/>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      
      <div className="lg:pl-64 flex flex-col flex-1">
        <TopBar onMenuClick={() => setIsMobileMenuOpen(true)} />
        
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="max-w-7xl mx-auto p-6" data-testid="returns-agent-page">
            <div className="mb-6">
              <h1 className="text-3xl font-bold flex items-center gap-3" data-testid="page-title">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <RotateCcw className="h-6 w-6 text-orange-600" />
                </div>
                Returns Agent
              </h1>
              <p className="text-muted-foreground mt-2" data-testid="page-description">
                Automate return and refund processing based on your business policies. Handle simple auto-approvals or complex eligibility evaluations.
              </p>
            </div>

            {/* 2/3 and 1/3 column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left column - 2/3 width for configuration */}
              <div className="lg:col-span-2">
                <div className="space-y-6">
                  {/* Agent Control */}
                  <Card data-testid="agent-control-card">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Bot className="h-5 w-5" />
                        Agent Control
                      </CardTitle>
                      <CardDescription>
                        Enable and configure the Returns Agent behavior
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Agent Enable/Disable */}
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-0.5">
                          <div className="text-base font-medium">Enable Returns Agent</div>
                          <div className="text-sm text-muted-foreground">
                            Automatically process return and refund requests
                          </div>
                        </div>
                        <Switch
                          checked={config?.isEnabled || false}
                          onCheckedChange={handleToggleAgent}
                          disabled={toggleAgentMutation.isPending}
                          data-testid="switch-enable-agent"
                        />
                      </div>

                      {/* Moderation Toggle */}
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-0.5">
                          <div className="text-base font-medium">Require Moderation</div>
                          <div className="text-sm text-muted-foreground">
                            {config?.requiresApproval 
                              ? "Responses will appear in approval queue before sending"
                              : "Responses will be sent automatically without review"
                            }
                          </div>
                        </div>
                        <Switch
                          checked={config?.requiresApproval || false}
                          onCheckedChange={handleToggleModeration}
                          disabled={toggleModerationMutation.isPending || !config?.isEnabled}
                          data-testid="switch-requires-moderation"
                        />
                      </div>

                      {/* Status Display */}
                      <div className="pt-4 border-t">
                        <div className="flex items-center space-x-2">
                          {config?.isEnabled ? (
                            <>
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <span className="text-sm font-medium text-green-600">
                                Agent Active
                              </span>
                            </>
                          ) : (
                            <>
                              <Bot className="h-4 w-4 text-gray-400" />
                              <span className="text-sm font-medium text-gray-600">
                                Agent Inactive
                              </span>
                            </>
                          )}
                          {config?.requiresApproval && config?.isEnabled && (
                            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                              Moderated
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Configuration Form */}
                  <Card data-testid="configuration-card">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        Return Policy Configuration
                      </CardTitle>
                      <CardDescription>
                        Set up your return policy and automation preferences
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                          {/* Simple Auto-Approval Section */}
                          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="text-lg font-semibold">Simple Auto-Approval</h3>
                                <p className="text-sm text-muted-foreground">
                                  Automatically approve all returns within a specific time window (no questions asked)
                                </p>
                              </div>
                              <FormField
                                control={form.control}
                                name="enableAutoApproval"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Switch
                                        checked={field.value || false}
                                        onCheckedChange={field.onChange}
                                        data-testid="switch-enable-auto-approval"
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </div>
                            
                            {form.watch("enableAutoApproval") && (
                              <div className="space-y-4">
                                <FormField
                                  control={form.control}
                                  name="autoApprovalDays"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel data-testid="label-auto-approval-days">Auto-Approval Window (Days)</FormLabel>
                                      <FormControl>
                                        <Input 
                                          {...field} 
                                          type="number" 
                                          min="1" 
                                          max="365"
                                          value={field.value || 30}
                                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                                          data-testid="input-auto-approval-days"
                                        />
                                      </FormControl>
                                      <p className="text-sm text-muted-foreground">
                                        Orders purchased within this timeframe will be automatically approved for returns
                                      </p>
                                      <FormMessage data-testid="error-auto-approval-days" />
                                    </FormItem>
                                  )}
                                />

                                {/* Automatic Refund Toggle */}
                                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                                  <div className="space-y-0.5">
                                    <div className="text-sm font-medium">Issue Instant Refunds</div>
                                    <div className="text-xs text-muted-foreground">
                                      Automatically process WooCommerce refunds when returns are auto-approved
                                    </div>
                                  </div>
                                  <FormField
                                    control={form.control}
                                    name="enableAutoRefund"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <Switch
                                            checked={field.value || false}
                                            onCheckedChange={field.onChange}
                                            data-testid="switch-enable-auto-refund"
                                          />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Smart Follow-Up Section */}
                          <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg space-y-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="text-lg font-semibold">Smart Follow-Up Conversations</h3>
                                <p className="text-sm text-muted-foreground">
                                  Automatically ask customers for missing information (order numbers, photos, etc.) before processing returns
                                </p>
                              </div>
                              <FormField
                                control={form.control}
                                name="enableSmartFollowUp"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Switch
                                        checked={field.value || false}
                                        onCheckedChange={field.onChange}
                                        data-testid="switch-enable-smart-follow-up"
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </div>
                            
                            {form.watch("enableSmartFollowUp") && (
                              <div className="space-y-4">
                                <FormField
                                  control={form.control}
                                  name="maxFollowUpAttempts"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel data-testid="label-max-follow-up-attempts">Maximum Follow-Up Attempts</FormLabel>
                                      <FormControl>
                                        <Input 
                                          {...field} 
                                          type="number" 
                                          min="1" 
                                          max="5"
                                          value={field.value || 2}
                                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                                          data-testid="input-max-follow-up-attempts"
                                        />
                                      </FormControl>
                                      <p className="text-sm text-muted-foreground">
                                        How many times to ask for missing information before escalating to manual review
                                      </p>
                                      <FormMessage data-testid="error-max-follow-up-attempts" />
                                    </FormItem>
                                  )}
                                />

                                {/* Information Requirements */}
                                <div className="space-y-3">
                                  <h4 className="font-medium text-sm">Information Requirements</h4>
                                  
                                  <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                                    <div className="space-y-0.5">
                                      <div className="text-sm font-medium">Require Return Reason</div>
                                      <div className="text-xs text-muted-foreground">
                                        Ask customers to specify why they want to return the item
                                      </div>
                                    </div>
                                    <FormField
                                      control={form.control}
                                      name="requireReasonForReturn"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormControl>
                                            <Switch
                                              checked={field.value || false}
                                              onCheckedChange={field.onChange}
                                              data-testid="switch-require-reason"
                                            />
                                          </FormControl>
                                        </FormItem>
                                      )}
                                    />
                                  </div>

                                  <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                                    <div className="space-y-0.5">
                                      <div className="text-sm font-medium">Require Photos for Damaged Items</div>
                                      <div className="text-xs text-muted-foreground">
                                        Request photos when customers report damaged or defective items
                                      </div>
                                    </div>
                                    <FormField
                                      control={form.control}
                                      name="requirePhotosForDamaged"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormControl>
                                            <Switch
                                              checked={field.value || false}
                                              onCheckedChange={field.onChange}
                                              data-testid="switch-require-photos"
                                            />
                                          </FormControl>
                                        </FormItem>
                                      )}
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Return Policy Text */}
                          <FormField
                            control={form.control}
                            name="returnPolicyText"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel data-testid="label-return-policy">Return Policy (Natural Language)</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    {...field} 
                                    value={field.value || ""} 
                                    placeholder="Describe your return policy in natural language. For example: 'We accept returns within 30 days of purchase for unopened items. Custom orders and sale items are final. Customers must pay return shipping unless the item was defective.'"
                                    className="min-h-[150px]"
                                    data-testid="textarea-return-policy"
                                  />
                                </FormControl>
                                <p className="text-sm text-muted-foreground">
                                  The AI will use this policy to evaluate return eligibility for complex cases
                                </p>
                                <FormMessage data-testid="error-return-policy" />
                              </FormItem>
                            )}
                          />

                          {/* Return Instructions */}
                          <FormField
                            control={form.control}
                            name="returnInstructions"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel data-testid="label-return-instructions">Return Instructions</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    {...field} 
                                    value={field.value || ""} 
                                    placeholder="Instructions for customers on how to return items. Include mailing address, packaging requirements, who pays shipping, etc."
                                    className="min-h-[120px]"
                                    data-testid="textarea-return-instructions"
                                  />
                                </FormControl>
                                <p className="text-sm text-muted-foreground">
                                  These instructions will be sent to customers when their return is approved
                                </p>
                                <FormMessage data-testid="error-return-instructions" />
                              </FormItem>
                            )}
                          />

                          <div className="flex justify-end">
                            <Button 
                              type="submit" 
                              disabled={saveMutation.isPending}
                              data-testid="button-save-config"
                            >
                              <Save className="w-4 h-4 mr-2" />
                              {saveMutation.isPending ? "Saving..." : "Save Configuration"}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </CardContent>
                  </Card>

                  {/* Analytics Card */}
                  {config && (
                    <Card data-testid="analytics-card">
                      <CardHeader>
                        <CardTitle>Usage Analytics</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <div className="text-2xl font-bold text-blue-600" data-testid="stat-total-processed">
                              {config.totalReturnsProcessed || 0}
                            </div>
                            <div className="text-sm text-muted-foreground">Total Processed</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-green-600" data-testid="stat-auto-approvals">
                              {config.autoApprovalsGranted || 0}
                            </div>
                            <div className="text-sm text-muted-foreground">Auto-Approved</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-orange-600" data-testid="stat-escalations">
                              {config.escalationsCreated || 0}
                            </div>
                            <div className="text-sm text-muted-foreground">Escalated</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>

              {/* Right column - 1/3 width for email preview */}
              <div className="lg:col-span-1">
                <AgentEmailPreview 
                  agentType="returns"
                  agentDisplayName="Returns Agent"
                  sampleSubject="Re: Return Request Approved"
                  sampleContent={returnsEmailTemplate}
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}