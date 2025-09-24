import { Link } from "wouter";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { RFPHeaderProps } from "./types";

const getStatusColor = (status: string) => {
  switch (status) {
    case "discovered": return "bg-blue-500 text-white dark:bg-blue-600 dark:text-blue-100";
    case "parsing": return "bg-yellow-500 text-white dark:bg-yellow-600 dark:text-yellow-100";
    case "drafting": return "bg-orange-500 text-white dark:bg-orange-600 dark:text-orange-100";
    case "review": return "bg-purple-500 text-white dark:bg-purple-600 dark:text-purple-100";
    case "approved": return "bg-green-500 text-white dark:bg-green-600 dark:text-green-100";
    case "submitted": return "bg-gray-500 text-white dark:bg-gray-600 dark:text-gray-100";
    case "closed": return "bg-red-500 text-white dark:bg-red-600 dark:text-red-100";
    default: return "bg-gray-500 text-white dark:bg-gray-600 dark:text-gray-100";
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case "discovered": return "Discovered";
    case "parsing": return "Parsing";
    case "drafting": return "Drafting";
    case "review": return "Under Review";
    case "approved": return "Approved";
    case "submitted": return "Submitted";
    case "closed": return "Closed";
    default: return status;
  }
};

export function RFPHeader({ rfp }: RFPHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-4">
        <Link href="/discovery">
          <Button variant="ghost" size="sm" data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to RFPs
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-rfp-title">
            {rfp.title}
          </h1>
          <p className="text-muted-foreground" data-testid="text-rfp-agency">
            {rfp.agency}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Badge
          className={getStatusColor(rfp.status)}
          data-testid="badge-status"
        >
          {getStatusLabel(rfp.status)}
        </Badge>
        <Button
          onClick={() => window.open(rfp.sourceUrl, '_blank', 'noopener,noreferrer')}
          variant="outline"
          data-testid="button-view-original"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          View Original RFP
        </Button>
      </div>
    </div>
  );
}