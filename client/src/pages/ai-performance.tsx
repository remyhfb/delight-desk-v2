import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AIInsightsDisplay } from '@/components/ai-insights-display';
import { AIAssistantAnalytics } from '@/components/ai-assistant-analytics';
import Sidebar from '@/components/layout/sidebar';
import TopBar from '@/components/layout/topbar';

export function AIPerformancePage() {
  const [timeframe, setTimeframe] = useState('30d');

  const { data: metrics, isLoading, error } = useQuery({
    queryKey: ['/api/ai-training/performance-metrics', timeframe],
    queryFn: async () => {
      const response = await fetch(`/api/ai-training/performance-metrics?timeframe=${timeframe}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch metrics: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      return data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: 3,
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-background">
            <div className="max-w-6xl mx-auto p-6 space-y-6">
              {/* Header with Back Button */}
              <div className="flex items-center gap-4 mb-6">
                <Link href="/ai-training">
                  <Button variant="ghost" size="sm" className="flex items-center gap-2" data-testid="button-back">
                    <ArrowLeft className="h-4 w-4" />
                    Back to AI Training
                  </Button>
                </Link>
                <div>
                  <h1 className="text-2xl font-bold">AI Performance Analytics</h1>
                  <p className="text-muted-foreground">
                    Monitor your AI assistant's performance and identify areas for improvement
                  </p>
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="grid grid-cols-1 gap-6">
        {isLoading ? (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-2">Loading AI performance insights...</span>
              </div>
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="p-6">
              <div className="space-y-2">
                <p className="text-red-500 font-medium">Error loading performance metrics:</p>
                <p className="text-red-600 text-sm">{error.message}</p>
              </div>
            </CardContent>
          </Card>
        ) : metrics?.aiInsights ? (
          <>
            <AIInsightsDisplay 
              metrics={metrics}
              timeframe={timeframe} 
              onTimeframeChange={setTimeframe}
            />
            
            {/* AI Assistant Detailed Analytics */}
            <AIAssistantAnalytics 
              feedback={{
                rejectionsByReason: metrics.rawData?.rejectionsByReason || {},
                editsByTopic: metrics.rawData?.editsByTopic || {},
                totalInteractions: metrics.totalInteractions || 0,
                totalRejections: metrics.totalRejected || 0,
                totalEdits: metrics.totalEdits || 0
              }}
              timeframe={timeframe}
            />
          </>
        ) : (
          <Card>
            <CardContent className="p-6">
              <p className="text-gray-500">No performance data available yet. Start using Rapid Resolution to see insights.</p>
            </CardContent>
          </Card>
        )}
        
        {/* Additional Insights */}
        <Card>
          <CardHeader>
            <CardTitle>Understanding Your Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-green-700 mb-2">High Acceptance Rate</h4>
                <p className="text-sm text-muted-foreground">
                  When you send AI responses without editing, it shows the AI understands your brand voice and customer needs well.
                </p>
              </div>
              
              <div>
                <h4 className="font-medium text-red-700 mb-2">Frequent Rejections</h4>
                <p className="text-sm text-muted-foreground">
                  When you decline AI suggestions, it indicates areas where more training content is needed.
                </p>
              </div>
              
              <div>
                <h4 className="font-medium text-yellow-700 mb-2">Response Edits</h4>
                <p className="text-sm text-muted-foreground">
                  When you edit AI responses before sending, it helps the AI learn your preferred communication style.
                </p>
              </div>
              
              <div>
                <h4 className="font-medium text-blue-700 mb-2">Topic Categories</h4>
                <p className="text-sm text-muted-foreground">
                  Understanding which topics need the most editing helps prioritize your training data improvements.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}