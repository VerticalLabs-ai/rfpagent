import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { FormWrapper } from '@/components/shared';
import type { Portal } from './types';

interface MonitoringConfig {
  scanFrequency: number;
  maxRfpsPerScan: number;
  selectors: any;
  filters: any;
}

interface MonitoringConfigFormProps {
  portal: Portal;
  onSubmit: (config: MonitoringConfig) => void;
  isLoading: boolean;
}

interface FormData {
  scanFrequency: string;
  maxRfpsPerScan: string;
  selectors: string;
  filters: string;
}

export function MonitoringConfigForm({
  portal,
  onSubmit,
  isLoading,
}: MonitoringConfigFormProps) {
  const form = useForm<FormData>({
    defaultValues: {
      scanFrequency: (portal.scanFrequency || 24).toString(),
      maxRfpsPerScan: '50',
      selectors: JSON.stringify(
        {
          rfpList: '.search-results',
          rfpItem: '.search-result-item',
          title: '.search-result-title a',
          agency: '.search-result-agency',
          deadline: '.search-result-deadline',
          link: '.search-result-title a',
          value: '.search-result-value',
          description: '.search-result-description',
        },
        null,
        2
      ),
      filters: JSON.stringify(
        {
          minValue: null,
          maxValue: null,
          keywords: [],
          excludeKeywords: [],
        },
        null,
        2
      ),
    },
  });

  const handleSubmit = (data: FormData) => {
    try {
      const config: MonitoringConfig = {
        scanFrequency: parseInt(data.scanFrequency),
        maxRfpsPerScan: parseInt(data.maxRfpsPerScan),
        selectors: JSON.parse(data.selectors),
        filters: JSON.parse(data.filters),
      };
      onSubmit(config);
    } catch (error) {
      console.error('Invalid JSON in configuration:', error);
    }
  };

  return (
    <FormWrapper
      form={form}
      onSubmit={handleSubmit}
      testId="monitoring-config-form"
      actions={[
        {
          label: isLoading ? 'Updating...' : 'Update Configuration',
          type: 'submit',
          icon: 'fas fa-save',
          loading: isLoading,
          testId: 'save-monitoring-config',
        },
      ]}
    >
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="scanFrequency"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Scan Frequency (Hours)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="1"
                  max="168"
                  {...field}
                  data-testid="scan-frequency-input"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="maxRfpsPerScan"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Max RFPs per Scan</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="1"
                  max="200"
                  {...field}
                  data-testid="max-rfps-input"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="selectors"
        render={({ field }) => (
          <FormItem>
            <FormLabel>CSS Selectors (JSON)</FormLabel>
            <FormControl>
              <Textarea
                placeholder="CSS selectors for scraping portal elements..."
                className="font-mono text-sm"
                rows={8}
                {...field}
                data-testid="selectors-input"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="filters"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Filter Configuration (JSON)</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Filter configuration for RFP discovery..."
                className="font-mono text-sm"
                rows={6}
                {...field}
                data-testid="filters-input"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </FormWrapper>
  );
}
