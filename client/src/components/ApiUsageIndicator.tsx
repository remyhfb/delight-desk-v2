import { useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Zap, TrendingUp } from "lucide-react";
import { FreemiumLimitMessage } from "./FreemiumLimitMessage";

interface ApiUsageStats {
  service: 'aftership' | 'openai';
  dailyCount: number;
  monthlyCount: number;
  dailyLimit: number;
  monthlyLimit: number;
  limitExceeded: boolean;
  allowed: boolean;
  limitType?: 'daily' | 'monthly';
}

interface ApiUsageIndicatorProps {
  service: 'aftership' | 'openai';
  compact?: boolean;
  onUpgrade?: () => void;
}

export function ApiUsageIndicator({ service, compact = false, onUpgrade }: ApiUsageIndicatorProps) {
  const { data: usage, isLoading } = useQuery<ApiUsageStats>({
    queryKey: ['/api/usage', service],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return compact ? null : (
      <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
    );
  }

  if (!usage) return null;

  const serviceDisplayNames = {
    aftership: 'Order Tracking',
    openai: 'AI Responses'
  };

  const serviceName = serviceDisplayNames[service];
  const dailyPercent = Math.min((usage.dailyCount / usage.dailyLimit) * 100, 100);
  const monthlyPercent = Math.min((usage.monthlyCount / usage.monthlyLimit) * 100, 100);

  // Show limit exceeded message
  if (usage.limitExceeded) {
    return (
      <FreemiumLimitMessage 
        service={service} 
        limitType={usage.limitType}
        onUpgrade={onUpgrade}
      />
    );
  }

  // Compact view for sidebar or small spaces
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <div className="flex items-center gap-1">
          {service === 'aftership' ? (
            <TrendingUp className="h-3 w-3 text-blue-500" />
          ) : (
            <Zap className="h-3 w-3 text-purple-500" />
          )}
          <span className="text-gray-600 dark:text-gray-400">{serviceName}</span>
        </div>
        
        <Badge 
          variant={dailyPercent > 80 ? "destructive" : dailyPercent > 60 ? "secondary" : "outline"}
          className="text-xs"
        >
          {usage.dailyCount}/{usage.dailyLimit}
        </Badge>
      </div>
    );
  }

  // Full view for settings or dashboard
  return (
    <div className="space-y-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {service === 'aftership' ? (
            <TrendingUp className="h-4 w-4 text-blue-500" />
          ) : (
            <Zap className="h-4 w-4 text-purple-500" />
          )}
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {serviceName}
          </span>
        </div>
        
        {dailyPercent > 80 && (
          <Badge variant="secondary" className="text-xs">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Approaching Limit
          </Badge>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Daily Usage</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {usage.dailyCount} / {usage.dailyLimit === Infinity ? '∞' : usage.dailyLimit}
          </span>
        </div>
        
        {usage.dailyLimit !== Infinity && (
          <Progress 
            value={dailyPercent} 
            className={`h-2 ${
              dailyPercent > 80 ? 'text-red-500' : 
              dailyPercent > 60 ? 'text-yellow-500' : 
              'text-green-500'
            }`}
          />
        )}

        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Monthly Usage</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {usage.monthlyCount} / {usage.monthlyLimit === Infinity ? '∞' : usage.monthlyLimit}
          </span>
        </div>
        
        {usage.monthlyLimit !== Infinity && (
          <Progress 
            value={monthlyPercent} 
            className={`h-2 ${
              monthlyPercent > 80 ? 'text-red-500' : 
              monthlyPercent > 60 ? 'text-yellow-500' : 
              'text-green-500'
            }`}
          />
        )}
      </div>

      {usage.dailyLimit !== Infinity && dailyPercent > 70 && onUpgrade && (
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onUpgrade}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Upgrade for unlimited usage →
          </button>
        </div>
      )}
    </div>
  );
}