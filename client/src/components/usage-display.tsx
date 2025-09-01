import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { getApiLimits, formatIncludedAutomations } from '@shared/pricing-utils';

interface UsageDisplayProps {
  planName: string;
  planPrice: number;
  usage: {
    aftershipDaily: number;
    aftershipMonthly: number;
    openaiDaily: number;
    openaiMonthly: number;
  };
}

export function UsageDisplay({ planName, planPrice, usage }: UsageDisplayProps) {
  // Get dynamic limits based on plan
  const limits = getApiLimits(planName);
  
  // Calculate usage percentages
  const aftershipDailyPercent = Math.min((usage.aftershipDaily / limits.aftership.daily) * 100, 100);
  const aftershipMonthlyPercent = Math.min((usage.aftershipMonthly / limits.aftership.monthly) * 100, 100);
  const openaiDailyPercent = Math.min((usage.openaiDaily / limits.openai.daily) * 100, 100);
  const openaiMonthlyPercent = Math.min((usage.openaiMonthly / limits.openai.monthly) * 100, 100);

  const getUsageColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 90) return 'bg-orange-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getUsageStatus = (percentage: number) => {
    if (percentage >= 100) return 'Limit Reached';
    if (percentage >= 90) return 'Nearly Full';
    if (percentage >= 75) return 'High Usage';
    return 'Normal';
  };

  return (
    <div className="space-y-6">
      {/* Plan Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Current Plan: {planName.charAt(0).toUpperCase() + planName.slice(1)}
            <Badge variant="secondary">${planPrice}/month</Badge>
          </CardTitle>
          <CardDescription>
            {formatIncludedAutomations(planPrice, planName)}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* AfterShip Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Shipping Tracking API (AfterShip)
            <Badge variant={aftershipMonthlyPercent >= 90 ? 'destructive' : 'default'}>
              {getUsageStatus(aftershipMonthlyPercent)}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Daily Usage */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Daily Usage</span>
              <span>{usage.aftershipDaily} / {limits.aftership.daily}</span>
            </div>
            <Progress 
              value={aftershipDailyPercent} 
              className={`h-2 ${getUsageColor(aftershipDailyPercent)}`}
            />
          </div>
          
          {/* Monthly Usage */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Monthly Usage</span>
              <span>{usage.aftershipMonthly} / {limits.aftership.monthly}</span>
            </div>
            <Progress 
              value={aftershipMonthlyPercent} 
              className={`h-2 ${getUsageColor(aftershipMonthlyPercent)}`}
            />
          </div>
        </CardContent>
      </Card>

      {/* OpenAI Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            AI Processing (OpenAI)
            <Badge variant={openaiMonthlyPercent >= 90 ? 'destructive' : 'default'}>
              {getUsageStatus(openaiMonthlyPercent)}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Daily Usage */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Daily Usage</span>
              <span>{usage.openaiDaily} / {limits.openai.daily}</span>
            </div>
            <Progress 
              value={openaiDailyPercent} 
              className={`h-2 ${getUsageColor(openaiDailyPercent)}`}
            />
          </div>
          
          {/* Monthly Usage */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Monthly Usage</span>
              <span>{usage.openaiMonthly} / {limits.openai.monthly}</span>
            </div>
            <Progress 
              value={openaiMonthlyPercent} 
              className={`h-2 ${getUsageColor(openaiMonthlyPercent)}`}
            />
          </div>
        </CardContent>
      </Card>

      {/* Upgrade Recommendations */}
      {(aftershipMonthlyPercent >= 75 || openaiMonthlyPercent >= 75) && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-orange-800">Consider Upgrading</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-orange-700 text-sm">
              You're using {Math.max(aftershipMonthlyPercent, openaiMonthlyPercent).toFixed(0)}% of your monthly allowance. 
              {planName === 'solopreneur' && ' Upgrade to Growth for more API calls.'}
              {planName === 'growth' && ' Upgrade to Scale for higher limits.'}
              {planName === 'scale' && ' Contact support for enterprise limits.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}