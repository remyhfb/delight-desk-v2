import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Edit2, Trash2, Calendar, DollarSign, Settings, Target, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { insertPromoCodeConfigSchema, type PromoCodeConfig, type InsertPromoCodeConfig } from "@shared/schema";
import { formatDistanceToNow, format } from "date-fns";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import Sidebar from "@/components/layout/sidebar";
import TopBar from "@/components/layout/topbar";
import { useIsMobile } from "@/hooks/use-mobile";
import { AgentEmailPreview } from "@/components/agent-email-preview";

const formSchema = insertPromoCodeConfigSchema.extend({
  validFrom: z.string().min(1, "Valid from date is required"),
  validUntil: z.string().min(1, "Valid until date is required"),
});

type FormData = z.infer<typeof formSchema>;

const promoCodeEmailTemplate = `Great news! I found a promo code that applies to your order: SAVE20

This will give you 20% off your purchase. The discount has been applied and you should see the savings reflected in your order total.

Is there anything else I can help you with regarding your order or our current promotions?`;

export default function PromoCodeConfigs() {
  const { user: currentUser } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<PromoCodeConfig | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      userId: currentUser?.id || "",
      promoCode: "",
      description: "",
      usageType: "refund_only",
      discountType: "percentage",
      discountAmount: "0",
      maxRefundValue: "",
      validFrom: "",
      validUntil: "",
      firstTimeCustomerOnly: false,
      appliesToSubscriptions: true,
      minOrderValue: "",
      enableFirstTimeCustomerOffers: false,
      firstTimeCustomerMessage: "",
      enableGeneralInquiryOffers: false,
      maxOffersPerCustomer: 1,
      offerFrequencyDays: 90,
      eligibleForAutomation: true,
      requiresApproval: true,
      isActive: true,
    },
  });

  // Fetch promo code configurations
  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["/api/promo-code-agent", currentUser?.id],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/promo-code-agent/${currentUser?.id}`);
      return response.json();
    },
    enabled: !!currentUser?.id,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: InsertPromoCodeConfig) => 
      apiRequest("POST", "/api/promo-code-agent", data).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promo-code-agent", currentUser?.id] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Promo code configuration created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create promo code configuration",
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PromoCodeConfig> }) =>
      apiRequest("PUT", `/api/promo-code-agent/${id}`, data).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promo-code-agent", currentUser?.id] });
      setEditingConfig(null);
      form.reset();
      toast({
        title: "Success",
        description: "Promo code configuration updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update promo code configuration",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => 
      apiRequest("DELETE", `/api/promo-code-agent/${id}`).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promo-code-agent", currentUser?.id] });
      toast({
        title: "Success",
        description: "Promo code configuration deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete promo code configuration",
        variant: "destructive",
      });
    },
  });

  // Toggle automation mutation
  const toggleAutomationMutation = useMutation({
    mutationFn: ({ id, eligibleForAutomation }: { id: string; eligibleForAutomation: boolean }) =>
      apiRequest("PUT", `/api/promo-code-agent/${id}`, { eligibleForAutomation }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promo-code-agent", currentUser?.id] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update automation setting",
        variant: "destructive",
      });
    },
  });

  // Toggle moderation mutation
  const toggleModerationMutation = useMutation({
    mutationFn: ({ id, requiresApproval }: { id: string; requiresApproval: boolean }) =>
      apiRequest("PUT", `/api/promo-code-agent/${id}`, { requiresApproval }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promo-code-agent", currentUser?.id] });
      toast({
        title: "Success",
        description: "Moderation setting updated successfully",
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
    const submitData: InsertPromoCodeConfig = {
      ...data,
      validFrom: new Date(data.validFrom),
      validUntil: new Date(data.validUntil),
      discountAmount: data.discountAmount,
      maxRefundValue: data.maxRefundValue || null,
      minOrderValue: data.minOrderValue || null,
    };

    if (editingConfig) {
      updateMutation.mutate({ id: editingConfig.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleEdit = (config: PromoCodeConfig) => {
    setEditingConfig(config);
    form.reset({
      userId: config.userId,
      promoCode: config.promoCode,
      description: config.description || "",
      usageType: config.usageType || "refund_only",
      discountType: config.discountType,
      discountAmount: config.discountAmount,
      maxRefundValue: config.maxRefundValue || "",
      validFrom: format(new Date(config.validFrom), "yyyy-MM-dd'T'HH:mm"),
      validUntil: format(new Date(config.validUntil), "yyyy-MM-dd'T'HH:mm"),
      firstTimeCustomerOnly: config.firstTimeCustomerOnly || false,
      appliesToSubscriptions: config.appliesToSubscriptions || false,
      minOrderValue: config.minOrderValue || "",
      enableFirstTimeCustomerOffers: config.enableFirstTimeCustomerOffers || false,
      firstTimeCustomerMessage: config.firstTimeCustomerMessage || "",
      enableGeneralInquiryOffers: config.enableGeneralInquiryOffers || false,
      maxOffersPerCustomer: config.maxOffersPerCustomer || 1,
      offerFrequencyDays: config.offerFrequencyDays || 90,
      eligibleForAutomation: config.eligibleForAutomation || false,
      requiresApproval: config.requiresApproval || false,
      isActive: config.isActive || false,
    });
    setIsCreateDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsCreateDialogOpen(false);
    setEditingConfig(null);
    form.reset();
  };

  const handleToggleAutomation = (id: string, eligibleForAutomation: boolean) => {
    toggleAutomationMutation.mutate({ id, eligibleForAutomation });
  };

  const handleToggleModeration = (id: string, requiresApproval: boolean) => {
    toggleModerationMutation.mutate({ id, requiresApproval });
  };

  const getStatusBadge = (config: PromoCodeConfig) => {
    const now = new Date();
    const validFrom = new Date(config.validFrom);
    const validUntil = new Date(config.validUntil);

    if (!config.isActive) {
      return <Badge variant="secondary" data-testid={`status-inactive-${config.id}`}>Inactive</Badge>;
    }
    
    if (now < validFrom) {
      return <Badge variant="outline" data-testid={`status-scheduled-${config.id}`}>Scheduled</Badge>;
    }
    
    if (now > validUntil) {
      return <Badge variant="destructive" data-testid={`status-expired-${config.id}`}>Expired</Badge>;
    }
    
    if (config.eligibleForAutomation && config.isStorewide && !config.hasProductRestrictions) {
      return <Badge variant="default" data-testid={`status-automated-${config.id}`}>Automated</Badge>;
    }
    
    return <Badge variant="secondary" data-testid={`status-manual-${config.id}`}>Manual Only</Badge>;
  };

  const formatDiscountDisplay = (config: PromoCodeConfig) => {
    if (config.discountType === "percentage") {
      return `${config.discountAmount}%${config.maxRefundValue ? ` (max $${config.maxRefundValue})` : ""}`;
    }
    return `$${config.discountAmount}`;
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
          <div className="max-w-7xl mx-auto p-6" data-testid="promo-configs-page">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-3xl font-bold" data-testid="page-title">Promo Code Agent</h1>
                <p className="text-muted-foreground mt-2" data-testid="page-description">
                  Automatically handle promo code refunds AND offer first-time customer discounts. Configure when and how to provide discounts to new customers and general inquiries, plus process refunds for missed promo codes.
                </p>
              </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleCloseDialog()} data-testid="button-create-config">
              <Plus className="w-4 h-4 mr-2" />
              Add Promo Code
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-create-config">
            <DialogHeader>
              <DialogTitle data-testid="dialog-title">
                {editingConfig ? "Edit Promo Code Configuration" : "Create Promo Code Configuration"}
              </DialogTitle>
              <DialogDescription data-testid="dialog-description">
                Set up automatic refunds for customers who qualified for a promo code but didn't receive the discount on their order. Configure the discount amount, validity period, and eligibility requirements.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Basic Configuration */}
                <div className="space-y-4">
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      <strong>Automation Eligibility:</strong> Promo codes with product restrictions or buy-one-get-one-free offers are not eligible for automation. Only simple percentage or fixed-amount discounts can be automated.
                    </p>
                  </div>

                  <h3 className="text-lg font-semibold flex items-center gap-2" data-testid="section-basic">
                    <Settings className="w-5 h-5" />
                    Basic Configuration
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="promoCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel data-testid="label-promo-code">Promo Code</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="SAVE20" data-testid="input-promo-code" />
                          </FormControl>
                          <FormMessage data-testid="error-promo-code" />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel data-testid="label-is-active">Active</FormLabel>
                            <div className="text-sm text-muted-foreground">
                              Enable this promo code configuration
                            </div>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                              data-testid="switch-is-active"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel data-testid="label-description">Description</FormLabel>
                        <FormControl>
                          <Textarea {...field} value={field.value || ""} placeholder="Internal description for this promo code..." data-testid="textarea-description" />
                        </FormControl>
                        <FormMessage data-testid="error-description" />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                {/* Usage Type Configuration */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2" data-testid="section-usage-type">
                    <Target className="w-5 h-5" />
                    Usage Type
                  </h3>
                  
                  <FormField
                    control={form.control}
                    name="usageType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel data-testid="label-usage-type">When to Offer This Promo Code</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-usage-type">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="refund_only" data-testid="option-refund-only">Refund Only (Original behavior)</SelectItem>
                            <SelectItem value="first_time_customer" data-testid="option-first-time-customer">First-Time Customer Discounts</SelectItem>
                            <SelectItem value="general_inquiry" data-testid="option-general-inquiry">General Discount Inquiries</SelectItem>
                            <SelectItem value="both" data-testid="option-both">Both Refunds and New Customer Offers</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="text-sm text-muted-foreground">
                          Choose when this promo code should be automatically offered to customers
                        </div>
                        <FormMessage data-testid="error-usage-type" />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                {/* Discount Configuration */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2" data-testid="section-discount">
                    <DollarSign className="w-5 h-5" />
                    Discount Configuration
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="discountType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel data-testid="label-discount-type">Discount Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-discount-type">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="percentage" data-testid="option-percentage">Percentage</SelectItem>
                              <SelectItem value="fixed_cash" data-testid="option-fixed-cash">Fixed Amount</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage data-testid="error-discount-type" />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="discountAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel data-testid="label-discount-amount">
                            {form.watch("discountType") === "percentage" ? "Percentage" : "Amount ($)"}
                          </FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="number" 
                              step="0.01" 
                              placeholder={form.watch("discountType") === "percentage" ? "20" : "25.00"}
                              data-testid="input-discount-amount"
                            />
                          </FormControl>
                          <FormMessage data-testid="error-discount-amount" />
                        </FormItem>
                      )}
                    />
                  </div>

                  {form.watch("discountType") === "percentage" && (
                    <FormField
                      control={form.control}
                      name="maxRefundValue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel data-testid="label-max-refund">Maximum Refund Amount ($)</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} type="number" step="0.01" placeholder="50.00" data-testid="input-max-refund" />
                          </FormControl>
                          <div className="text-sm text-muted-foreground">
                            Optional cap for percentage-based refunds
                          </div>
                          <FormMessage data-testid="error-max-refund" />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <Separator />

                {/* Validity Window */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2" data-testid="section-validity">
                    <Calendar className="w-5 h-5" />
                    Validity Window
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="validFrom"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel data-testid="label-valid-from">Valid From</FormLabel>
                          <FormControl>
                            <Input {...field} type="datetime-local" data-testid="input-valid-from" />
                          </FormControl>
                          <FormMessage data-testid="error-valid-from" />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="validUntil"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel data-testid="label-valid-until">Valid Until</FormLabel>
                          <FormControl>
                            <Input {...field} type="datetime-local" data-testid="input-valid-until" />
                          </FormControl>
                          <FormMessage data-testid="error-valid-until" />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Separator />

                {/* Eligibility Rules */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2" data-testid="section-eligibility">
                    <Target className="w-5 h-5" />
                    Eligibility Rules
                  </h3>
                  
                  <FormField
                    control={form.control}
                    name="minOrderValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel data-testid="label-min-order">Minimum Order Value ($)</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} type="number" step="0.01" placeholder="25.00" data-testid="input-min-order" />
                        </FormControl>
                        <div className="text-sm text-muted-foreground">
                          Optional minimum order requirement
                        </div>
                        <FormMessage data-testid="error-min-order" />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-3">
                    <FormField
                      control={form.control}
                      name="appliesToSubscriptions"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel data-testid="label-applies-subscriptions">Applies to Subscriptions</FormLabel>
                            <div className="text-sm text-muted-foreground">
                              Allow refunds for subscription orders
                            </div>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                              data-testid="switch-applies-subscriptions"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="requiresApproval"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel data-testid="label-requires-approval">Require Moderation</FormLabel>
                            <div className="text-sm text-muted-foreground">
                              Responses will appear in approval queue before sending
                            </div>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                              data-testid="switch-requires-approval"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Customer Offering Configuration - only show if usage type includes customer offers */}
                {(form.watch("usageType") === "first_time_customer" || form.watch("usageType") === "general_inquiry" || form.watch("usageType") === "both") && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold flex items-center gap-2" data-testid="section-customer-offers">
                        <DollarSign className="w-5 h-5" />
                        Customer Discount Offering
                      </h3>

                      {/* First-time customer offers */}
                      {(form.watch("usageType") === "first_time_customer" || form.watch("usageType") === "both") && (
                        <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold">First-Time Customer Discounts</h4>
                              <p className="text-sm text-muted-foreground">
                                Automatically offer this discount to customers with no previous orders
                              </p>
                            </div>
                            <FormField
                              control={form.control}
                              name="enableFirstTimeCustomerOffers"
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Switch
                                      checked={field.value || false}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-enable-first-time-offers"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                          
                          {form.watch("enableFirstTimeCustomerOffers") && (
                            <FormField
                              control={form.control}
                              name="firstTimeCustomerMessage"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel data-testid="label-first-time-message">Custom Message for First-Time Customers</FormLabel>
                                  <FormControl>
                                    <Textarea 
                                      {...field} 
                                      value={field.value || ""} 
                                      placeholder="Welcome! As a first-time customer, we'd love to offer you a special discount..."
                                      className="min-h-[80px]"
                                      data-testid="textarea-first-time-message"
                                    />
                                  </FormControl>
                                  <div className="text-sm text-muted-foreground">
                                    Custom welcome message when offering the discount to first-time customers
                                  </div>
                                  <FormMessage data-testid="error-first-time-message" />
                                </FormItem>
                              )}
                            />
                          )}
                        </div>
                      )}

                      {/* General inquiry offers */}
                      {(form.watch("usageType") === "general_inquiry" || form.watch("usageType") === "both") && (
                        <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold">General Discount Inquiries</h4>
                              <p className="text-sm text-muted-foreground">
                                Offer this discount when customers ask about available promotions
                              </p>
                            </div>
                            <FormField
                              control={form.control}
                              name="enableGeneralInquiryOffers"
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Switch
                                      checked={field.value || false}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-enable-general-offers"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                          
                          {form.watch("enableGeneralInquiryOffers") && (
                            <div className="grid grid-cols-2 gap-4">
                              <FormField
                                control={form.control}
                                name="maxOffersPerCustomer"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel data-testid="label-max-offers">Max Offers per Customer</FormLabel>
                                    <FormControl>
                                      <Input 
                                        {...field} 
                                        type="number" 
                                        min="1" 
                                        max="10"
                                        value={field.value || 1}
                                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                                        data-testid="input-max-offers"
                                      />
                                    </FormControl>
                                    <div className="text-sm text-muted-foreground">
                                      Limit how many times a customer can receive this offer
                                    </div>
                                    <FormMessage data-testid="error-max-offers" />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name="offerFrequencyDays"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel data-testid="label-frequency-days">Frequency (Days)</FormLabel>
                                    <FormControl>
                                      <Input 
                                        {...field} 
                                        type="number" 
                                        min="1" 
                                        max="365"
                                        value={field.value || 90}
                                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                                        data-testid="input-frequency-days"
                                      />
                                    </FormControl>
                                    <div className="text-sm text-muted-foreground">
                                      Minimum days between offers to the same customer
                                    </div>
                                    <FormMessage data-testid="error-frequency-days" />
                                  </FormItem>
                                )}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={handleCloseDialog} data-testid="button-cancel">
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-save"
                  >
                    {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingConfig ? "Update" : "Create"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* 2/3 and 1/3 column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - 2/3 width for promo codes */}
        <div className="lg:col-span-2">
          {/* Configuration List */}
          <div className="grid gap-4" data-testid="configs-list">
        {configs.length === 0 ? (
          <Card data-testid="empty-state">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Settings className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Promo Code Configurations</h3>
              <p className="text-muted-foreground text-center mb-4">
                Create your first enhanced promo code configuration to enable sophisticated automation
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-first">
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Configuration
              </Button>
            </CardContent>
          </Card>
        ) : (
          configs.map((config: PromoCodeConfig) => (
            <Card key={config.id} data-testid={`config-card-${config.id}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2" data-testid={`config-title-${config.id}`}>
                      {config.promoCode}
                      {getStatusBadge(config)}
                    </CardTitle>
                    <CardDescription data-testid={`config-description-${config.id}`}>
                      {config.description || "No description provided"}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={config.eligibleForAutomation || false}
                        onCheckedChange={(checked) => handleToggleAutomation(config.id, checked)}
                        data-testid={`switch-automation-${config.id}`}
                      />
                      <span className="text-sm text-muted-foreground">Auto</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={config.requiresApproval || false}
                        onCheckedChange={(checked) => handleToggleModeration(config.id, checked)}
                        data-testid={`switch-moderation-${config.id}`}
                      />
                      <span className="text-sm text-muted-foreground">Mod</span>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleEdit(config)}
                      data-testid={`button-edit-${config.id}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" data-testid={`button-delete-${config.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent data-testid={`dialog-delete-${config.id}`}>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Promo Code Configuration</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete the "{config.promoCode}" configuration? 
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel data-testid={`button-cancel-delete-${config.id}`}>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => deleteMutation.mutate(config.id)}
                            data-testid={`button-confirm-delete-${config.id}`}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div data-testid={`config-discount-${config.id}`}>
                    <div className="font-medium">Discount</div>
                    <div className="text-muted-foreground">{formatDiscountDisplay(config)}</div>
                  </div>
                  
                  <div data-testid={`config-validity-${config.id}`}>
                    <div className="font-medium">Valid Until</div>
                    <div className="text-muted-foreground">
                      {formatDistanceToNow(new Date(config.validUntil), { addSuffix: true })}
                    </div>
                  </div>
                  
                  <div data-testid={`config-usage-${config.id}`}>
                    <div className="font-medium">Usage</div>
                    <div className="text-muted-foreground">
                      {config.usageCount || 0} times
                      {config.lastUsed && (
                        <div className="text-xs">
                          Last: {formatDistanceToNow(new Date(config.lastUsed), { addSuffix: true })}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div data-testid={`config-restrictions-${config.id}`}>
                    <div className="font-medium">Restrictions</div>
                    <div className="text-muted-foreground space-y-1">
                      {config.minOrderValue && <Badge variant="outline" className="text-xs">Min ${config.minOrderValue}</Badge>}
                      {!config.appliesToSubscriptions && <Badge variant="outline" className="text-xs">No subscriptions</Badge>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
          </div>
        </div>

        {/* Right column - 1/3 width for email preview */}
        <div className="lg:col-span-1">
          <AgentEmailPreview 
            agentType="promo-code"
            agentDisplayName="Promo Code Agent"
            sampleSubject="Re: Promo Code Applied"
            sampleContent={promoCodeEmailTemplate}
          />
        </div>
      </div>
          </div>
        </main>
      </div>
    </div>
  );
}