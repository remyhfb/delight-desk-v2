import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function SystemStatus() {
  const { data: connections, isLoading } = useQuery({
    queryKey: ['/api/test-connections/user1'], // TODO: Replace with actual user ID
  });

  const getStatusBadge = (connected: boolean) => {
    return connected ? (
      <Badge variant="secondary" className="bg-green-100 text-green-800">Connected</Badge>
    ) : (
      <Badge variant="outline" className="bg-gray-100 text-gray-800">Not Connected</Badge>
    );
  };

  const services = [
    { name: 'Gmail OAuth', icon: 'fab fa-google text-red-500', key: 'gmail' },
    { name: 'Outlook OAuth', icon: 'fab fa-microsoft text-blue-500', key: 'outlook' },
    { name: 'WooCommerce', icon: 'fab fa-wordpress text-blue-600', key: 'woocommerce' },
    { name: 'Shopify', icon: 'fab fa-shopify text-green-500', key: 'shopify' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Status</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {services.map((service) => (
              <div key={service.key} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <i className={service.icon}></i>
                  <span className="text-sm text-gray-900">{service.name}</span>
                </div>
                <Skeleton className="h-5 w-20" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {services.map((service) => (
              <div key={service.key} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <i className={service.icon}></i>
                  <span className="text-sm text-gray-900">{service.name}</span>
                </div>
                {getStatusBadge((connections as any)?.[service.key] || false)}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
