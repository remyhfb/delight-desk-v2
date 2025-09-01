import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Brain, 
  Plus, 
  Trash2, 
  Globe, 
  MessageSquare, 
  Smile, 
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Bot,
  User,
  Sparkles
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Layout } from '@/components/layout/layout';
// AI Performance metrics moved to separate page at /ai-performance
import { useAuth } from '@/hooks/use-auth';

interface TrainingUrl {
  id: string;
  url: string;
  status: 'pending' | 'crawling' | 'completed' | 'failed';
  pageCount?: number;
  lastCrawled?: string;
}

interface ManualTrainingContent {
  id: string;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AITrainingConfigResponse {
  id: string;
  userId: string;
  allowEmojis: boolean;
  brandVoice: string;
  customInstructions?: string;
  trainingUrls: TrainingUrl[];
  manualContent?: ManualTrainingContent[];
  aiAgentName?: string;
  businessVertical?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const BRAND_VOICE_SUGGESTIONS = [
  'Friendly',
  'Professional',
  'Sophisticated',
  'Custom'
];

const ROBOT_NAME_SUGGESTIONS = [
  { name: 'WALL-E', description: '🤖 Cute, helpful, and universally loved' },
  { name: 'Baymax', description: '🏥 Caring healthcare assistant from Big Hero 6' },
  { name: 'R2-D2', description: '⭐ Iconic Star Wars helper droid' },
  { name: 'EVE', description: '🚀 Sophisticated robot from WALL-E' },
  { name: 'C-3PO', description: '👨‍💼 Polite protocol droid from Star Wars' },
  { name: 'Data', description: '🖖 Curious android from Star Trek' },
  { name: 'KITT', description: '🚗 Helpful AI from Knight Rider' },
];

interface AiNameSuggestion {
  name: string;
  reasoning: string;
  brandAlignment: string;
  personality: string;
}

export default function AITraining() {
  const [newUrl, setNewUrl] = useState('');
  const [brandVoice, setBrandVoice] = useState('Professional');
  const [customVoice, setCustomVoice] = useState('');
  const [allowEmojis, setAllowEmojis] = useState(false);
  const [customInstructions, setCustomInstructions] = useState('');
  const [playgroundQuery, setPlaygroundQuery] = useState('');
  const [playgroundResponse, setPlaygroundResponse] = useState('');
  const [playgroundLoading, setPlaygroundLoading] = useState(false);
  const [manualContentTitle, setManualContentTitle] = useState('');
  const [manualContent, setManualContent] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [aiAgentName, setAiAgentName] = useState('WALL-E');
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showAiSuggestions, setShowAiSuggestions] = useState(false);
  const [contentQuality, setContentQuality] = useState<any>(null);
  const [checkingContent, setCheckingContent] = useState(false);
  const [businessVertical, setBusinessVertical] = useState('general_ecommerce');
  // Performance timeframe moved to AI Performance page
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: trainingConfig, isLoading } = useQuery<AITrainingConfigResponse>({
    queryKey: ['/api/ai-training', user?.id],
    enabled: !!user?.id,
    staleTime: 0, // Always fetch fresh
    gcTime: 0  // Don't cache (updated for TanStack Query v5)
  });
  

  // Load existing configuration data
  useEffect(() => {
    if (trainingConfig) {
      setBrandVoice(trainingConfig.brandVoice || 'Professional');
      setAllowEmojis(trainingConfig.allowEmojis || false);
      setCustomInstructions(trainingConfig.customInstructions || '');
      setAiAgentName(trainingConfig.aiAgentName || 'WALL-E');
      setBusinessVertical(trainingConfig.businessVertical || 'general_ecommerce');
    }
  }, [trainingConfig]);

  // Check content quality when training URLs change
  useEffect(() => {
    if (user?.id && trainingConfig?.trainingUrls) {
      checkContentQuality();
    }
  }, [user?.id, trainingConfig?.trainingUrls]);

