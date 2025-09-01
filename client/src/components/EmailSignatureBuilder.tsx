import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { User, Globe, Phone, Mail, Camera, Building, Code, Eye, Info, X } from "lucide-react";
import { ObjectUploader } from "./ObjectUploader";
import type { UploadResult } from "@uppy/core";

interface SignatureData {
  name?: string;
  title?: string;
  company?: string;
  companyUrl?: string;
  phone?: string;
  email?: string;
  photoUrl?: string;
  htmlSignature?: string;
}

interface EmailSignatureBuilderProps {
  initialData?: SignatureData;
  onSave: (signatureData: SignatureData & { htmlSignature: string }) => void;
  onGeneratePreview: (data: SignatureData) => string;
}

export function EmailSignatureBuilder({ 
  initialData = {}, 
  onSave, 
  onGeneratePreview 
}: EmailSignatureBuilderProps) {
  const { toast } = useToast();
  const [signatureData, setSignatureData] = useState<SignatureData>(initialData);
  const [isUploading, setIsUploading] = useState<'photo' | null>(null);
  const [htmlSignatureText, setHtmlSignatureText] = useState(initialData.htmlSignature || '');
  const [activeTab, setActiveTab] = useState<'builder' | 'html'>('builder');

  const updateField = (field: keyof SignatureData, value: string) => {
    setSignatureData(prev => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = async (type: 'photo') => {
    return new Promise<{method: "PUT", url: string}>((resolve, reject) => {
      setIsUploading(type);
      
      fetch('/api/objects/upload', { method: 'POST' })
        .then(res => res.json())
        .then(data => resolve({ method: 'PUT', url: data.uploadURL }))
        .catch(reject);
    });
  };

  const handleImageUploadComplete = async (type: 'photo', result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    try {
      if (result.successful && result.successful[0]) {
        const uploadUrl = result.successful[0].uploadURL;
        
        // Update object ACL and get the normalized path
        const response = await fetch('/api/signature-images', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: uploadUrl, imageType: type })
        });

        if (response.ok) {
          const { objectPath } = await response.json();
          updateField('photoUrl', objectPath);
          toast({
            title: "Success",
            description: "Profile photo uploaded successfully!"
          });
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Error",
        description: "Failed to upload profile photo. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(null);
    }
  };

  const handleSave = () => {
    let htmlSignature: string;
    
    if (activeTab === 'html') {
      // Use the HTML text directly
      htmlSignature = htmlSignatureText;
    } else {
      // Generate HTML from visual builder data
      htmlSignature = onGeneratePreview(signatureData);
    }
    
    onSave({
      ...signatureData,
      htmlSignature
    });
  };

  const getPreviewHtml = () => {
    if (activeTab === 'html' && htmlSignatureText) {
      return htmlSignatureText;
    }
    return onGeneratePreview(signatureData);
  };

  return (
    <div className="space-y-6">
      {/* Explainer Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Email Signature Usage</p>
            <p>Your email signature will be automatically appended to the end of every response sent from this system, including AI-generated responses and manually written emails. You can choose to exclude the signature on individual emails when composing responses.</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'builder' | 'html')} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="builder" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Visual Builder
          </TabsTrigger>
          <TabsTrigger value="html" className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            HTML Signature
          </TabsTrigger>
        </TabsList>

        <TabsContent value="builder" className="space-y-6">
          {/* Personal Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Name
              </Label>
              <Input
                id="name"
                value={signatureData.name || ''}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="John Smith"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={signatureData.title || ''}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="Customer Success Manager"
              />
            </div>
          </div>

          {/* Company Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company" className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                Company
              </Label>
              <Input
                id="company"
                value={signatureData.company || ''}
                onChange={(e) => updateField('company', e.target.value)}
                placeholder="Acme Corporation"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="companyUrl" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Company URL
              </Label>
              <Input
                id="companyUrl"
                value={signatureData.companyUrl || ''}
                onChange={(e) => updateField('companyUrl', e.target.value)}
                placeholder="https://acmecorp.com"
              />
            </div>
          </div>

          {/* Contact Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={signatureData.email || ''}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="john@acmecorp.com"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Phone
              </Label>
              <Input
                id="phone"
                value={signatureData.phone || ''}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>

          <Separator />

          {/* Profile Photo Upload */}
          <div className="space-y-4">
            <h4 className="font-medium">Profile Photo (Optional)</h4>
            <div className="space-y-2">
              <Label>Profile Photo</Label>
              
              {!signatureData.photoUrl ? (
                // Upload button when no photo
                <ObjectUploader
                  maxFileSize={2097152} // 2MB
                  onGetUploadParameters={() => handleImageUpload('photo')}
                  onComplete={(result) => handleImageUploadComplete('photo', result)}
                  buttonClassName="w-full"
                >
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    {isUploading === 'photo' ? 'Uploading...' : 'Upload Profile Photo'}
                  </div>
                </ObjectUploader>
              ) : (
                // Photo management when photo exists
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                      <img 
                        src={signatureData.photoUrl} 
                        alt="Profile" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Profile photo uploaded</p>
                      <p className="text-xs text-muted-foreground">This will appear in your email signature</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <ObjectUploader
                      maxFileSize={2097152} // 2MB
                      onGetUploadParameters={() => handleImageUpload('photo')}
                      onComplete={(result) => handleImageUploadComplete('photo', result)}
                      buttonClassName="flex-1"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <Camera className="h-4 w-4" />
                        {isUploading === 'photo' ? 'Uploading...' : 'Replace Photo'}
                      </div>
                    </ObjectUploader>
                    
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => updateField('photoUrl', '')}
                      className="flex-1"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Remove Photo
                    </Button>
                  </div>
                </div>
              )}
              
              <p className="text-xs text-muted-foreground">
                Optional: Add a professional headshot. Your signature will look great with or without a photo.
              </p>
            </div>
          </div>

          <Separator />

        </TabsContent>

        <TabsContent value="html" className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="htmlSignature">
              Paste your existing HTML signature
            </Label>
            <Textarea
              id="htmlSignature"
              value={htmlSignatureText}
              onChange={(e) => setHtmlSignatureText(e.target.value)}
              placeholder="<table>...</table> or any HTML signature code"
              className="min-h-[200px] font-mono text-sm"
              rows={10}
            />
            <p className="text-sm text-muted-foreground">
              Paste the complete HTML code for your signature. This is perfect for company-wide signature templates.
            </p>
          </div>
        </TabsContent>

        {/* Save Button - Outside tabs so it's always visible */}
        <div className="mt-6">
          <Button onClick={handleSave} className="w-full">
            Save Email Signature
          </Button>
        </div>

        {/* Live Preview - Simplified */}
        <div className="mt-6">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Eye className="h-5 w-5" />
            Live Preview
          </h3>
          <div 
            className="p-4 bg-gray-50 border border-gray-200 rounded-md"
            dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
          />
        </div>
      </Tabs>
    </div>
  );
}