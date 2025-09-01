import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { getApiLimits, formatIncludedAutomations } from '@shared/pricing-utils';

interface CorrectedUsageDisplayProps {
  planName: string;
  planPrice: number;
  aftershipMonthly: number;
  openaiMonthly: number;
}

export function CorrectedUsageDisplay({ 
  planName, 
  planPrice,
  aftershipMonthly, 
  openaiMonthly 
}: CorrectedUsageDisplayProps) {
  const limits = getApiLimits(planName);
  
  // AfterShip has a monthly limit based on total automations
  const aftershipPercent = Math.min(100, (aftershipMonthly / limits.aftership.monthly) * 100);

  return (
    <div className="space-y-4">
      {/* Plan Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            {planName.charAt(0).toUpperCase() + planName.slice(1)} Plan
            <Badge variant="secondary">${planPrice}/month</Badge>
          </CardTitle>
          <CardDescription>
            {formatIncludedAutomations(planPrice, planName)}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* AfterShip Usage - LIMITED */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            AfterShip API Usage
            <Badge variant={aftershipPercent >= 90 ? 'destructive' : 'outline'}>
              {limits.aftership.monthly} automations/month
            </Badge>
          </CardTitle>
          <CardDescription>
            Order tracking and delivery predictions - limited by your plan
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Monthly Usage</span>
              <span>{aftershipMonthly} / {limits.aftership.monthly}</span>
            </div>
            <Progress 
              value={aftershipPercent} 
              className="h-3"
            />
            {aftershipPercent >= 90 && (
              <p className="text-sm text-red-600 mt-2">
                ⚠️ Approaching limit - consider upgrading your plan
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* OpenAI Usage - UNLIMITED */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            OpenAI API Usage
            <Badge variant="secondary">Unlimited</Badge>
          </CardTitle>
          <CardDescription>
            AI-powered email processing and responses - no limits on any plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Monthly Usage:</span>
              <span className="font-medium">{openaiMonthly.toLocaleString()} calls</span>
            </div>
            <p className="text-xs text-muted-foreground">
              OpenAI usage is unlimited on all plans. We only track usage for analytics.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Upgrade Recommendation */}
      {aftershipPercent >= 80 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-orange-800">Consider Upgrading</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-orange-700 text-sm">
              You're using {aftershipPercent.toFixed(0)}% of your AfterShip automation allowance. 
              {planName === 'solopreneur' && ' Upgrade to Growth for 60 automations/month.'}
              {planName === 'growth' && ' Upgrade to Scale for 114 automations/month.'}
              {planName === 'scale' && ' Contact support for custom enterprise limits.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}