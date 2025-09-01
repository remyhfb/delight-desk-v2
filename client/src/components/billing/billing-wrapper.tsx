import { Elements } from '@stripe/react-stripe-js';
import { stripePromise } from '@/lib/stripe';
import { SubscriptionManager } from './subscription-manager';

interface BillingWrapperProps {
  userId: string;
  userEmail: string;
  userName?: string;
  currentPlan?: any;
  billing?: any;
  availablePlans: any[];
  onUpdate: () => void;
}

export function BillingWrapper(props: BillingWrapperProps) {
  const elementsOptions = {
    mode: 'setup' as const,
    currency: 'usd',
    paymentMethodCreation: 'manual' as const,
    appearance: {
      theme: 'stripe' as const,
      variables: {
        colorPrimary: '#3b82f6',
        colorBackground: '#ffffff',
        colorText: '#1f2937',
        colorDanger: '#ef4444',
        fontFamily: 'Inter, system-ui, sans-serif',
        spacingUnit: '4px',
        borderRadius: '6px',
      },
    },
  };

  return (
    <Elements stripe={stripePromise} options={elementsOptions}>
      <SubscriptionManager {...props} />
    </Elements>
  );
}