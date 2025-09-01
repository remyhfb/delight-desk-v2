import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart3, AlertCircle, Trophy, Target, Lightbulb, Flag, ArrowRight,
  TrendingUp, TrendingDown, Minus, CheckCircle, X 
} from 'lucide-react';

interface AIInsights {
  overallAssessment: {
    score: number;
    status: 'excellent' | 'good' | 'fair' | 'needs_improvement' | 'poor';
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

interface AIPerformanceMetrics {
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
}

interface AIInsightsDisplayProps {
  metrics: AIPerformanceMetrics;
  timeframe?: string;
  onTimeframeChange?: (timeframe: string) => void;
}

export function AIInsightsDisplay({ metrics, timeframe, onTimeframeChange }: AIInsightsDisplayProps) {
  const { aiInsights } = metrics;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'text-green-600';
      case 'good': return 'text-blue-600';
      case 'fair': return 'text-yellow-600';
      case 'needs_improvement': return 'text-orange-600';
      case 'poor': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent': return <Trophy className="h-5 w-5 text-green-600" />;
      case 'good': return <Target className="h-5 w-5 text-blue-600" />;
      case 'fair': return <BarChart3 className="h-5 w-5 text-yellow-600" />;
      case 'needs_improvement': return <Flag className="h-5 w-5 text-orange-600" />;
      case 'poor': return <AlertCircle className="h-5 w-5 text-red-600" />;
      default: return <BarChart3 className="h-5 w-5 text-gray-600" />;
    }
  };

  const getFindingIcon = (type: string) => {
    switch (type) {
      case 'strength': return <Trophy className="h-4 w-4 text-green-600" />;
      case 'concern': return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'opportunity': return <Lightbulb className="h-4 w-4 text-blue-600" />;
      default: return <Target className="h-4 w-4 text-gray-600" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-orange-100 text-orange-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'improving': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'declining': return <TrendingDown className="h-4 w-4 text-red-600" />;
      default: return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Overall Assessment */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              AI Performance Analysis
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
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
            {getStatusIcon(aiInsights.overallAssessment.status)}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl font-bold">{aiInsights.overallAssessment.score}/100</span>
                <span className={`text-lg font-semibold capitalize ${getStatusColor(aiInsights.overallAssessment.status)}`}>
                  {aiInsights.overallAssessment.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-gray-700">{aiInsights.overallAssessment.summary}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Findings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Key Findings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {aiInsights.keyFindings.map((finding, index) => (
              <div key={index} className="flex gap-3 p-4 bg-gray-50 rounded-lg">
                {getFindingIcon(finding.type)}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold">{finding.title}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      finding.impact === 'high' ? 'bg-red-100 text-red-800' :
                      finding.impact === 'medium' ? 'bg-orange-100 text-orange-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {finding.impact} impact
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{finding.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            AI-Powered Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {aiInsights.recommendations.map((rec, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <ArrowRight className="h-4 w-4 mt-1 text-blue-600" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold">{rec.title}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs ${getPriorityColor(rec.priority)}`}>
                        {rec.priority} priority
                      </span>
                      <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800 capitalize">
                        {rec.category.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{rec.description}</p>
                    
                    <div className="space-y-2">
                      <h5 className="text-sm font-medium">Action Steps:</h5>
                      <ul className="text-sm text-gray-600 space-y-1">
                        {rec.actionSteps.map((step, stepIndex) => (
                          <li key={stepIndex} className="flex items-start gap-2">
                            <span className="text-blue-600 mt-1">•</span>
                            {step}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="mt-3 p-2 bg-blue-50 rounded text-sm">
                      <strong>Expected Impact:</strong> {rec.estimatedImpact}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Performance Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getTrendIcon(aiInsights.trends.direction)}
            Performance Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold capitalize">{aiInsights.trends.direction}</span>
              <span className="text-sm text-gray-500">trend</span>
            </div>
            <p className="text-gray-700">{aiInsights.trends.explanation}</p>
            <div className="p-3 bg-blue-50 rounded-lg">
              <h5 className="font-medium text-sm mb-1">Next Steps:</h5>
              <p className="text-sm text-gray-700">{aiInsights.trends.nextSteps}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Raw Metrics Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-gray-600">Performance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">{metrics.totalInteractions}</div>
              <div className="text-sm text-gray-500">Total Interactions</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{metrics.acceptanceRate.toFixed(1)}%</div>
              <div className="text-sm text-gray-500">Acceptance Rate</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{metrics.totalRejected}</div>
              <div className="text-sm text-gray-500">Rejections</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}