import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AutoResponderRules() {
  const { toast } = useToast();
  

  
  const { data: rules, isLoading } = useQuery({
    queryKey: ['/api/auto-responder-rules/user1'], // TODO: Replace with actual user ID
  });

  const toggleRuleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest('PUT', `/api/auto-responder-rules/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auto-responder-rules/user1'] });
      toast({
        title: "Rule updated",
        description: "Auto-responder rule has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update auto-responder rule.",
        variant: "destructive",
      });
    },
  });

  const handleToggle = (id: string, currentState: boolean) => {
    toggleRuleMutation.mutate({ id, isActive: !currentState });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Auto-Responder Rules</CardTitle>
        <Button variant="outline" size="sm">
          Add Rule
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 border border-gray-200 rounded-md">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-6 w-11" />
                  <Skeleton className="h-4 w-4" />
                </div>
              </div>
            ))}
          </div>
        ) : !rules || (rules as any[])?.length === 0 ? (
          <div className="text-center py-8">
            <i className="fas fa-robot text-4xl text-gray-300 mb-4"></i>
            <p className="text-gray-500">No auto-responder rules configured</p>
            <p className="text-sm text-gray-400">Create rules to automatically respond to common inquiries</p>
            <Button className="mt-4" variant="outline">
              Create First Rule
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {(rules as any[])?.map((rule: any) => (
              <div key={rule.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-md">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{rule.name}</p>
                  <p className="text-xs text-gray-500">{rule.description}</p>
                  <div className="mt-1 flex items-center space-x-2">
                    <Badge variant={rule.isActive ? "default" : "secondary"}>
                      {rule.isActive ? "Active" : "Disabled"}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {rule.triggerCount || 0} triggers today
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={rule.isActive}
                    onCheckedChange={() => handleToggle(rule.id, rule.isActive)}
                    disabled={toggleRuleMutation.isPending}
                  />
                  <Button variant="ghost" size="sm">
                    <i className="fas fa-edit"></i>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
