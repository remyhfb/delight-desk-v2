import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Brain, AlertTriangle, CheckCircle, 
  Lightbulb, ArrowRight, BarChart3 
} from 'lucide-react';

interface AIAssistantFeedback {
  rejectionsByReason: Record<string, number>;
  editsByTopic: Record<string, number>;
  totalInteractions: number;
  totalRejections: number;
  totalEdits: number;
}

interface AIAssistantAnalyticsProps {
  feedback: AIAssistantFeedback;
  timeframe?: string;
}

const REJECTION_REASON_LABELS: Record<string, string> = {
  'wrong_tone_style': 'Wrong tone or style',
  'factually_incorrect': 'Factually incorrect',
  'too_generic': 'Too generic, not personalized',
  'missed_context': 'Missed important context', 
  'violates_policy': 'Violates company policy',
  'other': 'Other reason'
};


export function AIAssistantAnalytics({ feedback, timeframe }: AIAssistantAnalyticsProps) {
  // Calculate percentages and insights
  const rejectionRate = feedback.totalInteractions > 0 
    ? (feedback.totalRejections / feedback.totalInteractions) * 100 
    : 0;
  
  const editRate = feedback.totalInteractions > 0 
    ? (feedback.totalEdits / feedback.totalInteractions) * 100 
    : 0;

  // Get top issues for recommendations
  const topRejectionReason = Object.entries(feedback.rejectionsByReason)
    .sort(([,a], [,b]) => b - a)[0];
  
  const topEditTopic = Object.entries(feedback.editsByTopic)
    .sort(([,a], [,b]) => b - a)[0];

  // Generate training recommendations based on data
  const getTrainingRecommendations = () => {
    const recommendations = [];
    
    if (topRejectionReason && topRejectionReason[1] > 0) {
      const [reason, count] = topRejectionReason;
      const reasonLabel = REJECTION_REASON_LABELS[reason] || reason;
      
      if (reason === 'wrong_tone_style') {
        recommendations.push({
          priority: 'high' as const,
          title: 'Brand Voice Training Needed',
          description: `${count} rejections for wrong tone/style. Your AI needs more examples of your preferred communication style.`,
          actions: [
            'Add 10-15 examples of approved customer responses to AI training',
            'Review brand voice settings in AI Team Center',
            'Include tone-specific feedback in future rejections'
          ]
        });
      } else if (reason === 'factually_incorrect') {
        recommendations.push({
          priority: 'high' as const,
          title: 'Knowledge Base Update Required',
          description: `${count} rejections for factual errors. Your AI needs more accurate product/policy information.`,
          actions: [
            'Update product information in AI training content',
            'Add FAQ content covering common customer questions',
            'Review and update company policy information'
          ]
        });
      } else if (reason === 'missed_context') {
        recommendations.push({
          priority: 'medium' as const,
          title: 'Context Understanding Improvement',
          description: `${count} rejections for missing context. AI needs better customer situation awareness.`,
          actions: [
            'Add examples of complex customer scenarios to training',
            'Include context-rich conversation examples',
            'Train on edge cases and unusual situations'
          ]
        });
      }
    }
    
    
    if (recommendations.length === 0) {
      recommendations.push({
        priority: 'low' as const,
        title: 'Continue Current Training',
        description: 'AI Assistant performance is stable. Continue adding diverse customer scenarios to training.',
        actions: [
          'Add new product information as it becomes available',
          'Include seasonal or promotional content updates',
          'Monitor for new patterns in customer inquiries'
        ]
      });
    }
    
    return recommendations;
  };

  const recommendations = getTrainingRecommendations();

  return (
    <div className="space-y-6">
      {/* AI Assistant Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Assistant Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{feedback.totalInteractions}</div>
              <div className="text-sm text-muted-foreground">Total Interactions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{rejectionRate.toFixed(1)}%</div>
              <div className="text-sm text-muted-foreground">Rejection Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{editRate.toFixed(1)}%</div>
              <div className="text-sm text-muted-foreground">Edit Rate</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rejection Reasons */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Rejection Reasons
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(feedback.rejectionsByReason)
              .sort(([,a], [,b]) => b - a)
              .slice(0, 6)
              .map(([reason, count]) => {
                const percentage = feedback.totalRejections > 0 
                  ? (count / feedback.totalRejections) * 100 
                  : 0;
                const label = REJECTION_REASON_LABELS[reason] || reason;
                
                return (
                  <div key={reason} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{label}</span>
                      <span className="text-sm text-muted-foreground">{count} ({percentage.toFixed(0)}%)</span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>

      {/* Training Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            AI Training Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recommendations.map((rec, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <ArrowRight className="h-4 w-4 mt-1 text-blue-600" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold">{rec.title}</h4>
                      <Badge variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'default' : 'secondary'}>
                        {rec.priority} priority
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{rec.description}</p>
                    
                    <div className="space-y-2">
                      <h5 className="text-sm font-medium">Recommended Actions:</h5>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {rec.actions.map((action, actionIndex) => (
                          <li key={actionIndex} className="flex items-start gap-2">
                            <CheckCircle className="h-3 w-3 mt-1 text-green-600 flex-shrink-0" />
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Topic Analysis */}
      {Object.keys(feedback.editsByTopic).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Topics Requiring Most Edits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(feedback.editsByTopic)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 6)
                .map(([topic, count]) => (
                  <div key={topic} className="p-3 bg-gray-50 rounded-lg">
                    <div className="font-medium capitalize text-sm">{topic.replace('_', ' ')}</div>
                    <div className="text-sm text-muted-foreground">{count} edits</div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}