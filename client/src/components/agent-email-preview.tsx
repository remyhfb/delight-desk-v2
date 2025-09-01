import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Eye, Mail, AlertTriangle, Settings } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';

interface EmailConfig {
  fromEmail?: string;
  replyToEmail?: string;
  companyName?: string;
  aiAgentName: string;
  aiAgentTitle: string;
  salutation: string;
  customSalutation?: string;
  signatureFooter: string;
  emailSignature?: string;
  signatureName?: string;
  signatureTitle?: string;
  signatureCompany?: string;
  signatureCompanyUrl?: string;
  signaturePhone?: string;
  signatureEmail?: string;
  signatureLogoUrl?: string;
  signaturePhotoUrl?: string;
}

interface AgentEmailPreviewProps {
  agentType: 'wismo' | 'product' | 'subscription' | 'returns' | 'promo-code';
  agentDisplayName: string;
  sampleSubject: string;
  sampleContent: string;
  className?: string;
}

export function AgentEmailPreview({ 
  agentType, 
  agentDisplayName, 
  sampleSubject, 
  sampleContent,
  className = "" 
}: AgentEmailPreviewProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: emailConfig, isLoading, error } = useQuery<EmailConfig>({
    queryKey: [`/api/agents/email-config/${user?.id}`],
    enabled: !!user?.id,
  });

  const isConfigured = emailConfig?.fromEmail && (
    emailConfig?.emailSignature || 
    emailConfig?.signatureName || 
    emailConfig?.signatureFooter ||
    emailConfig?.aiAgentName
  );

  const buildEmailSignature = () => {
    if (!emailConfig) return '';

    // Use custom signature if available
    if (emailConfig.emailSignature) {
      return emailConfig.emailSignature;
    }

    // Build signature from components
    let signature = '';
    
    // Add salutation
    const salutation = emailConfig.customSalutation || emailConfig.salutation;
    signature += `${salutation},\n\n`;
    
    // Add agent name and title
    signature += `${emailConfig.aiAgentName}\n`;
    signature += `${emailConfig.aiAgentTitle}\n`;
    
    // Add company if available
    if (emailConfig.signatureCompany || emailConfig.companyName) {
      signature += `${emailConfig.signatureCompany || emailConfig.companyName}\n`;
    }
    
    // Add contact info
    if (emailConfig.signaturePhone) {
      signature += `Phone: ${emailConfig.signaturePhone}\n`;
    }
    if (emailConfig.signatureEmail) {
      signature += `Email: ${emailConfig.signatureEmail}\n`;
    }
    
    // Add footer
    if (emailConfig.signatureFooter) {
      signature += `\n---\n${emailConfig.signatureFooter}`;
    }
    
    return signature;
  };

  const handleConfigureEmail = () => {
    setLocation('/ai-training?tab=settings');
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Eye className="h-5 w-5" />
            <span>Email Preview</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Eye className="h-5 w-5" />
          <span>Email Preview</span>
          {isConfigured ? (
            <Badge variant="default" className="bg-green-100 text-green-800">
              Configured
            </Badge>
          ) : (
            <Badge variant="destructive">
              Setup Required
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          How customers will see automated responses from this agent
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Configuration Warning */}
        {!isConfigured && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>
                {!emailConfig?.fromEmail ? 'Sending email address not configured.' : 'Email signature not configured.'} 
                {' '}This agent cannot be activated until email settings are complete.
              </span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleConfigureEmail}
                className="ml-3"
              >
                <Settings className="h-4 w-4 mr-2" />
                Configure
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Email Preview */}
        <div className="border rounded-lg p-4 bg-gray-50">
          <div className="space-y-3">
            {/* Email Header */}
            <div className="border-b pb-3">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Mail className="h-4 w-4" />
                <span>
                  From: {emailConfig?.fromEmail || 'your-email@yourstore.com'}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                Subject: {sampleSubject}
              </div>
            </div>

            {/* Email Body */}
            <div className="space-y-3">
              <div className="text-sm leading-relaxed whitespace-pre-line">
                {sampleContent}
              </div>
              
              {/* Email Signature */}
              {isConfigured && (
                <div className="border-t pt-3 mt-4">
                  <div className="text-sm leading-relaxed whitespace-pre-line text-gray-700">
                    {buildEmailSignature()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Missing Configuration Details */}
        {!isConfigured && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="font-medium text-amber-900 mb-2">Required Configuration:</h4>
            <ul className="space-y-1 text-sm text-amber-800">
              {!emailConfig?.fromEmail && (
                <li className="flex items-center gap-2">
                  <span className="text-amber-500">•</span>
                  Sending email address (From field)
                </li>
              )}
              {!emailConfig?.emailSignature && !emailConfig?.signatureName && (
                <li className="flex items-center gap-2">
                  <span className="text-amber-500">•</span>
                  Email signature
                </li>
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}