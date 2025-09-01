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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Sparkles,
  Settings,
  PlayCircle,
  HelpCircle,
  Heart,
  Check,
  FileText
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Layout } from '@/components/layout/layout';
import { useAuth } from '@/hooks/use-auth';
import { TrainingRequirementWarning, TrainingStatusIndicator } from '@/components/training-requirement-warning';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';

interface TrainingUrl {
  id: string;
  url: string;
  status: 'pending' | 'crawling' | 'completed' | 'failed';
  pageCount?: number;
  lastCrawled?: string;
}

interface AITrainingConfig {
  allowEmojis: boolean;
  brandVoice: string;
  customInstructions?: string;
  trainingUrls: TrainingUrl[];
  aiAgentName?: string;
}

interface GeneratedNameSuggestion {
  name: string;
  reasoning: string;
  culturalContext: string;
  appropriateFor: string;
}

const BRAND_VOICE_SUGGESTIONS = [
  'Friendly', 'Professional', 'Sophisticated'
];

const AGENT_TITLE_OPTIONS = [
  'AI Customer Service Agent',
  'AI Support Assistant', 
  'Digital Customer Assistant',
  'AI Help Desk Agent',
  'Smart Support Agent',
  'AI Customer Care Agent',
  'Virtual Support Agent',
  'Automated Customer Assistant',
  'Customer Service Representative',
  'Support Specialist'
];

const ASSISTANT_NAME_SUGGESTIONS = [
  { name: 'Alex', description: '👤 Professional and approachable' },
  { name: 'Sam', description: '💼 Reliable business assistant' },
  { name: 'Kai', description: '🌟 Friendly and energetic helper' },
  { name: 'Aria', description: '🎯 Efficient communicator' },
  { name: 'Maya', description: '🤝 Personable customer advocate' },
  { name: 'Rio', description: '📋 Organized service specialist' },
  { name: 'Zara', description: '💡 Smart solution finder' },
  { name: 'Noor', description: '✨ Bright support professional' },
  { name: 'Kaia', description: '🌍 Global customer specialist' },
  { name: 'Nia', description: '💪 Strong problem solver' },
  { name: 'Sage', description: '🧠 Wise customer advisor' },
  { name: 'Nova', description: '⚡ Dynamic service expert' },
];

