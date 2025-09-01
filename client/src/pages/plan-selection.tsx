import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Crown, Zap, ArrowRight, Clock, Shield, TrendingUp, Check, Star, Users, Building } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatCostPerResolution, formatIncludedAutomations, getAllPlanConfigs } from "../../../shared/pricing-utils";
import { useLocation } from "wouter";

interface BillingPlan {
  id: string;
  name: string;
  displayName: string;
  price: string;
  resolutions: number;
  storeLimit: number;
  emailLimit: number | null;
  features: string[];
  isActive: boolean;
  createdAt: string;
}

// Generate fallback plans from centralized configuration - no more hardcoding!
const fallbackPlans: BillingPlan[] = getAllPlanConfigs().map(config => ({
  id: config.id,
  name: config.name,
  displayName: config.displayName,
  price: config.price.toFixed(2),
  resolutions: config.resolutions,
  storeLimit: config.storeLimit,
  emailLimit: config.emailLimit,
  features: [...config.features],
  isActive: config.isActive,
  createdAt: new Date().toISOString()
}));

export default function PlanSelection() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isSelecting, setIsSelecting] = useState(false);

  // Fetch available billing plans
  const { data: plansData, isLoading: plansLoading, error: plansError } = useQuery<BillingPlan[]>({
    queryKey: ["/api/billing/plans"],
    retry: 3,
  });

  // Plan selection mutation
  const selectPlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      setIsSelecting(true);
      const response = await apiRequest('POST', '/api/billing/select-trial-plan', {
        planId
      });
      return response;
    },
    onSuccess: () => {
      setIsSelecting(false);
      toast({
        title: 'Welcome to Delight Desk!',
        description: 'Your 7-day free trial has started. Redirecting to your dashboard...',
      });
      setTimeout(() => {
        setLocation('/dashboard');
      }, 1500);
    },
    onError: (error: Error) => {
      setIsSelecting(false);
      toast({
        title: 'Plan Selection Failed',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    }
  });

  const handleSelectPlan = async (planId: string) => {
    if (isSelecting || selectPlanMutation.isPending) return;

    console.log('[PLAN_SELECTION] Selecting plan:', planId);
    console.log('[PLAN_SELECTION] Available plans:', plansData);
    console.log('[PLAN_SELECTION] Final plan ID to send:', planId);
    
    selectPlanMutation.mutate(planId);
  };

  // Loading state
  if (plansLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading plans...</p>
        </div>
      </div>
    );
  }

  // Use fallback plans if API fails or returns empty data, then sort by price
  const rawPlans = (plansData && plansData.length > 0) ? plansData : fallbackPlans;
  const plans = rawPlans.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));

  // Only show error if we have a real error and no fallback data
  if (plansError && !plans.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Failed to load plans. Please refresh the page.</p>
          <Button onClick={() => window.location.reload()}>Refresh Page</Button>
        </div>
      </div>
    );
  }

  // Get plan icons and colors
  const getPlanIcon = (planName: string) => {
    switch (planName.toLowerCase()) {
      case 'solopreneur': return <Zap className="h-6 w-6" />;
      case 'growth': return <TrendingUp className="h-6 w-6" />;
      case 'scale': return <Crown className="h-6 w-6" />;
      default: return <Zap className="h-6 w-6" />;
    }
  };

  const getPlanColor = (planName: string) => {
    switch (planName.toLowerCase()) {
      case 'solopreneur': return 'bg-blue-100 text-blue-600';
      case 'growth': return 'bg-purple-100 text-purple-600';
      case 'scale': return 'bg-amber-100 text-amber-600';
      default: return 'bg-blue-100 text-blue-600';
    }
  };

  const isPopular = (planName: string) => {
    return planName.toLowerCase() === 'growth';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header Section */}
      <div className="max-w-6xl mx-auto px-6 pt-12 pb-8">
        {/* Success Banner */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 text-sm px-4 py-2 rounded-full mb-6">
            <CheckCircle className="h-4 w-4" />
            Account Created Successfully!
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Simple, Usage-Based Pricing
          </h1>

          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Start your <strong>7-day free trial</strong>. Every plan includes full platform access. 
            Pay only when AI automations resolve customer issues.
          </p>

          {/* Value Props */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-gray-100">
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Save 20+ Hours Weekly</h3>
              <p className="text-gray-600 text-sm">
                Automate order status, refunds, and subscription management so you can focus on growing your business.
              </p>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-gray-100">
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Shield className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">100% Confidence Rule</h3>
              <p className="text-gray-600 text-sm">
                AI only handles simple transactional requests. Complex issues stay with humans for perfect customer care.
              </p>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-gray-100">
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">75% Faster Resolution</h3>
              <p className="text-gray-600 text-sm">
                Instant responses for order tracking, promo codes, and subscription changes. Happy customers, less work.
              </p>
            </div>
          </div>
        </div>

        {/* Dynamic Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => {
            const pricePerResolution = (parseFloat(plan.price) / (plan.resolutions || 1)).toFixed(2);
            const isPopularPlan = isPopular(plan.name);
            const borderClass = isPopularPlan ? 'border-purple-500' : 'border-white/20';
            const scaleClass = isPopularPlan ? 'transform scale-105' : '';
            const buttonClass = isPopularPlan ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-900 hover:bg-gray-800';
            
            return (
              <div key={plan.id} className={`bg-white/10 backdrop-blur-xl rounded-3xl border ${borderClass} p-8 text-center relative shadow-2xl ${scaleClass}`}>
                {isPopularPlan && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-2 rounded-full text-sm font-medium">
                      Most Popular
                    </div>
                  </div>
                )}
                
                <div className={`mb-6 ${isPopularPlan ? 'mt-4' : ''}`}>
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-4 ${getPlanColor(plan.name)}`}>
                    {getPlanIcon(plan.name)}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.displayName}</h3>
                  <p className="text-gray-600">
                    {plan.name === 'solopreneur' && 'Perfect for small stores'}
                    {plan.name === 'growth' && 'For growing businesses'}
                    {plan.name === 'scale' && 'For enterprise operations'}
                  </p>
                </div>
                
                <div className="mb-8">
                  <div className="text-5xl font-bold text-gray-900 mb-2">${parseInt(plan.price)}</div>
                  <div className="text-gray-600 mb-4">per month</div>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="text-sm text-gray-600 mb-2">Pay only for AI automations:</div>
                    <div className="text-lg font-semibold text-green-600">
                      {formatCostPerResolution(plan.name)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatIncludedAutomations(parseFloat(plan.price), plan.name)}
                    </div>
                  </div>
                </div>
                
                <div className="mb-8">
                  <div className="space-y-3">
                    {plan.features.map((feature, index) => (
                      <div key={index} className="flex items-center justify-center space-x-2 text-sm text-gray-700">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="text-center">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <Button
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={isSelecting || selectPlanMutation.isPending}
                  className={`w-full ${buttonClass} text-white`}
                  data-testid={`button-select-plan-${plan.name}`}
                >
                  {isSelecting || selectPlanMutation.isPending ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                      Starting Trial...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      Start 7-Day Free Trial
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Trust Section */}
        <div className="text-center mt-16 relative z-10">
          <p className="text-gray-600 mb-4">
            🚀 Average 73% reduction in response time • 🛡️ SOC 2 compliant • 💰 ROI positive within 30 days
          </p>
          <p className="text-sm text-gray-500">
            Built for e-commerce stores ready to scale customer service with AI automation.
          </p>
        </div>
      </div>
    </div>
  );
}