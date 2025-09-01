import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { updateUserProfileSchema, changeEmailSchema, changePasswordSchema } from "@shared/schema";
import type { UpdateUserProfile, ChangeEmail, ChangePassword } from "@shared/schema";
import { z } from "zod";
import { 
  User, 
  CreditCard, 
  Shield, 
  Store, 
  Zap,
  ArrowLeft,
  Trash2,
  AlertTriangle,
  Download,
  Clock,
  AlertCircle,
  CheckCircle
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { BillingWrapper } from "@/components/billing/billing-wrapper";
import { NewSubscriptionManager } from "@/components/billing/new-subscription-manager";
import { AddPaymentMethodModal } from "@/components/billing/add-payment-method-modal";
import { DirectPaymentModal } from "@/components/billing/direct-payment-modal";
import { UsageDashboard } from "@/components/usage-dashboard";
import { useLocation } from "wouter";
import Sidebar from "@/components/layout/sidebar";
import TopBar from "@/components/layout/topbar";
import { useAuth } from "@/hooks/use-auth";

export default function AccountSettings() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("profile");
  const [, setLocation] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDirectPaymentModal, setShowDirectPaymentModal] = useState(false);
  const { user: authUser, isLoading: authLoading } = useAuth();

  useEffect(() => {
    document.title = "Account Settings - Delight Desk";
  }, []);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !authUser) {
      setLocation('/login');
    }
  }, [authUser, authLoading, setLocation]);

  // Get authenticated user ID
  const userId = authUser?.id;

  // Fetch user profile and billing data using authenticated user ID
  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: [`/api/account/profile/${userId}`],
    enabled: !!userId, // Only fetch when we have a user ID
  });

  const { data: billingPlans } = useQuery({
    queryKey: ["/api/billing/plans"],
  });

  const { data: storeData } = useQuery({
    queryKey: [`/api/stores/${userId}/limits`],
    enabled: !!userId,
  });

  const user = (profileData as any)?.user || {};
  const billing = (profileData as any)?.billing || {};
  const plan = (profileData as any)?.plan || {};
  
  // Enhanced debug logging with user context
  console.log('[AccountSettings] authUser:', authUser);
  console.log('[AccountSettings] userId:', userId);
  console.log('[AccountSettings] profileData:', profileData);
  console.log('[AccountSettings] plan data:', plan);
  console.log('[AccountSettings] billing data:', billing);
  
  // Log production event for debugging
  useEffect(() => {
    if (userId && profileData) {
      fetch('/api/system/log-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'account_settings_loaded',
          data: {
            userId,
            hasProfileData: !!profileData,
            hasPlan: !!plan,
            hasBilling: !!billing,
            planDisplayName: plan?.displayName
          },
          userId
        })
      }).catch(console.error);
    }
  }, [userId, profileData, plan, billing]);



  // Show loading if auth is loading or profile is loading
  if (authLoading || profileLoading || !userId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading account settings...</div>
      </div>
    );
  }

  // If we have no profile data after loading, show error
  if (!profileData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Failed to load account data. Please refresh the page.</div>
      </div>
    );
  }

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
              <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">Account Settings</h1>
                <p className="text-gray-600 mt-2">
                  Manage your profile, billing, and store connections
                </p>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-6">
                  <TabsTrigger value="profile" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Profile
                  </TabsTrigger>
                  <TabsTrigger value="subscription" className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Billing & Subscription
                  </TabsTrigger>
                  <TabsTrigger value="usage" className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Usage
                  </TabsTrigger>
                  <TabsTrigger value="security" className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Security
                  </TabsTrigger>
                  <TabsTrigger value="stores" className="flex items-center gap-2">
                    <Store className="h-4 w-4" />
                    Stores
                  </TabsTrigger>
                </TabsList>

                {/* Profile Tab */}
                <TabsContent value="profile">
                  <ProfileSection user={user} userId={userId || ''} />
                </TabsContent>

                {/* Billing & Subscription Tab */}
                <TabsContent value="subscription">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">Billing & Subscription</h2>
                        <p className="text-gray-600">Manage your subscription, payment methods, and billing preferences</p>
                      </div>
                    </div>
                    <NewSubscriptionManager 
                      userId={userId || ''} 
                      onUpdate={() => {
                        queryClient.invalidateQueries({ queryKey: [`/api/account/profile/${userId}`] });
                      }} 
                    />
                  </div>
                </TabsContent>

                {/* Usage Tab */}
                <TabsContent value="usage">
                  <UsageDashboard userId={userId || ''} />
                </TabsContent>

                {/* Security Tab */}
                <TabsContent value="security">
                  <SecuritySection userId={userId || ''} />
                </TabsContent>

                {/* Stores Tab */}
                <TabsContent value="stores">
                  <StoresSection storeData={storeData} plan={plan} />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </main>
      </div>

      {/* Add Payment Method Modal */}
      <AddPaymentMethodModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        currentPlan={plan || undefined}
        userId={userId || ''}
        userEmail={user?.email || ''}
        onSuccess={() => {
          setShowPaymentModal(false);
          queryClient.invalidateQueries({ queryKey: [`/api/account/profile/${userId}`] });
          toast({
            title: "Payment Method Added",
            description: "Your payment method has been successfully added!",
          });
        }}
      />

      {/* Direct Payment Method Modal */}
      <DirectPaymentModal
        isOpen={showDirectPaymentModal}
        onClose={() => setShowDirectPaymentModal(false)}
        currentPlan={billing || undefined}
        userId={userId || ''}
        userEmail={user?.email || ''}
        userName={user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : ''}
        onSuccess={() => {
          setShowDirectPaymentModal(false);
          queryClient.invalidateQueries({ queryKey: [`/api/account/profile/${userId}`] });
          toast({
            title: "Payment Method Added",
            description: "Your payment method has been successfully added!",
          });
        }}
      />
    </div>
  );
}

