import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ComplianceChecklistProps } from './types';

export function ComplianceChecklist({
  complianceItems,
}: ComplianceChecklistProps) {
  if (complianceItems.length === 0) {
    return null;
  }

  return (
    <Card data-testid="card-compliance">
      <CardHeader>
        <CardTitle>Compliance Checklist</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {complianceItems.map((item, index) => (
            <li
              key={index}
              className="flex items-start gap-2"
              data-testid={`compliance-${index}`}
            >
              <CheckCircle2 className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
              <span className="text-sm">
                {typeof item === 'string' ? item : item.item}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
