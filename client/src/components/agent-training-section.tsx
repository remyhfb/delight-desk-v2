import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Plus, 
  Trash2, 
  Globe, 
  FileText, 
  AlertTriangle, 
  CheckCircle,
  Loader2,
  Brain,
  BookOpen,
  TrendingUp
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

interface TrainingUrl {
  id: string;
  url: string;
  status: 'pending' | 'crawling' | 'completed' | 'failed';
  pageCount?: number;
  lastCrawled?: string;
}

interface ManualContent {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

interface AgentTrainingRequirement {
  agentType: string;
  hasMinimumContent: boolean;
  hasRelevantContent: boolean;
  urlCount: number;
  manualContentCount: number;
  relevantChunks: number;
  totalSources: number;
  contentQuality: 'insufficient' | 'basic' | 'good' | 'excellent';
  recommendations: string[];
  warning?: string;
}

interface AgentTrainingSectionProps {
  agentType: 'product' | 'wismo' | 'subscription' | 'returns';
  agentDisplayName: string;
  className?: string;
}

export function AgentTrainingSection({ agentType, agentDisplayName, className = "" }: AgentTrainingSectionProps) {
  const [newUrl, setNewUrl] = useState('');
  const [manualContentTitle, setManualContentTitle] = useState('');
  const [manualContent, setManualContent] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch agent-specific training validation
  const { data: trainingRequirements, isLoading: isLoadingRequirements } = useQuery<AgentTrainingRequirement>({
    queryKey: [`/api/agents/${agentType}/training-validation/${user?.id}`],
    enabled: !!user?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch training URLs
  const { data: trainingUrls = [], isLoading: isLoadingUrls } = useQuery<TrainingUrl[]>({
    queryKey: ['/api/ai-training/urls', user?.id],
    enabled: !!user?.id,
  });

  // Fetch manual content  
  const { data: manualContents = [], isLoading: isLoadingManual } = useQuery<ManualContent[]>({
    queryKey: ['/api/ai-training/manual-content', user?.id],
    enabled: !!user?.id,
  });

  // Add URL mutation
  const addUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      const response = await fetch('/api/ai-training/urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!response.ok) throw new Error('Failed to add URL');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-training/urls'] });
      queryClient.invalidateQueries({ queryKey: [`/api/agents/${agentType}/training-validation`] });
      setNewUrl('');
      toast({ title: 'URL added successfully!', description: 'Content will be crawled shortly.' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to add URL', description: error.message, variant: 'destructive' });
    },
  });

