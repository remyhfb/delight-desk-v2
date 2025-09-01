import React, { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CreditCard, Loader2 } from "lucide-react";

// Initialize Stripe
const stripePromise = loadStripe(
  "pk_test_51RpW25D9VRG6SqwOkHVGF3X6R0CJtVy8x2RdbmR17p1oypVsIVzNuLmSKJqLEtlw8JoUaunq1gMnHXwLskTv2Diz00VMICs6YP",
);

// Card element options
const cardElementOptions = {
  style: {
    base: {
      fontSize: "16px",
      color: "#424770",
      "::placeholder": {
        color: "#aab7c4",
      },
      fontFamily: "Inter, system-ui, sans-serif",
    },
    invalid: {
      color: "#9e2146",
    },
  },
  hidePostalCode: false,
};

interface AddPaymentMethodFormProps {
  userId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function AddPaymentMethodForm({
  userId,
  onSuccess,
  onCancel,
}: AddPaymentMethodFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [cardholderName, setCardholderName] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      toast({
        title: "Error",
        description: "Stripe has not loaded yet. Please try again.",
        variant: "destructive",
      });
      return;
    }

    if (!cardholderName.trim()) {
      toast({
        title: "Error",
        description: "Please enter the cardholder name.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // First, get or create a Stripe customer
      const customerResponse = await apiRequest(
        "POST",
        "/api/billing/create-customer",
        {
          userId,
        },
      );

      if (!customerResponse.ok) {
        throw new Error("Failed to create customer");
      }

      const { customerId } = await customerResponse.json();

      console.log("Stripe Customer", customerResponse);

      // Create setup intent for saving the payment method
      const setupIntentResponse = await apiRequest(
        "POST",
        "/api/billing/create-setup-intent",
        {
          customerId,
        },
      );

      if (!setupIntentResponse.ok) {
        throw new Error("Failed to create setup intent");
      }

      const { clientSecret } = await setupIntentResponse.json();

      // Confirm the setup intent with the card
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error("Card element not found");
      }

      const { error, setupIntent } = await stripe.confirmCardSetup(
        clientSecret,
        {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: cardholderName,
            },
          },
        },
      );

      if (error) {
        toast({
          title: "Payment Method Error",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (setupIntent.status === "succeeded") {
        // Save payment method to our database
        const saveResponse = await apiRequest(
          "POST",
          "/api/billing/save-payment-method",
          {
            userId,
            paymentMethodId: setupIntent.payment_method,
            customerId,
          },
        );

        if (!saveResponse.ok) {
          throw new Error("Failed to save payment method");
        }

        toast({
          title: "Success",
          description: "Payment method added successfully!",
        });

        onSuccess();
      }
    } catch (error) {
      console.error("Payment method error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to add payment method",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Add Payment Method
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Cardholder Name */}
          <div className="space-y-2">
            <label htmlFor="cardholderName" className="text-sm font-medium">
              Cardholder Name
            </label>
            <input
              id="cardholderName"
              type="text"
              value={cardholderName}
              onChange={(e) => setCardholderName(e.target.value)}
              placeholder="John Doe"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              data-testid="input-cardholder-name"
            />
          </div>

          {/* Card Element */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Card Information</label>
            <div className="p-3 border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-blue-500">
              <CardElement options={cardElementOptions} />
            </div>
          </div>

          {/* Test Card Info */}
          <div className="bg-blue-50 p-3 rounded-md text-sm">
            <p className="font-medium text-blue-800 mb-1">Test Mode</p>
            <p className="text-blue-600">Use test card: 4242 4242 4242 4242</p>
            <p className="text-blue-600">Any future date and CVC</p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1"
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !stripe}
              className="flex-1"
              data-testid="button-add-payment-method"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Payment Method"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

interface AddPaymentMethodProps {
  userId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function AddPaymentMethod({
  userId,
  onSuccess,
  onCancel,
}: AddPaymentMethodProps) {
  return (
    <Elements stripe={stripePromise}>
      <AddPaymentMethodForm
        userId={userId}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    </Elements>
  );
}
