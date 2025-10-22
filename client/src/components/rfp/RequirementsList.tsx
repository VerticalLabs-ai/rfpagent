import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RequirementsListProps } from './types';

export function RequirementsList({ requirements }: RequirementsListProps) {
  if (requirements.length === 0) {
    return null;
  }

  return (
    <Card data-testid="card-requirements">
      <CardHeader>
        <CardTitle>Requirements</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {requirements.map((requirement, index) => (
            <li
              key={index}
              className="flex items-start gap-2"
              data-testid={`requirement-${index}`}
            >
              <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
              <span className="text-sm">{requirement}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
