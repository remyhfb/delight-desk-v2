import { AlertTriangle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface FreemiumLimitMessageProps {
  service: 'aftership' | 'openai';
  limitType?: 'daily' | 'monthly';
  onUpgrade?: () => void;
}

export function FreemiumLimitMessage({ service, limitType = 'daily', onUpgrade }: FreemiumLimitMessageProps) {
  const serviceNames = {
    aftership: 'Order Tracking',
    openai: 'AI Response Generation'
  };

  const serviceName = serviceNames[service];
  
  return (
    <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertDescription className="text-amber-800 dark:text-amber-200">
        <div className="space-y-3">
          <div>
            <strong>Free Trial Limit Reached</strong>
          </div>
          <div className="text-sm">
            You've reached your {limitType} limit for {serviceName} during your free trial. 
            You can continue using other features until your trial expires.
          </div>
          
          {onUpgrade && (
            <div className="flex items-center gap-2 pt-2">
              <Button 
                size="sm" 
                onClick={onUpgrade}
                className="bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600"
              >
                <Zap className="h-3 w-3 mr-1" />
                Upgrade Now
              </Button>
              <span className="text-xs text-amber-700 dark:text-amber-300">
                Unlimited usage with paid plans
              </span>
            </div>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}