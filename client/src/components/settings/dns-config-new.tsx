import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Copy, Check, AlertCircle, RefreshCw, BookOpen } from "lucide-react";
import { DNSProviderGuides } from './dns-provider-guides';

interface DNSRecord {
  type: string;
  name: string;
  value: string;
  status?: 'pending' | 'valid' | 'invalid';
  ttl?: number;
}

export default function DNSConfigNew() {
  const { toast } = useToast();
  const [verifiedDomain, setVerifiedDomain] = useState('');
  const [originalInput, setOriginalInput] = useState('');
  const [domainVerified, setDomainVerified] = useState(false);
  const [domainId, setDomainId] = useState<string>('');
  const [dnsRecords, setDnsRecords] = useState<DNSRecord[]>([]);
  const [recordsAdded, setRecordsAdded] = useState(false);
  const [coworkerEmail, setCoworkerEmail] = useState('');
  const [coworkerMessage, setCoworkerMessage] = useState(`Hi, I'm trying to authenticate our domain with Delight Desk, but I don't have the ability to modify our DNS records. Can you help me add these records, so that I can complete the process?`);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard`,
      });
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const verifyDomainMutation = useMutation({
    mutationFn: async (domain: string) => {
      const response = await apiRequest('POST', '/api/verify-domain', { userId: 'user1', domain });
      return response.json();
    },
    onSuccess: (response: any) => {
      setDomainVerified(response.verified);
      setDomainId(response.domainId);
      setVerifiedDomain(response.domain);
      
      // Transform SendGrid response to our DNS records format
      const records: DNSRecord[] = [];
      if (response.dnsRecords) {
        const dns = response.dnsRecords;
        
        // Handle mail CNAME record
        if (dns.mail_cname) {
          records.push({
            type: 'CNAME',
            name: dns.mail_cname.host || dns.mail_cname.name || `mail.${response.domain}`,
            value: dns.mail_cname.data || dns.mail_cname.value,
            status: 'pending',
            ttl: 3600
          });
        }
        
        // Handle DKIM CNAME records
        if (dns.dkim1) {
          records.push({
            type: 'CNAME',
            name: dns.dkim1.host || dns.dkim1.name,
            value: dns.dkim1.data || dns.dkim1.value,
            status: 'pending',
            ttl: 3600
          });
        }
        
        if (dns.dkim2) {
          records.push({
            type: 'CNAME',
            name: dns.dkim2.host || dns.dkim2.name,
            value: dns.dkim2.data || dns.dkim2.value,
            status: 'pending',
            ttl: 3600
          });
        }
      }
      
      setDnsRecords(records);
      toast({
        title: "Domain added successfully!",
        description: "Please add the DNS records below to complete verification.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Domain setup failed",
        description: error.message || "Failed to set up domain",
        variant: "destructive",
      });
    },
  });

  const validateDNSMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/validate-dns-records', { 
        userId: 'user1', 
        domain: verifiedDomain
      });
      return response.json();
    },
    onSuccess: (response: any) => {
      const isVerified = response.verified || false;
      setDomainVerified(isVerified);
      
      // Update all record statuses based on verification result
      const updatedRecords = dnsRecords.map(record => ({
        ...record,
        status: isVerified ? 'valid' as const : 'pending' as const
      }));
      setDnsRecords(updatedRecords);
      
      toast({
        title: isVerified ? "Domain verified successfully!" : "Domain verification pending",
        description: response.message || (isVerified 
          ? "Your domain is now ready for email sending." 
          : "Please ensure DNS records are configured and try again in a few minutes."),
        variant: isVerified ? "default" : "destructive",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Verification failed",
        description: error.message || "Failed to verify domain.",
        variant: "destructive",
      });
    },
  });

  const sendToCoworkerMutation = useMutation({
    mutationFn: async (emailData: { email: string; message: string }) => {
      const response = await apiRequest('POST', '/api/send-dns-instructions', {
        userId: 'user1',
        domain: verifiedDomain,
        domainId,
        dnsRecords,
        coworkerEmail: emailData.email,
        message: emailData.message
      });
      return response.json();
    },
    onSuccess: (response: any) => {
      toast({
        title: "Instructions sent!",
        description: `DNS setup instructions sent to ${coworkerEmail}`,
      });
      setCoworkerEmail('');
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send instructions",
        description: error.message || "Unable to send DNS instructions email.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!originalInput.trim()) return;
    
    const cleanDomain = originalInput.trim().toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '');
    
    setOriginalInput(cleanDomain);
    verifyDomainMutation.mutate(cleanDomain);
  };

  const handleVerifyDomain = () => {
    if (!recordsAdded) {
      toast({
        title: "Please confirm DNS records",
        description: "Check the box to confirm you've added all DNS records before verifying.",
        variant: "destructive",
      });
      return;
    }
    validateDNSMutation.mutate();
  };

  const handleSendToCoworker = () => {
    if (!coworkerEmail.trim()) {
      toast({
        title: "Email required",
        description: "Please enter your coworker's email address.",
        variant: "destructive",
      });
      return;
    }
    
    if (!verifiedDomain || dnsRecords.length === 0) {
      toast({
        title: "Generate DNS records first",
        description: "Please generate DNS records for a domain before sending instructions.",
        variant: "destructive",
      });
      return;
    }

    sendToCoworkerMutation.mutate({
      email: coworkerEmail,
      message: coworkerMessage
    });
  };

  return (
    <div className="space-y-6">
      {/* Domain Input Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Domain Authentication</span>
            {domainVerified && <Check className="h-5 w-5 text-green-600" />}
          </CardTitle>
          <CardDescription>
            Set up domain authentication to improve email deliverability and remove "via" messages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="domain">Enter your domain</Label>
              <div className="flex gap-2">
                <Input
                  id="domain"
                  type="text"
                  placeholder="example.com"
                  value={originalInput}
                  onChange={(e) => setOriginalInput(e.target.value)}
                  disabled={verifyDomainMutation.isPending}
                  className="flex-1"
                />
                <Button 
                  type="submit" 
                  disabled={verifyDomainMutation.isPending || !originalInput.trim()}
                >
                  {verifyDomainMutation.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                  Generate DNS Records
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* DNS Records Section - SendGrid Style Tabs */}
      {dnsRecords.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Install DNS Records</CardTitle>
            <CardDescription>
              You will need to install the following records to complete the process.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="manual" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="manual">Manual Setup</TabsTrigger>
                <TabsTrigger value="coworker">Send To A Coworker</TabsTrigger>
              </TabsList>

              {/* Manual Setup Tab */}
              <TabsContent value="manual" className="space-y-6">
                {/* Instructions */}
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                      1
                    </div>
                    <div>
                      <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                        Add all of these records to {verifiedDomain}'s DNS section.
                      </h4>
                    </div>
                  </div>
                </div>

                {/* DNS Records Table */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-50 dark:bg-gray-900/50 border-b px-6 py-3">
                    <div className="grid grid-cols-12 gap-4 font-medium text-sm text-gray-600 dark:text-gray-400">
                      <div className="col-span-2">TYPE</div>
                      <div className="col-span-5">HOST</div>
                      <div className="col-span-5">VALUE</div>
                    </div>
                  </div>
                  
                  {dnsRecords.map((record, index) => (
                    <div key={index} className="border-b last:border-b-0 px-6 py-4">
                      <div className="grid grid-cols-12 gap-4 items-center">
                        {/* TYPE */}
                        <div className="col-span-2">
                          <div className="bg-gray-100 dark:bg-gray-800 rounded px-2 py-1 text-sm font-mono">
                            {record.type}
                          </div>
                        </div>
                        
                        {/* HOST */}
                        <div className="col-span-5">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-50 dark:bg-gray-900/50 rounded px-3 py-2 text-sm font-mono break-all">
                              {record.name}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(record.name, 'Host')}
                              className="flex-shrink-0"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        
                        {/* VALUE */}
                        <div className="col-span-5">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-50 dark:bg-gray-900/50 rounded px-3 py-2 text-sm font-mono break-all">
                              {record.value}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(record.value, 'Value')}
                              className="flex-shrink-0"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Confirmation Section */}
                <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                      2
                    </div>
                    <div className="flex-1 space-y-3">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">
                        Confirm you've added these once completed.
                      </h4>
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="records-added" 
                          checked={recordsAdded}
                          onCheckedChange={(checked) => setRecordsAdded(checked === true)}
                        />
                        <Label htmlFor="records-added" className="text-sm">
                          I've added these records.
                        </Label>
                      </div>
                      
                      <Button 
                        onClick={handleVerifyDomain}
                        disabled={!recordsAdded || validateDNSMutation.isPending}
                        className="w-full sm:w-auto"
                      >
                        {validateDNSMutation.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                        Verify Domain
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Success State */}
                {domainVerified && (
                  <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
                    <Check className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800 dark:text-green-200">
                      <strong>Domain verified successfully!</strong> You can now send emails from {verifiedDomain}.
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>

              {/* Send To A Coworker Tab */}
              <TabsContent value="coworker" className="space-y-6">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Enter a coworker's email address and we'll send them everything they need to install these records.
                </p>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="coworker-email">To</Label>
                    <Input
                      id="coworker-email"
                      type="email"
                      placeholder="Email Address"
                      value={coworkerEmail}
                      onChange={(e) => setCoworkerEmail(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="coworker-message">Message</Label>
                    <Textarea
                      id="coworker-message"
                      placeholder="Add a personal message..."
                      value={coworkerMessage}
                      onChange={(e) => setCoworkerMessage(e.target.value)}
                      rows={4}
                      className="mt-1"
                    />
                  </div>

                  <Button 
                    onClick={handleSendToCoworker}
                    disabled={sendToCoworkerMutation.isPending || !coworkerEmail.trim()}
                    className="w-full"
                  >
                    {sendToCoworkerMutation.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                    Send DNS Instructions
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* DNS Provider Guides Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            DNS Setup Guides
          </CardTitle>
          <CardDescription>
            Step-by-step instructions for popular DNS providers to help you add the records above.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DNSProviderGuides records={dnsRecords} domain={verifiedDomain} />
        </CardContent>
      </Card>
    </div>
  );
}