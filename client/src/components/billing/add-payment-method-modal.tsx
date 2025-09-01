import { useState } from 'react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { stripePromise } from '@/lib/stripe';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CreditCard, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AddPaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userEmail: string;
  userName?: string;
  currentPlan?: any;
  onSuccess: () => void;
}

function PaymentMethodSetupForm({ 
  userId, 
  userEmail, 
  userName, 
  currentPlan,
  onSuccess, 
  onCancel 
}: {
  userId: string;
  userEmail: string;
  userName?: string;
  currentPlan?: any;
  onSuccess: () => void;
  onCancel: () => void;
}) {
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
      // Submit the payment element
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

      // Create subscription with the payment method
      const response = await fetch('/api/billing/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          planId: currentPlan?.id,
          paymentMethodId: paymentMethod.id,
          email: userEmail,
          name: userName,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to add payment method');
      }

      // If there's a client secret, confirm the payment
      if (result.clientSecret) {
        const { error: confirmError } = await stripe.confirmPayment({
          clientSecret: result.clientSecret,
          redirect: 'if_required',
        });

        if (confirmError) {
          throw new Error(confirmError.message);
        }
      }

      toast({
        title: 'Payment Method Added',
        description: `Your ${currentPlan?.displayName} subscription is now active with your payment method secured.`,
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
    <Card>
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <div className="bg-purple-100 p-3 rounded-full">
            <CreditCard className="w-6 h-6 text-purple-600" />
          </div>
        </div>
        <CardTitle>Secure Your {currentPlan?.displayName} Plan</CardTitle>
        <CardDescription>
          Add a payment method to activate your subscription and continue using all features after your trial ends.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Lock className="w-4 h-4" />
              <span>Your payment information is securely processed by Stripe</span>
            </div>
            
            <PaymentElement 
              options={{
                layout: 'tabs',
                paymentMethodOrder: ['card'],
              }}
            />
          </div>

          <div className="space-y-3">
            <Button
              type="submit"
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              disabled={!stripe || !elements || isProcessing}
              data-testid="button-confirm-payment"
            >
              {isProcessing ? (
                'Processing...'
              ) : (
                `Secure My ${currentPlan?.displayName} Subscription`
              )}
            </Button>
            
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={onCancel}
              disabled={isProcessing}
              data-testid="button-cancel-payment"
            >
              Cancel
            </Button>
          </div>
        </form>

        <div className="mt-4 text-xs text-gray-500 text-center">
          <p>
            Your trial continues until it expires. You'll be charged ${currentPlan?.price}/month starting then.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function AddPaymentMethodModal({
  isOpen,
  onClose,
  userId,
  userEmail,
  userName,
  currentPlan,
  onSuccess
}: AddPaymentMethodModalProps) {
  console.log('AddPaymentMethodModal render:', { isOpen, currentPlan });
  const [setupIntent, setSetupIntent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleModalOpen = async () => {
    if (!isOpen || setupIntent) return;

    setIsLoading(true);
    try {
      // First, get or create the Stripe customer
      const customerResponse = await fetch('/api/billing/create-customer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          email: userEmail,
        }),
      });

      const customerResult = await customerResponse.json();
      if (!customerResponse.ok) {
        throw new Error(customerResult.message || 'Failed to create customer');
      }

      // Then create the setup intent with the customer ID
      const setupResponse = await fetch('/api/billing/create-setup-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: customerResult.customerId,
        }),
      });

      const setupResult = await setupResponse.json();
      if (setupResponse.ok) {
        setSetupIntent(setupResult.clientSecret);
      } else {
        throw new Error(setupResult.message || 'Failed to create setup intent');
      }
    } catch (error) {
      console.error('Failed to create setup intent:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSetupIntent(null);
    onClose();
  };

  const handleSuccess = () => {
    setSetupIntent(null);
    onSuccess();
    onClose();
  };

  // Create setup intent when modal opens
  if (isOpen && !setupIntent && !isLoading) {
    handleModalOpen();
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Payment Method</DialogTitle>
          <DialogDescription>
            Secure your subscription with a payment method
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : setupIntent ? (
          <Elements 
            stripe={stripePromise} 
            options={{
              clientSecret: setupIntent,
              appearance: {
                theme: 'stripe',
                variables: {
                  colorPrimary: '#7c3aed',
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
            <PaymentMethodSetupForm
              userId={userId}
              userEmail={userEmail}
              userName={userName}
              currentPlan={currentPlan}
              onSuccess={handleSuccess}
              onCancel={handleClose}
            />
          </Elements>
        ) : (
          <div className="text-center p-8 text-gray-500">
            Failed to load payment form. Please try again.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}