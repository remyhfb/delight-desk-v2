import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Zap, Users, Building, ArrowRight, Star, DollarSign } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { formatCostPerResolution, formatIncludedAutomations, getAllPlanConfigs } from "../../../shared/pricing-utils";

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

export default function Pricing() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  // Fetch available billing plans
  const { data: plansData, isLoading: plansLoading } = useQuery<BillingPlan[]>({
    queryKey: ["/api/billing/plans"],
    retry: 3,
  });

  // Plan selection mutation for authenticated users
  const selectPlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      if (!user) {
        // For non-authenticated users, redirect to signup with plan selection
        setLocation(`/signup?plan=${planId}`);
        return;
      }
      
      // For authenticated users, proceed with plan selection
      const response = await apiRequest('POST', '/api/billing/select-trial-plan', {
        planId
      });
      return response;
    },
    onSuccess: () => {
      if (user) {
        toast({
          title: 'Plan Selected!',
          description: 'Your plan has been updated successfully.',
        });
        setLocation('/account-settings');
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Plan Selection Failed',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    }
  });

  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId);
    selectPlanMutation.mutate(planId);
  };

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

  // Use plans from API or fallback, then sort by price
  const rawPlans = (plansData && plansData.length > 0) ? plansData : fallbackPlans;
  const plans = rawPlans.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));

  const getPlanIcon = (planName: string) => {
    switch (planName.toLowerCase()) {
      case 'solopreneur':
        return <Zap className="h-6 w-6" />;
      case 'growth':
        return <Users className="h-6 w-6" />;
      case 'scale':
        return <Building className="h-6 w-6" />;
      default:
        return <Zap className="h-6 w-6" />;
    }
  };

  const isPopular = (planName: string) => {
    return planName.toLowerCase() === 'growth';
  };

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <a href="/" className="text-2xl font-bold text-gray-900">
                Delight Desk
              </a>
            </div>
            <div className="flex items-center gap-4">
              {user ? (
                <Button variant="outline" onClick={() => setLocation('/dashboard')}>
                  Go to Dashboard
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setLocation('/login')}>
                    Sign In
                  </Button>
                  <Button onClick={() => setLocation('/signup')}>
                    Get Started
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center space-x-2 bg-blue-50 rounded-full px-4 py-2 mb-8 border border-blue-200">
            <DollarSign className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">Monthly Billing</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Simple, Usage-Based Pricing
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Every plan includes full platform access. Pay only when AI automations resolve customer issues.
          </p>
          
          {user && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
              <p className="text-blue-800 font-medium">
                👋 Welcome back, {user.email}!
              </p>
              <p className="text-blue-600 text-sm mt-1">
                Select a plan to continue your automation journey
              </p>
            </div>
          )}
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16">
          {plans.map((plan) => (
            <Card 
              key={plan.id} 
              className={`relative text-center ${
                isPopular(plan.name) 
                  ? 'border-purple-500 shadow-lg scale-105' 
                  : 'border-gray-200 hover:border-gray-300'
              } transition-all duration-200`}
            >
              {isPopular(plan.name) && (
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-purple-600 text-white">
                  <Star className="h-3 w-3 mr-1" />
                  Most Popular
                </Badge>
              )}
              
              <CardHeader className="pb-4">
                <div className="flex items-center justify-center mb-4">
                  <div className={`p-3 rounded-full ${
                    isPopular(plan.name) ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {getPlanIcon(plan.name)}
                  </div>
                </div>
                <CardTitle className="text-2xl font-bold">{plan.displayName}</CardTitle>
                <CardDescription className="text-gray-600">
                  {plan.name === 'solopreneur' && 'Perfect for small stores'}
                  {plan.name === 'growth' && 'For growing businesses'}
                  {plan.name === 'scale' && 'For enterprise operations'}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Pricing */}
                <div>
                  <div className="text-4xl font-bold text-gray-900 mb-2">${parseInt(plan.price)}</div>
                  <div className="text-gray-600 mb-4">per month</div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600 mb-2">Pay only for AI automations:</div>
                    <div className="text-lg font-semibold text-green-600">
                      {formatCostPerResolution(plan.name)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatIncludedAutomations(parseFloat(plan.price), plan.name)}
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div className="space-y-3 text-left">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* CTA Button */}
                <Button
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={selectPlanMutation.isPending && selectedPlan === plan.id}
                  className={`w-full ${
                    isPopular(plan.name) 
                      ? 'bg-purple-600 hover:bg-purple-700' 
                      : 'bg-gray-900 hover:bg-gray-800'
                  } text-white`}
                >
                  {selectPlanMutation.isPending && selectedPlan === plan.id ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                      Processing...
                    </div>
                  ) : user ? (
                    <div className="flex items-center gap-2">
                      Select Plan
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      Start 7-Day Free Trial
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Trust Section */}
        <div className="text-center">
          <p className="text-gray-600 mb-4">
            ✓ 7-day free trial • ✓ No setup fees • ✓ Cancel anytime
          </p>
          <p className="text-sm text-gray-500">
            All plans include full platform access. You only pay for successful AI automations.
          </p>
        </div>
      </div>
    </div>
  );
}