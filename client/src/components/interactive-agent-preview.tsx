import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Eye, Mail, AlertTriangle, Settings, Send, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface InteractiveAgentPreviewProps {
  agentType: 'wismo' | 'product' | 'subscription' | 'returns' | 'promo-code' | 'address-change';
  agentDisplayName: string;
  className?: string;
}

interface AIResponse {
  subject: string;
  content: string;
  signature: string;
  fromEmail: string;
}

export function InteractiveAgentPreview({ 
  agentType, 
  agentDisplayName,
  className = "" 
}: InteractiveAgentPreviewProps) {
  const [customerQuestion, setCustomerQuestion] = useState('');
  const [orderIdentifier, setOrderIdentifier] = useState('');
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const generateResponseMutation = useMutation({
    mutationFn: async (input: { question?: string; orderIdentifier?: string }) => {
      const payload = agentType === 'wismo' 
        ? { orderIdentifier: input.orderIdentifier, userId: user?.id }
        : { customerQuestion: input.question, userId: user?.id };
      
      const response = await apiRequest('POST', `/api/agents/${agentType}/preview-response`, payload);
      return response.json();
    },
    onSuccess: (data) => {
      setAiResponse(data);
      toast({
        title: "AI Response Generated",
        description: "Your agent has generated a response using your training data.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Generate Response",
        description: error.message || "Please check your training data and try again.",
        variant: "destructive",
      });
    },
  });

  const handleGenerateResponse = () => {
    if (agentType === 'wismo') {
      if (!orderIdentifier.trim()) {
        toast({
          title: "Order Information Required",
          description: "Please enter an order number or email address to generate a response.",
          variant: "destructive",
        });
        return;
      }
      generateResponseMutation.mutate({ orderIdentifier: orderIdentifier.trim() });
    } else {
      if (!customerQuestion.trim()) {
        toast({
          title: "Question Required",
          description: "Please enter a customer question to generate a response.",
          variant: "destructive",
        });
        return;
      }
      generateResponseMutation.mutate({ question: customerQuestion.trim() });
    }
  };

  const handleConfigureAgent = () => {
    setLocation('/ai-training?tab=settings');
  };


  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Sparkles className="h-5 w-5" />
          <span>Test Your Agent</span>
          <Badge variant="secondary" className="bg-purple-100 text-purple-800">
            AI Powered
          </Badge>
        </CardTitle>
        <CardDescription>
          {agentType === 'wismo' 
            ? `Enter a real order number or email address to see how your ${agentDisplayName} responds with actual order data`
            : `Enter a customer question to see how your ${agentDisplayName} responds using your training data`
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Input Field - Different for WISMO vs Other Agents */}
        {agentType === 'wismo' ? (
          <div className="space-y-2">
            <label className="text-sm font-medium">Order Number or Email Address</label>
            <input
              type="text"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Enter order number (e.g., 12345) or email address (e.g., customer@email.com)"
              value={orderIdentifier}
              onChange={(e) => setOrderIdentifier(e.target.value)}
              data-testid="input-order-identifier"
            />
            <p className="text-xs text-muted-foreground">
              ⚠️ This demo requires a real order from your WooCommerce store to function properly
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-sm font-medium">Customer Question</label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Enter a customer question to test your agent..."
              value={customerQuestion}
              onChange={(e) => setCustomerQuestion(e.target.value)}
              data-testid="input-customer-question"
            ></textarea>
          </div>
        )}

        {/* Generate Button */}
        <Button
          onClick={handleGenerateResponse}
          disabled={generateResponseMutation.isPending || 
            (agentType === 'wismo' ? !orderIdentifier.trim() : !customerQuestion.trim())}
          className="w-full"
          data-testid="button-generate-response"
        >
          {generateResponseMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating Response...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Generate AI Response
            </>
          )}
        </Button>

        {/* AI Response Preview */}
        {aiResponse && (
          <div className="border rounded-lg p-4 bg-gradient-to-br from-blue-50 to-purple-50">
            <div className="space-y-3">
              {/* Email Header */}
              <div className="border-b pb-3">
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Mail className="h-4 w-4" />
                  <span>From: {aiResponse.fromEmail}</span>
                </div>
                <div className="text-sm text-gray-600">
                  Subject: {aiResponse.subject}
                </div>
              </div>

              {/* Email Body */}
              <div className="space-y-3">
                <div className="text-sm leading-relaxed whitespace-pre-line">
                  {aiResponse.content}
                </div>
                
                {/* Email Signature */}
                <div className="border-t pt-3 mt-4">
                  <div className="text-sm leading-relaxed text-gray-700 whitespace-pre-line">
                    {aiResponse.signature}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}