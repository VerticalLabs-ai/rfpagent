import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RiskFlagsProps } from './types';

export function RiskFlags({ riskFlags }: RiskFlagsProps) {
  if (riskFlags.length === 0) {
    return null;
  }

  return (
    <Card data-testid="card-risks">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-500" />
          Risk Flags
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {riskFlags.map((risk, index) => (
            <li
              key={index}
              className="flex items-start gap-2"
              data-testid={`risk-${index}`}
            >
              <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
              <span className="text-sm">
                {typeof risk === 'string' ? risk : risk.flag}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
