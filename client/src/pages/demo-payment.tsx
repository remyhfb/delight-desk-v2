import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import PaymentMethodsList from "@/components/billing/payment-methods-list";

export default function DemoPaymentPage() {
  // For demo purposes, using a hardcoded userId - in real app this comes from auth
  const demoUserId = "7896907c-9fc3-471a-a2ba-de70cb2a7eee";

  // Fetch user profile to show context
  const { data: profileData } = useQuery({
    queryKey: [`/api/profile/${demoUserId}`],
    enabled: !!demoUserId,
  });

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Payment Method Demo
          </h1>
          <p className="text-gray-600">
            This demo shows how to add, manage, and set default payment methods
            using Stripe.
          </p>
          {profileData && typeof profileData === 'object' && profileData && "user" in profileData && (profileData as any).user && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Demo User:</strong>{" "}
                {(profileData as any).user?.firstName || ""}{" "}
                {(profileData as any).user?.lastName || ""} (
                {(profileData as any).user?.email || "Unknown"})
              </p>
            </div>
          )}
        </div>

        <div className="grid gap-6">
          {/* Payment Methods Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                💳 Payment Methods Management
              </CardTitle>
              <p className="text-sm text-gray-600">
                Add and manage payment methods for your subscription. All
                payments are processed securely through Stripe.
              </p>
            </CardHeader>
            <CardContent>
              <PaymentMethodsList userId={demoUserId} />
            </CardContent>
          </Card>

          {/* Test Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🧪 Test Instructions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">
                  Test Credit Cards
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="font-mono">4242 4242 4242 4242</span>
                    <span className="text-gray-500">Visa - Success</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-mono">4000 0000 0000 0002</span>
                    <span className="text-gray-500">Visa - Declined</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-mono">5555 5555 5555 4444</span>
                    <span className="text-gray-500">Mastercard - Success</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Test Data</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Use any future expiration date (e.g., 12/26)</li>
                  <li>• Use any 3-digit CVC (e.g., 123)</li>
                  <li>• Use any valid ZIP code (e.g., 12345)</li>
                  <li>• Enter any name for cardholder</li>
                </ul>
              </div>

              <div className="bg-yellow-50 p-3 rounded-md border border-yellow-200">
                <p className="text-sm text-yellow-800">
                  <strong>Test Mode:</strong> This is running in Stripe test
                  mode. No real charges will be made.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* API Features */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                ⚡ Features Demonstrated
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">
                    Frontend Features
                  </h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Stripe Elements integration</li>
                    <li>• Card input validation</li>
                    <li>• Real-time error handling</li>
                    <li>• Loading states and feedback</li>
                    <li>• Mobile-responsive design</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">
                    Backend Features
                  </h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Customer creation</li>
                    <li>• Setup Intent for card saving</li>
                    <li>• Payment method storage</li>
                    <li>• Default payment method management</li>
                    <li>• Secure card deletion</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
