import { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CreditCard, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PaymentMethodFormProps {
  planId: string;
  planName: string;
  planPrice: number;
  userId: string;
  userEmail: string;
  userName?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function PaymentMethodForm({ 
  planId, 
  planName, 
  planPrice, 
  userId, 
  userEmail, 
  userName,
  onSuccess, 
  onCancel 
}: PaymentMethodFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Confirm the payment method
      const { error: submitError } = await elements.submit();
      if (submitError) {
        throw new Error(submitError.message);
      }

      // Create payment method
      const { error: paymentMethodError, paymentMethod } = await stripe.createPaymentMethod({
        elements,
        params: {
          billing_details: {
            email: userEmail,
            name: userName,
          },
        },
      });

      if (paymentMethodError) {
        throw new Error(paymentMethodError.message);
      }

      // Create subscription on backend with payment method storage
      const response = await fetch('/api/billing/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          planId,
          paymentMethodId: paymentMethod.id,
          email: userEmail,
          name: userName,
          // Include payment method details for storage
          paymentMethodData: {
            stripePaymentMethodId: paymentMethod.id,
            type: paymentMethod.type,
            cardBrand: paymentMethod.card?.brand,
            cardLast4: paymentMethod.card?.last4,
            cardExpMonth: paymentMethod.card?.exp_month,
            cardExpYear: paymentMethod.card?.exp_year,
            isDefault: true // First payment method is default
          }
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to create subscription');
      }

      // If there's a client secret, confirm the payment
      if (result.clientSecret) {
        const { error: confirmError } = await stripe.confirmPayment({
          clientSecret: result.clientSecret,
          elements,
          confirmParams: {
            return_url: window.location.origin + '/account-settings?tab=billing',
          },
          redirect: 'if_required',
        });

        if (confirmError) {
          throw new Error(confirmError.message);
        }
      }

      toast({
        title: 'Subscription Created',
        description: `Successfully subscribed to ${planName} plan with 7-day free trial.`,
      });

      onSuccess();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      toast({
        title: 'Payment Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <CreditCard className="h-5 w-5" />
          Subscribe to {planName}
        </CardTitle>
        <CardDescription>
          ${planPrice}/month • 7-day free trial • Cancel anytime
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <PaymentElement options={{
              layout: 'tabs',
              paymentMethodOrder: ['card', 'apple_pay', 'google_pay']
            }} />
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
            <Shield className="h-4 w-4" />
            <span>Your payment information is encrypted and secure</span>
          </div>

          <div className="flex gap-3">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel}
              disabled={isProcessing}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!stripe || isProcessing}
              className="flex-1"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Start Free Trial'
              )}
            </Button>
          </div>
        </form>

        <div className="mt-4 text-xs text-gray-500 text-center">
          <p>
            Your 7-day free trial starts immediately. You'll be charged ${planPrice}/month after the trial period ends.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}