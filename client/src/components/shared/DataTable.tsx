import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "./EmptyState";
import { LoadingCards } from "./LoadingCards";

interface Column<T> {
  key: keyof T;
  header: string;
  render?: (value: any, item: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  title?: string;
  titleIcon?: string;
  data: T[];
  columns: Column<T>[];
  isLoading?: boolean;
  emptyState?: {
    icon: string;
    title: string;
    description: string;
    action?: {
      label: string;
      onClick: () => void;
    };
  };
  keyExtractor: (item: T) => string;
  className?: string;
  testId?: string;
}

export function DataTable<T>({
  title,
  titleIcon,
  data,
  columns,
  isLoading = false,
  emptyState,
  keyExtractor,
  className = "",
  testId
}: DataTableProps<T>) {
  if (isLoading) {
    return <LoadingCards count={3} variant="list" />;
  }

  if (!data || data.length === 0) {
    return emptyState ? (
      <EmptyState
        icon={emptyState.icon}
        title={emptyState.title}
        description={emptyState.description}
        action={emptyState.action}
      />
    ) : null;
  }

  return (
    <Card className={className}>
      {title && (
        <CardHeader>
          <CardTitle className="flex items-center">
            {titleIcon && <i className={`${titleIcon} mr-2`}></i>}
            {title}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div className="space-y-4" data-testid={testId}>
          {data.map((item) => (
            <div
              key={keyExtractor(item)}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              {columns.map((column) => (
                <div key={String(column.key)} className={column.className}>
                  {column.render ?
                    column.render(item[column.key], item) :
                    String(item[column.key] || '')
                  }
                </div>
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}