import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, ChevronRight, Copy, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DNSRecord {
  type: string;
  name: string;
  value: string;
  priority?: number;
}

interface ProviderGuide {
  name: string;
  logo: string;
  difficulty: 'Easy' | 'Medium' | 'Advanced';
  loginUrl: string;
  steps: string[];
  screenshots?: string[];
  notes?: string[];
}

const DNS_PROVIDERS: ProviderGuide[] = [
  {
    name: 'GoDaddy',
    logo: '🏢',
    difficulty: 'Easy',
    loginUrl: 'https://account.godaddy.com/access/login',
    steps: [
      'Log in to your GoDaddy account',
      'Go to "My Products" and find your domain',
      'Click "DNS" next to your domain name',
      'Scroll down to the "Records" section',
      'Click "Add" to create a new record',
      'Select the record type (TXT, CNAME, or MX)',
      'Enter the Name and Value exactly as shown above',
      'Click "Save" and wait 5-10 minutes for propagation'
    ],
    notes: [
      'GoDaddy may take up to 1 hour for DNS changes to take effect',
      'Use "@" for the root domain when adding records',
      'Remove any conflicting existing records first'
    ]
  },
  {
    name: 'Cloudflare',
    logo: '☁️',
    difficulty: 'Easy',
    loginUrl: 'https://dash.cloudflare.com/login',
    steps: [
      'Log in to your Cloudflare dashboard',
      'Select your domain from the list',
      'Click on the "DNS" tab in the top menu',
      'Click "Add record" button',
      'Select the record type from the dropdown',
      'Enter the Name and Content exactly as shown',
      'Set TTL to "Auto" and Proxy status to "DNS only"',
      'Click "Save" - changes are usually instant'
    ],
    notes: [
      'Cloudflare changes propagate very quickly (usually under 5 minutes)',
      'Make sure Proxy is set to "DNS only" (gray cloud) for email records',
      'You can use the built-in DNS checker to verify immediately'
    ]
  },
  {
    name: 'Namecheap',
    logo: '💰',
    difficulty: 'Easy',
    loginUrl: 'https://www.namecheap.com/myaccount/login/',
    steps: [
      'Log in to your Namecheap account',
      'Go to "Domain List" in the left sidebar',
      'Click "Manage" next to your domain',
      'Click on the "Advanced DNS" tab',
      'Click "Add New Record" button',
      'Choose the record type and fill in the details',
      'Use "@" for root domain or the exact subdomain shown',
      'Click the green checkmark to save'
    ],
    notes: [
      'Changes usually take 30 minutes to propagate',
      'Use "@" for root domain records',
      'Check the "Host Records" section for existing conflicting records'
    ]
  },
  {
    name: 'Google Domains',
    logo: '🔍',
    difficulty: 'Easy',
    loginUrl: 'https://domains.google.com/',
    steps: [
      'Go to Google Domains and sign in',
      'Click on your domain name',
      'Click "DNS" in the left sidebar',
      'Scroll down to "Custom resource records"',
      'Enter the Name, Type, and Data as shown',
      'Set TTL to 300 (5 minutes) for faster updates',
      'Click "Add" to save the record'
    ],
    notes: [
      'Google Domains typically propagates within 10-15 minutes',
      'Leave the name field empty for root domain (@) records',
      'You can add multiple values for the same record name'
    ]
  },
  {
    name: 'Route 53 (AWS)',
    logo: '☁️',
    difficulty: 'Advanced',
    loginUrl: 'https://console.aws.amazon.com/route53/',
    steps: [
      'Sign in to AWS Console and go to Route 53',
      'Click "Hosted zones" in the left navigation',
      'Click on your domain name',
      'Click "Create record" button',
      'Choose "Simple routing" and click "Next"',
      'Enter the record name and select the record type',
      'Enter the value exactly as shown above',
      'Click "Create records" to save'
    ],
    notes: [
      'Route 53 changes usually propagate within 60 seconds',
      'Make sure you are in the correct hosted zone',
      'AWS charges per hosted zone and per query'
    ]
  },
  {
    name: 'Network Solutions',
    logo: '🌐',
    difficulty: 'Medium',
    loginUrl: 'https://www.networksolutions.com/manage-it/',
    steps: [
      'Log in to Network Solutions account manager',
      'Click "Manage" next to your domain',
      'Click "Change Where Domain Points"',
      'Select "Advanced DNS" option',
      'Click "Manage Advanced DNS Records"',
      'Click "Add New Record"',
      'Fill in the record type, host, and answer fields',
      'Click "Continue" then "Save Changes"'
    ],
    notes: [
      'Network Solutions can take 4-24 hours for full propagation',
      'Use "@" for root domain records',
      'Some record types may require calling customer support'
    ]
  },
  {
    name: 'Hover',
    logo: '🎯',
    difficulty: 'Easy',
    loginUrl: 'https://www.hover.com/signin',
    steps: [
      'Log in to your Hover account',
      'Click on your domain name',
      'Click the "DNS" tab',
      'Click "Add New Record"',
      'Select the record type from dropdown',
      'Enter hostname and target value as shown',
      'Click "Add Record" to save'
    ],
    notes: [
      'Hover changes typically take 15-30 minutes',
      'Use "@" for root domain records',
      'Clean, simple interface makes this straightforward'
    ]
  },
  {
    name: 'Other Provider',
    logo: '❓',
    difficulty: 'Medium',
    loginUrl: '#',
    steps: [
      'Log in to your DNS provider\'s control panel',
      'Look for "DNS Management", "DNS Records", or "Zone Editor"',
      'Find the option to "Add Record" or "Create Record"',
      'Select the record type (TXT, CNAME, MX) from dropdown',
      'Enter the Name/Host field exactly as shown above',
      'Enter the Value/Target field exactly as shown above',
      'Save the record and wait for propagation (5 minutes to 24 hours)',
      'Use our verification tool above to check if it worked'
    ],
    notes: [
      'Every DNS provider has slightly different terminology',
      'Look for DNS, Zone, or Record management sections',
      'Propagation times vary widely between providers'
    ]
  }
];

