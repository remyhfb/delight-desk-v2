import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, CreditCard, Star, Settings, Trash2, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { formatCostPerResolution, formatIncludedAutomations } from "@shared/pricing-utils";
import { DirectPaymentModal } from './direct-payment-modal';

interface Plan {
  id: string;
  name: string;
  displayName: string;
  price: string;
  storeLimit: number;
  emailLimit: number | null;
  features: string[];
  isActive: boolean;
  createdAt: string;
}

interface Billing {
  id: string;
  userId: string;
  planId: string;
  status: 'trial' | 'active' | 'cancelled' | 'expired';
  trialEndsAt: string | null;
  billingCycleStart: string | null;
  billingCycleEnd: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  aftershipDailyCount: number;
  aftershipMonthlyCount: number;
  openaiDailyCount: number;
  openaiMonthlyCount: number;
  lastResetDaily: string;
  lastResetMonthly: string;
  isBetaTester: boolean;
  betaTesterGrantedAt: string | null;
  betaTesterGrantedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  username: string;
}

interface NewSubscriptionManagerProps {
  userId: string;
  onUpdate: () => void;
}

export function NewSubscriptionManager({ userId, onUpdate }: NewSubscriptionManagerProps) {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user profile data
  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ['/api/account/profile', userId],
    queryFn: () => apiRequest('GET', `/api/account/profile/${userId}`).then(res => res.json()),
    enabled: !!userId,
  });

  // Fetch payment methods if user has a Stripe customer ID
  const { data: paymentMethodsData, isLoading: paymentMethodsLoading } = useQuery({
    queryKey: ['/api/billing/payment-methods', profileData?.billing?.stripeCustomerId],
    queryFn: () => apiRequest('GET', `/api/billing/payment-methods/${profileData?.billing?.stripeCustomerId || ''}`).then(res => res.json()),
    enabled: !!profileData?.billing?.stripeCustomerId,
  });

  // Fetch all available plans
  const { data: plansData, isLoading: plansLoading, error: plansError } = useQuery({
    queryKey: ['/api/billing/plans'],
    queryFn: () => apiRequest('GET', '/api/billing/plans').then(res => res.json()),
  });



  const user: User | null = profileData?.user || null;
  const billing: Billing | null = profileData?.billing || null;
  const currentPlan: Plan | null = profileData?.plan || null;
  const availablePlans: Plan[] = (plansData || []).sort((a: Plan, b: Plan) => parseFloat(a.price) - parseFloat(b.price));
  const hasPaymentMethods = paymentMethodsData?.hasPaymentMethods || false;

  // Update subscription mutation
  const updateSubscriptionMutation = useMutation({
    mutationFn: (data: { newPlanId: string }) => 
      apiRequest('POST', '/api/billing/update-subscription', { ...data, userId }).then(res => res.json()),
    onSuccess: () => {
      toast({
        title: 'Subscription Updated',
        description: 'Your subscription has been updated successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/account/profile'] });
      onUpdate();
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Cancel subscription mutation
  const cancelSubscriptionMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/billing/cancel-subscription', { userId }).then(res => res.json()),
    onSuccess: () => {
      toast({
        title: 'Subscription Cancelled',
        description: 'Your subscription has been cancelled successfully. Access continues until the end of your billing period.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/account/profile'] });
      onUpdate();
    },
    onError: (error: Error) => {
      toast({
        title: 'Cancellation Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Billing portal mutation
  const billingPortalMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/billing/create-portal-session', { userId }).then(res => res.json()),
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, '_blank');
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Portal Access Failed',
        description: error.message || 'Unable to access billing portal. Please contact support.',
        variant: 'destructive',
      });
    }
  });

  // Start trial mutation for new users
  const startTrialMutation = useMutation({
    mutationFn: (data: { planId: string }) => 
      apiRequest('POST', '/api/billing/select-trial-plan', { ...data, userId }).then(res => res.json()),
    onSuccess: () => {
      toast({
        title: 'Trial Started',
        description: 'Your free trial has been started successfully!',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/account/profile'] });
      onUpdate();
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Start Trial',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  const handlePlanSelect = (plan: Plan) => {
    console.log('Plan selected:', plan);
    
    if (!billing) {
      // New user - start trial without payment method
      startTrialMutation.mutate({ planId: plan.id });
    } else if (billing.status === 'cancelled' && hasPaymentMethods) {
      // Cancelled user with payment method - resume and upgrade
      updateSubscriptionMutation.mutate({ newPlanId: plan.id });
    } else if (billing.status === 'cancelled' && !hasPaymentMethods) {
      // Cancelled user without payment method - show payment modal
      setSelectedPlan(plan);
      setShowPaymentModal(true);
    } else if (billing.status === 'trial') {
      // Trial user - always allow plan changes without payment method requirement
      updateSubscriptionMutation.mutate({ newPlanId: plan.id });
    } else if (billing.stripeSubscriptionId) {
      // Existing subscriber - update subscription
      updateSubscriptionMutation.mutate({ newPlanId: plan.id });
    } else {
      // Fallback - show payment modal
      setSelectedPlan(plan);
      setShowPaymentModal(true);
    }
  };

  const handleAddPaymentMethod = (plan: Plan) => {
    // Specifically for adding payment method to current plan
    setSelectedPlan(plan);
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = () => {
    // Invalidate all relevant queries to refresh data
    queryClient.invalidateQueries({ queryKey: ['/api/account/profile'] });
    queryClient.invalidateQueries({ queryKey: ['/api/billing/payment-methods'] });
    onUpdate();
    setShowPaymentModal(false);
    setSelectedPlan(null);
    toast({
      title: 'Payment Added Successfully',
      description: 'Your payment method has been secured for your trial!',
    });
  };

  if (profileLoading || plansLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-600">Unable to load user information.</p>
      </div>
    );
  }

  // Handle users without billing data - show setup flow
  if (!billing) {
    return (
      <div className="space-y-8">
        {/* Setup Header */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Welcome to Delight Desk</CardTitle>
            <CardDescription>
              Get started with your free trial. No credit card required.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-blue-900">Ready to Start Your Free Trial</span>
              </div>
              <p className="text-sm text-blue-700">
                Choose a plan below to start your 7-day free trial. You can cancel anytime.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Available Plans for Setup */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Choose Your Plan</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {availablePlans.map((plan) => {
              const isPopular = plan.name === 'growth';
              
              return (
                <Card key={plan.id} className={`relative ${isPopular ? 'border-purple-200 ring-2 ring-purple-100' : ''}`}>
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                        <Star className="w-3 h-3 mr-1" />
                        Most Popular
                      </Badge>
                    </div>
                  )}
                  
                  <CardHeader className="text-center">
                    <CardTitle className="text-xl">{plan.displayName}</CardTitle>
                    <div className="text-3xl font-bold">${parseInt(plan.price)}</div>
                    <CardDescription>per month</CardDescription>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      {plan.features.map((feature, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="pt-4">
                      <Button
                        variant={isPopular ? "default" : "outline"}
                        className={`w-full ${isPopular ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
                        onClick={() => handlePlanSelect(plan)}
                        disabled={startTrialMutation.isPending || updateSubscriptionMutation.isPending}
                        data-testid={`button-start-trial-${plan.name}`}
                      >
                        {startTrialMutation.isPending ? 'Starting Trial...' : 'Start Free Trial'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Payment Modal for Trial Setup */}
        <DirectPaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          userId={userId}
          userEmail={user.email}
          userName={user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username}
          currentPlan={selectedPlan}
          onSuccess={handlePaymentSuccess}
        />
      </div>
    );
  }

  const isOnTrial = billing.status === 'trial';
  const isActive = billing.status === 'active';
  const isCancelled = billing.status === 'cancelled';
  const hasPaymentMethod = hasPaymentMethods || !!billing.stripeSubscriptionId;

  // Calculate trial days remaining
  const trialDaysLeft = billing.trialEndsAt 
    ? Math.max(0, Math.ceil((new Date(billing.trialEndsAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const userName = user.firstName && user.lastName 
    ? `${user.firstName} ${user.lastName}` 
    : user.username;

  return (
    <div className="space-y-8">
      {/* Current Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Current Subscription</CardTitle>
              <CardDescription>
                {currentPlan?.displayName || 'No active plan'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {isOnTrial && !isCancelled && (
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                  <Clock className="w-3 h-3 mr-1" />
                  {trialDaysLeft} days left
                </Badge>
              )}
              {isActive && (
                <Badge className="bg-green-50 text-green-700 border-green-200">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Active
                </Badge>
              )}
              {isCancelled && (
                <Badge variant="destructive">
                  <Clock className="w-3 h-3 mr-1" />
                  Cancelled • {trialDaysLeft} days left
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isOnTrial && !hasPaymentMethod && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-orange-600" />
                  <span className="font-medium text-orange-900">Trial Active</span>
                </div>
                <p className="text-sm text-orange-700">
                  Your trial ends in {trialDaysLeft} days. Add a payment method to continue using Delight Desk.
                </p>
              </div>
            )}
            
            {isOnTrial && hasPaymentMethod && !isCancelled && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-blue-900">Payment Method Added</span>
                </div>
                <p className="text-sm text-blue-700">
                  Your subscription will automatically begin when your trial ends in {trialDaysLeft} days.
                </p>
              </div>
            )}

            {isOnTrial && isCancelled && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="font-medium text-green-900">Subscription Cancelled</span>
                </div>
                <p className="text-sm text-green-700 mb-3">
                  You won't be charged when your trial ends in {trialDaysLeft} days. You can continue using Delight Desk until then.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Resume subscription by updating status back to trial
                    updateSubscriptionMutation.mutate({ newPlanId: currentPlan?.id || 'trial' });
                  }}
                  disabled={updateSubscriptionMutation.isPending}
                  className="border-blue-200 text-blue-700 hover:bg-blue-50"
                  data-testid="button-resume-subscription"
                >
                  {updateSubscriptionMutation.isPending ? 'Resuming...' : 'Resume Subscription'}
                </Button>
              </div>
            )}

            {isActive && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="font-medium text-green-900">Subscription Active</span>
                </div>
                <p className="text-sm text-green-700">
                  Your subscription is active and will renew automatically.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Billing Management */}
      {(hasPaymentMethod || billing.stripeCustomerId) && (
        <Card>
          <CardHeader>
            <CardTitle>Billing Management</CardTitle>
            <CardDescription>
              Manage your billing settings, payment methods, and subscription
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {/* Billing Portal Button */}
              {billing.stripeCustomerId && (
                <Button 
                  variant="outline" 
                  onClick={() => billingPortalMutation.mutate()}
                  disabled={billingPortalMutation.isPending}
                  data-testid="button-billing-portal"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  {billingPortalMutation.isPending ? 'Opening...' : 'Manage Billing & Invoices'}
                  <ExternalLink className="w-3 h-3 ml-2" />
                </Button>
              )}

              {/* Cancel Subscription Button - Both Active and Trial with Payment Method */}
              {((isActive && billing.stripeSubscriptionId) || (isOnTrial && hasPaymentMethod)) && !isCancelled && (
                <Button 
                  variant="destructive" 
                  onClick={() => cancelSubscriptionMutation.mutate()}
                  disabled={cancelSubscriptionMutation.isPending}
                  data-testid="button-cancel-subscription"
                  className="ml-auto"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {cancelSubscriptionMutation.isPending ? 'Cancelling...' : 'Cancel Subscription'}
                </Button>
              )}
            </div>

            {/* Helper Text */}
            <div className="mt-4 text-xs text-gray-500">
              {isActive && (
                <p>
                  Cancelling will stop future billing. You'll retain access until the end of your current billing period.
                </p>
              )}
              {isOnTrial && hasPaymentMethod && !isCancelled && (
                <p>
                  Cancelling prevents automatic billing when your trial ends. You'll keep full access for the remaining trial period.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Plans */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Available Plans</h3>
        {plansLoading && (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin w-6 h-6 border-4 border-primary border-t-transparent rounded-full" />
            <span className="ml-2 text-gray-600">Loading plans...</span>
          </div>
        )}
        {plansError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-700">Failed to load plans: {plansError.message}</p>
          </div>
        )}
        {!plansLoading && !plansError && availablePlans.length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-yellow-700">No plans available at this time.</p>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {availablePlans.map((plan) => {
            const isCurrentPlan = currentPlan?.id === plan.id;
            
            return (
              <Card key={plan.id} className={`relative ${isCurrentPlan ? 'ring-2 ring-blue-500' : ''}`}>
                {isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-blue-500 text-white">
                      Current Plan
                    </Badge>
                  </div>
                )}
                
                <CardHeader className="text-center">
                  <CardTitle className="text-xl">{plan.displayName}</CardTitle>
                  <div className="text-3xl font-bold">${plan.price}</div>
                  <CardDescription>per month</CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {plan.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="pt-4">
                    {isCurrentPlan ? (
                      <div className="space-y-2">
                        {isOnTrial && !hasPaymentMethod && (
                          <Button
                            className="w-full"
                            onClick={() => handleAddPaymentMethod(plan)}
                            disabled={updateSubscriptionMutation.isPending}
                            data-testid={`button-add-payment-${plan.name}`}
                          >
                            <CreditCard className="w-4 h-4 mr-2" />
                            Add Payment Method
                          </Button>
                        )}
                        
                        {isOnTrial && hasPaymentMethod && !billing.stripeSubscriptionId && !isCancelled && (
                          <Button
                            variant="outline"
                            className="w-full border-blue-200 text-blue-700 hover:bg-blue-50"
                            disabled={true}
                            data-testid={`button-plan-selected-${plan.name}`}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Plan Selected
                          </Button>
                        )}

                        {isCancelled && (
                          <div className="space-y-2">
                            <Button
                              variant="outline"
                              className="w-full border-gray-200 text-gray-600"
                              disabled={true}
                              data-testid={`button-plan-selected-cancelled-${plan.name}`}
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Selected Plan
                            </Button>
                            <Button
                              className="w-full"
                              onClick={() => {
                                updateSubscriptionMutation.mutate({ newPlanId: plan.id });
                              }}
                              disabled={updateSubscriptionMutation.isPending}
                              data-testid={`button-resume-from-plan-${plan.name}`}
                            >
                              {updateSubscriptionMutation.isPending ? 'Resuming...' : 'Resume Subscription'}
                            </Button>
                          </div>
                        )}
                        
                        {hasPaymentMethod && isActive && !isCancelled && (
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => cancelSubscriptionMutation.mutate()}
                            disabled={cancelSubscriptionMutation.isPending}
                            data-testid="button-cancel-subscription"
                          >
                            Cancel Subscription
                          </Button>
                        )}
                        

                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => handlePlanSelect(plan)}
                        disabled={updateSubscriptionMutation.isPending}
                        data-testid={`button-select-${plan.name}`}
                      >
                        {updateSubscriptionMutation.isPending ? (
                          'Updating...'
                        ) : !currentPlan ? (
                          'Select Plan'
                        ) : (
                          parseFloat(plan.price) > parseFloat(currentPlan.price) ? 'Upgrade' :
                          parseFloat(plan.price) < parseFloat(currentPlan.price) ? 'Downgrade' : 'Switch to this Plan'
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Payment Modal */}
      <DirectPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        userId={userId}
        userEmail={user.email}
        userName={userName}
        currentPlan={selectedPlan}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
}