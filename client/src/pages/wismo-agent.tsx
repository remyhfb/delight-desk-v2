import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Layout } from "@/components/layout/layout";
import { Truck, AlertTriangle, Bot, CheckCircle, Mail, Eye } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { InteractiveAgentPreview } from "@/components/interactive-agent-preview";

const wismoEmailTemplate = `Thank you for your order inquiry! 

Your order #12345 is currently being processed and will ship within 1-2 business days. You'll receive tracking information via email once your order ships.

Estimated delivery: 3-5 business days from ship date.

Track your order: [Tracking Link]`;

export default function WismoAgent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch agent settings from backend
  const { data: agentSettings, isLoading } = useQuery({
    queryKey: [`/api/agents/wismo/${user?.id}/settings`],
    queryFn: async () => {
      const response = await fetch(`/api/agents/wismo/${user?.id}/settings`);
      if (!response.ok) throw new Error('Failed to fetch agent settings');
      return response.json() as Promise<{
        isEnabled: boolean;
        requiresModeration: boolean;
        rules: any[];
      }>;
    },
    enabled: !!user?.id
  });



  const toggleAgentMutation = useMutation({
    mutationFn: async ({ enabled }: { enabled: boolean }) => {
      return apiRequest('POST', `/api/agents/wismo/${user?.id}/toggle`, {
        isEnabled: enabled,
        requiresModeration: agentSettings?.requiresModeration || false
      });
    },
    onSuccess: () => {
      toast({ description: "WISMO Agent settings updated successfully" });
      // Invalidate both individual agent and overview caches
      queryClient.invalidateQueries({ queryKey: [`/api/agents/wismo/${user?.id}/settings`] });
      queryClient.invalidateQueries({ queryKey: [`/api/agents/${user?.id}/overview`] });
    },
    onError: (error: any) => {
      toast({
        description: error.message || "Failed to update settings",
        variant: "destructive",
      });
    }
  });

  const toggleModerationMutation = useMutation({
    mutationFn: async ({ requiresModeration }: { requiresModeration: boolean }) => {
      return apiRequest('POST', `/api/agents/wismo/${user?.id}/moderation`, {
        requiresModeration
      });
    },
    onSuccess: () => {
      toast({ description: "Moderation settings updated successfully" });
      // Invalidate both individual agent and overview caches
      queryClient.invalidateQueries({ queryKey: [`/api/agents/wismo/${user?.id}/settings`] });
      queryClient.invalidateQueries({ queryKey: [`/api/agents/${user?.id}/overview`] });
    },
    onError: () => {
      toast({
        description: "Failed to update moderation settings",
        variant: "destructive",
      });
    }
  });

  const handleToggleAgent = () => {
    const newState = !agentSettings?.isEnabled;
    toggleAgentMutation.mutate({ enabled: newState });
  };

  const handleToggleModeration = () => {
    const newState = !agentSettings?.requiresModeration;
    toggleModerationMutation.mutate({ requiresModeration: newState });
  };


  
  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto p-6 space-y-6">
          <div className="text-center py-8">
            <Bot className="mx-auto h-12 w-12 text-gray-400 animate-pulse" />
            <p className="mt-2 text-gray-600">Loading agent settings...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Truck className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">WISMO Agent</h1>
              <p className="text-gray-600">Where Is My Order - Automate order status and shipping inquiries</p>
            </div>
          </div>
        </div>



        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Agent Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bot className="h-5 w-5" />
                <span>Agent Settings</span>
              </CardTitle>
              <CardDescription>
                Configure how the WISMO Agent handles order status inquiries
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Agent Enable/Disable */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <div className="text-base font-medium">Enable WISMO Agent</div>
                  <div className="text-sm text-muted-foreground">
                    Automatically respond to order status and shipping inquiries
                  </div>
                </div>
                <Switch
                  checked={agentSettings?.isEnabled || false}
                  onCheckedChange={handleToggleAgent}
                  disabled={toggleAgentMutation.isPending}
                  data-testid="switch-enable-agent"
                />
              </div>

              {/* Moderation Toggle */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <div className="text-base font-medium">Requires Moderation</div>
                  <div className="text-sm text-muted-foreground">
                    {agentSettings?.requiresModeration 
                      ? "Responses will appear in approval queue before sending"
                      : "Responses will be sent automatically without review"
                    }
                  </div>
                </div>
                <Switch
                  checked={agentSettings?.requiresModeration || false}
                  onCheckedChange={handleToggleModeration}
                  disabled={toggleModerationMutation.isPending || !agentSettings?.isEnabled}
                  data-testid="switch-requires-moderation"
                />
              </div>

              {/* Status Display */}
              <div className="pt-4 border-t">
                <div className="flex items-center space-x-2">
                  {agentSettings?.isEnabled ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-600">
                        Agent Active
                      </span>
                    </>
                  ) : (
                    <>
                      <Bot className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-600">
                        Agent Inactive
                      </span>
                    </>
                  )}
                  {agentSettings?.requiresModeration && agentSettings?.isEnabled && (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                      Moderated
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Interactive Agent Preview */}
          <InteractiveAgentPreview 
            agentType="wismo"
            agentDisplayName="WISMO Agent"
          />

          {/* What This Agent Handles */}
          <Card>
            <CardHeader>
              <CardTitle>What this agent handles</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  Order status inquiries ("Where is my order?")
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  Shipping information requests
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  Delivery updates and tracking
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  Package location questions
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Additional Information */}
        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="space-y-2">
                <div className="font-medium flex items-center space-x-2">
                  <Bot className="h-4 w-4 text-blue-600" />
                  <span>1. Detection</span>
                </div>
                <p className="text-gray-600">
                  AI identifies order status inquiries and shipping questions from customer emails
                </p>
              </div>
              <div className="space-y-2">
                <div className="font-medium flex items-center space-x-2">
                  <Truck className="h-4 w-4 text-green-600" />
                  <span>2. Processing</span>
                </div>
                <p className="text-gray-600">
                  Looks up order information and tracking details automatically
                </p>
              </div>
              <div className="space-y-2">
                <div className="font-medium flex items-center space-x-2">
                  <Mail className="h-4 w-4 text-purple-600" />
                  <span>3. Response</span>
                </div>
                <p className="text-gray-600">
                  {agentSettings?.requiresModeration 
                    ? "Sends response to approval queue for review"
                    : "Sends personalized response with order status and tracking"
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}