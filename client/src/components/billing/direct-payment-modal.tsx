import { useState, useEffect } from 'react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { stripePromise } from '@/lib/stripe';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DirectPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userEmail: string;
  userName?: string;
  currentPlan?: any;
  onSuccess: () => void;
}

function DirectPaymentForm({ 
  userId, 
  userEmail, 
  userName, 
  currentPlan,
  onSuccess, 
  onCancel,
  clientSecret
}: {
  userId: string;
  userEmail: string;
  userName?: string;
  currentPlan?: any;
  onSuccess: () => void;
  onCancel: () => void;
  clientSecret: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isElementReady, setIsElementReady] = useState(false);

  // Debug stripe and elements loading
  useEffect(() => {
    console.log('DirectPaymentForm mounted');
    console.log('Stripe loaded:', !!stripe);
    console.log('Elements loaded:', !!elements);
    console.log('Client secret:', clientSecret);
  }, [stripe, elements, clientSecret]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      setError('Payment system not ready. Please try again.');
      return;
    }

    // Check if PaymentElement is mounted and ready
    const paymentElement = elements.getElement('payment');
    if (!paymentElement) {
      setError('Payment form not ready. Please wait a moment and try again.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // First validate the payment element
      const { error: submitError } = await elements.submit();
      if (submitError) {
        throw new Error(submitError.message);
      }

      // Confirm the setup intent
      const { error: confirmError, setupIntent } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: window.location.origin + '/account-settings?tab=billing',
        },
        redirect: 'if_required',
      });

      if (confirmError) {
        throw new Error(confirmError.message);
      }

      // Verify setup intent was successful
      if (setupIntent?.status !== 'succeeded') {
        throw new Error('Payment method setup was not completed successfully');
      }

      console.log('Setup intent completed successfully:', setupIntent.id);
      console.log('Payment method ID:', setupIntent.payment_method);

      toast({
        title: 'Payment Method Added',
        description: 'Your payment method has been successfully added and secured for your trial.',
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
          onReady={() => {
            console.log('PaymentElement ready');
            setIsElementReady(true);
          }}
          onFocus={() => setError(null)}
          onLoadError={(error) => {
            console.error('PaymentElement load error:', error);
            setError('Failed to load payment form. Please try again.');
          }}
        />
      </div>

      <div className="space-y-3">
        <Button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          disabled={!stripe || !elements || isProcessing || !isElementReady}
          data-testid="button-add-payment-method"
        >
          {isProcessing ? 'Adding Payment Method...' : !isElementReady ? 'Loading Payment Form...' : 'Add Payment Method'}
        </Button>
        
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={onCancel}
          disabled={isProcessing}
          data-testid="button-cancel-add-payment"
        >
          Cancel
        </Button>
      </div>

      <div className="text-xs text-gray-500 text-center">
        <p>
          Your trial continues until {currentPlan?.trialEndsAt ? new Date(currentPlan.trialEndsAt).toLocaleDateString() : 'it expires'}. 
          You'll be charged ${currentPlan?.price || '9.00'}/month starting then.
        </p>
      </div>
    </form>
  );
}

export function DirectPaymentModal({
  isOpen,
  onClose,
  userId,
  userEmail,
  userName,
  currentPlan,
  onSuccess
}: DirectPaymentModalProps) {
  const [setupIntent, setSetupIntent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleModalOpen = async () => {
    if (!isOpen || setupIntent) return;

    console.log('DirectPaymentModal opening for user:', userId);
    setIsLoading(true);
    try {
      // First, get or create the Stripe customer
      console.log('Creating customer...');
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
      console.log('Customer created:', customerResult.customerId);

      // Then create the setup intent with the customer ID
      console.log('Creating setup intent...');
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
        console.log('Setup intent created:', setupResult.clientSecret);
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
  };

  // Create setup intent when modal opens
  useEffect(() => {
    if (isOpen && !setupIntent && !isLoading) {
      handleModalOpen();
    }
  }, [isOpen, setupIntent, isLoading]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Payment Method</DialogTitle>
          <DialogDescription>
            Add your payment method to secure your subscription
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
              },
            }}
            key={setupIntent} // Force re-render when setupIntent changes
          >
            <DirectPaymentForm
              userId={userId}
              userEmail={userEmail}
              userName={userName}
              currentPlan={currentPlan}
              onSuccess={handleSuccess}
              onCancel={handleClose}
              clientSecret={setupIntent}
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