interface DNSProviderGuidesProps {
  records: DNSRecord[];
  domain: string;
}

export function DNSProviderGuides({ records = [], domain = '' }: DNSProviderGuidesProps) {
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [copiedRecord, setCopiedRecord] = useState<string>('');
  const { toast } = useToast();

  const copyToClipboard = (text: string, recordId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedRecord(recordId);
    setTimeout(() => setCopiedRecord(''), 2000);
    toast({
      title: "Copied to clipboard",
      description: "DNS record value copied successfully"
    });
  };

  const selectedGuide = DNS_PROVIDERS.find(p => p.name === selectedProvider);

  return (
    <div className="space-y-6">
      {/* Only show DNS Records Summary if we have records */}
      {records && records.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>DNS Records to Add</CardTitle>
            <CardDescription>
              Add these records to your DNS provider for {domain}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {records.map((record, index) => (
            <div key={index} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <Badge variant="outline">{record.type} Record</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(record.value, `${record.type}-${index}`)}
                  className="h-8 px-2"
                >
                  {copiedRecord === `${record.type}-${index}` ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-600 dark:text-gray-400">Name/Host:</span>
                  <div className="font-mono bg-white dark:bg-gray-900 p-2 rounded border mt-1">
                    {record.name || '@'}
                  </div>
                </div>
                <div>
                  <span className="font-medium text-gray-600 dark:text-gray-400">Value/Target:</span>
                  <div className="font-mono bg-white dark:bg-gray-900 p-2 rounded border mt-1 break-all">
                    {record.value}
                  </div>
                </div>
                {record.priority && (
                  <div>
                    <span className="font-medium text-gray-600 dark:text-gray-400">Priority:</span>
                    <div className="font-mono bg-white dark:bg-gray-900 p-2 rounded border mt-1">
                      {record.priority}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      )}

      {/* Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Choose Your DNS Provider</CardTitle>
          <CardDescription>
            Select your domain registrar or DNS provider for step-by-step instructions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {DNS_PROVIDERS.map((provider) => (
              <Card
                key={provider.name}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedProvider === provider.name 
                    ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950' 
                    : ''
                }`}
                onClick={() => setSelectedProvider(provider.name)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl">{provider.logo}</span>
                      <span className="font-medium">{provider.name}</span>
                    </div>
                    <Badge 
                      variant={provider.difficulty === 'Easy' ? 'default' : 
                               provider.difficulty === 'Medium' ? 'secondary' : 'destructive'}
                    >
                      {provider.difficulty}
                    </Badge>
                  </div>
                  {selectedProvider === provider.name && (
                    <div className="flex items-center text-blue-600 dark:text-blue-400 text-sm">
                      <ChevronRight className="h-4 w-4 mr-1" />
                      Selected - view guide below
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Selected Provider Guide */}
      {selectedGuide && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <span className="text-2xl">{selectedGuide.logo}</span>
                  <span>{selectedGuide.name} Setup Guide</span>
                  <Badge variant={
                    selectedGuide.difficulty === 'Easy' ? 'default' : 
                    selectedGuide.difficulty === 'Medium' ? 'secondary' : 'destructive'
                  }>
                    {selectedGuide.difficulty}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Follow these steps to add DNS records in {selectedGuide.name}
                </CardDescription>
              </div>
              {selectedGuide.loginUrl !== '#' && (
                <Button
                  onClick={() => window.open(selectedGuide.loginUrl, '_blank')}
                  className="flex items-center space-x-2"
                >
                  <span>Login to {selectedGuide.name}</span>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step-by-step instructions */}
            <div>
              <h4 className="font-medium mb-4">Step-by-Step Instructions:</h4>
              <ol className="space-y-3">
                {selectedGuide.steps.map((step, index) => (
                  <li key={index} className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                    <span className="text-sm">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Important notes */}
            {selectedGuide.notes && selectedGuide.notes.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-950 p-4 rounded-lg">
                <h4 className="font-medium mb-2 text-yellow-800 dark:text-yellow-200">
                  Important Notes for {selectedGuide.name}:
                </h4>
                <ul className="space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
                  {selectedGuide.notes.map((note, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <span className="text-yellow-600 dark:text-yellow-400 mt-1">•</span>
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Login button */}
            {selectedGuide.loginUrl !== '#' && (
              <div className="pt-4 border-t">
                <Button
                  onClick={() => window.open(selectedGuide.loginUrl, '_blank')}
                  className="w-full flex items-center justify-center space-x-2"
                  size="lg"
                >
                  <span>Open {selectedGuide.name} DNS Management</span>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* General Tips */}
      <Card>
        <CardHeader>
          <CardTitle>General DNS Tips</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-start space-x-2">
            <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
            <span><strong>Propagation Time:</strong> DNS changes can take 5 minutes to 24 hours to take effect worldwide</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
            <span><strong>Root Domain:</strong> Use "@" or leave blank when the name field should be your main domain</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
            <span><strong>Exact Match:</strong> Copy and paste the values exactly as shown - spacing and punctuation matter</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
            <span><strong>Multiple Records:</strong> You may need to add multiple TXT records - most providers allow this</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}