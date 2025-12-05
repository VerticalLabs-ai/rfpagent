import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardMetrics } from '@/types/api';

export default function MetricsCards() {
  const { data: metrics, isLoading } = useQuery<DashboardMetrics>({
    queryKey: ['/api/dashboard/metrics'],
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {[1, 2, 3].map(i => (
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
      title: 'Active RFPs',
      value: metrics?.activeRfps || 0,
      icon: 'fas fa-file-contract',
      iconBg: 'bg-blue-900/30',
      iconColor: 'text-blue-400',
      change: `${metrics?.activeRfps || 0} opportunities found`,
      changeColor: 'text-blue-400',
      testId: 'metric-active-rfps',
    },
    {
      title: 'Portals Tracked',
      value: metrics?.portalsTracked || 0,
      icon: 'fas fa-globe',
      iconBg: 'bg-green-900/30',
      iconColor: 'text-green-400',
      change: 'Government procurement sites',
      changeColor: 'text-green-400',
      testId: 'metric-portals-tracked',
    },
    {
      title: 'Revenue Pipeline',
      value: `$${((metrics?.totalValue || 0) / 1000000).toFixed(1)}M`,
      icon: 'fas fa-dollar-sign',
      iconBg: 'bg-yellow-900/30',
      iconColor: 'text-yellow-400',
      change: 'Total estimated value',
      changeColor: 'text-yellow-400',
      testId: 'metric-revenue-pipeline',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      {cards.map(card => (
        <Card key={card.title} data-testid={card.testId}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </p>
                <p
                  className="text-2xl font-bold text-foreground"
                  data-testid={`${card.testId}-value`}
                >
                  {card.value}
                </p>
              </div>
              <div
                className={`w-12 h-12 ${card.iconBg} rounded-full flex items-center justify-center`}
              >
                <i className={`${card.icon} ${card.iconColor}`}></i>
              </div>
            </div>
            <p
              className={`text-xs ${card.changeColor} mt-2`}
              data-testid={`${card.testId}-change`}
            >
              {card.change}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
