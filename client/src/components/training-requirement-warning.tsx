import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Plus, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLocation } from 'wouter';

interface TrainingRequirement {
  hasMinimumContent: boolean;
  urlCount: number;
  manualContentCount: number;
  totalSources: number;
  warning?: string;
}

interface TrainingRequirementWarningProps {
  userId: string;
  showCard?: boolean;
  className?: string;
}

export function TrainingRequirementWarning({ 
  userId, 
  showCard = false, 
  className = "" 
}: TrainingRequirementWarningProps) {
  const [, setLocation] = useLocation();

  const { data: requirements, isLoading } = useQuery<TrainingRequirement>({
    queryKey: [`/api/ai-training/requirements/${userId}`],
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes
  });

  const { data: trainingStatus } = useQuery<{
    status: 'sufficient' | 'insufficient' | 'error';
    message: string;
    details: TrainingRequirement;
  }>({
    queryKey: [`/api/ai-training/training-status/${userId}`],
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading || !requirements || requirements.hasMinimumContent) {
    return null; // Don't show warning if training requirements are met
  }

  const handleAddTrainingData = () => {
    setLocation('/ai-training?tab=knowledge');
  };

  const warningContent = (
    <>
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-semibold text-amber-800 mb-2">
            Training Data Required
          </h4>
          <p className="text-sm text-amber-700 mb-4">
            {requirements.warning || "AI automation requires at least 1 training source to prevent generic responses that could harm your business."}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={handleAddTrainingData}
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Training Data
            </Button>
            <p className="text-xs text-amber-600 flex items-center">
              <ExternalLink className="h-3 w-3 mr-1" />
              Add URLs or manual content in AI Team Center
            </p>
          </div>
        </div>
      </div>
    </>
  );

  if (showCard) {
    return (
      <Card className={`border-amber-200 bg-amber-50 ${className}`}>
        <CardHeader className="pb-4">
          <CardTitle className="text-amber-800 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            AI Automation Disabled
          </CardTitle>
          <CardDescription className="text-amber-700">
            Training data is required before enabling automation
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {warningContent}
        </CardContent>
      </Card>
    );
  }

  return (
    <Alert className={`border-amber-200 bg-amber-50 ${className}`}>
      <AlertDescription>
        {warningContent}
      </AlertDescription>
    </Alert>
  );
}

export function TrainingStatusIndicator({ userId }: { userId: string }) {
  const { data: trainingStatus, isLoading } = useQuery<{
    status: 'sufficient' | 'insufficient' | 'error';
    message: string;
    details: TrainingRequirement;
  }>({
    queryKey: [`/api/ai-training/training-status/${userId}`],
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading || !trainingStatus) {
    return null;
  }

  const statusColors = {
    sufficient: 'text-green-600 bg-green-50 border-green-200',
    insufficient: 'text-amber-600 bg-amber-50 border-amber-200',
    error: 'text-red-600 bg-red-50 border-red-200'
  };

  return (
    <div className={`inline-flex items-center px-3 py-2 rounded-lg border text-sm font-medium ${statusColors[trainingStatus.status]}`}>
      {trainingStatus.status === 'sufficient' ? (
        <>
          <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
          Training Complete ({trainingStatus.details.totalSources} source{trainingStatus.details.totalSources === 1 ? '' : 's'})
        </>
      ) : (
        <>
          <AlertTriangle className="h-4 w-4 mr-2" />
          {trainingStatus.status === 'insufficient' ? 'Training Required' : 'Training Error'}
        </>
      )}
    </div>
  );
}