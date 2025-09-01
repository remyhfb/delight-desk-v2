import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { CreditCard, Plus, Trash2, Star } from 'lucide-react';
import AddPaymentMethod from './add-payment-method';

interface PaymentMethod {
  id: string;
  stripePaymentMethodId: string;
  type: string;
  cardBrand: string;
  cardLast4: string;
  cardExpMonth: number;
  cardExpYear: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
}

interface PaymentMethodsListProps {
  userId: string;
}

export default function PaymentMethodsList({ userId }: PaymentMethodsListProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch payment methods
  const { data: paymentMethods = [], isLoading } = useQuery({
    queryKey: [`/api/billing/payment-methods/${userId}`],
    enabled: !!userId,
  });

  // Delete payment method mutation
  const deletePaymentMethod = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      const response = await apiRequest('DELETE', `/api/billing/payment-methods/${paymentMethodId}`, {
        userId,
      });
      if (!response.ok) {
        throw new Error('Failed to delete payment method');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/billing/payment-methods/${userId}`] });
      toast({
        title: "Success",
        description: "Payment method deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete payment method",
        variant: "destructive",
      });
    },
  });

  // Set default payment method mutation
  const setDefaultPaymentMethod = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      const response = await apiRequest('POST', `/api/billing/payment-methods/${paymentMethodId}/set-default`, {
        userId,
      });
      if (!response.ok) {
        throw new Error('Failed to set default payment method');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/billing/payment-methods/${userId}`] });
      toast({
        title: "Success",
        description: "Default payment method updated",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update default payment method",
        variant: "destructive",
      });
    },
  });

  const handleAddSuccess = () => {
    setShowAddForm(false);
    queryClient.invalidateQueries({ queryKey: [`/api/billing/payment-methods/${userId}`] });
  };

  const getCardBrandIcon = (brand: string) => {
    switch (brand.toLowerCase()) {
      case 'visa':
        return '💳';
      case 'mastercard':
        return '💳';
      case 'amex':
        return '💳';
      default:
        return '💳';
    }
  };

  if (showAddForm) {
    return (
      <div className="flex justify-center">
        <AddPaymentMethod
          userId={userId}
          onSuccess={handleAddSuccess}
          onCancel={() => setShowAddForm(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Payment Methods</h3>
        <Button
          onClick={() => setShowAddForm(true)}
          size="sm"
          data-testid="button-add-payment-method"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Payment Method
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-gray-500 mt-2">Loading payment methods...</p>
        </div>
      ) : !Array.isArray(paymentMethods) || paymentMethods.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">No payment methods</h4>
            <p className="text-gray-500 mb-4">Add a payment method to continue with your subscription</p>
            <Button onClick={() => setShowAddForm(true)} data-testid="button-add-first-payment-method">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Payment Method
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {Array.isArray(paymentMethods) && paymentMethods.map((method: PaymentMethod) => (
            <Card key={method.id} className={method.isDefault ? 'ring-2 ring-blue-500' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">
                      {getCardBrandIcon(method.cardBrand)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium capitalize">
                          {method.cardBrand} •••• {method.cardLast4}
                        </span>
                        {method.isDefault && (
                          <Badge variant="secondary" className="text-xs">
                            <Star className="h-3 w-3 mr-1" />
                            Default
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        Expires {String(method.cardExpMonth).padStart(2, '0')}/{method.cardExpYear}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {!method.isDefault && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDefaultPaymentMethod.mutate(method.id)}
                        disabled={setDefaultPaymentMethod.isPending}
                        data-testid={`button-set-default-${method.id}`}
                      >
                        Set Default
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deletePaymentMethod.mutate(method.id)}
                      disabled={deletePaymentMethod.isPending}
                      data-testid={`button-delete-${method.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}