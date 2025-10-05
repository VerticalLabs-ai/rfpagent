import type { z } from 'zod';
import { insertPortalSchema } from '@shared/schema';

export type PortalFormData = z.infer<typeof insertPortalSchema>;

export interface Portal {
  id: string;
  name: string;
  url: string;
  type: string;
  isActive: boolean;
  lastScanned?: Date;
  status?: string;
  username?: string;
  password?: string;
  scanFrequency?: number;
  monitoringEnabled?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PortalActivity {
  portalId: string;
  timestamp: Date;
  type: string;
  status: string;
  details?: string;
}

export interface MonitoringStatus {
  totalPortals: number;
  activePortals: number;
  runningScans: number;
  lastScanTime?: Date;
  nextScheduledScan?: Date;
  systemHealth: 'healthy' | 'warning' | 'error';
}

export interface Discovery {
  id: string;
  portalId: string;
  portalName: string;
  title: string;
  description?: string;
  discoveredAt: Date;
  status: string;
  rfpUrl?: string;
}

export interface ScanState {
  status: 'idle' | 'scanning' | 'completed' | 'error';
  progress?: number;
  currentStep?: string;
  rfpsFound?: number;
  error?: string;
}
