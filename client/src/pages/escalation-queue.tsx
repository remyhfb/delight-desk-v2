import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { 
  AlertTriangle, 
  Clock, 
  Search, 
  Filter,
  Mail,
  User,
  Calendar,
  ArrowUp,
  ArrowDown,
  CheckCircle,
  XCircle,
  ExternalLink,
  Bot,
  AlertCircle,
  Copy,
  Edit,
  Send,
  X,
  Sparkles,
  Loader2,
  Zap,
  Package,
  CreditCard,
  History
} from 'lucide-react';
import { format } from 'date-fns';
import { Layout } from '@/components/layout/layout';
import { EmailSignatureBuilder } from '@/components/EmailSignatureBuilder';

interface EscalatedEmail {
  id: string;
  emailId: string;
  userId: string;
  subject: string;
  customerEmail: string;
  body: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'resolved' | 'closed';
  classification: string;
  reason: string;
  assignedTo?: string;
  notes?: string;
  aiSuggestedResponse?: string;
  aiConfidence?: number;
  createdAt: string;
  resolvedAt?: string;
}

export default function AIAssistant() {
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  // Simplified state - removed AI generation and low confidence suggestion complexity

  const [refundAmounts, setRefundAmounts] = useState<Record<string, string>>({});
  const [showOrderHistory, setShowOrderHistory] = useState<string | null>(null);
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [writingCustomResponse, setWritingCustomResponse] = useState<Set<string>>(new Set());
  const [customResponses, setCustomResponses] = useState<Record<string, string>>({});
  const [showLowConfidenceSuggestions, setShowLowConfidenceSuggestions] = useState<Set<string>>(new Set());
  const [editingResponse, setEditingResponse] = useState<Set<string>>(new Set());
  const [editedResponses, setEditedResponses] = useState<Record<string, string>>({});
  const [includeSignature, setIncludeSignature] = useState<Record<string, boolean>>({});

  // Email signature state  
  const [instructingAI, setInstructingAI] = useState<Set<string>>(new Set());
  const [aiInstructions, setAiInstructions] = useState<Record<string, string>>({});
  const [generatedFromInstructions, setGeneratedFromInstructions] = useState<Record<string, string>>({});

  // AI Response Feedback state
  const [showRejectionModal, setShowRejectionModal] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [customRejectionReason, setCustomRejectionReason] = useState<string>('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Get authenticated user  
  const { data: authUser } = useQuery<{ id: string; email: string; username: string } | null>({ 
    queryKey: ['/api/auth/me'] 
  });

  const { data: escalatedEmails = [], isLoading } = useQuery<EscalatedEmail[]>({
    queryKey: ['/api/escalation-queue', user?.id],
    enabled: !!user?.id,
  });

  // Check AI training completion status
  const { data: aiTrainingStatus } = useQuery<{
    isTrainingComplete: boolean;
    hasTrainingUrls: boolean;
    hasCompletedUrls: boolean;
    completedUrlCount: number;
    urlCount: number;
    contentCount: number;
    brandVoice: string;
  }>({
    queryKey: ['/api/ai-training/status', user?.id],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    enabled: !!user?.id,
  });

  // Email signature query and mutation
  const { data: signatureData } = useQuery<{
    name: string;
    title: string;
    company: string;
    companyUrl: string;
    phone: string;
    email: string;
    photoUrl?: string;
  }>({
    queryKey: ['/api/users', user?.id, 'email-signature'],
    enabled: !!user?.id,
  });

  const updateSignatureMutation = useMutation({
    mutationFn: async (signaturePayload: any) => {
      const response = await fetch(`/api/users/${user?.id}/email-signature`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signaturePayload)
      });
      if (!response.ok) throw new Error('Failed to update signature');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users', user?.id, 'email-signature'] });
      toast({ title: 'Success', description: 'Email signature updated successfully' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update email signature', variant: 'destructive' });
    }
  });

  const handleSaveSignature = (signatureData: any) => {
    updateSignatureMutation.mutate(signatureData);
  };

  // Generate clean, professional HTML signature preview
  const generateSignaturePreview = (data: any): string => {
    const {
      name = '',
      title = '',
      company = '',
      companyUrl = '',
      phone = '',
      email = '',
      photoUrl = ''
    } = data;

    if (!name && !title && !company && !phone && !email) {
      return '<p style="color: #666; font-family: Arial, sans-serif; font-size: 14px; margin: 20px 0;">No signature configured</p>';
    }

    // Use clean signature format
    return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif; font-size: 14px; line-height: 1.5; color: #333333; max-width: 400px;">
  <div style="display: flex; align-items: flex-start; gap: 12px;">
    ${photoUrl ? `<img src="${photoUrl}" alt="${name || 'Profile'}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; border: 2px solid #f0f0f0;" />` : ''}
    <div>
      ${name ? `<div style="font-size: 16px; font-weight: 600; color: #1a1a1a; margin-bottom: 2px;">${name}</div>` : ''}
      ${title ? `<div style="font-size: 14px; color: #666666; margin-bottom: 4px;">${title}</div>` : ''}
      ${company ? `<div style="font-size: 14px; font-weight: 500; color: #1a1a1a; margin-bottom: 6px;">${companyUrl ? `<a href="${companyUrl}" style="color: #1a1a1a; text-decoration: none;">${company}</a>` : company}</div>` : ''}
      <div style="font-size: 14px; line-height: 1.4;">
        ${email ? `<div><a href="mailto:${email}" style="color: #0066cc; text-decoration: none;">${email}</a></div>` : ''}
        ${phone ? `<div><a href="tel:${phone.replace(/\s/g, '')}" style="color: #666666; text-decoration: none;">${phone}</a></div>` : ''}
      </div>
    </div>
  </div>
</div>`.trim();
  };



  // Approve and send AI response
  const approveResponseMutation = useMutation({
    mutationFn: async ({ emailId, response, includeSignature }: { emailId: string; response: string; includeSignature?: boolean }) => {
      const email = escalatedEmails.find(e => e.id === emailId);
      if (!email) throw new Error('Email not found');

      const sendResponse = await fetch('/api/escalation-queue/send-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          customerEmail: email.customerEmail,
          subject: `Re: ${email.subject}`,
          message: response,
          escalationId: emailId,
          includeSignature: includeSignature !== false // Default to true unless explicitly false
        })
      });

      if (!sendResponse.ok) throw new Error('Failed to send response');
      return sendResponse.json();
    },
    onSuccess: (data, variables) => {
      const { emailId, response: finalResponse } = variables;

      // Track edit if user modified an AI response
      const emailDetails = escalatedEmails.find(e => e.id === emailId);
      if (emailDetails && emailDetails.aiSuggestedResponse && editingResponse.has(emailId)) {
        const originalResponse = emailDetails.aiSuggestedResponse;
        if (originalResponse !== finalResponse) {
          // Track edit feedback
          fetch('/api/ai-training/edit-feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: 'user1', // TODO: Replace with actual user ID
              emailId: emailId,
              originalResponse: originalResponse,
              editedResponse: finalResponse,
              aiConfidence: emailDetails.aiConfidence || 0,
              emailClassification: emailDetails.classification || null,
              customerEmail: emailDetails.customerEmail || null,
              originalEmailSubject: emailDetails.subject || null
            })
          }).catch(error => {
            console.warn('Failed to track edit feedback:', error);
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['/api/escalation-queue', 'user1'] });
      toast({ title: 'Response sent', description: 'Your response has been sent to the customer.' });
      setSelectedEmail(null);
      setEditingResponse(new Set());
      setEditedResponses({});
      setCustomResponses({});
      setIncludeSignature({});
    },
    onError: (error) => {
      toast({ title: 'Error', description: 'Failed to send response', variant: 'destructive' });
    }
  });

  // Reject AI suggestion
  const rejectResponseMutation = useMutation({
    mutationFn: async (emailId: string) => {
      const response = await fetch(`/api/escalation-queue/${emailId}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress' })
      });
      if (!response.ok) throw new Error('Failed to reject suggestion');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/escalation-queue', 'user1'] });
      toast({ title: 'Suggestion rejected', description: 'AI suggestion has been rejected. You can now handle this manually.' });
    }
  });

  // AI Response Feedback Mutation
  const submitFeedbackMutation = useMutation({
    mutationFn: async (data: {
      emailId: string;
      rejectionReason: string;
      customReason?: string;
      aiResponse: string;
      aiConfidence: number;
    }) => {
      const response = await fetch('/api/ai-training/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'user1',
          emailId: data.emailId,
          rejectionReason: data.rejectionReason,
          customReason: data.customReason,
          aiResponse: data.aiResponse,
          aiConfidence: data.aiConfidence
        })
      });
      if (!response.ok) throw new Error('Failed to submit feedback');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Feedback Submitted",
        description: "Thank you! Your feedback helps our AI learn and improve future responses.",
        duration: 4000,
      });
      setShowRejectionModal(null);
      setRejectionReason('');
      setCustomRejectionReason('');
      setIsSubmittingFeedback(false);
      // Hide the AI suggestion after rejection
      const emailId = showRejectionModal;
      if (emailId) {
        setShowLowConfidenceSuggestions(prev => {
          const updated = new Set(prev);
          updated.delete(emailId);
          return updated;
        });
      }
    },
    onError: () => {
      toast({
        title: "Submission Failed",
        description: "Failed to submit feedback. Your input is valuable - please try again.",
        variant: "destructive",
      });
      setIsSubmittingFeedback(false);
    }
  });

  // Generate AI response from instructions
  const generateFromInstructionsMutation = useMutation({
    mutationFn: async ({ emailId, instructions }: { emailId: string; instructions: string }) => {
      const email = escalatedEmails.find(e => e.id === emailId);
      if (!email) throw new Error('Email not found');

      // Prepare full email context including conversation thread
      let fullEmailContext = email.body;

      // If this is part of a conversation thread, include previous context
      if (email.subject.toLowerCase().includes('re:') || email.subject.toLowerCase().includes('fwd:')) {
        fullEmailContext = `[ONGOING CONVERSATION]
Original Email Subject: ${email.subject}
Latest Customer Message: ${email.body}

Note: This appears to be part of an ongoing conversation. Please consider the context when responding.`;
      }

      const response = await fetch('/api/ai/generate-from-instructions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailContent: fullEmailContext,
          customerEmail: email.customerEmail,
          subject: email.subject,
          instructions: instructions,
          escalationReason: email.reason || email.classification, // Include escalation context
          priority: email.priority
        })
      });

      if (!response.ok) throw new Error('Failed to generate response');
      const data = await response.json();
      return data.response;
    },
    onSuccess: (generatedResponse, { emailId }) => {
      setGeneratedFromInstructions(prev => ({
        ...prev,
        [emailId]: generatedResponse
      }));
      setInstructingAI(prev => {
        const updated = new Set(prev);
        updated.delete(emailId);
        return updated;
      });
      toast({ title: 'Response generated', description: 'AI has generated a response based on your instructions.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to generate AI response', variant: 'destructive' });
    }
  });



  // Mark ticket as in progress
  const markInProgressMutation = useMutation({
    mutationFn: async ({ emailId }: { emailId: string }) => {
      const response = await fetch(`/api/escalation-queue/${emailId}/in-progress`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress' })
      });
      if (!response.ok) throw new Error('Failed to mark as in progress');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/escalation-queue', 'user1'] });
      toast({ title: 'Ticket in progress', description: 'Ticket has been marked as in progress.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to mark as in progress', variant: 'destructive' });
    }
  });

  // Mark ticket as resolved
  const markResolvedMutation = useMutation({
    mutationFn: async ({ emailId }: { emailId: string }) => {
      const response = await fetch(`/api/escalation-queue/${emailId}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' })
      });
      if (!response.ok) throw new Error('Failed to mark as resolved');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/escalation-queue', 'user1'] });
      toast({ title: 'Ticket resolved', description: 'Ticket has been marked as resolved.' });
      setSelectedEmail(null);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to mark as resolved', variant: 'destructive' });
    }
  });

  // Mark ticket as unresolved (back to pending)
  const markUnresolvedMutation = useMutation({
    mutationFn: async ({ emailId }: { emailId: string }) => {
      const response = await fetch(`/api/escalation-queue/${emailId}/unresolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pending' })
      });
      if (!response.ok) throw new Error('Failed to mark as unresolved');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/escalation-queue', 'user1'] });
      toast({ title: 'Ticket reopened', description: 'Ticket has been marked as unresolved and moved back to pending.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to mark as unresolved', variant: 'destructive' });
    }
  });

  // Bulk mark as resolved
  const bulkMarkResolvedMutation = useMutation({
    mutationFn: async ({ emailIds }: { emailIds: string[] }) => {
      const promises = emailIds.map(emailId =>
        fetch(`/api/escalation-queue/${emailId}/resolve`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'resolved' })
        })
      );
      const responses = await Promise.all(promises);
      const failedRequests = responses.filter(r => !r.ok);
      if (failedRequests.length > 0) throw new Error(`Failed to resolve ${failedRequests.length} items`);
      return { success: true, count: emailIds.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/escalation-queue', 'user1'] });
      setSelectedEmails(new Set());
      toast({ title: 'Success', description: `Marked ${data.count} items as resolved.` });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Bulk mark as in progress
  const bulkMarkInProgressMutation = useMutation({
    mutationFn: async ({ emailIds }: { emailIds: string[] }) => {
      const promises = emailIds.map(emailId =>
        fetch(`/api/escalation-queue/${emailId}/in-progress`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'in_progress' })
        })
      );
      const responses = await Promise.all(promises);
      const failedRequests = responses.filter(r => !r.ok);
      if (failedRequests.length > 0) throw new Error(`Failed to update ${failedRequests.length} items`);
      return { success: true, count: emailIds.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/escalation-queue', 'user1'] });
      setSelectedEmails(new Set());
      toast({ title: 'Success', description: `Marked ${data.count} items as in progress.` });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Send Order Status for specific customer using Gmail sender service
  const sendOrderStatusMutation = useMutation({
    mutationFn: async ({ customerEmail }: { customerEmail: string }) => {
      const response = await fetch('/api/quick-actions/send-order-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchTerm: customerEmail, userId: user?.id })
      });
      if (!response.ok) throw new Error('Failed to send order status update');
      return response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: 'Order status email sent successfully',
        description: `Sent to ${data.customerEmail} for order #${data.orderNumber}` 
      });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Quick Refund mutation for individual cards
  const quickRefundMutation = useMutation({
    mutationFn: async ({ customerEmail, amount }: { customerEmail: string; amount: number }) => {
      const response = await fetch('/api/quick-actions/refund-by-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerEmail, amount, userId: 'user1' })
      });
      if (!response.ok) throw new Error('Failed to process refund');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Refund processed successfully.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Handler functions for card-level quick actions
  const handleSendOrderStatus = async (customerEmail: string) => {
    sendOrderStatusMutation.mutate({ customerEmail });
  };

  const handleQuickRefund = async (customerEmail: string, amount: number) => {
    quickRefundMutation.mutate({ customerEmail, amount });
  };

  // View Order History mutation
  const viewOrderHistoryMutation = useMutation({
    mutationFn: async ({ customerEmail }: { customerEmail: string }) => {
      const response = await fetch('/api/quick-actions/lookup-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerEmail, userId: 'user1' })
      });
      if (!response.ok) throw new Error('Failed to fetch order history');
      return response.json();
    },
    onSuccess: (data, variables) => {
      setOrderHistory(data.orders || []);
      setShowOrderHistory(variables.customerEmail);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const handleViewOrderHistory = async (customerEmail: string) => {
    viewOrderHistoryMutation.mutate({ customerEmail });
  };

  const toggleCustomResponse = (emailId: string) => {
    setWritingCustomResponse(prev => {
      const updated = new Set(prev);
      if (updated.has(emailId)) {
        updated.delete(emailId);
        // Clear custom response when canceling
        setCustomResponses(prev => {
          const newResponses = { ...prev };
          delete newResponses[emailId];
          return newResponses;
        });
      } else {
        updated.add(emailId);
      }
      return updated;
    });
  };

  const updateCustomResponse = (emailId: string, response: string) => {
    setCustomResponses(prev => ({
      ...prev,
      [emailId]: response
    }));
  };

  const toggleAIInstruction = (emailId: string) => {
    setInstructingAI(prev => {
      const newSet = new Set(prev);
      if (newSet.has(emailId)) {
        newSet.delete(emailId);
      } else {
        newSet.add(emailId);
      }
      return newSet;
    });
  };

  const updateAIInstruction = (emailId: string, instruction: string) => {
    setAiInstructions(prev => ({
      ...prev,
      [emailId]: instruction
    }));
  };



  const selectedEmailDetails = selectedEmail 
    ? escalatedEmails.find(email => email.id === selectedEmail)
    : null;

  const toggleLowConfidenceSuggestion = (emailId: string) => {
    setShowLowConfidenceSuggestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(emailId)) {
        newSet.delete(emailId);
      } else {
        newSet.add(emailId);
      }
      return newSet;
    });
  };

  const toggleEditResponse = (emailId: string) => {
    setEditingResponse(prev => {
      const newSet = new Set(prev);
      if (newSet.has(emailId)) {
        newSet.delete(emailId);
        // Remove from edited responses when canceling edit
        setEditedResponses(prevEdited => {
          const newEdited = { ...prevEdited };
          delete newEdited[emailId];
          return newEdited;
        });
      } else {
        newSet.add(emailId);
        // Initialize with current AI response
        const email = escalatedEmails.find(e => e.id === emailId);
        if (email?.aiSuggestedResponse) {
          setEditedResponses(prev => ({
            ...prev,
            [emailId]: email.aiSuggestedResponse!
          }));
        }
      }
      return newSet;
    });
  };

  const updateEditedResponse = (emailId: string, response: string) => {
    setEditedResponses(prev => ({
      ...prev,
      [emailId]: response
    }));
  };

  const startEditingResponse = (emailId: string, currentResponse: string) => {
    setEditingResponse(prev => new Set(prev).add(emailId));
    setEditedResponses(prev => ({ ...prev, [emailId]: currentResponse }));
  };

  const cancelEditingResponse = (emailId: string) => {
    setEditingResponse(prev => {
      const newSet = new Set(prev);
      newSet.delete(emailId);
      return newSet;
    });
    setEditedResponses(prev => {
      const { [emailId]: removed, ...rest } = prev;
      return rest;
    });
  };

  // Helper function to get signature inclusion state (defaults to true)
  const getShouldIncludeSignature = (emailId: string): boolean => {
    return includeSignature[emailId] !== false; // Default to true unless explicitly set to false
  };

  const handleApproveResponse = (emailId: string, response: string, isEdited = false) => {
    const shouldInclude = getShouldIncludeSignature(emailId);
    approveResponseMutation.mutate({ emailId, response, includeSignature: shouldInclude });
    if (isEdited) {
      cancelEditingResponse(emailId);
    }
  };

  const handleRejectSuggestion = (emailId: string) => {
    rejectResponseMutation.mutate(emailId);
  };

  // Removed bulk AI generation - focusing on individual custom responses

  const handleViewCustomerAccount = async (customerEmail: string) => {
    try {
      // Fetch user's connected store information
      const response = await fetch('/api/store-connections/user1');
      const storeConnections = await response.json();

      if (storeConnections.length === 0) {
        alert('No store connections found. Please connect a WooCommerce or Shopify store first.');
        return;
      }

      // Use the first connected store (in production, could let user choose if multiple)
      const store = storeConnections[0];
      let customerUrl = '';

      if (store.platform === 'woocommerce') {
        // WooCommerce admin URL format
        customerUrl = `${store.storeUrl}/wp-admin/users.php?s=${encodeURIComponent(customerEmail)}`;
      } else if (store.platform === 'shopify') {
        // Shopify admin URL format  
        customerUrl = `https://${store.storeUrl}/admin/customers?query=${encodeURIComponent(customerEmail)}`;
      } else {
        alert('Unsupported platform. Only WooCommerce and Shopify are supported.');
        return;
      }

      // Open in new tab
      window.open(customerUrl, '_blank');
    } catch (error) {
      console.error('Failed to get store connections:', error);
      // Fallback - show demo URLs
      const demos = [
        `WooCommerce: example-store.com/wp-admin/users.php?s=${customerEmail}`,
        `Shopify: example-store.myshopify.com/admin/customers?query=${customerEmail}`
      ];
      alert(`Demo URLs for ${customerEmail}:\n\n${demos.join('\n\n')}`);
    }
  };

  const filteredEmails = escalatedEmails.filter(email => {
    const matchesSearch = 
      email.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.customerEmail.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesPriority = priorityFilter === 'all' || email.priority === priorityFilter;
    const matchesStatus = statusFilter === 'all' || email.status === statusFilter;

    return matchesSearch && matchesPriority && matchesStatus;
  });

  // Bulk selection handlers
  const toggleEmailSelection = (emailId: string) => {
    setSelectedEmails(prev => {
      const newSet = new Set(prev);
      if (newSet.has(emailId)) {
        newSet.delete(emailId);
      } else {
        newSet.add(emailId);
      }
      return newSet;
    });
  };

  const selectAllEmails = () => {
    const allIds = filteredEmails.map(email => email.id);
    setSelectedEmails(new Set(allIds));
  };

  const clearSelection = () => {
    setSelectedEmails(new Set());
  };

  const handleBulkMarkResolved = () => {
    if (selectedEmails.size === 0) return;
    bulkMarkResolvedMutation.mutate({ emailIds: Array.from(selectedEmails) });
  };

  const handleBulkMarkInProgress = () => {
    if (selectedEmails.size === 0) return;
    bulkMarkInProgressMutation.mutate({ emailIds: Array.from(selectedEmails) });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-orange-600 bg-orange-50';
      case 'in_progress': return 'text-blue-600 bg-blue-50';
      case 'resolved': return 'text-green-600 bg-green-50';
      case 'closed': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent':
      case 'high':
        return <ArrowUp className="h-3 w-3" />;
      case 'low':
        return <ArrowDown className="h-3 w-3" />;
      default:
        return <AlertTriangle className="h-3 w-3" />;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      if (!dateString) return 'N/A';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return format(date, 'MMM d, yyyy h:mm a');
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const getTimeAgo = (dateString: string) => {
    try {
      if (!dateString) return 'Unknown';
      const now = new Date();
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';

      const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

      if (diffInHours < 1) return 'Less than 1 hour ago';
      if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    } catch (error) {
      return 'Unknown';
    }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header with Stats */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Assistant</h1>
            <p className="text-gray-600 mt-1">Resolve complex cases with AI-powered assistance</p>
          </div>

          <div className="flex gap-4">
            <Card className="flex-shrink-0">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Clock className="h-4 w-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Pending</p>
                    <p className="text-xl font-bold text-gray-900">
                      {escalatedEmails.filter(e => e.status === 'pending').length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="flex-shrink-0">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <ArrowUp className="h-4 w-4 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">High Priority</p>
                    <p className="text-xl font-bold text-gray-900">
                      {escalatedEmails.filter(e => e.priority === 'high' || e.priority === 'urgent').length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* AI Training Notification */}
        {aiTrainingStatus && !aiTrainingStatus.isTrainingComplete && (
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Bot className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-purple-900">Maximize AI Intelligence</h3>
                <p className="text-sm text-purple-700 mt-1">
                  Complete AI training to get better response suggestions and more accurate instructions-based generation. 
                  {!aiTrainingStatus.hasTrainingUrls ? ' Add training URLs from your website to get started.' :
                   !aiTrainingStatus.hasCompletedUrls ? ' Your training URLs are being processed.' :
                   ' Your AI is ready but could benefit from more training data.'}
                </p>
                <div className="mt-2 flex items-center gap-4 text-xs text-purple-600">
                  <span>URLs: {aiTrainingStatus.completedUrlCount || 0}/{aiTrainingStatus.urlCount || 0}</span>
                  <span>Content: {aiTrainingStatus.contentCount || 0} pages</span>
                  <span>Voice: {aiTrainingStatus.brandVoice}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="text-purple-700 border-purple-300 hover:bg-purple-100"
                  onClick={() => window.location.href = '/ai-training'}
                >
                  <Bot className="h-3 w-3 mr-1" />
                  Complete Training
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Email List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                {/* Filters */}
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search emails..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <Tabs value={statusFilter} onValueChange={setStatusFilter}>
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="pending" className="text-xs">Pending</TabsTrigger>
                      <TabsTrigger value="in_progress" className="text-xs">Progress</TabsTrigger>
                      <TabsTrigger value="resolved" className="text-xs">Resolved</TabsTrigger>
                      <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                    </TabsList>
                  </Tabs>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-700">Priority Filter</label>
                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All priorities" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Priorities</SelectItem>
                        <SelectItem value="urgent">🔴 Urgent</SelectItem>
                        <SelectItem value="high">🟠 High</SelectItem>
                        <SelectItem value="medium">🟡 Medium</SelectItem>
                        <SelectItem value="low">🔵 Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Bulk Actions */}
                  {selectedEmails.size > 0 && (
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-blue-900">
                          {selectedEmails.size} items selected
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={clearSelection}
                          className="text-blue-600 hover:text-blue-800 h-6 px-2"
                        >
                          Clear
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleBulkMarkInProgress}
                          disabled={bulkMarkInProgressMutation.isPending}
                          className="bg-blue-600 hover:bg-blue-700 text-xs"
                        >
                          {bulkMarkInProgressMutation.isPending ? 'Updating...' : 'Mark In Progress'}
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleBulkMarkResolved}
                          disabled={bulkMarkResolvedMutation.isPending}
                          className="bg-green-600 hover:bg-green-700 text-xs"
                        >
                          {bulkMarkResolvedMutation.isPending ? 'Resolving...' : 'Mark Resolved'}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Select All / Clear Selection */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={selectAllEmails}
                      disabled={filteredEmails.length === 0}
                      className="flex-1 text-xs"
                    >
                      Select All ({filteredEmails.length})
                    </Button>
                    {selectedEmails.size > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={clearSelection}
                        className="flex-1 text-xs"
                      >
                        Clear ({selectedEmails.size})
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="max-h-[600px] overflow-y-auto">
                  {isLoading ? (
                    <div className="p-4 text-center text-gray-500">Loading escalated emails...</div>
                  ) : filteredEmails.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">No escalated emails found</div>
                  ) : (
                    <div className="divide-y">
                      {filteredEmails.map((email) => (
                        <div
                          key={email.id}
                          className={`p-4 hover:bg-gray-50 cursor-pointer ${
                            selectedEmail === email.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                          } ${
                            selectedEmails.has(email.id) ? 'bg-blue-25' : ''
                          }`}
                          onClick={() => setSelectedEmail(email.id)}
                        >
                          <div className="space-y-3">
                            {/* Header with checkbox, subject, and badges */}
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={selectedEmails.has(email.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedEmails(prev => new Set(prev).add(email.id));
                                  } else {
                                    setSelectedEmails(prev => {
                                      const newSet = new Set(prev);
                                      newSet.delete(email.id);
                                      return newSet;
                                    });
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="mt-1"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm text-gray-900 truncate mb-1">{email.subject}</p>
                                    <p className="text-xs text-gray-500">
                                      From: {email.customerEmail}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                                    <Badge 
                                      variant="outline" 
                                      className={`text-xs ${getPriorityColor(email.priority)}`}
                                    >
                                      {getPriorityIcon(email.priority)}
                                      <span className="ml-1 capitalize">{email.priority}</span>
                                    </Badge>
                                    <Badge 
                                      variant="secondary" 
                                      className={`text-xs ${getStatusColor(email.status)}`}
                                    >
                                      {email.status?.replace('_', ' ') || 'Unknown'}
                                    </Badge>
                                  </div>
                                </div>

                                {/* Metadata row */}
                                <div className="space-y-1 text-xs text-gray-500">
                                  <div>
                                    Created: {getTimeAgo(email.createdAt)}
                                  </div>
                                  {email.reason && (
                                    <div>
                                      Reason: {email.reason}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Professional Email Signature Builder */}
            <Card className="mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Professional Email Signature</CardTitle>
              </CardHeader>
              <CardContent>
                <EmailSignatureBuilder
                  initialData={{
                    name: signatureData?.name || '',
                    title: signatureData?.title || '',
                    company: signatureData?.company || '',
                    companyUrl: signatureData?.companyUrl || '',
                    phone: signatureData?.phone || '',
                    email: signatureData?.email || '',
                    photoUrl: signatureData?.photoUrl || ''
                  }}
                  onSave={handleSaveSignature}
                  onGeneratePreview={generateSignaturePreview}
                />
              </CardContent>
            </Card>
          </div>

          {/* Email Details */}
          <div className="lg:col-span-2">
            {selectedEmail && selectedEmailDetails ? (
              <div className="space-y-4">
                {/* Email Header */}
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{selectedEmailDetails.subject}</CardTitle>
                        <p className="text-sm text-gray-600 mt-1">
                          From: {selectedEmailDetails.customerEmail}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="outline" 
                          className={getPriorityColor(selectedEmailDetails.priority)}
                        >
                          {getPriorityIcon(selectedEmailDetails.priority)}
                          <span className="ml-1 capitalize">{selectedEmailDetails.priority}</span>
                        </Badge>
                        <Badge 
                          variant="secondary" 
                          className={getStatusColor(selectedEmailDetails.status)}
                        >
                          {selectedEmailDetails.status?.replace('_', ' ') || 'Unknown'}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-600">Created:</span>
                        <p>{formatDate(selectedEmailDetails.createdAt)}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Escalation Reason:</span>
                        <p className="capitalize">{selectedEmailDetails.reason || 'Unknown'}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Customer Account:</span>
                        <div className="flex items-center gap-2 mt-1">
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={async () => {
                              await handleViewCustomerAccount(selectedEmailDetails.customerEmail);
                            }}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View in Store
                          </Button>
                        </div>
                      </div>

                      <div>
                        <span className="font-medium text-gray-600">Quick Actions:</span>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-3 text-xs bg-blue-50 hover:bg-blue-100 border-blue-200"
                            onClick={async () => {
                              await handleSendOrderStatus(selectedEmailDetails.customerEmail);
                            }}
                            disabled={sendOrderStatusMutation.isPending}
                          >
                            <Package className="h-3 w-3 mr-1" />
                            {sendOrderStatusMutation.isPending ? 'Sending...' : 'Send Order Status'}
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-3 text-xs bg-purple-50 hover:bg-purple-100 border-purple-200"
                            onClick={async () => {
                              await handleViewOrderHistory(selectedEmailDetails.customerEmail);
                            }}
                            disabled={viewOrderHistoryMutation.isPending}
                          >
                            <History className="h-3 w-3 mr-1" />
                            {viewOrderHistoryMutation.isPending ? 'Loading...' : 'View Order History'}
                          </Button>

                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              placeholder="Refund amount"
                              className="h-8 w-28 text-xs"
                              value={refundAmounts[selectedEmailDetails.id] || ''}
                              onChange={(e) => {
                                setRefundAmounts(prev => ({
                                  ...prev,
                                  [selectedEmailDetails.id]: e.target.value
                                }));
                              }}
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-3 text-xs bg-green-50 hover:bg-green-100 border-green-200"
                              onClick={async () => {
                                const amount = parseFloat(refundAmounts[selectedEmailDetails.id] || '0');
                                if (amount > 0) {
                                  await handleQuickRefund(selectedEmailDetails.customerEmail, amount);
                                }
                              }}
                              disabled={!refundAmounts[selectedEmailDetails.id] || parseFloat(refundAmounts[selectedEmailDetails.id]) <= 0 || quickRefundMutation.isPending}
                            >
                              <CreditCard className="h-3 w-3 mr-1" />
                              {quickRefundMutation.isPending ? 'Processing...' : 'Quick Refund'}
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Order History Display */}
                      {showOrderHistory === selectedEmailDetails.customerEmail && (
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-600">Order History (Last 3 Orders):</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => setShowOrderHistory(null)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="mt-2 space-y-2">
                            {orderHistory.length === 0 ? (
                              <p className="text-xs text-gray-500 p-2 bg-gray-50 rounded">
                                No orders found for this customer
                              </p>
                            ) : (
                              orderHistory.slice(0, 3).map((order, index) => (
                                <div key={order.id || index} className="p-3 bg-gray-50 rounded border text-xs">
                                  <div className="flex justify-between items-start mb-1">
                                    <span className="font-medium">#{order.orderNumber}</span>
                                    <span className="text-gray-600">{order.total}</span>
                                  </div>
                                  <div className="text-gray-600 space-y-1">
                                    <div>Status: <span className="capitalize">{order.status}</span></div>
                                    <div>Date: {new Date(order.dateCreated).toLocaleDateString()}</div>
                                    {order.trackingNumber && (
                                      <div>Tracking: {order.trackingNumber}</div>
                                    )}
                                    <div className="text-gray-500">
                                      Platform: {order.platform}
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                  </CardContent>
                </Card>

                {/* Email Content */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Original Email Content</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="p-4 bg-gray-50 border rounded-md text-sm whitespace-pre-wrap">
                      {selectedEmailDetails.body}
                    </div>
                  </CardContent>
                </Card>

                {/* AI Assistant Section */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-blue-600" />
                      <CardTitle className="text-base">AI Assistant</CardTitle>
                    </div>
                    <p className="text-sm text-gray-600">
                      AI-powered suggestions based on your trained brand knowledge and company policies
                    </p>
                  </CardHeader>
                  <CardContent>
                    {selectedEmailDetails.aiSuggestedResponse && selectedEmailDetails.aiConfidence && selectedEmailDetails.aiConfidence > 0.5 ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-700">Suggested Response</span>
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${
                                selectedEmailDetails.aiConfidence >= 0.8 
                                  ? 'bg-green-50 text-green-700 border-green-300' 
                                  : selectedEmailDetails.aiConfidence >= 0.6
                                  ? 'bg-yellow-50 text-yellow-700 border-yellow-300'
                                  : 'bg-red-50 text-red-700 border-red-300'
                              }`}
                            >
                              {Math.round(selectedEmailDetails.aiConfidence * 100)}% confident
                            </Badge>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`signature-${selectedEmailDetails.id}`}
                              checked={getShouldIncludeSignature(selectedEmailDetails.id)}
                              onCheckedChange={(checked) => {
                                setIncludeSignature(prev => ({
                                  ...prev,
                                  [selectedEmailDetails.id]: Boolean(checked)
                                }));
                              }}
                            />
                            <label 
                              htmlFor={`signature-${selectedEmailDetails.id}`}
                              className="text-xs text-gray-600 cursor-pointer"
                            >
                              Include email signature
                            </label>
                          </div>

                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              onClick={() => {
                                // Send the AI response as-is
                                  approveResponseMutation.mutate({
                                    emailId: selectedEmailDetails.id,
                                    response: selectedEmailDetails.aiSuggestedResponse || '',
                                    includeSignature: getShouldIncludeSignature(selectedEmailDetails.id)
                                  });
                                }}
                                disabled={approveResponseMutation.isPending}
                              >
                                <Send className="h-3 w-3 mr-1" />
                                Send
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => toggleEditResponse(selectedEmailDetails.id)}
                              >
                                <Edit className="h-3 w-3 mr-1" />
                                Edit
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => {
                                  setShowRejectionModal(selectedEmailDetails.id);
                                }}
                                data-testid="button-reject-response"
                              >
                                <X className="h-3 w-3 mr-1" />
                                Reject Response
                              </Button>
                          </div>
                        </div>

                        {editingResponse.has(selectedEmailDetails.id) ? (
                          <div className="space-y-3">
                            <Textarea 
                              value={editedResponses[selectedEmailDetails.id] || ''}
                              onChange={(e) => updateEditedResponse(selectedEmailDetails.id, e.target.value)}
                              className="min-h-32"
                              placeholder="Edit the AI response..."
                            />
                            <div className="flex items-center space-x-2 mb-2">
                              <Checkbox
                                id={`signature-edit-${selectedEmailDetails.id}`}
                                checked={getShouldIncludeSignature(selectedEmailDetails.id)}
                                onCheckedChange={(checked) => {
                                  setIncludeSignature(prev => ({
                                    ...prev,
                                    [selectedEmailDetails.id]: Boolean(checked)
                                  }));
                                }}
                              />
                              <label 
                                htmlFor={`signature-edit-${selectedEmailDetails.id}`}
                                className="text-xs text-gray-600 cursor-pointer"
                              >
                                Include email signature
                              </label>
                            </div>
                            <div className="flex gap-2">
                              <Button 
                                size="sm"
                                onClick={() => approveResponseMutation.mutate({ 
                                  emailId: selectedEmailDetails.id, 
                                  response: editedResponses[selectedEmailDetails.id],
                                  includeSignature: getShouldIncludeSignature(selectedEmailDetails.id)
                                })}
                                disabled={approveResponseMutation.isPending || !editedResponses[selectedEmailDetails.id]?.trim()}
                              >
                                <Send className="h-3 w-3 mr-1" />
                                Send
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => toggleEditResponse(selectedEmailDetails.id)}
                              >
                                <X className="h-3 w-3 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="p-4 bg-blue-50 border-l-4 border-blue-400 rounded-md">
                              <p className="text-sm whitespace-pre-wrap text-gray-800">
                                {selectedEmailDetails.aiSuggestedResponse}
                              </p>
                            </div>

                            <div className="text-xs text-gray-500">
                              💡 This suggestion is generated from your brand training data. Review and modify as needed before sending.
                            </div>
                          </div>
                        )}
                      </div>
                    ) : selectedEmailDetails.aiConfidence && selectedEmailDetails.aiConfidence <= 0.5 ? (
                      <div className="space-y-4">
                        <div className="flex items-start gap-3 p-4 bg-gray-50 border border-gray-200 rounded-md">
                          <AlertCircle className="h-5 w-5 text-gray-500 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-800">AI Response Not Available Due to Low Confidence</p>
                            <p className="text-sm text-gray-600 mt-1">
                              This complex issue requires human expertise and judgment. The AI cannot provide a confident suggestion for this type of inquiry.
                            </p>
                            <div className="mt-2 text-xs text-gray-500">
                              Consider adding more training data about this topic in the AI Training section to improve future suggestions.
                            </div>
                          </div>
                        </div>

                        {/* Response Options */}
                        <div className="space-y-4">
                          <div className="flex gap-2">
                            <Button 
                              size="sm"
                              variant={instructingAI.has(selectedEmailDetails.id) ? "default" : "outline"}
                              onClick={() => toggleAIInstruction(selectedEmailDetails.id)}
                            >
                              <Bot className="h-3 w-3 mr-1" />
                              Instruct AI
                            </Button>
                            <Button 
                              size="sm"
                              variant={!instructingAI.has(selectedEmailDetails.id) && !generatedFromInstructions[selectedEmailDetails.id] ? "default" : "outline"}
                              onClick={() => {
                                setInstructingAI(prev => {
                                  const updated = new Set(prev);
                                  updated.delete(selectedEmailDetails.id);
                                  return updated;
                                });
                              }}
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Write Manually
                            </Button>
                          </div>

                          {instructingAI.has(selectedEmailDetails.id) ? (
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-purple-700">Tell AI What to Write</span>
                                <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-300">
                                  AI-assisted
                                </Badge>
                              </div>

                              <Textarea
                                value={aiInstructions[selectedEmailDetails.id] || ''}
                                onChange={(e) => updateAIInstruction(selectedEmailDetails.id, e.target.value)}
                                className="min-h-[80px]"
                                placeholder="Tell the AI what to write (e.g., 'Apologize for the delay and offer a 15% discount' or 'Explain our return policy and ask for order number')"
                              />

                              <Button 
                                size="sm"
                                onClick={() => {
                                  const instructions = aiInstructions[selectedEmailDetails.id];
                                  if (instructions?.trim()) {
                                    generateFromInstructionsMutation.mutate({ 
                                      emailId: selectedEmailDetails.id, 
                                      instructions 
                                    });
                                  }
                                }}
                                disabled={generateFromInstructionsMutation.isPending || !aiInstructions[selectedEmailDetails.id]?.trim()}
                              >
                                {generateFromInstructionsMutation.isPending ? (
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                ) : (
                                  <Sparkles className="h-3 w-3 mr-1" />
                                )}
                                Generate Response
                              </Button>
                            </div>
                          ) : generatedFromInstructions[selectedEmailDetails.id] ? (
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-purple-700">AI Generated Response</span>
                                <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-300">
                                  From instructions
                                </Badge>
                              </div>

                              <div className="p-4 bg-purple-50 border-l-4 border-purple-400 rounded-md">
                                <p className="text-sm whitespace-pre-wrap text-gray-800">
                                  {generatedFromInstructions[selectedEmailDetails.id]}
                                </p>
                              </div>

                              <div className="flex items-center space-x-2 mb-2">
                                <Checkbox
                                  id={`signature-instructions-${selectedEmailDetails.id}`}
                                  checked={getShouldIncludeSignature(selectedEmailDetails.id)}
                                  onCheckedChange={(checked) => {
                                    setIncludeSignature(prev => ({
                                      ...prev,
                                      [selectedEmailDetails.id]: Boolean(checked)
                                    }));
                                  }}
                                />
                                <label 
                                  htmlFor={`signature-instructions-${selectedEmailDetails.id}`}
                                  className="text-xs text-gray-600 cursor-pointer"
                                >
                                  Include email signature
                                </label>
                              </div>
                              <div className="flex gap-2">
                                <Button 
                                  size="sm"
                                  onClick={() => {
                                    approveResponseMutation.mutate({ 
                                      emailId: selectedEmailDetails.id, 
                                      response: generatedFromInstructions[selectedEmailDetails.id],
                                      includeSignature: getShouldIncludeSignature(selectedEmailDetails.id)
                                    });
                                  }}
                                  disabled={approveResponseMutation.isPending}
                                >
                                  <Send className="h-3 w-3 mr-1" />
                                  Send
                                </Button>
                                <Button 
                                  size="sm"
                                  variant="outline"
                                  onClick={() => toggleAIInstruction(selectedEmailDetails.id)}
                                >
                                  <Edit className="h-3 w-3 mr-1" />
                                  Modify Instructions
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-blue-700">Write Your Response</span>
                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-300">
                                  Human-written
                                </Badge>
                              </div>

                              <Textarea
                                value={customResponses[selectedEmailDetails.id] || ''}
                                onChange={(e) => updateCustomResponse(selectedEmailDetails.id, e.target.value)}
                                className="min-h-[120px]"
                                placeholder="Write your response to the customer..."
                              />

                              <div className="flex items-center space-x-2 mb-2">
                                <Checkbox
                                  id={`signature-custom-${selectedEmailDetails.id}`}
                                  checked={getShouldIncludeSignature(selectedEmailDetails.id)}
                                  onCheckedChange={(checked) => {
                                    setIncludeSignature(prev => ({
                                      ...prev,
                                      [selectedEmailDetails.id]: Boolean(checked)
                                    }));
                                  }}
                                />
                                <label 
                                  htmlFor={`signature-custom-${selectedEmailDetails.id}`}
                                  className="text-xs text-gray-600 cursor-pointer"
                                >
                                  Include email signature
                                </label>
                              </div>
                              <Button 
                                size="sm"
                                onClick={() => {
                                  const customText = customResponses[selectedEmailDetails.id];
                                  if (customText?.trim()) {
                                    approveResponseMutation.mutate({ 
                                      emailId: selectedEmailDetails.id, 
                                      response: customText,
                                      includeSignature: getShouldIncludeSignature(selectedEmailDetails.id)
                                    });
                                  }
                                }}
                                disabled={approveResponseMutation.isPending || !customResponses[selectedEmailDetails.id]?.trim()}
                              >
                                <Send className="h-3 w-3 mr-1" />
                                Send Response
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                {/* Action Buttons */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Actions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2 flex-wrap">
                      {selectedEmailDetails.status === 'pending' && (
                        <Button 
                          size="sm" 
                          className="bg-yellow-600 hover:bg-yellow-700"
                          onClick={() => {
                            markInProgressMutation.mutate({ emailId: selectedEmailDetails.id });
                          }}
                          disabled={markInProgressMutation.isPending}
                        >
                          {markInProgressMutation.isPending ? 'Updating...' : 'Mark In Progress'}
                        </Button>
                      )}

                      {/* Show Mark as Resolved for pending and in_progress tickets */}
                      {(selectedEmailDetails.status === 'pending' || selectedEmailDetails.status === 'in_progress') && (
                        <Button 
                          size="sm" 
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => {
                            markResolvedMutation.mutate({ emailId: selectedEmailDetails.id });
                          }}
                          disabled={markResolvedMutation.isPending}
                        >
                          {markResolvedMutation.isPending ? 'Resolving...' : 'Mark as Resolved'}
                        </Button>
                      )}

                      {/* Show Mark as Unresolved for resolved tickets */}
                      {selectedEmailDetails.status === 'resolved' && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="border-orange-300 text-orange-700 hover:bg-orange-50"
                          onClick={() => {
                            markUnresolvedMutation.mutate({ emailId: selectedEmailDetails.id });
                          }}
                          disabled={markUnresolvedMutation.isPending}
                        >
                          {markUnresolvedMutation.isPending ? 'Reopening...' : 'Mark as Unresolved'}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="h-96 flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <Mail className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Select an email to view details</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* AI Response Rejection Feedback Modal */}
      <Dialog open={showRejectionModal !== null} onOpenChange={() => {
        if (!isSubmittingFeedback) {
          setShowRejectionModal(null);
          setRejectionReason('');
          setCustomRejectionReason('');
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-blue-600" />
              Help Us Improve AI Responses
            </DialogTitle>
            <DialogDescription className="space-y-2">
              <p>Your feedback directly improves our AI's future responses.</p>
              <div className="text-sm bg-blue-50 p-3 rounded-md border border-blue-200">
                <p className="font-medium text-blue-800">✨ Rapid Learning Cycle</p>
                <p className="text-blue-700">This feedback helps the AI learn your preferences and improve similar responses within hours, not weeks.</p>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-3 block">
                What was wrong with this response?
              </Label>
              <RadioGroup value={rejectionReason} onValueChange={setRejectionReason}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="tone_inappropriate" id="tone" />
                  <Label htmlFor="tone" className="text-sm">Wrong tone or style</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="factually_incorrect" id="facts" />
                  <Label htmlFor="facts" className="text-sm">Factually incorrect</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="too_generic" id="generic" />
                  <Label htmlFor="generic" className="text-sm">Too generic, not personalized</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="missed_context" id="context" />
                  <Label htmlFor="context" className="text-sm">Missed important context</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="policy_violation" id="policy" />
                  <Label htmlFor="policy" className="text-sm">Violates company policy</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="other" id="other" />
                  <Label htmlFor="other" className="text-sm">Other reason</Label>
                </div>
              </RadioGroup>
            </div>

            {rejectionReason === 'other' && (
              <div>
                <Label htmlFor="custom-reason" className="text-sm font-medium text-gray-700 mb-2 block">
                  Please specify the issue:
                </Label>
                <Textarea
                  id="custom-reason"
                  value={customRejectionReason}
                  onChange={(e) => setCustomRejectionReason(e.target.value)}
                  placeholder="Help us understand what went wrong with this response..."
                  className="min-h-20"
                  data-testid="textarea-custom-rejection-reason"
                />
              </div>
            )}

            <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
              💡 <strong>Your input matters:</strong> Each piece of feedback helps our AI learn your specific business needs and communication style.
            </div>
          </div>

          <DialogFooter className="flex gap-3">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setShowRejectionModal(null);
                setRejectionReason('');
                setCustomRejectionReason('');
              }}
              disabled={isSubmittingFeedback}
            >
              Cancel
            </Button>
            <Button 
              type="button"
              onClick={() => {
                if (!rejectionReason) return;
                if (rejectionReason === 'other' && !customRejectionReason.trim()) return;

                setIsSubmittingFeedback(true);
                const emailDetails = escalatedEmails.find(e => e.id === showRejectionModal);
                if (emailDetails) {
                  submitFeedbackMutation.mutate({
                    emailId: showRejectionModal!,
                    rejectionReason,
                    customReason: rejectionReason === 'other' ? customRejectionReason : undefined,
                    aiResponse: emailDetails.aiSuggestedResponse || '',
                    aiConfidence: emailDetails.aiConfidence || 0
                  });
                }
              }}
              disabled={
                !rejectionReason || 
                (rejectionReason === 'other' && !customRejectionReason.trim()) ||
                isSubmittingFeedback
              }
              data-testid="button-submit-feedback"
            >
              {isSubmittingFeedback ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Feedback'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}