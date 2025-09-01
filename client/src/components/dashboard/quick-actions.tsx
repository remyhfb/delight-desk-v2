import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function QuickActions() {
  const { toast } = useToast();

  const processEmailsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/process-emails/user1', {}); // TODO: Replace with actual user ID
    },
    onSuccess: (response) => {
      toast({
        title: "Processing started",
        description: "Email queue processing has been initiated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start email processing.",
        variant: "destructive",
      });
    },
  });

  const testConnectionsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/test-connections/user1', {}); // TODO: Replace with actual user ID
    },
    onSuccess: () => {
      toast({
        title: "Connections tested",
        description: "All connection tests completed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to test connections.",
        variant: "destructive",
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <Button 
            className="w-full" 
            onClick={() => processEmailsMutation.mutate()}
            disabled={processEmailsMutation.isPending}
          >
            <i className="fas fa-play mr-2"></i>
            {processEmailsMutation.isPending ? 'Processing...' : 'Process Queue Now'}
          </Button>
          
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => testConnectionsMutation.mutate()}
            disabled={testConnectionsMutation.isPending}
          >
            <i className="fas fa-check-circle mr-2"></i>
            {testConnectionsMutation.isPending ? 'Testing...' : 'Test All Connections'}
          </Button>
          
          <Button variant="outline" className="w-full">
            <i className="fas fa-file-alt mr-2"></i>
            View System Logs
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
