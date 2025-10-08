import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { EditPortalForm } from './EditPortalForm';
import { MonitoringConfigForm } from './MonitoringConfigForm';
import type { Portal, PortalFormData } from './types';

interface PortalCardProps {
  portal: Portal;
  rfpCount: number;
  onUpdate: (data: Partial<PortalFormData>) => void;
  onScan: () => void;
  onDelete: () => void;
  onUpdateMonitoring: (data: any) => void;
  scanning?: boolean;
  deleting?: boolean;
  updatingMonitoring?: boolean;
}

export function PortalCard({
  portal,
  rfpCount,
  onUpdate,
  onScan,
  onDelete,
  onUpdateMonitoring,
  scanning = false,
  deleting = false,
  updatingMonitoring = false,
}: PortalCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'maintenance':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getLastScannedText = (
    lastScanned: Date | string | null | undefined
  ) => {
    if (!lastScanned) return 'Never scanned';

    const date = new Date(lastScanned);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    return `${Math.floor(diffMinutes / 1440)}d ago`;
  };

  return (
    <Card data-testid={`portal-card-${portal.id}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle
              className="flex items-center gap-2"
              data-testid={`portal-name-${portal.id}`}
            >
              {portal.name}
              <div
                className={`w-2 h-2 ${getStatusColor(portal.status || 'active')} rounded-full`}
                data-testid={`portal-status-indicator-${portal.id}`}
              ></div>
            </CardTitle>
            <p
              className="text-sm text-muted-foreground break-all"
              data-testid={`portal-url-${portal.id}`}
            >
              {portal.url}
            </p>
          </div>
          <Badge
            variant={portal.username ? 'default' : 'secondary'}
            data-testid={`portal-auth-badge-${portal.id}`}
          >
            {portal.username ? 'Auth Required' : 'Public'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Status:</span>
              <p
                className="font-medium capitalize"
                data-testid={`portal-status-text-${portal.id}`}
              >
                {portal.status || 'active'}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">RFPs Found:</span>
              <p
                className="font-medium"
                data-testid={`portal-rfp-count-${portal.id}`}
              >
                {rfpCount}
              </p>
            </div>
          </div>

          <div className="text-sm">
            <span className="text-muted-foreground">Last Scanned:</span>
            <p
              className="font-medium"
              data-testid={`portal-last-scanned-${portal.id}`}
            >
              {getLastScannedText(portal.lastScanned)}
            </p>
          </div>

          <div className="flex space-x-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onScan}
              disabled={scanning}
              data-testid={`scan-portal-${portal.id}`}
            >
              <i className="fas fa-search mr-2"></i>
              {scanning ? 'Scanning...' : 'Scan Now'}
            </Button>

            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid={`edit-portal-${portal.id}`}
                >
                  <i className="fas fa-edit mr-2"></i>
                  Edit
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Portal</DialogTitle>
                </DialogHeader>
                <EditPortalForm portal={portal} onSubmit={onUpdate} />
              </DialogContent>
            </Dialog>

            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid={`configure-monitoring-${portal.id}`}
                >
                  <i className="fas fa-chart-line mr-2"></i>
                  Monitor
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Monitoring Configuration</DialogTitle>
                </DialogHeader>
                <MonitoringConfigForm
                  portal={portal}
                  onSubmit={onUpdateMonitoring}
                  isLoading={updatingMonitoring}
                />
              </DialogContent>
            </Dialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleting}
                  data-testid={`delete-portal-${portal.id}`}
                >
                  <i className="fas fa-trash mr-2"></i>
                  {deleting ? 'Deleting...' : 'Delete'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Portal</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete &quot;{portal.name}&quot;?
                    This action will permanently remove the portal and all
                    associated RFPs, proposals, documents, and submissions. This
                    cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid={`cancel-delete-${portal.id}`}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    data-testid={`confirm-delete-${portal.id}`}
                  >
                    Delete Portal
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
