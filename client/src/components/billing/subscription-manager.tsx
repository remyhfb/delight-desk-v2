import { useState } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { stripePromise, stripeConfig } from '@/lib/stripe';
import { PaymentMethodForm } from './payment-method-form';
import { AddPaymentMethodModal } from './add-payment-method-modal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CreditCard, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Zap,
  Crown
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { formatCostPerResolution, formatIncludedAutomations } from "@shared/pricing-utils";

interface SubscriptionManagerProps {
  userId: string;
  userEmail: string;
  userName?: string;
  currentPlan?: any;
  billing?: any;
  availablePlans: any[];
  onUpdate: () => void;
}

export function SubscriptionManager({
  userId,
  userEmail,
  userName,
  currentPlan,
  billing,
  availablePlans,
  onUpdate
}: SubscriptionManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);

  const updateSubscriptionMutation = useMutation({
    mutationFn: async ({ newPlanId }: { newPlanId: string }) => {
      return await apiRequest('POST', '/api/billing/update-subscription', {
        userId,
        newPlanId
      });
    },
    onSuccess: (data, { newPlanId }) => {
      const selectedPlan = availablePlans?.find(p => p.id === newPlanId);
      toast({
        title: 'Plan Changed Successfully',
        description: `You have successfully changed to the ${selectedPlan?.displayName} plan.`,
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

  const cancelSubscriptionMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/billing/cancel-subscription', {
        userId
      });
    },
    onSuccess: () => {
      toast({
        title: 'Subscription Cancelled',
        description: 'Your subscription will end at the end of the current billing period.',
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

  const handlePlanSelect = (plan: any) => {
    console.log('handlePlanSelect called with plan:', plan);
    console.log('billing?.stripeSubscriptionId:', billing?.stripeSubscriptionId);
    
    if (!billing?.stripeSubscriptionId) {
      // Trial user - show payment modal to secure subscription
      console.log('Setting selectedPlan and showPaymentModal to true');
      setSelectedPlan(plan);
      setShowPaymentModal(true);
    } else {
      // Update existing subscription
      updateSubscriptionMutation.mutate({ newPlanId: plan.id });
    }
  };

  const handlePaymentSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/account/profile'] });
    onUpdate();
    setShowPaymentModal(false);
    setSelectedPlan(null);
  };

  const isOnTrial = billing?.status === 'trial';
  const isActive = billing?.status === 'active';
  const isCancelled = billing?.status === 'cancelled';
  const isExpired = billing?.status === 'expired';

  // Calculate trial days remaining
  const trialDaysLeft = billing?.trialEndsAt 
    ? Math.max(0, Math.ceil((new Date(billing.trialEndsAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  if (showPaymentForm && selectedPlan) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <Button 
            variant="ghost" 
            onClick={() => setShowPaymentForm(false)}
          >
            ← Back to Plans
          </Button>
        </div>
        
        <Elements 
          stripe={stripePromise} 
          options={{
            mode: 'setup',
            currency: 'usd',
            paymentMethodCreation: 'manual',
            appearance: {
              theme: 'stripe',
              variables: {
                colorPrimary: '#3b82f6',
                colorBackground: '#ffffff',
                colorText: '#1f2937',
                colorDanger: '#ef4444',
                fontFamily: 'Inter, system-ui, sans-serif',
                spacingUnit: '4px',
                borderRadius: '6px',
              },
            },
          }}
        >
          <PaymentMethodForm
            planId={selectedPlan.id}
            planName={selectedPlan.displayName}
            planPrice={selectedPlan.price ? parseFloat(selectedPlan.price.toString()) : 0}
            userId={userId}
            userEmail={userEmail}
            userName={userName}
            onSuccess={handlePaymentSuccess}
            onCancel={() => setShowPaymentForm(false)}
          />
        </Elements>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Trial Status */}
      {isOnTrial && currentPlan && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-full">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">You're currently on the {currentPlan.displayName} Plan (Trial)</h3>
                <p className="text-sm text-gray-600">
                  {trialDaysLeft > 0 
                    ? `Your trial ends in ${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'}`
                    : 'Your trial ends today'
                  }
                </p>
              </div>
            </div>
            <Button 
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => handlePlanSelect(currentPlan)}
            >
              Add Payment Method
            </Button>
          </div>
        </div>
      )}

      {/* Available Plans - Exact Copy from Homepage */}
      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mt-12">
        
        {/* Starter Plan */}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 p-8 text-center relative shadow-2xl">
          {currentPlan?.name === 'starter' && (
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
            <div className="text-5xl font-bold text-gray-900 mb-2">$9</div>
            <div className="text-gray-600 mb-4">per month</div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="text-sm text-gray-600 mb-2">Pay only for AI automations:</div>
              <div className="text-lg font-semibold text-green-600">{formatCostPerResolution('solopreneur')}</div>
              <div className="text-xs text-gray-500 mt-1">{formatIncludedAutomations(9, 'solopreneur')}</div>
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
          
          {currentPlan?.name !== 'solopreneur' && (
            <Button 
              className="w-full bg-gray-900 hover:bg-gray-800 text-white"
              onClick={() => handlePlanSelect(availablePlans.find(p => p.name === 'solopreneur')!)}
              disabled={updateSubscriptionMutation.isPending}
            >
              Downgrade to Solopreneur
            </Button>
          )}
          
          {currentPlan?.name === 'solopreneur' && (
            <div className="space-y-2">
              {isOnTrial && (
                <Button
                  className="w-full bg-gray-900 hover:bg-gray-800 text-white"
                  onClick={() => {
                    console.log('Add Payment Method button clicked!');
                    const soloPlan = availablePlans.find(p => p.name === 'solopreneur');
                    console.log('Found solopreneur plan:', soloPlan);
                    handlePlanSelect(soloPlan!);
                  }}
                  disabled={updateSubscriptionMutation.isPending}
                  data-testid="button-add-payment-solopreneur"
                >
                  Add Payment Method
                </Button>
              )}
              
              {billing?.stripeSubscriptionId && isActive && !isCancelled && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => cancelSubscriptionMutation.mutate()}
                  disabled={cancelSubscriptionMutation.isPending}
                >
                  Cancel Subscription
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Growth Plan */}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-purple-500 p-8 text-center relative shadow-2xl transform scale-105">
          {currentPlan?.name === 'growth' ? (
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
            <div className="text-5xl font-bold text-gray-900 mb-2">$45</div>
            <div className="text-gray-600 mb-4">per month</div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="text-sm text-gray-600 mb-2">Pay only for AI automations:</div>
              <div className="text-lg font-semibold text-green-600">{formatCostPerResolution('growth')}</div>
              <div className="text-xs text-gray-500 mt-1">{formatIncludedAutomations(45, 'growth')}</div>
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
          
          {currentPlan?.name !== 'growth' && (
            <Button 
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => handlePlanSelect(availablePlans.find(p => p.name === 'growth')!)}
              disabled={updateSubscriptionMutation.isPending}
            >
              {currentPlan?.name === 'starter' ? 'Upgrade' : 'Downgrade'} to Growth
            </Button>
          )}
          
          {currentPlan?.name === 'growth' && (
            <div className="space-y-2">
              {isOnTrial && (
                <Button
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={() => {
                    console.log('Growth Add Payment Method button clicked!');
                    const growthPlan = availablePlans.find(p => p.name === 'growth');
                    console.log('Found growth plan:', growthPlan);
                    handlePlanSelect(growthPlan!);
                  }}
                  disabled={updateSubscriptionMutation.isPending}
                  data-testid="button-add-payment-growth"
                >
                  Add Payment Method
                </Button>
              )}
              
              {billing?.stripeSubscriptionId && isActive && !isCancelled && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => cancelSubscriptionMutation.mutate()}
                  disabled={cancelSubscriptionMutation.isPending}
                >
                  Cancel Subscription
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Scale Plan */}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 p-8 text-center relative shadow-2xl">
          {currentPlan?.name === 'scale' && (
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
            <div className="text-5xl font-bold text-gray-900 mb-2">$80</div>
            <div className="text-gray-600 mb-4">per month</div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="text-sm text-gray-600 mb-2">Pay only for AI automations:</div>
              <div className="text-lg font-semibold text-green-600">{formatCostPerResolution('scale')}</div>
              <div className="text-xs text-gray-500 mt-1">{formatIncludedAutomations(80, 'scale')}</div>
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
          
          {currentPlan?.name !== 'scale' && (
            <Button 
              className="w-full bg-gray-900 hover:bg-gray-800 text-white"
              onClick={() => handlePlanSelect(availablePlans.find(p => p.name === 'scale')!)}
              disabled={updateSubscriptionMutation.isPending}
            >
              Upgrade to Scale
            </Button>
          )}
          
          {currentPlan?.name === 'scale' && (
            <div className="space-y-2">
              {isOnTrial && (
                <Button
                  className="w-full bg-gray-900 hover:bg-gray-800 text-white"
                  onClick={() => handlePlanSelect(availablePlans.find(p => p.name === 'scale')!)}
                  disabled={updateSubscriptionMutation.isPending}
                >
                  Add Payment Method
                </Button>
              )}
              
              {billing?.stripeSubscriptionId && isActive && !isCancelled && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => cancelSubscriptionMutation.mutate()}
                  disabled={cancelSubscriptionMutation.isPending}
                >
                  Cancel Subscription
                </Button>
              )}
            </div>
          )}
        </div>
        
      </div>

      <AddPaymentMethodModal
        isOpen={showPaymentModal}
        onClose={() => {
          console.log('Modal closing');
          setShowPaymentModal(false);
        }}
        userId={userId}
        userEmail={userEmail}
        userName={userName}
        currentPlan={selectedPlan}
        onSuccess={handlePaymentSuccess}
      />
      
      {/* Debug info */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{ position: 'fixed', bottom: 0, right: 0, background: 'black', color: 'white', padding: '8px', fontSize: '12px', zIndex: 9999 }}>
          Modal: {showPaymentModal ? 'OPEN' : 'CLOSED'} | Plan: {selectedPlan?.name || 'none'}
        </div>
      )}
    </div>
  );
}