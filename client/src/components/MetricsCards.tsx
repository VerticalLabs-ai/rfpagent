import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function MetricsCards() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["/api/dashboard/metrics"],
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "Active RFPs",
      value: metrics?.activeRfps || 0,
      icon: "fas fa-file-contract",
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      change: "+12% from last week",
      changeColor: "text-green-600",
      testId: "metric-active-rfps"
    },
    {
      title: "Win Rate",
      value: `${metrics?.winRate || 0}%`,
      icon: "fas fa-trophy",
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      change: "+8% from last month",
      changeColor: "text-green-600",
      testId: "metric-win-rate"
    },
    {
      title: "Avg Response Time",
      value: `${metrics?.avgResponseTime || 0}h`,
      icon: "fas fa-clock",
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
      change: "↓ 89% improvement",
      changeColor: "text-green-600",
      testId: "metric-response-time"
    },
    {
      title: "Revenue Pipeline",
      value: `$${((metrics?.totalValue || 0) / 1000000).toFixed(1)}M`,
      icon: "fas fa-dollar-sign",
      iconBg: "bg-yellow-100",
      iconColor: "text-yellow-600",
      change: "+43% growth",
      changeColor: "text-green-600",
      testId: "metric-revenue-pipeline"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {cards.map((card) => (
        <Card key={card.title} data-testid={card.testId}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                <p className="text-2xl font-bold text-foreground" data-testid={`${card.testId}-value`}>
                  {card.value}
                </p>
              </div>
              <div className={`w-12 h-12 ${card.iconBg} rounded-full flex items-center justify-center`}>
                <i className={`${card.icon} ${card.iconColor}`}></i>
              </div>
            </div>
            <p className={`text-xs ${card.changeColor} mt-2`} data-testid={`${card.testId}-change`}>
              {card.change}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