  // Add manual content mutation
  const addManualContentMutation = useMutation({
    mutationFn: async ({ title, content }: { title: string; content: string }) => {
      if (!user?.id) throw new Error('Not authenticated');
      const response = await fetch('/api/ai-training/manual-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });
      if (!response.ok) throw new Error('Failed to add content');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-training/manual-content'] });
      queryClient.invalidateQueries({ queryKey: [`/api/agents/${agentType}/training-validation`] });
      setManualContentTitle('');
      setManualContent('');
      setShowManualInput(false);
      toast({ title: 'Content added successfully!', description: 'This content will help train your AI agent.' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to add content', description: error.message, variant: 'destructive' });
    },
  });

  // Delete URL mutation
  const deleteUrlMutation = useMutation({
    mutationFn: async (urlId: string) => {
      const response = await fetch(`/api/ai-training/urls/${urlId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete URL');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-training/urls'] });
      queryClient.invalidateQueries({ queryKey: [`/api/agents/${agentType}/training-validation`] });
      toast({ title: 'URL removed successfully!' });
    },
  });

  // Delete manual content mutation
  const deleteManualContentMutation = useMutation({
    mutationFn: async (contentId: string) => {
      const response = await fetch(`/api/ai-training/manual-content/${contentId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete content');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-training/manual-content'] });
      queryClient.invalidateQueries({ queryKey: [`/api/agents/${agentType}/training-validation`] });
      toast({ title: 'Content removed successfully!' });
    },
  });

  const handleAddUrl = () => {
    if (!newUrl.trim()) return;
    
    try {
      new URL(newUrl); // Validate URL format
      addUrlMutation.mutate(newUrl.trim());
    } catch {
      toast({ 
        title: 'Invalid URL', 
        description: 'Please enter a valid URL starting with http:// or https://',
        variant: 'destructive'
      });
    }
  };

  const handleAddManualContent = () => {
    if (!manualContentTitle.trim() || !manualContent.trim()) {
      toast({ 
        title: 'Missing Information', 
        description: 'Please provide both a title and content',
        variant: 'destructive'
      });
      return;
    }
    
    addManualContentMutation.mutate({
      title: manualContentTitle.trim(),
      content: manualContent.trim()
    });
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'text-green-600 bg-green-50 border-green-200';
      case 'good': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'basic': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'insufficient': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getQualityIcon = (quality: string) => {
    switch (quality) {
      case 'excellent': return <CheckCircle className="h-4 w-4" />;
      case 'good': return <TrendingUp className="h-4 w-4" />;
      case 'basic': return <Brain className="h-4 w-4" />;
      case 'insufficient': return <AlertTriangle className="h-4 w-4" />;
      default: return <BookOpen className="h-4 w-4" />;
    }
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            {agentDisplayName} Training Data
          </CardTitle>
          {trainingRequirements && (
            <div className={`flex items-center gap-2 p-3 rounded-lg border ${getQualityColor(trainingRequirements.contentQuality)}`}>
              {getQualityIcon(trainingRequirements.contentQuality)}
              <div className="flex-1">
                <p className="font-medium capitalize">{trainingRequirements.contentQuality} Training Quality</p>
                <p className="text-sm opacity-75">
                  {trainingRequirements.totalSources} training {trainingRequirements.totalSources === 1 ? 'source' : 'sources'} added
                </p>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Combined Status and Recommendations */}
          {(trainingRequirements?.warning || (trainingRequirements?.recommendations && trainingRequirements.recommendations.length > 0)) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              {trainingRequirements?.warning && (
                <div className="flex items-start gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-800">{trainingRequirements.warning}</p>
                </div>
              )}
              
              {trainingRequirements?.recommendations && trainingRequirements.recommendations.length > 0 && (
                <>
                  {trainingRequirements.warning && <div className="border-t border-blue-200 my-3"></div>}
                  <h4 className="font-medium text-blue-900 mb-2">Recommendations:</h4>
                  <ul className="space-y-1 text-sm text-blue-800">
                    {trainingRequirements.recommendations.map((rec, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-blue-500 mt-1">•</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {/* Add URL Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Website URLs</span>
            </div>
            
            <div className="flex gap-2">
              <Input
                placeholder={`https://yoursite.com/${agentType === 'product' ? 'products' : agentType}`}
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && newUrl.trim() && !addUrlMutation.isPending && handleAddUrl()}
                disabled={addUrlMutation.isPending}
              />
              <Button 
                onClick={handleAddUrl}
                disabled={addUrlMutation.isPending || !newUrl.trim()}
              >
                {addUrlMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* URL List */}
            {trainingUrls.length > 0 && (
              <div className="space-y-2">
                {trainingUrls.map((url) => (
                  <div key={url.id} className="flex items-center justify-between p-3 border rounded-lg bg-white">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="bg-blue-100 rounded-full p-2">
                        <Globe className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{url.url}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={url.status === 'completed' ? 'default' : url.status === 'failed' ? 'destructive' : 'secondary'}>
                            {url.status}
                          </Badge>
                          {url.pageCount && (
                            <span className="text-xs text-gray-500">{url.pageCount} pages</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteUrlMutation.mutate(url.id)}
                      disabled={deleteUrlMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Manual Content Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Manual Content ({manualContents.length})</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowManualInput(!showManualInput)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Content
              </Button>
            </div>

            {/* Manual Content Input */}
            {showManualInput && (
              <Card className="border-2 border-dashed border-gray-200">
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="manual-title">Title</Label>
                    <Input
                      id="manual-title"
                      placeholder={`e.g., ${agentType === 'product' ? 'Product Features & Benefits' : `${agentDisplayName} Information`}`}
                      value={manualContentTitle}
                      onChange={(e) => setManualContentTitle(e.target.value)}
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manual-content">Content</Label>
                    <Textarea
                      id="manual-content"
                      placeholder={`Add detailed information about ${agentType === 'product' ? 'your products, features, specifications, and benefits' : `${agentType} policies and procedures`}...`}
                      value={manualContent}
                      onChange={(e) => setManualContent(e.target.value)}
                      rows={6}
                      className="bg-white resize-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowManualInput(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAddManualContent}
                      disabled={addManualContentMutation.isPending || !manualContentTitle.trim() || !manualContent.trim()}
                    >
                      {addManualContentMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Adding...
                        </>
                      ) : (
                        'Add Content'
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Manual Content List */}
            {manualContents.length > 0 && (
              <div className="space-y-2">
                {manualContents.map((content) => (
                  <div key={content.id} className="flex items-center justify-between p-3 border rounded-lg bg-white">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="bg-green-100 rounded-full p-2">
                        <FileText className="h-4 w-4 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{content.title}</p>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {content.content.substring(0, 100)}...
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteManualContentMutation.mutate(content.id)}
                      disabled={deleteManualContentMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}