  // Check if user has adequate content for AI suggestions
  const checkContentQuality = async () => {
    if (!user?.id) return;
    
    setCheckingContent(true);
    try {
      const response = await fetch('/api/ai-training/check-content-quality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      
      if (response.ok) {
        const data = await response.json();
        setContentQuality(data);
      }
    } catch (error) {
      console.error('Failed to check content quality:', error);
    } finally {
      setCheckingContent(false);
    }
  };

  const addUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      const response = await fetch('/api/ai-training/urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, userId: user.id })
      });
      if (!response.ok) throw new Error('Failed to add URL');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-training', user?.id] });
      setNewUrl('');
      
      // Check if this URL was already added or is a new one
      const isNewUrl = data.createdAt && new Date(data.createdAt).getTime() > (Date.now() - 10000);
      
      if (isNewUrl) {
        toast({ title: 'URL added', description: 'Training URL has been added and will be crawled shortly.' });
      } else {
        toast({ 
          title: 'URL already exists', 
          description: data.status === 'failed' ? 'Retrying crawl for failed URL.' : 'This URL has already been added to your training content.' 
        });
      }
    },
    onError: (error: any) => {
      const errorMessage = error?.message || 'Failed to add training URL';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    }
  });

  const addManualContentMutation = useMutation({
    mutationFn: async (data: { title: string; content: string }) => {
      if (!user?.id) throw new Error('Not authenticated');
      const response = await fetch('/api/ai-training/manual-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user.id, 
          title: data.title,
          content: data.content 
        })
      });
      if (!response.ok) throw new Error('Failed to add manual content');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-training', user?.id] });
      setManualContentTitle('');
      setManualContent('');
      setShowManualInput(false);
      toast({ title: 'Content added', description: 'Manual training content has been added successfully.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to add manual content', variant: 'destructive' });
    }
  });

  const removeUrlMutation = useMutation({
    mutationFn: async (urlId: string) => {
      const response = await fetch(`/api/ai-training/urls/${urlId}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to remove URL');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-training', user?.id] });
      toast({ title: 'URL removed', description: 'Training URL has been removed.' });
    }
  });

  const saveConfigMutation = useMutation({
    mutationFn: async (config: Partial<AITrainingConfigResponse>) => {
      if (!user?.id) throw new Error('Not authenticated');
      const response = await fetch('/api/ai-training/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, userId: user.id })
      });
      if (!response.ok) throw new Error('Failed to save configuration');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-training', user?.id] });
      toast({ title: 'Settings saved', description: 'AI training configuration has been updated.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save configuration', variant: 'destructive' });
    }
  });

  const testPlaygroundMutation = useMutation({
    mutationFn: async (query: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      const response = await fetch('/api/ai-training/playground-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user.id,
          query: query.trim()
        })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to get AI response');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setPlaygroundResponse(data.response);
      setPlaygroundLoading(false);
    },
    onError: (error) => {
      toast({ 
        title: 'Error', 
        description: error instanceof Error ? error.message : 'Failed to get AI response',
        variant: 'destructive' 
      });
      setPlaygroundLoading(false);
    }
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

  const handleSaveConfig = () => {
    const finalBrandVoice = brandVoice === 'Custom' ? customVoice : brandVoice;
    
    saveConfigMutation.mutate({
      allowEmojis,
      brandVoice: finalBrandVoice,
      customInstructions,
      aiAgentName: aiAgentName || 'WALL-E',
      businessVertical: businessVertical || 'general_ecommerce'
    });
  };

  const handlePlaygroundTest = () => {
    if (!playgroundQuery.trim()) {
      toast({ 
        title: 'Empty Question', 
        description: 'Please enter a question to test the AI',
        variant: 'destructive' 
      });
      return;
    }

    setPlaygroundLoading(true);
    setPlaygroundResponse('');
    testPlaygroundMutation.mutate(playgroundQuery);
  };

  // Get AI-powered name suggestions based on training data
  const handleGetAiSuggestions = async () => {
    if (!user?.id) return;
    
    setLoadingSuggestions(true);
    try {
      const response = await fetch('/api/ai-training/suggest-names', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.needsMoreContent) {
          toast({
            title: 'Need More Brand Content',
            description: errorData.error || 'Add more company and product information to get personalized suggestions',
            variant: 'destructive'
          });
          return;
        }
        throw new Error('Failed to get suggestions');
      }
      
      const data = await response.json();
      setAiSuggestions(data.suggestions || []);
      setShowAiSuggestions(true);
      
      toast({
        title: 'AI Suggestions Ready',
        description: 'Generated personalized names based on your brand content'
      });
      
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate AI suggestions',
        variant: 'destructive'
      });
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed': return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'crawling': return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
      default: return <Globe className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'crawling': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto p-6 space-y-6">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
          <Brain className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">AI Response Training</h1>
          </div>
          <p className="text-gray-600">
            Train the AI to provide brand-appropriate response suggestions for escalated emails. 
            The AI will only suggest responses when it has high confidence in their accuracy.
          </p>
        </div>

        {/* AI Performance Analytics moved to /ai-performance page */}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Training URLs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Training Content URLs
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/ai-training', user?.id] })}
                className="h-6 px-2"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </CardTitle>
            <p className="text-sm text-gray-600">
              Add URLs for the AI to crawl and learn from (FAQ pages, product pages, support documentation, etc.)
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
              <p className="text-xs text-amber-800">
                <strong>Content Limits:</strong> Each URL crawls up to 50 pages maximum. For large sites, focus on key pages like FAQs, policies, and product information for best results.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add URL Input */}
            <div className="flex gap-2">
              <Input
                placeholder="https://yoursite.com/faq"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && newUrl.trim() && !addUrlMutation.isPending && handleAddUrl()}
                disabled={addUrlMutation.isPending}
              />
              <Button 
                onClick={handleAddUrl}
                disabled={addUrlMutation.isPending || !newUrl.trim()}
                size="sm"
              >
                {addUrlMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* URL List and Manual Content Combined */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {/* ALWAYS SHOW - Bypass all conditional logic */}
              {/* Display URLs */}
              {trainingConfig?.trainingUrls?.map((urlItem) => (
                <div key={urlItem.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {getStatusIcon(urlItem.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{urlItem.url}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className={`text-xs ${getStatusColor(urlItem.status)}`}>
                          {urlItem.status}
                        </Badge>
                        {urlItem.pageCount && (
                          <span className="text-xs text-gray-500">
                            {urlItem.pageCount} pages crawled
                          </span>
                        )}
                        {urlItem.status === 'completed' && urlItem.lastCrawled && (
                          <span className="text-xs text-green-600">
                            ✓ Crawled {new Date(urlItem.lastCrawled).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeUrlMutation.mutate(urlItem.id)}
                    disabled={removeUrlMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              
              {/* Display Manual Content */}
              {trainingConfig?.manualContent?.map((content) => (
                <div key={content.id} className="flex items-center justify-between p-3 border rounded-lg bg-blue-50 border-blue-200">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <MessageSquare className="h-4 w-4 text-blue-600" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-blue-900">{content.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                          manual content
                        </Badge>
                        <span className="text-xs text-blue-700">
                          {content.content.length} characters
                        </span>
                        <span className="text-xs text-blue-600">
                          ✓ Added {new Date(content.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      toast({ 
                        title: 'Manual content ready!', 
                        description: `"${content.title}" is cataloged and available to all AI agents.`
                      });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              
              {/* HARDCODED TEST ITEM - Claude's Challenge */}
              <div className="flex items-center justify-between p-3 border rounded-lg bg-green-50 border-green-200">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <MessageSquare className="h-4 w-4 text-green-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-green-900">Claude's Test Content</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                        hardcoded test
                      </Badge>
                      <span className="text-xs text-green-700">
                        42 characters
                      </span>
                      <span className="text-xs text-green-600">
                        ✓ Added manually by Claude
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    toast({ 
                      title: 'Challenge completed!', 
                      description: 'Claude successfully added content to the list!'
                    });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Empty state only if truly nothing */}
              {(!trainingConfig?.trainingUrls || trainingConfig.trainingUrls.length === 0) && 
               (!trainingConfig?.manualContent || trainingConfig.manualContent.length === 0) && (
                <div className="text-center py-8 text-gray-500">
                  <Globe className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No training sources added yet</p>
                  <p className="text-xs">Add URLs above or manual content below to train the AI</p>
                </div>
              )}
            </div>

            {/* Manual Content Fallback */}
            <Separator className="my-4" />
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="bg-blue-100 rounded-full p-2 mt-1">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-blue-900 mb-2">
                    Website Not Scraping Properly?
                  </h4>
                  <p className="text-xs text-blue-800 mb-3">
                    Some websites have anti-scraping protection or complex JavaScript that prevents automated content extraction. 
                    If your website content isn't being captured properly, you can manually add your FAQ or support content below.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowManualInput(!showManualInput)}
                    className="text-xs bg-white hover:bg-blue-50 border-blue-200"
                  >
                    {showManualInput ? 'Hide' : 'Add Content Manually'}
                  </Button>
                </div>
              </div>
            </div>

            {showManualInput && (
              <div className="space-y-3 border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="space-y-2">
                  <Label htmlFor="manual-title" className="text-sm font-medium">Content Title</Label>
                  <Input
                    id="manual-title"
                    placeholder="e.g., FAQ - Shipping & Returns"
                    value={manualContentTitle}
                    onChange={(e) => setManualContentTitle(e.target.value)}
                    className="bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manual-content" className="text-sm font-medium">Content</Label>
                  <Textarea
                    id="manual-content"
                    placeholder="Copy and paste your FAQ content, support documentation, or any other content you want the AI to learn from. Include questions and answers in a clear format."
                    value={manualContent}
                    onChange={(e) => setManualContent(e.target.value)}
                    rows={8}
                    className="bg-white resize-none"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowManualInput(false);
                      setManualContentTitle('');
                      setManualContent('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleAddManualContent}
                    disabled={addManualContentMutation.isPending || !manualContentTitle.trim() || !manualContent.trim()}
                  >
                    {addManualContentMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        Adding...
                      </>
                    ) : (
                      'Add Content'
                    )}
                  </Button>
                </div>
              </div>
            )}

          </CardContent>
        </Card>

        {/* Brand Voice & Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Brand Voice & Settings
            </CardTitle>
            <p className="text-sm text-gray-600">
              Configure how the AI should write responses in your brand's voice
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Brand Voice Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Brand Voice (defaults to "Professional")</Label>
              <div className="grid grid-cols-3 gap-2">
                {BRAND_VOICE_SUGGESTIONS.map((voice) => (
                  <Button
                    key={voice}
                    variant={brandVoice === voice ? "default" : "outline"}
                    size="sm"
                    onClick={() => setBrandVoice(voice)}
                    className="text-xs"
                  >
                    {voice}
                  </Button>
                ))}
                <Button
                  variant={brandVoice === 'Custom' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setBrandVoice('Custom')}
                  className="text-xs"
                >
                  Custom
                </Button>
              </div>
              
              {brandVoice === 'Custom' && (
                <Input
                  placeholder="Describe your brand voice..."
                  value={customVoice}
                  onChange={(e) => setCustomVoice(e.target.value)}
                />
              )}
            </div>

            <Separator />

            {/* Emoji Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Smile className="h-4 w-4" />
                  Allow Emojis
                </Label>
                <p className="text-xs text-gray-600">
                  Include emojis in AI-suggested responses
                </p>
              </div>
              <Switch
                checked={allowEmojis}
                onCheckedChange={setAllowEmojis}
              />
            </div>

            <Separator />

            {/* Custom Instructions */}
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Additional Instructions (Optional)</Label>
                <p className="text-xs text-gray-500 mt-1">
                  Add specific guidelines for responses that aren't covered by your website content
                </p>
              </div>
              
              <Textarea
                placeholder="Example: Always mention free shipping on orders over $50, or Always offer a 20% discount code SAVE20 for disappointed customers..."
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                rows={3}
                className="resize-none"
              />
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs font-medium text-blue-800 mb-2">Common use cases:</p>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• <strong>Current promotions:</strong> "Always mention our current 15% off promotion with code SPRING15"</li>
                  <li>• <strong>Response templates:</strong> "End all responses with 'Thanks for choosing [Company]! Reply if you need more help'"</li>
                  <li>• <strong>Escalation triggers:</strong> "If customer mentions 'lawsuit' or 'attorney', immediately escalate to manager"</li>
                  <li>• <strong>Policy clarifications:</strong> "Our return window is 60 days, not 30 days as some old pages might show"</li>
                  <li>• <strong>Tone adjustments:</strong> "Always apologize first before providing solutions, even for simple questions"</li>
                </ul>
              </div>
            </div>

            <Button 
              onClick={handleSaveConfig}
              disabled={saveConfigMutation.isPending}
              className="w-full"
            >
              {saveConfigMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Configuration'
              )}
            </Button>
          </CardContent>
        </Card>
        
        {/* AI Agent Personalization */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-blue-600" />
              AI Agent Identity
            </CardTitle>
            <p className="text-sm text-gray-600">
              Give your AI agent a friendly name that will appear in email signatures
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label className="text-sm font-medium">Agent Name</Label>
                <Input
                  placeholder="Enter your AI agent's name"
                  value={aiAgentName}
                  onChange={(e) => setAiAgentName(e.target.value)}
                  className="max-w-xs"
                  data-testid="input-agent-name"
                />
                <p className="text-xs text-gray-500">
                  This name will appear in email signatures when your AI agent responds to customers
                </p>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Business Type</Label>
                <Select value={businessVertical} onValueChange={setBusinessVertical}>
                  <SelectTrigger className="max-w-xs">
                    <SelectValue placeholder="Select your business type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="food_beverage">Food & Beverage</SelectItem>
                    <SelectItem value="fashion">Fashion & Apparel</SelectItem>
                    <SelectItem value="electronics">Electronics & Tech</SelectItem>
                    <SelectItem value="beauty">Beauty & Personal Care</SelectItem>
                    <SelectItem value="general_ecommerce">General E-commerce</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Helps your AI provide industry-specific guidance and appropriate responses
                </p>
              </div>
            </div>

            {/* AI-Powered Brand Suggestions */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">AI-Powered Brand Suggestions</Label>
              
              {/* Content Quality Status */}
              {checkingContent ? (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Analyzing content quality...
                </div>
              ) : contentQuality ? (
                <div className="space-y-2">
                  {contentQuality.hasEnoughContent ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-xs text-green-700">
                          <CheckCircle className="w-3 h-3" />
                          Content quality: {contentQuality.contentQuality}
                        </div>
                        <span className="text-xs text-gray-500">
                          ({contentQuality.totalWords} words)
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGetAiSuggestions}
                        disabled={loadingSuggestions}
                        className="text-xs"
                        data-testid="button-get-ai-suggestions"
                      >
                        {loadingSuggestions ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin mr-1" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3 mr-1" />
                            Get Smart Suggestions
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-amber-800 mb-1">
                            Need More Brand Content ({contentQuality.totalWords} words)
                          </div>
                          <p className="text-xs text-amber-700 mb-2">
                            Add more company information to get personalized AI agent names that match your brand:
                          </p>
                          <ul className="text-xs text-amber-700 space-y-1">
                            {contentQuality.suggestions.map((suggestion: string, index: number) => (
                              <li key={index}>• {suggestion}</li>
                            ))}
                          </ul>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled
                            className="text-xs mt-2 opacity-50"
                            data-testid="button-get-ai-suggestions-disabled"
                          >
                            <Sparkles className="w-3 h-3 mr-1" />
                            Need More Content
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Globe className="w-3 h-3" />
                  Add training content to enable AI-powered suggestions
                </div>
              )}
              
              <p className="text-xs text-gray-500">
                Get personalized AI agent names based on your actual brand content and voice
              </p>
              
              {showAiSuggestions && aiSuggestions.length > 0 && (
                <div className="grid grid-cols-1 gap-3">
                  {aiSuggestions.map((suggestion: AiNameSuggestion, index: number) => (
                    <div 
                      key={index} 
                      onClick={() => setAiAgentName(suggestion.name)}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors hover:bg-green-50 ${
                        aiAgentName === suggestion.name 
                          ? 'border-green-500 bg-green-50' 
                          : 'border-gray-200 hover:border-green-300'
                      }`}
                      data-testid={`button-ai-suggestion-${index}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-sm">{suggestion.name}</div>
                        <div className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                          AI Suggested
                        </div>
                      </div>
                      <div className="text-xs text-gray-600 mb-2">{suggestion.reasoning}</div>
                      <div className="flex gap-2">
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded">
                          {suggestion.personality}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Popular Robot Names</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {ROBOT_NAME_SUGGESTIONS.map((robot) => (
                  <div
                    key={robot.name}
                    onClick={() => setAiAgentName(robot.name)}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors hover:bg-blue-50 ${
                      aiAgentName === robot.name 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                    data-testid={`button-robot-${robot.name.toLowerCase()}`}
                  >
                    <div className="font-medium text-sm">{robot.name}</div>
                    <div className="text-xs text-gray-600">{robot.description}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="bg-blue-100 rounded-full p-2 mt-1">
                  <User className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-blue-900 mb-1">
                    Email Signature Preview
                  </h4>
                  <div className="text-xs text-blue-800 bg-white border border-blue-200 rounded p-2 font-mono">
                    Best regards,<br/>
                    {aiAgentName || 'Your AI Agent'}<br/>
                    Delight Desk Agent<br/>
                    Your Company Customer Service Team
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Playground */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-purple-600" />
            AI Playground
          </CardTitle>
          <p className="text-sm text-gray-600">
            Test your trained AI by asking product, company, or brand questions and see responses in your chosen voice
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Question Input */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Ask a Customer Question</Label>
              <Textarea
                placeholder="What's your return policy? Tell me about your company. What makes your brand unique? Do you offer free shipping?"
                value={playgroundQuery}
                onChange={(e) => setPlaygroundQuery(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <Button 
                onClick={handlePlaygroundTest}
                disabled={playgroundLoading || !playgroundQuery.trim()}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                {playgroundLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    AI is thinking...
                  </>
                ) : (
                  'Get AI Response'
                )}
              </Button>
            </div>

            {/* AI Response */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">AI Response Preview</Label>
              <div className="min-h-[120px] p-4 border rounded-lg bg-gray-50">
                {playgroundLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                  </div>
                ) : playgroundResponse ? (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{playgroundResponse}</p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">
                    Enter a question above and click "Get AI Response" to see how your trained AI would respond to customers
                  </p>
                )}
              </div>
              {playgroundResponse && (
                <div className="text-xs text-gray-500">
                  Response generated using your current brand voice ({brandVoice}) and trained content
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">How AI Response Suggestions Work</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium text-blue-600">1. Content Training</h4>
              <p className="text-gray-600">
                AI crawls your provided URLs to learn about your products, policies, and brand voice
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-blue-600">2. Smart Analysis</h4>
              <p className="text-gray-600">
                For each escalated email, AI analyzes if it can provide a confident, accurate response
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-blue-600">3. Suggested Responses</h4>
              <p className="text-gray-600">
                Only high-confidence suggestions appear in the escalation queue for agent review
              </p>
            </div>
          </div>
        </CardContent>
        </Card>
        </div>
    </Layout>
  );
}