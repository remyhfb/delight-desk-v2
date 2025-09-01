import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UsageDisplay } from '@/components/usage-display';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface UserBilling {
  id: string;
  status: string;
  plan: {
    name: string;
    displayName: string;
    price: string;
  };
}

interface ApiUsage {
  aftershipDaily: number;
  aftershipMonthly: number;
  openaiDaily: number;
  openaiMonthly: number;
}

export default function ApiUsageSettings() {
  // Fetch current user and billing info
  const { data: user, isLoading: userLoading } = useQuery<any>({
    queryKey: ['/api/auth/me'],
  });

  // Fetch user billing information
  const { data: billing, isLoading: billingLoading } = useQuery<UserBilling>({
    queryKey: ['/api/billing/current'],
    enabled: !!user,
  });

  // Fetch API usage data
  const { data: usage, isLoading: usageLoading, refetch: refetchUsage } = useQuery<ApiUsage>({
    queryKey: ['/api/usage/current'],
    enabled: !!user,
  });

  if (userLoading || billingLoading || usageLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center space-x-4 mb-8">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <span>Loading usage data...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Please sign in to view your API usage details.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!billing) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No billing information found. Please set up your subscription first.
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button asChild>
            <a href="/pricing">View Plans</a>
          </Button>
        </div>
      </div>
    );
  }

  const handleRefreshUsage = () => {
    refetchUsage();
  };

  const planPrice = parseFloat(billing.plan.price);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">API Usage & Limits</h1>
            <p className="text-muted-foreground mt-2">
              Monitor your API usage and manage your plan limits
            </p>
          </div>
          <Button onClick={handleRefreshUsage} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Account Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={billing.status === 'active' ? 'default' : 'secondary'}>
                {billing.status === 'active' ? 'Active' : billing.status === 'trial' ? 'Free Trial' : 'Inactive'}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Current Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="font-medium">{billing.plan.displayName}</span>
                <span className="text-sm text-muted-foreground">${planPrice}/month</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild variant="outline" size="sm" className="w-full">
                <a href="/pricing">Upgrade Plan</a>
              </Button>
              <Button asChild variant="ghost" size="sm" className="w-full">
                <a href="/billing">Manage Billing</a>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Usage Display Component */}
        {usage && (
          <UsageDisplay 
            planName={billing.plan.name}
            planPrice={planPrice}
            usage={usage}
          />
        )}

        {/* API Documentation */}
        <Card>
          <CardHeader>
            <CardTitle>Understanding Your API Limits</CardTitle>
            <CardDescription>
              Learn how your plan's API limits work and how to optimize usage
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">AfterShip Tracking API</h4>
                <p className="text-sm text-muted-foreground">
                  Used for tracking shipments and delivery predictions. Each package lookup counts as one API call.
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-2">OpenAI Processing API</h4>
                <p className="text-sm text-muted-foreground">
                  Used for AI-powered email analysis, sentiment detection, and automated responses.
                </p>
              </div>
            </div>
            
            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium mb-2">Limit Reset Schedule</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>Daily limits</strong> reset every day at midnight UTC</li>
                <li>• <strong>Monthly limits</strong> reset on the first day of each month</li>
                <li>• Unused limits do not roll over to the next period</li>
                <li>• Usage is tracked in real-time with automatic notifications</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Support Information */}
        <Card>
          <CardHeader>
            <CardTitle>Need Help?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Optimize Usage</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Learn strategies to make the most of your API limits without sacrificing functionality.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <a href="/docs/optimization" target="_blank">View Optimization Tips</a>
                </Button>
              </div>
              <div>
                <h4 className="font-medium mb-2">Contact Support</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Have questions about your usage or need help choosing the right plan?
                </p>
                <Button variant="outline" size="sm" asChild>
                  <a href="mailto:support@delightdesk.io">Email Support</a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}