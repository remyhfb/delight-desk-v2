import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Copy, CheckCircle, XCircle, AlertCircle, RefreshCw, ExternalLink, HelpCircle, BookOpen } from "lucide-react";
import { DNSProviderGuides } from './dns-provider-guides';

interface DNSRecord {
  type: string;
  name: string;
  value: string;
  status?: 'pending' | 'valid' | 'invalid';
  ttl?: number;
}

interface ValidationResult {
  record: DNSRecord;
  isValid: boolean;
  actualValue?: string;
  error?: string;
}

export default function DNSConfig() {
  const { toast } = useToast();
  const [verifiedDomain, setVerifiedDomain] = useState('');
  const [originalInput, setOriginalInput] = useState('');
  const [domainVerified, setDomainVerified] = useState(false);
  const [domainId, setDomainId] = useState<string>('');
  const [dnsRecords, setDnsRecords] = useState<DNSRecord[]>([]);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [autoValidation, setAutoValidation] = useState(false);

  const verifyDomainMutation = useMutation({
    mutationFn: async (domain: string) => {
      const response = await apiRequest('POST', '/api/verify-domain', { userId: 'user1', domain });
      return response.json();
    },
    onSuccess: (response: any) => {

      console.log('Response verified:', response.verified);
      console.log('Response domainId:', response.domainId);
      console.log('Response dnsRecords:', response.dnsRecords);
      
      setDomainVerified(response.verified);
      setDomainId(response.domainId);
      
      // Transform SendGrid response to our DNS records format
      console.log('SendGrid DNS response:', response.dnsRecords);
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
        
        // Handle DKIM CNAME records - SendGrid returns 'dkim1' and 'dkim2' fields
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
        
        console.log('Parsed DNS records:', records);
      }
      
      setDnsRecords(records);
      toast({
        title: response.verified ? "Domain verified" : "DNS records generated",
        description: response.verified 
          ? "Domain is already verified and ready to use." 
          : "Add these DNS records to your domain provider, then click 'Validate DNS Records'.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error", 
        description: error.message || "Failed to generate DNS records.",
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

  const validateSendGridMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/validate-domain', { userId: 'user1', domainId });
      return response.json();
    },
    onSuccess: (response: any) => {
      setDomainVerified(response.verified);
      toast({
        title: response.verified ? "SendGrid domain verified!" : "Validation pending",
        description: response.message,
        variant: response.verified ? "default" : "destructive",
      });
    },
    onError: (error: any) => {
      toast({
        title: "SendGrid validation failed",
        description: error.message || "Failed to validate with SendGrid.",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = (text: string, description: string = "DNS record copied to clipboard.") => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description,
    });
  };

  // Normalize domain input to remove common prefixes and ensure proper format
  const normalizeDomain = (input: string): string => {
    let domain = input.trim().toLowerCase();
    
    // Remove common prefixes
    domain = domain.replace(/^https?:\/\//, ''); // Remove http/https
    domain = domain.replace(/^www\./, ''); // Remove www
    domain = domain.replace(/\/$/, ''); // Remove trailing slash
    
    // Remove paths/query params if present
    domain = domain.split('/')[0];
    domain = domain.split('?')[0];
    
    return domain;
  };

  const handleDomainInput = (value: string) => {
    const normalized = normalizeDomain(value);
    setVerifiedDomain(normalized);
    // Store original input to show auto-correction feedback
    setOriginalInput(value);
  };

  // Validate domain format
  const isValidDomain = (domain: string): boolean => {
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
    return domainRegex.test(domain);
  };

  const getDomainValidationMessage = () => {
    if (!verifiedDomain) return null;
    if (!isValidDomain(verifiedDomain)) {
      return "Please enter a valid domain (e.g., yourstore.com)";
    }
    return null;
  };

  // Auto-validation every 30 seconds when enabled
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoValidation && dnsRecords.length > 0 && !domainVerified) {
      interval = setInterval(() => {
        validateDNSMutation.mutate();
      }, 30000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoValidation, dnsRecords.length, domainVerified]);

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'valid':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'invalid':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            DNS Configuration
          </CardTitle>
          <CardDescription>
            Set up email authentication for your domain
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Domain Input Section */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="verified-domain" className="text-sm font-medium">
                Your Domain
              </Label>
              <p className="text-xs text-gray-500 mt-1">
                Enter your root domain only (e.g., "yourstore.com" not "www.yourstore.com")
              </p>
            </div>
            <div className="flex rounded-md shadow-sm">
              <Input
                id="verified-domain"
                type="text"
                className="flex-1 rounded-r-none"
                placeholder="yourstore.com"
                value={verifiedDomain}
                onChange={(e) => handleDomainInput(e.target.value)}
              />
              <Button 
                type="button"
                variant="outline"
                className="rounded-l-none border-l-0"
                onClick={() => verifyDomainMutation.mutate(verifiedDomain)}
                disabled={verifyDomainMutation.isPending || !verifiedDomain.trim() || !isValidDomain(verifiedDomain)}
              >
                {verifyDomainMutation.isPending ? 'Generating...' : 'Generate DNS Records'}
              </Button>
            </div>
            
            {/* Domain validation feedback */}
            {getDomainValidationMessage() && (
              <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
                {getDomainValidationMessage()}
              </div>
            )}
            
            {/* Auto-correction feedback */}
            {verifiedDomain && originalInput && verifiedDomain !== originalInput && (
              <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded border border-blue-200">
                <strong>Auto-corrected:</strong> Using "{verifiedDomain}" (removed www/http prefixes)
              </div>
            )}
          </div>

          {/* Domain Status - Only show if domain has been set and records generated */}
          {dnsRecords.length > 0 && (
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="flex items-center gap-3">
                {getStatusIcon(domainVerified ? 'valid' : 'pending')}
                <div>
                  <p className="font-medium">
                    {domainVerified ? 'Domain Verified' : 'Verification Pending'}
                  </p>
                  <p className="text-sm text-gray-600">
                    {domainVerified 
                      ? 'Your domain is ready for email sending' 
                      : 'Add DNS records below to your domain, then click "Verify Domain"'
                    }
                  </p>
                </div>
              </div>
              {domainVerified && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Ready
                </Badge>
              )}
            </div>
          )}

          {/* Initial Helper Section - Show when no records generated yet */}
          {dnsRecords.length === 0 && verifiedDomain && (
            <Alert>
              <BookOpen className="h-4 w-4" />
              <AlertDescription>
                <strong>Next Step:</strong> Click "Generate DNS Records" above to get the specific DNS records for {verifiedDomain}. 
                Once generated, you'll see detailed setup guides for all major DNS providers including GoDaddy, Cloudflare, Namecheap, and more.
              </AlertDescription>
            </Alert>
          )}

          {/* DNS Records Section */}
          {dnsRecords.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">DNS Records to Add</h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => validateDNSMutation.mutate()}
                    disabled={validateDNSMutation.isPending}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${validateDNSMutation.isPending ? 'animate-spin' : ''}`} />
                    {validateDNSMutation.isPending ? 'Verifying...' : 'Verify Domain'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAutoValidation(!autoValidation);
                      toast({
                        title: autoValidation ? "Auto-validation disabled" : "Auto-validation enabled",
                        description: autoValidation ? "Manual checks only" : "Checking every 30 seconds",
                      });
                    }}
                  >
                    {autoValidation ? 'Auto: ON' : 'Auto: OFF'}
                  </Button>
                </div>
              </div>

              <Tabs defaultValue="records" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="records">DNS Records</TabsTrigger>
                  <TabsTrigger value="guides">Setup Guides</TabsTrigger>
                </TabsList>
                
                <TabsContent value="records" className="space-y-4">
                  {dnsRecords.map((record, index) => {
                    const validation = validationResults.find(v => 
                      v.record.name === record.name && v.record.type === record.type
                    );
                    
                    return (
                      <Card key={index} className="relative">
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(record.status)}
                              <h4 className="font-medium">
                                {record.type} Record {index + 1}
                              </h4>
                            </div>
                            {record.status === 'valid' && (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                Verified
                              </Badge>
                            )}
                          </div>
                          
                          <div className="grid gap-4">
                            <div>
                              <Label className="text-sm font-medium text-gray-700 mb-2 block">
                                Record Name / Host
                              </Label>
                              <div className="flex">
                                <Input
                                  readOnly
                                  value={record.name}
                                  className="flex-1 rounded-r-none bg-gray-50 font-mono text-sm"
                                />
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="rounded-l-none border-l-0"
                                  onClick={() => copyToClipboard(record.name, "Record name copied")}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            
                            <div>
                              <Label className="text-sm font-medium text-gray-700 mb-2 block">
                                Record Value / Points To
                              </Label>
                              <div className="flex">
                                <Input
                                  readOnly
                                  value={record.value}
                                  className="flex-1 rounded-r-none bg-gray-50 font-mono text-sm"
                                />
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="rounded-l-none border-l-0"
                                  onClick={() => copyToClipboard(record.value, "Record value copied")}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <Label className="text-gray-600">Record Type:</Label>
                                <p className="font-medium">{record.type}</p>
                              </div>
                              <div>
                                <Label className="text-gray-600">TTL:</Label>
                                <p className="font-medium">{record.ttl || 3600} seconds</p>
                              </div>
                            </div>

                            {validation && !validation.isValid && (
                              <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                  <strong>Validation Error:</strong> {validation.error}
                                  {validation.actualValue && (
                                    <span className="block mt-1">
                                      Current value: <code className="text-sm bg-gray-100 px-1 rounded">{validation.actualValue}</code>
                                    </span>
                                  )}
                                </AlertDescription>
                              </Alert>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </TabsContent>

                <TabsContent value="guides" className="space-y-4">
                  <DNSProviderGuides 
                    records={dnsRecords}
                    domain={verifiedDomain}
                  />
                </TabsContent>
              </Tabs>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <Button
                  onClick={() => validateSendGridMutation.mutate()}
                  disabled={validateSendGridMutation.isPending || !dnsRecords.every(r => r.status === 'valid')}
                  className="flex-1"
                >
                  {validateSendGridMutation.isPending ? 'Finalizing...' : 'Complete Setup'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const allRecords = dnsRecords.map(r => `${r.type}: ${r.name} → ${r.value}`).join('\n');
                    copyToClipboard(allRecords, "All DNS records copied");
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy All
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}