function ProfileSection({ user, userId }: { user: any; userId: string }) {
  const { toast } = useToast();

  const form = useForm<UpdateUserProfile>({
    resolver: zodResolver(updateUserProfileSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      company: user?.company || "",
      phone: user?.phone || "",
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: UpdateUserProfile) => {
      const response = await fetch(`/api/account/profile/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update profile");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/account/profile/${userId}`] });
      toast({
        title: "Profile updated",
        description: "Your profile information has been saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: UpdateUserProfile) => {
    updateProfileMutation.mutate(data);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>
          Update your personal details and contact information
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="company"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input {...field} type="tel" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="pt-4">
              <Button 
                type="submit" 
                disabled={updateProfileMutation.isPending}
              >
                {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>

        <div className="mt-6 pt-6 border-t">
          <div className="space-y-2">
            <h3 className="font-medium">Account Email</h3>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{user?.email}</span>
              <Button variant="outline" size="sm">
                Change Email
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BillingSection({ billing, plan, billingPlans, trialDaysLeft }: any) {
  // Check if user has payment method attached (Stripe customer/subscription exists)
  const hasPaymentMethod = billing?.stripeCustomerId && billing?.stripeSubscriptionId;

  // Get actual plan data for credit numbers
  const starterPlan = billingPlans?.find((p: any) => p.name === 'starter');
  const growthPlan = billingPlans?.find((p: any) => p.name === 'growth'); 
  const scalePlan = billingPlans?.find((p: any) => p.name === 'scale');
  
  // Debug logging to see what's happening
  console.log('[BILLING_DEBUG] Billing data:', billing);
  console.log('[BILLING_DEBUG] hasPaymentMethod:', hasPaymentMethod);
  console.log('[BILLING_DEBUG] stripeCustomerId:', billing?.stripeCustomerId);
  console.log('[BILLING_DEBUG] stripeSubscriptionId:', billing?.stripeSubscriptionId);
  
  // User is truly on trial only if they don't have payment method attached
  const isOnTrial = billing?.status === 'trial' && !hasPaymentMethod;
  
  console.log('[BILLING_DEBUG] isOnTrial:', isOnTrial);
  console.log('[BILLING_DEBUG] billing status:', billing?.status);

  return (
    <div className="space-y-6">
      {/* Current Plan Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-500" />
            Current Plan: {plan?.displayName || 'Starter'}
            {isOnTrial && (
              <Badge variant="secondary" className="ml-2">
                {trialDaysLeft > 0 ? `${trialDaysLeft} days trial` : 'Trial'}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {isOnTrial && trialDaysLeft > 0 ? (
              <div className="flex items-center gap-2 text-amber-600">
                <Clock className="h-4 w-4" />
                {trialDaysLeft} days left in your {plan?.displayName || 'Starter'} trial
              </div>
            ) : isOnTrial && trialDaysLeft === 0 ? (
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-4 w-4" />
                {plan?.displayName || 'Starter'} trial expired - Enter payment details to continue
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                Active {plan?.displayName || 'Starter'} subscription
              </div>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium">Monthly Price</p>
              <p className="text-2xl font-bold">
                ${plan?.price || '0'}<span className="text-sm font-normal">/month</span>
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Store Limit</p>
              <p className="text-lg font-semibold">{plan?.storeLimit || '1'}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Platform Usage</p>
              <p className="text-lg font-semibold">Unlimited</p>
            </div>
          </div>

          {isOnTrial ? (
            <div className="mt-4">
              <Button className="w-full md:w-auto">
                Add Payment Method
              </Button>
            </div>
          ) : hasPaymentMethod ? (
            <div className="mt-4 space-y-2">
              <div className="text-sm text-green-600 font-medium">✓ Payment method on file</div>
              <Button variant="outline" className="w-full md:w-auto">
                Manage Subscription
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Available Plans */}
      <Card>
        <CardHeader>
          <CardTitle>Available Plans</CardTitle>
          <CardDescription>
            Choose the plan that best fits your business needs. All plans include a 7-day free trial.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Pricing Cards - Exact Copy from Homepage */}
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            
            {/* Starter Plan */}
            <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 p-8 text-center relative shadow-2xl">
              {plan?.name === 'starter' && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-gradient-to-r from-blue-500 to-green-500 text-white px-6 py-2 rounded-full text-sm font-medium">
                    Current Plan
                  </div>
                </div>
              )}
              
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Starter</h3>
                <p className="text-gray-600">Perfect for small stores</p>
              </div>
              
              <div className="mb-8">
                <div className="text-5xl font-bold text-gray-900 mb-2">${starterPlan?.price || '9'}</div>
                <div className="text-gray-600 mb-4">per month</div>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="text-sm text-gray-600 mb-2">Monthly AI Credits:</div>
                  <div className="text-lg font-semibold text-green-600">{starterPlan?.monthlyCredits || 115} credits included</div>
                  <div className="text-xs text-gray-500 mt-1">AI order lookups with delivery predictions</div>
                </div>
              </div>
              
              <div className="mb-8">
                <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="font-semibold text-gray-900 mb-2">✓ Full Platform Access Included</div>
                  <div className="text-sm text-gray-600">Quick Actions dashboard, order management, integrations. Pay only when AI automates.</div>
                </div>
                
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-center space-x-2 text-sm text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>🏪 Connect 1 Store Platform</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2 text-sm text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Support: Email</span>
                  </div>
                </div>
              </div>
              
              {plan?.name !== 'starter' && (
                <Button className="w-full bg-gray-900 hover:bg-gray-800 text-white">
                  {plan?.price && parseFloat(plan.price) > 9 ? 'Downgrade' : 'Upgrade'} to Starter
                </Button>
              )}
            </div>

            {/* Growth Plan */}
            <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-purple-500 p-8 text-center relative shadow-2xl transform scale-105">
              {plan?.name === 'growth' ? (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-gradient-to-r from-blue-500 to-green-500 text-white px-6 py-2 rounded-full text-sm font-medium">
                    Current Plan
                  </div>
                </div>
              ) : (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-2 rounded-full text-sm font-medium">
                    Most Popular
                  </div>
                </div>
              )}
              
              <div className="mb-6 mt-4">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Growth</h3>
                <p className="text-gray-600">For growing businesses</p>
              </div>
              
              <div className="mb-8">
                <div className="text-5xl font-bold text-gray-900 mb-2">${growthPlan?.price || '45'}</div>
                <div className="text-gray-600 mb-4">per month</div>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="text-sm text-gray-600 mb-2">Monthly AI Credits:</div>
                  <div className="text-lg font-semibold text-green-600">{growthPlan?.monthlyCredits || 395} credits included</div>
                  <div className="text-xs text-gray-500 mt-1">AI order lookups with delivery predictions</div>
                </div>
              </div>
              
              <div className="mb-8">
                <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="font-semibold text-gray-900 mb-2">✓ Full Platform Access Included</div>
                  <div className="text-sm text-gray-600">Quick Actions dashboard, order management, integrations. Pay only when AI automates.</div>
                </div>
                
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-center space-x-2 text-sm text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>🏪 Connect 2-5 Store Platforms</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2 text-sm text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Support: Priority Email + Phone</span>
                  </div>
                </div>
              </div>
              
              {plan?.name !== 'growth' && (
                <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                  {plan?.price && parseFloat(plan.price) > 45 ? 'Downgrade' : 'Upgrade'} to Growth
                </Button>
              )}
            </div>

            {/* Scale Plan */}
            <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 p-8 text-center relative shadow-2xl">
              {plan?.name === 'scale' && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-gradient-to-r from-blue-500 to-green-500 text-white px-6 py-2 rounded-full text-sm font-medium">
                    Current Plan
                  </div>
                </div>
              )}
              
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Scale</h3>
                <p className="text-gray-600">For enterprise operations</p>
              </div>
              
              <div className="mb-8">
                <div className="text-5xl font-bold text-gray-900 mb-2">${scalePlan?.price || '80'}</div>
                <div className="text-gray-600 mb-4">per month</div>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="text-sm text-gray-600 mb-2">Monthly AI Credits:</div>
                  <div className="text-lg font-semibold text-green-600">{scalePlan?.monthlyCredits?.toLocaleString() || '1,325'} credits included</div>
                  <div className="text-xs text-gray-500 mt-1">AI order lookups with delivery predictions</div>
                </div>
              </div>
              
              <div className="mb-8">
                <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="font-semibold text-gray-900 mb-2">✓ Full Platform Access Included</div>
                  <div className="text-sm text-gray-600">Quick Actions dashboard, order management, integrations. Pay only when AI automates.</div>
                </div>
                
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-center space-x-2 text-sm text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>🏪 Connect 6-10 Store Platforms</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2 text-sm text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Support: Priority + Dedicated Account Manager</span>
                  </div>
                </div>
              </div>
              
              {plan?.name !== 'scale' && (
                <Button className="w-full bg-gray-900 hover:bg-gray-800 text-white">
                  Upgrade to Scale
                </Button>
              )}
            </div>
            
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// PlanCard component removed - pricing cards now use exact homepage structure

function SecuritySection({ userId }: { userId: string }) {
  return (
    <div className="space-y-6">
      <ChangeEmailCard userId={userId} />
      <ChangePasswordCard userId={userId} />
      <DangerZoneCard userId={userId} />
    </div>
  );
}

function ChangeEmailCard({ userId }: { userId: string }) {
  const { toast } = useToast();

  const form = useForm<ChangeEmail & { userId: string }>({
    resolver: zodResolver(z.object({
      userId: z.string(),
      newEmail: z.string().email("Please enter a valid email address"),
      password: z.string().min(1, "Password is required"),
    })),
    defaultValues: {
      userId,
      newEmail: "",
      password: "",
    },
  });

  const changeEmailMutation = useMutation({
    mutationFn: async (data: ChangeEmail & { userId: string }) => {
      const response = await fetch("/api/account/change-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/account/profile/${userId}`] });
      form.reset();
      toast({
        title: "Email changed",
        description: "Your email address has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to change email",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change Email Address</CardTitle>
        <CardDescription>
          Update the email address associated with your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => changeEmailMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="newEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Email Address</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              disabled={changeEmailMutation.isPending}
            >
              {changeEmailMutation.isPending ? "Changing..." : "Change Email"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function ChangePasswordCard({ userId }: { userId: string }) {
  const { toast } = useToast();

  const form = useForm<ChangePassword & { userId: string }>({
    resolver: zodResolver(z.object({
      userId: z.string(),
      currentPassword: z.string().min(1, "Current password is required"),
      newPassword: z.string().min(8, "Password must be at least 8 characters"),
      confirmPassword: z.string().min(1, "Please confirm your new password"),
    }).refine((data) => data.newPassword === data.confirmPassword, {
      message: "Passwords don't match",
      path: ["confirmPassword"],
    })),
    defaultValues: {
      userId,
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: ChangePassword & { userId: string }) => {
      const response = await fetch("/api/account/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: () => {
      form.reset();
      toast({
        title: "Password changed",
        description: "Your password has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to change password",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change Password</CardTitle>
        <CardDescription>
          Update your account password for security
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => changePasswordMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Password</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm New Password</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              disabled={changePasswordMutation.isPending}
            >
              {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function DangerZoneCard({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  
  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/account/delete/${userId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Account deleted",
        description: "Your account and all associated data have been permanently removed.",
      });
      // Clear any cached data and redirect to homepage
      queryClient.clear();
      setLocation('/');
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete account",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDeleteAccount = () => {
    if (deleteConfirmation !== "DELETE") {
      toast({
        title: "Confirmation required",
        description: "Please type 'DELETE' to confirm account deletion.",
        variant: "destructive",
      });
      return;
    }
    deleteAccountMutation.mutate();
  };

  return (
    <Card className="border-red-200 bg-red-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-700">
          <AlertTriangle className="h-5 w-5" />
          Danger Zone
        </CardTitle>
        <CardDescription className="text-red-600">
          Irreversible actions that will permanently affect your account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 border border-red-200 rounded-lg bg-red-50">
          <div className="flex items-start gap-3">
            <Trash2 className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-semibold text-red-900 mb-1">Delete Account</h4>
              <p className="text-sm text-red-700 mb-3">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
              <ul className="text-xs text-red-600 mb-4 space-y-1">
                <li>• All your profile and billing information will be removed</li>
                <li>• Store connections and integrations will be disconnected</li>
                <li>• Email automation rules and history will be deleted</li>
                <li>• Any active subscriptions will be cancelled</li>
              </ul>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-red-700">
                      <AlertTriangle className="h-5 w-5" />
                      Are you absolutely sure?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-3">
                      <p>
                        This action will permanently delete your Delight Desk account and cannot be undone. 
                        All your data will be permanently removed from our servers.
                      </p>
                      <div className="bg-red-50 border border-red-200 rounded p-3">
                        <p className="font-medium text-red-900 mb-2">This will delete:</p>
                        <ul className="text-sm text-red-700 space-y-1">
                          <li>• Your profile and account settings</li>
                          <li>• All store connections and integrations</li>
                          <li>• Email automation rules and templates</li>
                          <li>• Order history and customer data</li>
                          <li>• Billing information and invoices</li>
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="delete-confirmation" className="text-sm font-medium text-gray-700">
                          To confirm, type <span className="font-mono bg-gray-100 px-1 rounded">DELETE</span> in the box below:
                        </label>
                        <Input
                          id="delete-confirmation"
                          value={deleteConfirmation}
                          onChange={(e) => setDeleteConfirmation(e.target.value)}
                          placeholder="Type DELETE to confirm"
                          className="font-mono"
                        />
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setDeleteConfirmation("")}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      disabled={deleteConfirmation !== "DELETE" || deleteAccountMutation.isPending}
                      className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
                    >
                      {deleteAccountMutation.isPending ? "Deleting..." : "Delete Account Forever"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StoresSection({ storeData, plan }: any) {
  const currentCount = storeData?.currentCount || 0;
  const limit = storeData?.limit || 1;
  const canAddMore = storeData?.canAddMore || false;
  const connections = storeData?.connections || [];

  const progressPercentage = (currentCount / limit) * 100;

  return (
    <div className="space-y-6">
      {/* Store Usage Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Store Connections</CardTitle>
          <CardDescription>
            Manage your connected e-commerce stores
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {currentCount} of {limit} stores connected
              </span>
              <Badge variant={canAddMore ? "default" : "secondary"}>
                {canAddMore ? "Can add more" : "Limit reached"}
              </Badge>
            </div>
            
            <Progress value={progressPercentage} className="h-2" />
            
            {!canAddMore && (
              <div className="flex items-center gap-2 text-amber-600 text-sm">
                <AlertCircle className="h-4 w-4" />
                Upgrade your plan to connect more stores
              </div>
            )}
          </div>

          <div className="mt-6">
            <Button disabled={!canAddMore}>
              <Store className="h-4 w-4 mr-2" />
              Add New Store
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Connected Stores List */}
      <Card>
        <CardHeader>
          <CardTitle>Connected Stores</CardTitle>
          <CardDescription>
            Your currently connected e-commerce platforms
          </CardDescription>
        </CardHeader>
        <CardContent>
          {connections.length === 0 ? (
            <div className="text-center py-8">
              <Store className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">No stores connected yet</p>
              <p className="text-sm text-gray-400">
                Connect your first store to start automating customer service
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {connections.map((connection: any) => (
                <div key={connection.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Store className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">{connection.storeUrl}</p>
                      <p className="text-sm text-gray-500 capitalize">
                        {connection.platform}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={connection.isActive ? "default" : "secondary"}>
                      {connection.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Button variant="outline" size="sm">
                      Manage
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