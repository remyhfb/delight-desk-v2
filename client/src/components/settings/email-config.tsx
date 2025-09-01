import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

export default function EmailConfig() {
  const { toast } = useToast();
  
  const { data: settings } = useQuery({
    queryKey: ['/api/settings/user1'], // TODO: Replace with actual user ID
  });

  const [emailProvider, setEmailProvider] = useState((settings as any)?.emailProvider || 'gmail');
  const [fromEmail, setFromEmail] = useState((settings as any)?.fromEmail || '');
  const [replyToEmail, setReplyToEmail] = useState((settings as any)?.replyToEmail || '');
  const [sendgridEnabled, setSendgridEnabled] = useState((settings as any)?.sendgridEnabled || false);

  const saveSettingsMutation = useMutation({
    mutationFn: async (settingsData: any) => {
      return apiRequest('PUT', '/api/settings/user1', settingsData); // TODO: Replace with actual user ID
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/user1'] });
      toast({
        title: "Settings saved",
        description: "Email configuration has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save email settings.",
        variant: "destructive",
      });
    },
  });

  const handleSaveSettings = () => {
    saveSettingsMutation.mutate({
      emailProvider,
      fromEmail,
      replyToEmail,
      sendgridEnabled,
    });
  };

  return (
    <div>
      <h4 className="text-md font-medium text-gray-900 mb-4">Email Provider Settings</h4>
      <div className="space-y-4">
        <div>
          <Label htmlFor="email-provider" className="text-sm font-medium text-gray-700">
            Primary Email Provider
          </Label>
          <Select value={emailProvider} onValueChange={setEmailProvider}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select email provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gmail">Gmail OAuth</SelectItem>
              <SelectItem value="outlook">Outlook OAuth</SelectItem>
              <SelectItem value="sendgrid">SendGrid SMTP</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="from-email" className="text-sm font-medium text-gray-700">
            From Email Address
          </Label>
          <Input
            id="from-email"
            type="email"
            className="mt-1"
            placeholder="support@humanfoodbar.com"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="reply-to-email" className="text-sm font-medium text-gray-700">
            Reply-To Address
          </Label>
          <Input
            id="reply-to-email"
            type="email"
            className="mt-1"
            placeholder="noreply@humanfoodbar.com"
            value={replyToEmail}
            onChange={(e) => setReplyToEmail(e.target.value)}
          />
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="enable-sendgrid"
            checked={sendgridEnabled}
            onCheckedChange={(checked) => setSendgridEnabled(checked as boolean)}
          />
          <Label htmlFor="enable-sendgrid" className="text-sm text-gray-900">
            Enable SendGrid for outbound emails
          </Label>
        </div>

        <Button 
          onClick={handleSaveSettings}
          disabled={saveSettingsMutation.isPending}
          className="w-full"
        >
          {saveSettingsMutation.isPending ? 'Saving...' : 'Save Email Settings'}
        </Button>
      </div>
    </div>
  );
}
