import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown, CheckCircle, X, BarChart3, Minus, AlertCircle, Target, Lightbulb, Trophy, Flag, ArrowRight } from 'lucide-react';

interface AIPerformanceMetricsProps {
  timeframe?: string;
  onTimeframeChange?: (timeframe: string) => void;
}

interface AIInsights {
  overallAssessment: {
    score: number; // 1-100
    status: 'excellent' | 'good' | 'needs_improvement' | 'poor';
    summary: string;
  };
  keyFindings: Array<{
    type: 'strength' | 'concern' | 'opportunity';
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
  }>;
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    category: 'training_data' | 'brand_voice' | 'content_knowledge' | 'response_structure';
    title: string;
    description: string;
    actionSteps: string[];
    estimatedImpact: string;
  }>;
  trends: {
    direction: 'improving' | 'declining' | 'stable';
    explanation: string;
    nextSteps: string;
  };
}

interface PerformanceMetrics {
  totalInteractions: number;
  acceptanceRate: number;
  rejectionRate: number;
  totalAccepted: number;
  totalRejected: number;
  trend: {
    acceptanceChange: number;
    direction: 'improving' | 'declining' | 'stable';
  };
  aiInsights: AIInsights;
  timestamp: string;
  actionableInsights?: {
    topIssues: {
      rejectionReason: string;
      editType: string;
      editTopic: string;
    };
  };
}

export function AIPerformanceMetrics({ 
  timeframe = '30d', 
  onTimeframeChange 
}: AIPerformanceMetricsProps) {
  const { data: metrics, isLoading, error } = useQuery<PerformanceMetrics>({
    queryKey: ['/api/ai-training/performance-metrics', timeframe],
    queryFn: async () => {
      const response = await fetch(`/api/ai-training/performance-metrics?timeframe=${timeframe}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch metrics: ${response.statusText}`);
      }
      return response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'improving': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'declining': return <TrendingDown className="h-4 w-4 text-red-600" />;
      default: return <Minus className="h-4 w-4 text-gray-400" />;
    }
  };

  const getTrendText = (direction: string, change: number) => {
    if (direction === 'stable') return 'No significant change';
    const changeText = `${Math.abs(change)}%`;
    return direction === 'improving' 
      ? `+${changeText} from last ${timeframe}` 
      : `-${changeText} from last ${timeframe}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            AI Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm text-gray-500">Loading performance data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            AI Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500 text-sm">Error loading performance metrics: {error.message}</p>
        </CardContent>
      </Card>
    );
  }

  if (!metrics || metrics.totalInteractions === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            AI Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-sm">No interactions yet. Performance metrics will appear after you start using the Rapid Resolution feature.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            AI Performance
          </CardTitle>
          {onTimeframeChange && (
            <Select value={timeframe} onValueChange={onTimeframeChange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Based on {metrics.totalInteractions} AI response interactions
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Main Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 rounded-lg bg-green-50 border border-green-200">
            <div className="flex items-center justify-center mb-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-green-700">{metrics.acceptanceRate}%</p>
            <p className="text-sm text-green-600 font-medium">Acceptance Rate</p>
            <p className="text-xs text-gray-500 mt-1">
              {metrics.totalAccepted} responses sent as-is
            </p>
          </div>
          
          <div className="text-center p-4 rounded-lg bg-red-50 border border-red-200">
            <div className="flex items-center justify-center mb-2">
              <X className="h-5 w-5 text-red-600" />
            </div>
            <p className="text-2xl font-bold text-red-700">{metrics.rejectionRate}%</p>
            <p className="text-sm text-red-600 font-medium">Rejection Rate</p>
            <p className="text-xs text-gray-500 mt-1">
              {metrics.totalRejected} responses edited or declined
            </p>
          </div>
        </div>

        {/* Trend Information */}
        <div className="p-4 rounded-lg bg-gray-50 border">
          <div className="flex items-center gap-2 mb-2">
            {getTrendIcon(metrics.trend.direction)}
            <h4 className="text-sm font-medium">
              {metrics.trend.direction === 'improving' ? 'Trending Up' : 
               metrics.trend.direction === 'declining' ? 'Trending Down' : 'Stable'}
            </h4>
          </div>
          <p className="text-sm text-gray-600">
            {getTrendText(metrics.trend.direction, metrics.trend.acceptanceChange)}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-green-600">Accepted</span>
            <span className="text-red-600">Rejected</span>
          </div>
          <Progress value={metrics.acceptanceRate} className="h-3" />
        </div>

        {/* Actionable Insights */}
        {metrics.actionableInsights && (
          <div className="space-y-4 pt-4 border-t">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Areas Needing Training Data
            </h4>
            
            {/* Top Issues */}
            <div className="grid grid-cols-1 gap-3">
              {metrics.actionableInsights.topIssues.rejectionReason !== 'none' && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <X className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium text-red-700">Top Rejection Reason</span>
                  </div>
                  <p className="text-sm text-red-600 capitalize">
                    {metrics.actionableInsights.topIssues.rejectionReason.replace('_', ' ')}
                  </p>
                  <p className="text-xs text-red-500 mt-1">
                    Add more training content about this topic in AI Training
                  </p>
                </div>
              )}
              
              {metrics.actionableInsights.topIssues.editType !== 'none' && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingDown className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-700">Most Common Edit</span>
                  </div>
                  <p className="text-sm text-yellow-600 capitalize">
                    {metrics.actionableInsights.topIssues.editType.replace('_', ' ')} adjustments
                  </p>
                  <p className="text-xs text-yellow-500 mt-1">
                    Update your brand voice settings or add examples for this style
                  </p>
                </div>
              )}

              {metrics.actionableInsights.topIssues.editTopic !== 'none' && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <BarChart3 className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700">Topic Needing Improvement</span>
                  </div>
                  <p className="text-sm text-blue-600 capitalize">
                    {metrics.actionableInsights.topIssues.editTopic.replace('_', ' ')} inquiries
                  </p>
                  <p className="text-xs text-blue-500 mt-1">
                    Add more training content or FAQ entries for this topic
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}