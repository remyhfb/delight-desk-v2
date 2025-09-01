import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function StatsCards() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['/api/dashboard/stats/user1'], // TODO: Replace with actual user ID
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {[
          { title: "Emails Today", value: "0", icon: "fas fa-envelope", color: "text-primary" },
          { title: "Auto-Resolved", value: "0", icon: "fas fa-robot", color: "text-green-600" },
          { title: "Escalated", value: "0", icon: "fas fa-exclamation-triangle", color: "text-yellow-600" },
          { title: "Success Rate", value: "0%", icon: "fas fa-percentage", color: "text-blue-600" },
        ].map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <i className={`${stat.icon} text-xl ${stat.color}`}></i>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dt className="text-sm font-medium text-gray-500 truncate">{stat.title}</dt>
                  <dd className="text-lg font-semibold text-gray-900">{stat.value}</dd>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statsData = [
    { title: "Emails Today", value: (stats as any)?.emailsToday?.toString() || "0", icon: "fas fa-envelope", color: "text-primary" },
    { title: "Auto-Resolved", value: (stats as any)?.autoResolved?.toString() || "0", icon: "fas fa-robot", color: "text-green-600" },
    { title: "Escalated", value: (stats as any)?.escalated?.toString() || "0", icon: "fas fa-exclamation-triangle", color: "text-yellow-600" },
    { title: "Success Rate", value: `${(stats as any)?.successRate || 0}%`, icon: "fas fa-percentage", color: "text-blue-600" },
  ];

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
      {statsData.map((stat) => (
        <Card key={stat.title}>
          <CardContent className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <i className={`${stat.icon} text-xl ${stat.color}`}></i>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dt className="text-sm font-medium text-gray-500 truncate">{stat.title}</dt>
                <dd className="text-lg font-semibold text-gray-900">{stat.value}</dd>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
