import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface LoadingCardsProps {
  count?: number;
  variant?: "grid" | "list";
  cardHeight?: string;
}

export function LoadingCards({ count = 3, variant = "grid", cardHeight = "h-48" }: LoadingCardsProps) {
  const containerClass = variant === "grid"
    ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
    : "space-y-4";

  return (
    <div className={containerClass}>
      {Array.from({ length: count }, (_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-3/4" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}