// Manual Content Display Component
function ManualContentDisplay() {
  const { user } = useAuth();
  
  // Use the same data source as the main AI training config
  const { data: trainingConfig } = useQuery({
    queryKey: ['/api/ai-training', user?.id],
    enabled: !!user?.id
  });
  
  const manualContent = trainingConfig?.manualContent;

  if (!manualContent || manualContent.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
        <p className="text-sm">No manual knowledge sources added yet</p>
        <p className="text-xs">Add content in the AI Knowledge tab to see it listed here</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {manualContent.map((content: any) => (
        <div key={content.id} className="flex items-center justify-between p-4 border rounded-lg bg-blue-50 border-blue-200">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <MessageSquare className="h-5 w-5 text-blue-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-blue-900 truncate">{content.title}</h3>
              <div className="flex items-center gap-3 mt-1">
                <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                  manual content
                </Badge>
                <span className="text-xs text-blue-700">
                  {content.content?.length || 0} characters
                </span>
                <span className="text-xs text-blue-600">
                  Added {new Date(content.createdAt).toLocaleDateString()}
                </span>
              </div>
              {content.content && content.content.length > 100 && (
                <p className="text-xs text-blue-700 mt-2 line-clamp-2">
                  {content.content.substring(0, 150)}...
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Active
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}



export default function AITrainingNew() {
  // State management
  const [activeTab, setActiveTab] = useState('identity');
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
  const [aiAgentName, setAiAgentName] = useState('');
  const [aiAgentTitle, setAiAgentTitle] = useState('AI Customer Service Agent');
  const [salutation, setSalutation] = useState('Best regards');
  const [customSalutation, setCustomSalutation] = useState('');
  const [signatureCompanyName, setSignatureCompanyName] = useState('');
  const [signatureFooter, setSignatureFooter] = useState("We use AI to solve customer problems faster. Reply 'Human' for immediate escalation.");
  const [businessVertical, setBusinessVertical] = useState('general_ecommerce');
  const [useBusinessVerticalGuidance, setUseBusinessVerticalGuidance] = useState(false);
  const [targetAudience, setTargetAudience] = useState('');
  const [generatedNames, setGeneratedNames] = useState<GeneratedNameSuggestion[]>([]);
  const [isGeneratingNames, setIsGeneratingNames] = useState(false);

  const [contentQuality, setContentQuality] = useState<any>(null);
  const [checkingContent, setCheckingContent] = useState(false);
  const [loyalCustomerGreeting, setLoyalCustomerGreeting] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: trainingConfig, isLoading } = useQuery<AITrainingConfig>({
    queryKey: ['/api/ai-training', user?.id],
    enabled: !!user?.id
  });

  // Fetch existing manual content
  const { data: manualContents = [], isLoading: isLoadingManual } = useQuery({
    queryKey: ['/api/ai-training/manual-content', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      const response = await fetch('/api/ai-training/manual-content');
      if (!response.ok) throw new Error('Failed to fetch manual content');
      return response.json();
    },
    enabled: !!user?.id
  });

  // Mutation hooks
  const saveConfigMutation = useMutation({
    mutationFn: async (config: Partial<AITrainingConfig>) => {
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
    onSuccess: () => {
      setNewUrl('');
      queryClient.invalidateQueries({ queryKey: ['/api/ai-training', user?.id] });
      toast({ title: 'URL added', description: 'Training URL has been added successfully.' });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || 'Failed to add training URL';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    }
  });

  const removeUrlMutation = useMutation({
    mutationFn: async (urlId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      const response = await fetch(`/api/ai-training/urls/${urlId}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to remove URL');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-training', user?.id] });
      toast({ title: "Training source removed", description: "URL and associated data has been deleted" });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || 'Failed to remove training URL';
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
      queryClient.invalidateQueries({ queryKey: ['/api/ai-training/manual-content'] });
      setManualContentTitle('');
      setManualContent('');
      setShowManualInput(false);
      toast({ title: 'Content added', description: 'Manual training content has been added successfully.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to add manual content', variant: 'destructive' });
    }
  });

  // Delete manual content mutation
  const deleteManualContentMutation = useMutation({
    mutationFn: async (contentId: string) => {
      const response = await fetch(`/api/ai-training/manual-content/${contentId}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete manual content');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-training/manual-content'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ai-training', user?.id] });
      toast({ title: 'Content deleted', description: 'Manual training content has been removed.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete manual content', variant: 'destructive' });
    }
  });

  // Load existing configuration
  useEffect(() => {
    if (trainingConfig) {
      setBrandVoice(trainingConfig.brandVoice || 'Professional');
      setAllowEmojis(trainingConfig.allowEmojis || false);
      setCustomInstructions(trainingConfig.customInstructions || '');
      setAiAgentName(trainingConfig.aiAgentName || '');
      setAiAgentTitle((trainingConfig as any).aiAgentTitle || 'AI Customer Service Agent');
      setSalutation((trainingConfig as any).salutation || 'Best regards');
      setCustomSalutation((trainingConfig as any).customSalutation || '');
      setSignatureCompanyName((trainingConfig as any).signatureCompanyName || '');
      setSignatureFooter((trainingConfig as any).signatureFooter || "We use AI to solve customer problems faster. Reply 'Human' for immediate escalation.");
      setBusinessVertical((trainingConfig as any).businessVertical || 'general_ecommerce');
      setUseBusinessVerticalGuidance((trainingConfig as any).useBusinessVerticalGuidance ?? false);
      setLoyalCustomerGreeting((trainingConfig as any).loyalCustomerGreeting || false);
    }
  }, [trainingConfig]);

  // Check content quality when training URLs change
  useEffect(() => {
    if (user?.id && trainingConfig?.trainingUrls) {
      checkContentQuality();
    }
  }, [user?.id, trainingConfig?.trainingUrls]);

  // Content quality check
  const checkContentQuality = async () => {
    if (!user?.id) return;
    
    setCheckingContent(true);
    try {
      const response = await fetch('/api/ai-training/check-content-quality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await response.json();
      setContentQuality(data);
    } catch (error) {
      console.error('Error checking content quality:', error);
    } finally {
      setCheckingContent(false);
    }
  };

  // Event handlers
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


  // Generate names based on target audience
  const handleGenerateNames = async () => {
    if (!targetAudience.trim()) return;
    
    setIsGeneratingNames(true);
    try {
      const response = await fetch('/api/ai-training/generate-audience-names', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          targetAudience: targetAudience.trim(),
          businessVertical,
          brandVoice: brandVoice === 'Custom' ? customVoice : brandVoice
        })
      });
      
      if (!response.ok) throw new Error('Failed to generate names');
      
      const suggestions = await response.json();
      setGeneratedNames(suggestions);
      toast({
        title: "Names Generated",
        description: `Generated ${suggestions.length} names for your target audience.`
      });
    } catch (error) {
      console.error('Error generating names:', error);
      toast({
        title: "Generation Failed", 
        description: "Could not generate names. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingNames(false);
    }
  };

  // Manual save function (with toast notifications)
  const handleManualSave = () => {
    const finalBrandVoice = brandVoice === 'Custom' ? customVoice : brandVoice;
    
    saveConfigMutation.mutate({
      allowEmojis,
      brandVoice: finalBrandVoice,
      customInstructions,
      aiAgentName: aiAgentName || '',
      aiAgentTitle: aiAgentTitle || 'AI Customer Service Agent',
      salutation: salutation === 'Custom' ? (customSalutation || 'Best regards') : (salutation || 'Best regards'),
      customSalutation: customSalutation || '',
      signatureCompanyName: signatureCompanyName || '',
      signatureFooter: signatureFooter || "We use AI to solve customer problems faster. Reply 'Human' for immediate escalation.",
      businessVertical: businessVertical || 'general_ecommerce',
      useBusinessVerticalGuidance,
      loyalCustomerGreeting
    });
  };

  // Auto-save function (no toast notifications)
  const handleAutoSave = () => {
    const finalBrandVoice = brandVoice === 'Custom' ? customVoice : brandVoice;
    
    autoSaveMutation.mutate({
      allowEmojis,
      brandVoice: finalBrandVoice,
      customInstructions,
      aiAgentName: aiAgentName || '',
      aiAgentTitle: aiAgentTitle || 'AI Customer Service Agent',
      salutation: salutation === 'Custom' ? (customSalutation || 'Best regards') : (salutation || 'Best regards'),
      customSalutation: customSalutation || '',
      signatureCompanyName: signatureCompanyName || '',
      signatureFooter: signatureFooter || "We use AI to solve customer problems faster. Reply 'Human' for immediate escalation.",
      businessVertical: businessVertical || 'general_ecommerce',
      useBusinessVerticalGuidance,
      loyalCustomerGreeting
    } as any);
  };

  // Auto-save effects
  useEffect(() => {
    if (trainingConfig && (
      aiAgentName !== (trainingConfig.aiAgentName || '') ||
      aiAgentTitle !== ((trainingConfig as any).aiAgentTitle || 'AI Customer Service Agent') ||
      salutation !== ((trainingConfig as any).salutation || 'Best regards') ||
      customSalutation !== ((trainingConfig as any).customSalutation || '') ||
      signatureCompanyName !== ((trainingConfig as any).signatureCompanyName || '') ||
      signatureFooter !== ((trainingConfig as any).signatureFooter || "We use AI to solve customer problems faster. Reply 'Human' for immediate escalation.") ||
      businessVertical !== ((trainingConfig as any).businessVertical || 'general_ecommerce') ||
      useBusinessVerticalGuidance !== ((trainingConfig as any).useBusinessVerticalGuidance ?? false) ||
      brandVoice !== (trainingConfig.brandVoice || 'Professional') ||
      customVoice !== ((trainingConfig as any).customVoice || '') ||
      allowEmojis !== (trainingConfig.allowEmojis || false) ||
      customInstructions !== (trainingConfig.customInstructions || '')
    )) {
      const timeoutId = setTimeout(() => {
        handleAutoSave();
      }, 1000); // Auto-save after 1 second of inactivity

      return () => clearTimeout(timeoutId);
    }
  }, [aiAgentName, aiAgentTitle, salutation, customSalutation, signatureCompanyName, signatureFooter, businessVertical, useBusinessVerticalGuidance, brandVoice, customVoice, allowEmojis, customInstructions, trainingConfig]);

  // Auto-save for text-only fields (separate to avoid race condition)
  const handleTextAutoSave = () => {
    const finalBrandVoice = brandVoice === 'Custom' ? customVoice : brandVoice;
    
    autoSaveMutation.mutate({
      allowEmojis,
      brandVoice: finalBrandVoice,
      customInstructions,
      // CRITICAL: Include ALL other fields to prevent overwrites
      aiAgentName: aiAgentName || '',
      aiAgentTitle: aiAgentTitle || 'AI Customer Service Agent',
      salutation: salutation || 'Best regards',
      signatureCompanyName: signatureCompanyName || '',
      signatureFooter: signatureFooter || "We use AI to solve customer problems faster. Reply 'Human' for immediate escalation.",
      businessVertical: businessVertical || 'general_ecommerce',
      useBusinessVerticalGuidance,
      loyalCustomerGreeting
    } as any);
  };

  useEffect(() => {
    if (trainingConfig && (
      brandVoice !== (trainingConfig.brandVoice || 'Professional') ||
      allowEmojis !== (trainingConfig.allowEmojis || false) ||
      customInstructions !== (trainingConfig.customInstructions || '')
    )) {
      const timeoutId = setTimeout(() => {
        handleTextAutoSave();
      }, 2000); // Longer delay for text inputs

      return () => clearTimeout(timeoutId);
    }
  }, [brandVoice, allowEmojis, customInstructions, trainingConfig]);

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



  // Helper functions
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
        {/* Page Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Brain className="h-7 w-7 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">AI Team Center</h1>
          </div>
          <p className="text-gray-600 text-lg">
            Build and invest in your AI agent. Like any new hire, you get out what you put in.
          </p>
        </div>

        {/* Main Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:grid-cols-4">
            <TabsTrigger value="identity" className="flex items-center gap-2 px-6">
              <Bot className="h-4 w-4" />
              <span className="hidden sm:inline">AI Identity</span>
              <span className="sm:hidden">Identity</span>
            </TabsTrigger>
            <TabsTrigger value="content" className="flex items-center gap-2 px-6">
              <Globe className="h-4 w-4" />
              <span className="hidden sm:inline">AI Knowledge</span>
              <span className="sm:hidden">Knowledge</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2 px-6">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Voice & Settings</span>
              <span className="sm:hidden">Settings</span>
            </TabsTrigger>
            <TabsTrigger value="playground" className="flex items-center gap-2 px-6">
              <PlayCircle className="h-4 w-4" />
              <span className="hidden sm:inline">AI Performance</span>
              <span className="sm:hidden">Performance</span>
            </TabsTrigger>
          </TabsList>

          {/* AI Knowledge Tab */}
          <TabsContent value="content" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    AI Knowledge Sources
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/ai-training', user?.id] })}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Share your business knowledge with your AI agent (FAQ pages, product pages, support docs, etc.)
                </p>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-xs text-green-800">
                    <strong>Pro Tip:</strong> Add specific policy pages, FAQ sections, and product detail pages. Quality content that directly answers customer questions works better than generic marketing pages.
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
                  >
                    {addUrlMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>


                {/* URL List */}
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {!trainingConfig?.trainingUrls || trainingConfig.trainingUrls.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Globe className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p className="font-medium">No training URLs added yet</p>
                      <p className="text-sm">Add URLs above to train your AI on brand content</p>
                    </div>
                  ) : (
                    trainingConfig.trainingUrls.map((urlItem) => (
                      <div key={urlItem.id} className="flex items-center justify-between p-4 border rounded-lg bg-white">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {getStatusIcon(urlItem.status)}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{urlItem.url}</p>
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
                    ))
                  )}
                </div>

                {/* DISPLAY MANUAL CONTENT FROM API */}
                {trainingConfig?.manualContent?.map((content: any) => (
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
                            {content.content?.length || 0} characters
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
                      onClick={() => deleteManualContentMutation.mutate(content.id)}
                      disabled={deleteManualContentMutation.isPending}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <Separator />

                {/* Manual Content List */}
                {manualContents.length > 0 && (
                  <>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">Manual Content ({manualContents.length})</span>
                      </div>
                      {manualContents.map((content: any) => (
                        <div key={content.id} className="flex items-center justify-between p-4 border rounded-lg bg-white">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="bg-blue-100 rounded-full p-2">
                              <FileText className="h-4 w-4 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{content.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  Manual
                                </Badge>
                                <span className="text-xs text-gray-500">
                                  Added {new Date(content.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteManualContentMutation.mutate(content.id)}
                            disabled={deleteManualContentMutation.isPending}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Separator />
                  </>
                )}

                {/* Manual Content Input */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="bg-blue-100 rounded-full p-2">
                      <AlertCircle className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-blue-900 mb-2">
                        Add Content Manually
                      </h4>
                      <p className="text-xs text-blue-800 mb-3">
                        Fine-tune your AI by adding specific content that addresses customer questions not covered in your FAQs, or add content from websites that can't be scraped.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowManualInput(!showManualInput)}
                        className="bg-white hover:bg-blue-50"
                      >
                        {showManualInput ? 'Hide Manual Input' : 'Add Content Manually'}
                      </Button>
                    </div>
                  </div>
                </div>

                {showManualInput && (
                  <Card className="bg-gray-50">
                    <CardContent className="pt-6 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="manual-title">Content Title</Label>
                        <Input
                          id="manual-title"
                          placeholder="e.g., FAQ - Shipping & Returns"
                          value={manualContentTitle}
                          onChange={(e) => setManualContentTitle(e.target.value)}
                          className="bg-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="manual-content">Content</Label>
                        <Textarea
                          id="manual-content"
                          placeholder="Copy and paste your FAQ content, support documentation, or other content for the AI to learn from."
                          value={manualContent}
                          onChange={(e) => setManualContent(e.target.value)}
                          rows={6}
                          className="bg-white resize-none"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowManualInput(false);
                            setManualContentTitle('');
                            setManualContent('');
                          }}
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Identity Tab */}
          <TabsContent value="identity" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Bot className="h-5 w-5" />
                      AI Agent Name
                    </CardTitle>
                    <p className="text-sm text-gray-600">
                      Give your AI agent a professional identity for customer service interactions. This name will be used for all AI agents regardless of their function.
                    </p>
                  </div>
                  
                  {/* Simple Save Button */}
                  <Button 
                    onClick={handleManualSave}
                    disabled={saveConfigMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {saveConfigMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Two Column Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left Column - Form Fields */}
                  <div className="space-y-6">
                    {/* Custom Name Input */}
                    <div className="space-y-3">
                      <Label htmlFor="agent-name">AI Agent Name</Label>
                      <Input
                        id="agent-name"
                        placeholder="Enter a professional name for your AI agent"
                        value={aiAgentName}
                        onChange={(e) => setAiAgentName(e.target.value)}
                      />
                    </div>

                    {/* Business Vertical */}
                    <div className="space-y-3">
                      <Label htmlFor="business-vertical">Business Type</Label>
                      <Select value={businessVertical} onValueChange={setBusinessVertical}>
                        <SelectTrigger data-testid="select-business-vertical">
                          <SelectValue placeholder="Select your business type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general_ecommerce">General E-commerce</SelectItem>
                          <SelectItem value="fashion_apparel">Fashion & Apparel</SelectItem>
                          <SelectItem value="electronics_tech">Electronics & Technology</SelectItem>
                          <SelectItem value="food_beverage">Food & Beverage</SelectItem>
                          <SelectItem value="beauty_personal_care">Beauty & Personal Care</SelectItem>
                          <SelectItem value="home_garden">Home & Garden</SelectItem>
                          <SelectItem value="sports_outdoors">Sports & Outdoors</SelectItem>
                          <SelectItem value="automotive">Automotive & Parts</SelectItem>
                          <SelectItem value="health_wellness">Health & Wellness</SelectItem>
                          <SelectItem value="jewelry_accessories">Jewelry & Accessories</SelectItem>
                          <SelectItem value="books_media">Books & Media</SelectItem>
                          <SelectItem value="pet_supplies">Pet Supplies</SelectItem>
                          <SelectItem value="toys_games">Toys & Games</SelectItem>
                          <SelectItem value="crafts_hobbies">Arts, Crafts & Hobbies</SelectItem>
                          <SelectItem value="baby_kids">Baby & Kids</SelectItem>
                          <SelectItem value="office_supplies">Office & Business Supplies</SelectItem>
                          <SelectItem value="furniture">Furniture & Decor</SelectItem>
                          <SelectItem value="tools_hardware">Tools & Hardware</SelectItem>
                          <SelectItem value="musical_instruments">Musical Instruments</SelectItem>
                          <SelectItem value="collectibles">Collectibles & Antiques</SelectItem>
                          <SelectItem value="subscription_boxes">Subscription Boxes</SelectItem>
                          <SelectItem value="digital_products">Digital Products & Services</SelectItem>
                          <SelectItem value="b2b_wholesale">B2B & Wholesale</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500">
                        Choose your business type to help the AI provide industry-appropriate responses
                      </p>
                    </div>


                    {/* Agent Title */}
                    <div className="space-y-3">
                      <Label htmlFor="agent-title">AI Agent Title</Label>
                      <Select value={aiAgentTitle} onValueChange={setAiAgentTitle}>
                        <SelectTrigger data-testid="select-agent-title">
                          <SelectValue placeholder="Choose agent title" />
                        </SelectTrigger>
                        <SelectContent>
                          {AGENT_TITLE_OPTIONS.map((title) => (
                            <SelectItem key={title} value={title}>{title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500">
                        This title appears in your AI agent's email signature to establish professional identity.
                      </p>
                    </div>

                    {/* Email Salutation */}
                    <div className="space-y-3">
                      <Label htmlFor="salutation">Email Salutation</Label>
                      <Select value={salutation} onValueChange={setSalutation}>
                        <SelectTrigger data-testid="select-salutation">
                          <SelectValue placeholder="Choose salutation" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Best regards">Best regards</SelectItem>
                          <SelectItem value="Thank you">Thank you</SelectItem>
                          <SelectItem value="Sincerely">Sincerely</SelectItem>
                          <SelectItem value="Warm regards">Warm regards</SelectItem>
                          <SelectItem value="Here if you need anything">Here if you need anything</SelectItem>
                          <SelectItem value="Cheers">Cheers</SelectItem>
                          <SelectItem value="At your service">At your service</SelectItem>
                          <SelectItem value="With love (and lots of code),">With love (and lots of code),</SelectItem>
                          <SelectItem value="Beep bop, here to help,">Beep bop, here to help,</SelectItem>
                          <SelectItem value="Digitally yours,">Digitally yours,</SelectItem>
                          <SelectItem value="Sincerely, your friendly robot 🤖">Sincerely, your friendly robot 🤖</SelectItem>
                          <SelectItem value="Custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      {salutation === 'Custom' && (
                        <div className="mt-3">
                          <Input
                            placeholder="Enter custom email closing (e.g., 'Your friendly AI assistant,')"
                            value={customSalutation}
                            onChange={(e) => setCustomSalutation(e.target.value)}
                          />
                        </div>
                      )}
                      
                      <p className="text-xs text-gray-500">
                        Choose from research-backed professional closings or create your own custom ending.
                      </p>
                    </div>

                    {/* Signature Company Name */}
                    <div className="space-y-3">
                      <Label htmlFor="signature-company">Company Name for Email Signature</Label>
                      <Input
                        id="signature-company"
                        placeholder="Enter company name for AI email signatures"
                        value={signatureCompanyName}
                        onChange={(e) => setSignatureCompanyName(e.target.value)}
                      />
                      <p className="text-xs text-gray-500">
                        This company name will appear in your AI agent's email signature. Leave blank to use your account's default company name.
                      </p>
                    </div>

                    {/* Signature Footer */}
                    <div className="space-y-3">
                      <Label htmlFor="signature-footer">Signature Footer</Label>
                      <Input
                        id="signature-footer"
                        value={signatureFooter}
                        onChange={(e) => setSignatureFooter(e.target.value)}
                      />
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <p className="text-xs text-green-800">
                          <strong>Recommended:</strong> "We use AI to solve customer problems faster. Reply 'Human' for immediate escalation." — This promotes transparency while providing a clear escalation path for customers who prefer human support.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Name Generator */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Name Generator
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium">Target Audience</Label>
                        <p className="text-xs text-gray-600 mb-3">Describe your typical customers to generate appropriate names</p>
                        <Input
                          placeholder="e.g., busy professionals, seniors, young families, tech enthusiasts"
                          value={targetAudience}
                          onChange={(e) => setTargetAudience(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleGenerateNames();
                            }
                          }}
                        />
                      </div>
                      
                      <Button 
                        onClick={handleGenerateNames}
                        disabled={!targetAudience.trim() || isGeneratingNames}
                        className="w-full"
                        size="sm"
                      >
                        {isGeneratingNames ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Generating Names...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Generate Names for This Audience
                          </>
                        )}
                      </Button>

                      {generatedNames.length > 0 && (
                        <div>
                          <Label className="text-sm font-medium text-green-700 mb-2 block">Names for Your Audience</Label>
                          <div className="grid grid-cols-2 gap-2">
                            {generatedNames.map((suggestion) => (
                              <div
                                key={suggestion.name}
                                onClick={() => setAiAgentName(suggestion.name)}
                                className={`p-3 border rounded-lg cursor-pointer transition-colors hover:bg-blue-50 ${
                                  aiAgentName === suggestion.name 
                                    ? 'border-blue-500 bg-blue-50' 
                                    : 'border-gray-200 hover:border-blue-300'
                                }`}
                              >
                                <div className="font-medium text-sm">{suggestion.name}</div>
                                <div className="text-xs text-gray-600">{suggestion.reasoning}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Signature Preview */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="bg-blue-100 rounded-full p-2">
                      <User className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-blue-900 mb-2">
                        Email Signature Preview
                      </h4>
                      <div className="text-xs text-blue-800 bg-white border border-blue-200 rounded p-3 font-mono">
                        {salutation === 'Custom' ? (customSalutation || 'Best regards') : salutation},<br/>
                        {aiAgentName || 'Your AI Agent'}<br/>
                        {aiAgentTitle}<br/>
                        {signatureCompanyName || 'Your Company'}
                        {signatureFooter && (
                          <>
                            <br/><br/>
                            <span className="text-gray-600 italic">{signatureFooter}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

          </TabsContent>


          {/* Voice & Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Brand Voice & Response Settings
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Configure how your AI should write responses to match your brand's communication style
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Simple Save Button */}
                <div className="flex justify-end mb-4">
                  <Button 
                    onClick={handleManualSave}
                    disabled={saveConfigMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {saveConfigMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>

                {/* Brand Voice Selection */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Brand Voice</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={brandVoice === 'Friendly' ? "default" : "outline"}
                      size="sm"
                      onClick={() => setBrandVoice('Friendly')}
                      className="text-xs"
                    >
                      Friendly
                    </Button>
                    <Button
                      variant={brandVoice === 'Professional' ? "default" : "outline"}
                      size="sm"
                      onClick={() => setBrandVoice('Professional')}
                      className="text-xs"
                    >
                      Professional
                    </Button>
                    <Button
                      variant={brandVoice === 'Sophisticated' ? "default" : "outline"}
                      size="sm"
                      onClick={() => setBrandVoice('Sophisticated')}
                      className="text-xs"
                    >
                      Sophisticated
                    </Button>
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
                    <div className="mt-3">
                      <Input
                        placeholder="Describe your custom brand voice (e.g. Warm and conversational like a trusted family doctor, always explaining things clearly without medical jargon)"
                        value={customVoice}
                        onChange={(e) => setCustomVoice(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                {/* Business Vertical Guidance Toggle */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">Industry-Specific Guidance</Label>
                      <p className="text-xs text-gray-500">
                        Include industry-specific guidance like health disclaimers, safety warnings, and compliance notes
                      </p>
                    </div>
                    <Switch
                      id="business-guidance-toggle"
                      checked={useBusinessVerticalGuidance}
                      onCheckedChange={setUseBusinessVerticalGuidance}
                      data-testid="toggle-business-guidance"
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Test responses with and without this setting to find what works best for your business
                  </p>
                </div>

                {/* Loyal Customer Greeting */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Heart className="h-4 w-4 text-blue-500" />
                        Thank Loyal Customers
                      </Label>
                      <p className="text-xs text-gray-500">
                        Automatically thank repeat customers for their loyalty in the first reply of email threads
                      </p>
                    </div>
                    <Switch
                      checked={loyalCustomerGreeting}
                      onCheckedChange={setLoyalCustomerGreeting}
                    />
                  </div>
                </div>

                {/* Emoji Settings */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">Allow Emojis in Responses</Label>
                      <p className="text-xs text-gray-500">Let the AI use emojis to make responses more friendly</p>
                    </div>
                    <Switch
                      checked={allowEmojis}
                      onCheckedChange={setAllowEmojis}
                    />
                  </div>
                </div>

                {/* Custom Instructions */}
                <div className="space-y-3">
                  <Label htmlFor="custom-instructions" className="text-sm font-medium">
                    Custom Instructions (Optional)
                  </Label>
                  <Textarea
                    id="custom-instructions"
                    placeholder="Add any specific guidelines for how the AI should respond (e.g., 'Always mention our 30-day return policy', 'Be extra friendly with VIP customers', etc.)"
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                  <p className="text-xs text-gray-500">
                    These instructions will be applied to all AI-generated responses
                  </p>
                </div>

              </CardContent>
            </Card>

          </TabsContent>

          {/* Test Playground Tab */}
          <TabsContent value="playground" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PlayCircle className="h-5 w-5 text-purple-600" />
                  AI Response Playground
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Test your trained AI by asking questions and see how it responds using your brand voice and training content
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Question Input */}
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Ask a Customer Question</Label>
                      <Textarea
                        placeholder="What's your return policy? Tell me about your company. What makes your brand unique? Do you offer free shipping?"
                        value={playgroundQuery}
                        onChange={(e) => setPlaygroundQuery(e.target.value)}
                        rows={6}
                        className="resize-none"
                      />
                    </div>
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
                        <>
                          <PlayCircle className="h-4 w-4 mr-2" />
                          Get AI Response
                        </>
                      )}
                    </Button>
                  </div>

                  {/* AI Response */}
                  <div className="space-y-4">
                    <Label className="text-sm font-medium">AI Response Preview</Label>
                    <div className="min-h-[200px] p-4 border rounded-lg bg-gray-50">
                      {playgroundLoading ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto mb-2" />
                            <p className="text-sm text-gray-600">Generating response...</p>
                          </div>
                        </div>
                      ) : playgroundResponse ? (
                        <div className="space-y-3">
                          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                            {playgroundResponse}
                          </p>
                          <div className="pt-3 border-t border-gray-200">
                            <p className="text-xs text-gray-500">
                              Response generated using <strong>{brandVoice}</strong> voice
                              {allowEmojis && ' with emojis enabled'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full text-center">
                          <div>
                            <MessageSquare className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">
                              Enter a question and click "Get AI Response" to test your trained AI
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Performance Tips */}
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-700">
                  <HelpCircle className="h-5 w-5" />
                  Performance Tips
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="bg-white p-4 rounded-lg border border-blue-200">
                    <h4 className="font-medium text-blue-700 mb-2">💡 Test Common Questions</h4>
                    <p className="text-gray-700">
                      Ask about your return policy, shipping, pricing, and product details to see if your AI has learned these key topics.
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border border-blue-200">
                    <h4 className="font-medium text-blue-700 mb-2">🎯 Improve Responses</h4>
                    <p className="text-gray-700">
                      If responses seem generic, add more specific content about your products and policies to the AI Knowledge tab.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}