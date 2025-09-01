import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/layout/layout";
import { Brain, Settings, Bot, CheckCircle, AlertTriangle } from "lucide-react";
import { AgentTrainingSection } from "@/components/agent-training-section";
import { InteractiveAgentPreview } from "@/components/interactive-agent-preview";

interface User {
  id: string;
  email: string;
  isAdmin: boolean;
}

interface AgentSettings {
  isEnabled: boolean;
  requiresModeration: boolean;
  ruleCount: number;
  rules: Array<{
    id: string;
    name: string;
    classification: string;
    isActive: boolean;
    requiresApproval: boolean;
  }>;
}

export default function ProductAgent() {
  const { toast } = useToast();
  
  // Get current user
  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  // Get agent settings
  const { data: agentSettings, isLoading: isLoadingSettings } = useQuery<AgentSettings>({
    queryKey: [`/api/agents/product/${user?.id}/settings`],
    enabled: !!user?.id,
  });


  const toggleAgentMutation = useMutation({
    mutationFn: async ({ enabled }: { enabled: boolean }) => {
      return apiRequest('POST', `/api/agents/product/${user?.id}/toggle`, {
        isEnabled: enabled,
        requiresModeration: agentSettings?.requiresModeration || false
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/agents/product/${user?.id}/settings`] });
      queryClient.invalidateQueries({ queryKey: [`/api/agents/${user?.id}/overview`] });
      toast({ 
        title: "Product Agent updated successfully!", 
        description: agentSettings?.isEnabled ? "Product Agent has been disabled" : "Product Agent has been enabled"
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update Product Agent", 
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const toggleModerationMutation = useMutation({
    mutationFn: async ({ requiresModeration }: { requiresModeration: boolean }) => {
      return apiRequest('POST', `/api/agents/product/${user?.id}/moderation`, {
        requiresModeration
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/agents/product/${user?.id}/settings`] });
      toast({ 
        title: "Moderation settings updated!", 
        description: `Product Agent ${agentSettings?.requiresModeration ? "moderation disabled" : "moderation enabled"}`
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update moderation settings", 
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const handleToggleAgent = (enabled: boolean) => {
    toggleAgentMutation.mutate({ enabled });
  };

  const handleToggleModeration = (requiresModeration: boolean) => {
    toggleModerationMutation.mutate({ requiresModeration });
  };

  if (isLoadingSettings) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto p-6 space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Brain className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Product Agent</h1>
            <p className="text-gray-600">Automate responses to product questions and brand inquiries</p>
          </div>
        </div>
        <Badge variant={agentSettings?.isEnabled ? "default" : "secondary"}>
          {agentSettings?.isEnabled ? "Active" : "Inactive"}
        </Badge>
      </div>

      {/* Agent Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Agent Configuration</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900">Enable Product Agent</h3>
              <p className="text-sm text-gray-600">
                Automatically respond to product features, specifications, compatibility, and brand inquiries
              </p>
            </div>
            <Switch
              checked={agentSettings?.isEnabled || false}
              onCheckedChange={handleToggleAgent}
              disabled={toggleAgentMutation.isPending}
              data-testid="toggle-product-agent"
            />
          </div>

          <Separator />

          {/* Moderation Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900">Require Human Approval</h3>
              <p className="text-sm text-gray-600">
                All Product Agent responses will be sent to the approval queue for human review before being sent
              </p>
            </div>
            <Switch
              checked={agentSettings?.requiresModeration || false}
              onCheckedChange={handleToggleModeration}
              disabled={toggleModerationMutation.isPending || !agentSettings?.isEnabled}
              data-testid="toggle-product-moderation"
            />
          </div>
        </CardContent>
      </Card>

      {/* Agent Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bot className="h-5 w-5" />
            <span>How Product Agent Works</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Brain className="h-5 w-5 text-blue-600" />
                <h4 className="font-medium text-blue-900">Product Intelligence</h4>
              </div>
              <p className="text-sm text-blue-800">
                Responds to questions about product features, specifications, compatibility, usage instructions, and brand information based on your training data.
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <h4 className="font-medium text-green-900">Automated Responses</h4>
              </div>
              <p className="text-sm text-green-800">
                Provides instant answers to product inquiries, reducing response times and improving customer satisfaction.
              </p>
            </div>
          </div>



          {agentSettings?.requiresModeration && (
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="flex items-center space-x-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <h4 className="font-medium text-yellow-900">Human Approval Required</h4>
              </div>
              <p className="text-sm text-yellow-800">
                All responses will be reviewed by humans before being sent to customers. You can disable this setting once you're confident in the agent's performance.
              </p>
            </div>
          )}


        </CardContent>
      </Card>

      {/* Interactive AI Preview Section */}
      <InteractiveAgentPreview 
        agentType="product"
        agentDisplayName="Product Agent"
      />

      {/* Training Data Section */}
      <AgentTrainingSection 
        agentType="product"
        agentDisplayName="Product Agent"
      />
    </div>
    </Layout>
  );
}