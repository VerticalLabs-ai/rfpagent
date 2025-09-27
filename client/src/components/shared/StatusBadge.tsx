import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: string;
  variant?: "default" | "secondary" | "destructive" | "outline";
  className?: string;
  testId?: string;
}

export function StatusBadge({ status, variant, className, testId }: StatusBadgeProps) {
  const getVariant = () => {
    if (variant) return variant;

    switch (status.toLowerCase()) {
      case "active":
      case "completed":
      case "success":
        return "default";
      case "error":
      case "failed":
      case "inactive":
        return "destructive";
      case "pending":
      case "processing":
      case "discovered":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getStatusColor = () => {
    switch (status.toLowerCase()) {
      case "active":
        return "bg-green-100 text-green-700";
      case "error":
      case "failed":
        return "bg-red-100 text-red-700";
      case "pending":
        return "bg-yellow-100 text-yellow-700";
      case "completed":
        return "bg-blue-100 text-blue-700";
      default:
        return "";
    }
  };

  return (
    <Badge
      variant={getVariant()}
      className={`${getStatusColor()} ${className}`}
      data-testid={testId}
    >
      {status}
    </Badge>
  );
}