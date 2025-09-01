import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertTriangle, Brain, Zap, Shield } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface SentimentResult {
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'MIXED';
  confidence: number;
  scores: {
    positive: number;
    negative: number;
    neutral: number;
    mixed: number;
  };
  reasoning?: string;
}

interface GuardRailResult {
  approved: boolean;
  blockReason?: string;
  sentiment: SentimentResult;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface ValidationResult {
  approved: boolean;
  contentSafety: {
    safe: boolean;
    blocked: boolean;
    categories: string[];
    reasoning?: string;
  };
  brandVoice: {
    consistent: boolean;
    score: number;
    issues?: string[];
  };
  sentimentGuardRails: GuardRailResult;
  blockReason?: string;
}

function SentimentTest() {
  const [text, setText] = useState('');
  const [context, setContext] = useState<'email_response' | 'auto_reply' | 'customer_communication'>('email_response');
  const [testResult, setTestResult] = useState<any>(null);
  const [connectionStatus, setConnectionStatus] = useState<any>(null);

  const testSentiment = useMutation({
    mutationFn: async (data: { text: string; context: string }) => {
      const response = await fetch('/api/test-sentiment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to test sentiment');
      return response.json();
    },
    onSuccess: (data: any) => {
      setTestResult(data.results);
    }
  });

  const validateConnection = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/validate-aws-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      if (!response.ok) throw new Error('Failed to validate connection');
      return response.json();
    },
    onSuccess: (data: any) => {
      setConnectionStatus(data);
    }
  });

  const handleTest = () => {
    if (!text.trim()) return;
    testSentiment.mutate({ text, context });
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'POSITIVE': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'NEGATIVE': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'NEUTRAL': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
      case 'MIXED': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'LOW': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'HIGH': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-6" data-testid="page-sentiment-test">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100" data-testid="text-page-title">
            Sentiment Analysis Guard Rails Test
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2" data-testid="text-page-description">
            Test Amazon Comprehend sentiment analysis and AI guard rails system
          </p>
        </div>
        
        <Button 
          onClick={() => validateConnection.mutate()}
          disabled={validateConnection.isPending}
          variant="outline"
          data-testid="button-validate-connection"
        >
          <Shield className="h-4 w-4 mr-2" />
          {validateConnection.isPending ? 'Checking...' : 'Check AWS Connection'}
        </Button>
      </div>

      {connectionStatus && (
        <Alert data-testid="alert-connection-status">
          <div className="flex items-center">
            {connectionStatus.connected ? (
              <CheckCircle2 className="h-4 w-4 text-green-500 mr-2" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500 mr-2" />
            )}
            <AlertDescription>
              <strong>AWS Connection:</strong> {connectionStatus.connected ? 'Connected' : 'Failed'}
              {connectionStatus.serviceInfo && (
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Service: {connectionStatus.serviceInfo.service} | 
                  Region: {connectionStatus.serviceInfo.region} | 
                  Credentials: {connectionStatus.serviceInfo.hasCredentials ? 'Valid' : 'Missing'} |
                  Fallback: {connectionStatus.serviceInfo.fallbackEnabled ? 'Enabled' : 'Disabled'}
                </div>
              )}
            </AlertDescription>
          </div>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <Card data-testid="card-input-panel">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Brain className="h-5 w-5 mr-2" />
              Test Input
            </CardTitle>
            <CardDescription>
              Enter text to analyze sentiment and test guard rails
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label htmlFor="context" className="block text-sm font-medium mb-2">
                Context Type
              </label>
              <Select value={context} onValueChange={(value: any) => setContext(value)}>
                <SelectTrigger data-testid="select-context">
                  <SelectValue placeholder="Select context type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email_response">Email Response</SelectItem>
                  <SelectItem value="auto_reply">Auto Reply</SelectItem>
                  <SelectItem value="customer_communication">Customer Communication</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label htmlFor="text" className="block text-sm font-medium mb-2">
                Text to Analyze
              </label>
              <Textarea
                id="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter your text here to test sentiment analysis and guard rails..."
                rows={8}
                className="w-full"
                data-testid="textarea-test-input"
              />
            </div>

            <Button
              onClick={handleTest}
              disabled={!text.trim() || testSentiment.isPending}
              className="w-full"
              data-testid="button-test-sentiment"
            >
              <Zap className="h-4 w-4 mr-2" />
              {testSentiment.isPending ? 'Analyzing...' : 'Analyze Sentiment'}
            </Button>

            {/* Sample Test Cases */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-2">Sample Test Cases:</h4>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setText("Thank you for your order! We're excited to ship your items soon.")}
                  data-testid="button-sample-positive"
                >
                  Positive Sample
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setText("Your order is completely messed up and we can't do anything about it.")}
                  data-testid="button-sample-negative"
                >
                  Negative Sample
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setText("We received your request and will process it within 3-5 business days.")}
                  data-testid="button-sample-neutral"
                >
                  Neutral Sample
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Panel */}
        <Card data-testid="card-results-panel">
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Analysis Results
            </CardTitle>
            <CardDescription>
              Sentiment analysis and guard rail validation results
            </CardDescription>
          </CardHeader>
          <CardContent>
            {testSentiment.isPending && (
              <div className="flex items-center justify-center py-8" data-testid="loading-analysis">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2">Analyzing with Amazon Comprehend...</span>
              </div>
            )}

            {testSentiment.error && (
              <Alert data-testid="alert-error">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  Error: {(testSentiment.error as any)?.message || 'Analysis failed'}
                </AlertDescription>
              </Alert>
            )}

            {testResult && (
              <div className="space-y-4" data-testid="results-container">
                {/* Overall Validation Status */}
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <h4 className="font-medium">Overall Validation</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {testResult.fullValidation?.approved ? 'Response approved' : 'Response blocked'}
                    </p>
                  </div>
                  {testResult.fullValidation?.approved ? (
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                  ) : (
                    <XCircle className="h-8 w-8 text-red-500" />
                  )}
                </div>

                {/* Block Reason */}
                {testResult.fullValidation?.blockReason && (
                  <Alert data-testid="alert-block-reason">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Blocked:</strong> {testResult.fullValidation.blockReason}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Sentiment Analysis */}
                <div className="space-y-3">
                  <h4 className="font-medium">Amazon Comprehend Sentiment Analysis</h4>
                  
                  <div className="flex items-center space-x-2">
                    <Badge className={getSentimentColor(testResult.sentiment?.sentiment)}>
                      {testResult.sentiment?.sentiment}
                    </Badge>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {testResult.sentiment?.confidence}% confidence
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Positive: {testResult.sentiment?.scores?.positive || 0}%</div>
                    <div>Negative: {testResult.sentiment?.scores?.negative || 0}%</div>
                    <div>Neutral: {testResult.sentiment?.scores?.neutral || 0}%</div>
                    <div>Mixed: {testResult.sentiment?.scores?.mixed || 0}%</div>
                  </div>

                  {testResult.sentiment?.reasoning && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                      {testResult.sentiment.reasoning}
                    </p>
                  )}
                </div>

                {/* Guard Rails */}
                <div className="space-y-3">
                  <h4 className="font-medium">Guard Rail Analysis</h4>
                  
                  <div className="flex items-center space-x-2">
                    <Badge className={getRiskColor(testResult.guardRails?.riskLevel)}>
                      {testResult.guardRails?.riskLevel} RISK
                    </Badge>
                    {testResult.guardRails?.approved ? (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                        APPROVED
                      </Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                        BLOCKED
                      </Badge>
                    )}
                  </div>

                  {testResult.guardRails?.blockReason && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {testResult.guardRails.blockReason}
                    </p>
                  )}
                </div>

                {/* Service Info */}
                {testResult.serviceInfo && (
                  <div className="text-xs text-gray-500 pt-2 border-t">
                    <strong>Service:</strong> {testResult.serviceInfo.service} |{' '}
                    <strong>Region:</strong> {testResult.serviceInfo.region} |{' '}
                    <strong>Credentials:</strong> {testResult.serviceInfo.hasCredentials ? 'Valid' : 'Missing'}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default SentimentTest;