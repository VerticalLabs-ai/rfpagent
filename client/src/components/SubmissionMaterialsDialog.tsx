import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { RFPProcessingProgressModal } from './RFPProcessingProgress';
import {
  Plus,
  Trash2,
  DollarSign,
  FileText,
  CheckSquare,
  Settings,
  Brain,
  Sparkles,
  Zap,
  Crown,
} from 'lucide-react';

// Quality level type for Claude-based generation
type ProposalQualityLevel = 'fast' | 'standard' | 'enhanced' | 'premium' | 'maximum';

// Quality level configuration with UI info
const qualityLevelOptions: Array<{
  value: ProposalQualityLevel;
  label: string;
  description: string;
  model: string;
  thinkingBudget: number | null;
  estimatedCost: string;
  estimatedTime: string;
  icon: React.ReactNode;
}> = [
  {
    value: 'fast',
    label: 'Quick Draft',
    description: 'Fast generation for initial drafts. No extended thinking.',
    model: 'Claude Sonnet 4.5',
    thinkingBudget: null,
    estimatedCost: '$0.10-0.30',
    estimatedTime: '15-30 seconds',
    icon: <Zap className="w-4 h-4" />,
  },
  {
    value: 'standard',
    label: 'Standard',
    description: 'Balanced quality with extended thinking for better reasoning.',
    model: 'Claude Sonnet 4.5',
    thinkingBudget: 10000,
    estimatedCost: '$0.50-1.00',
    estimatedTime: '1-2 minutes',
    icon: <FileText className="w-4 h-4" />,
  },
  {
    value: 'enhanced',
    label: 'Enhanced',
    description: 'Higher quality for important RFPs. Extended thinking.',
    model: 'Claude Sonnet 4.5',
    thinkingBudget: 16000,
    estimatedCost: '$1.00-2.00',
    estimatedTime: '2-4 minutes',
    icon: <Sparkles className="w-4 h-4" />,
  },
  {
    value: 'premium',
    label: 'Premium',
    description: 'Premium quality using Opus 4.5 for high-value contracts.',
    model: 'Claude Opus 4.5',
    thinkingBudget: 24000,
    estimatedCost: '$5.00-10.00',
    estimatedTime: '4-8 minutes',
    icon: <Brain className="w-4 h-4" />,
  },
  {
    value: 'maximum',
    label: 'Maximum',
    description: 'Maximum quality for critical, high-stakes RFPs. Full thinking.',
    model: 'Claude Opus 4.5',
    thinkingBudget: 32000,
    estimatedCost: '$10.00-20.00',
    estimatedTime: '8-15 minutes',
    icon: <Crown className="w-4 h-4" />,
  },
];

interface PricingItem {
  name: string;
  category: string;
  unitPrice: number;
  unit: string;
  notes?: string;
  margin?: number;
}

interface SubmissionMaterialsDialogProps {
  rfpId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: (materials: any) => void;
}

export function SubmissionMaterialsDialog({
  rfpId,
  open,
  onOpenChange,
  onComplete,
}: SubmissionMaterialsDialogProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('settings');
  const [progressSessionId, setProgressSessionId] = useState<string | null>(
    null
  );
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);

  // Form state
  const [companyProfileId, setCompanyProfileId] = useState('');
  const [generateCompliance, setGenerateCompliance] = useState(true);
  const [generatePricing, setGeneratePricing] = useState(true);
  const [autoSubmit, setAutoSubmit] = useState(false);
  const [customInstructions, setCustomInstructions] = useState('');

  // Claude quality level state
  const [qualityLevel, setQualityLevel] = useState<ProposalQualityLevel>('standard');
  const [enableThinking, setEnableThinking] = useState(true);

  // Get current quality level info
  const currentQualityInfo = qualityLevelOptions.find(q => q.value === qualityLevel);

  // Pricing data state
  const [pricingItems, setPricingItems] = useState<PricingItem[]>([
    {
      name: 'Water Bottles',
      category: 'Beverages',
      unitPrice: 4.5,
      unit: 'case',
      margin: 40,
      notes: 'Example: Water bottles at $4.50 per case',
    },
  ]);
  const [defaultMargin, setDefaultMargin] = useState(40);
  const [laborRate, setLaborRate] = useState(75.0);
  const [overheadRate, setOverheadRate] = useState(25.0);

  // Fetch company profiles for selection
  const { data: companyProfiles } = useQuery({
    queryKey: ['/api/company/profiles'],
    queryFn: async () => {
      const response = await fetch('/api/company/profiles');
      if (!response.ok) throw new Error('Failed to fetch company profiles');
      return response.json();
    },
  });

  // Mutation for generating submission materials
  const generateMaterialsMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest(
        'POST',
        `/api/proposals/${rfpId}/submission-materials`,
        data
      );
      return await response.json();
    },
    onSuccess: data => {
      console.log('Submission materials generation response:', data);

      if (data.success && data.data.sessionId) {
        // Show progress modal
        setProgressSessionId(data.data.sessionId);
        setProgressDialogOpen(true);
        onOpenChange(false);

        toast({
          title: 'Submission Materials Generation Started',
          description:
            'AI agents are creating your complete submission package. You can track progress in real-time.',
        });
      } else {
        toast({
          title: 'Generation Failed',
          description:
            data.error || 'Failed to start submission materials generation.',
          variant: 'destructive',
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Generation Failed',
        description:
          error?.message ||
          'Failed to generate submission materials. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const addPricingItem = () => {
    setPricingItems([
      ...pricingItems,
      {
        name: '',
        category: '',
        unitPrice: 0,
        unit: '',
        margin: defaultMargin,
      },
    ]);
  };

  const removePricingItem = (index: number) => {
    setPricingItems(pricingItems.filter((_, i) => i !== index));
  };

  const updatePricingItem = (
    index: number,
    field: keyof PricingItem,
    value: any
  ) => {
    const updated = pricingItems.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    );
    setPricingItems(updated);
  };

  const handleGenerate = () => {
    const requestData = {
      companyProfileId: companyProfileId || undefined,
      pricingData: {
        items: pricingItems.filter(item => item.name && item.unitPrice > 0),
        defaultMargin,
        laborRate,
        overheadRate,
      },
      generateCompliance,
      generatePricing,
      autoSubmit,
      customInstructions: customInstructions || undefined,
      // Claude quality level options
      qualityLevel,
      enableThinking,
    };

    generateMaterialsMutation.mutate(requestData);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Generate Submission Materials
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="pricing">Pricing Data</TabsTrigger>
              <TabsTrigger value="review">Review & Generate</TabsTrigger>
            </TabsList>

            <TabsContent value="settings" className="space-y-6">
              {/* AI Quality Level Selection */}
              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Brain className="w-4 h-4 text-primary" />
                    AI Quality Level
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="quality-level">Select Quality Level</Label>
                    <Select
                      value={qualityLevel}
                      onValueChange={(value) => setQualityLevel(value as ProposalQualityLevel)}
                    >
                      <SelectTrigger className="w-full mt-1">
                        <SelectValue placeholder="Select quality level" />
                      </SelectTrigger>
                      <SelectContent>
                        {qualityLevelOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center gap-2">
                              {option.icon}
                              <span className="font-medium">{option.label}</span>
                              <span className="text-muted-foreground text-xs">({option.model})</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Quality Level Info Box */}
                  {currentQualityInfo && (
                    <div className="bg-muted/50 p-4 rounded-lg border border-border space-y-3">
                      <div className="flex items-center gap-2">
                        {currentQualityInfo.icon}
                        <span className="font-medium">{currentQualityInfo.label}</span>
                        {(qualityLevel === 'premium' || qualityLevel === 'maximum') && (
                          <Badge variant="secondary" className="text-xs bg-amber-500/10 text-amber-600">
                            Opus 4.5
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{currentQualityInfo.description}</p>
                      <div className="grid grid-cols-3 gap-4 text-xs">
                        <div>
                          <span className="text-muted-foreground">Model:</span>
                          <p className="font-medium">{currentQualityInfo.model}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Est. Cost:</span>
                          <p className="font-medium">{currentQualityInfo.estimatedCost}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Est. Time:</span>
                          <p className="font-medium">{currentQualityInfo.estimatedTime}</p>
                        </div>
                      </div>
                      {currentQualityInfo.thinkingBudget && (
                        <div className="flex items-center gap-2 text-xs text-primary">
                          <Sparkles className="w-3 h-3" />
                          <span>Extended thinking enabled ({currentQualityInfo.thinkingBudget.toLocaleString()} budget tokens)</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Extended Thinking Toggle */}
                  <div className="flex items-center justify-between pt-2">
                    <div className="space-y-0.5">
                      <Label htmlFor="enable-thinking" className="flex items-center gap-2">
                        <Brain className="w-4 h-4" />
                        Enable Extended Thinking
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Uses Claude's thinking mode for deeper reasoning (recommended for quality proposals)
                      </p>
                    </div>
                    <Switch
                      id="enable-thinking"
                      checked={enableThinking}
                      onCheckedChange={setEnableThinking}
                      disabled={qualityLevel === 'fast'}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Generation Options</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="company-profile">Company Profile</Label>
                    <select
                      id="company-profile"
                      value={companyProfileId}
                      onChange={e => setCompanyProfileId(e.target.value)}
                      className="w-full mt-1 p-2 border rounded-md"
                    >
                      <option value="">Use Default Profile</option>
                      {companyProfiles?.map((profile: any) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.businessName} ({profile.businessType})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="generate-compliance"
                        checked={generateCompliance}
                        onCheckedChange={setGenerateCompliance}
                      />
                      <Label htmlFor="generate-compliance">
                        Generate Compliance Checklist
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="generate-pricing"
                        checked={generatePricing}
                        onCheckedChange={setGeneratePricing}
                      />
                      <Label htmlFor="generate-pricing">
                        Generate Pricing Tables
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="auto-submit"
                        checked={autoSubmit}
                        onCheckedChange={setAutoSubmit}
                      />
                      <Label htmlFor="auto-submit">
                        Auto-Submit When Ready
                      </Label>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="custom-instructions">
                      Custom Instructions
                    </Label>
                    <Textarea
                      id="custom-instructions"
                      placeholder="Add any special requirements, emphasis points, or custom instructions for the AI agents..."
                      value={customInstructions}
                      onChange={e => setCustomInstructions(e.target.value)}
                      className="mt-1"
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pricing" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Pricing Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="default-margin">Default Margin (%)</Label>
                      <Input
                        id="default-margin"
                        type="number"
                        value={defaultMargin}
                        onChange={e => setDefaultMargin(Number(e.target.value))}
                        min="0"
                        max="100"
                      />
                    </div>
                    <div>
                      <Label htmlFor="labor-rate">Labor Rate ($/hour)</Label>
                      <Input
                        id="labor-rate"
                        type="number"
                        value={laborRate}
                        onChange={e => setLaborRate(Number(e.target.value))}
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <Label htmlFor="overhead-rate">Overhead Rate (%)</Label>
                      <Input
                        id="overhead-rate"
                        type="number"
                        value={overheadRate}
                        onChange={e => setOverheadRate(Number(e.target.value))}
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium">Pricing Items</h3>
                      <Button type="button" size="sm" onClick={addPricingItem}>
                        <Plus className="w-4 h-4 mr-1" />
                        Add Item
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {pricingItems.map((item, index) => (
                        <div
                          key={index}
                          className="grid grid-cols-12 gap-2 items-end p-3 border rounded-lg"
                        >
                          <div className="col-span-3">
                            <Label className="text-xs">Item Name</Label>
                            <Input
                              placeholder="e.g., Water Bottles"
                              value={item.name}
                              onChange={e =>
                                updatePricingItem(index, 'name', e.target.value)
                              }
                            />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Category</Label>
                            <Input
                              placeholder="e.g., Beverages"
                              value={item.category}
                              onChange={e =>
                                updatePricingItem(
                                  index,
                                  'category',
                                  e.target.value
                                )
                              }
                            />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Unit Price ($)</Label>
                            <Input
                              type="number"
                              placeholder="4.50"
                              value={item.unitPrice || ''}
                              onChange={e =>
                                updatePricingItem(
                                  index,
                                  'unitPrice',
                                  Number(e.target.value)
                                )
                              }
                              min="0"
                              step="0.01"
                            />
                          </div>
                          <div className="col-span-1">
                            <Label className="text-xs">Unit</Label>
                            <Input
                              placeholder="case"
                              value={item.unit}
                              onChange={e =>
                                updatePricingItem(index, 'unit', e.target.value)
                              }
                            />
                          </div>
                          <div className="col-span-1">
                            <Label className="text-xs">Margin (%)</Label>
                            <Input
                              type="number"
                              value={item.margin || defaultMargin}
                              onChange={e =>
                                updatePricingItem(
                                  index,
                                  'margin',
                                  Number(e.target.value)
                                )
                              }
                              min="0"
                              max="100"
                            />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Notes</Label>
                            <Input
                              placeholder="Optional notes"
                              value={item.notes || ''}
                              onChange={e =>
                                updatePricingItem(
                                  index,
                                  'notes',
                                  e.target.value
                                )
                              }
                            />
                          </div>
                          <div className="col-span-1">
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => removePricingItem(index)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {pricingItems.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <DollarSign className="w-8 h-8 mx-auto mb-2" />
                        <p>No pricing items added yet</p>
                        <p className="text-sm">
                          Add items to generate accurate pricing tables
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="review" className="space-y-6">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <CheckSquare className="w-5 h-5" />
                    Generation Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm text-foreground flex items-center gap-2">
                        <Brain className="w-4 h-4" />
                        AI Quality
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Quality Level:
                          </span>
                          <span className="font-medium flex items-center gap-1">
                            {currentQualityInfo?.icon}
                            {currentQualityInfo?.label}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            AI Model:
                          </span>
                          <span className="font-medium">
                            {currentQualityInfo?.model}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Extended Thinking:
                          </span>
                          <span className="font-medium">
                            {enableThinking && qualityLevel !== 'fast' ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Est. Cost:
                          </span>
                          <span className="font-medium">
                            {currentQualityInfo?.estimatedCost}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm text-foreground flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        Settings
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Company Profile:
                          </span>
                          <span className="font-medium">
                            {companyProfileId
                              ? 'Custom Profile'
                              : 'Default Profile'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Generate Compliance:
                          </span>
                          <span className="font-medium">
                            {generateCompliance ? 'Yes' : 'No'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Generate Pricing:
                          </span>
                          <span className="font-medium">
                            {generatePricing ? 'Yes' : 'No'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Auto-Submit:
                          </span>
                          <span className="font-medium">
                            {autoSubmit ? 'Yes' : 'No'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm text-foreground flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Pricing Items
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Items configured:
                          </span>
                          <span className="font-medium">
                            {pricingItems.length}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Default Margin:
                          </span>
                          <span className="font-medium">{defaultMargin}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Labor Rate:
                          </span>
                          <span className="font-medium">${laborRate}/hour</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Overhead Rate:
                          </span>
                          <span className="font-medium">{overheadRate}%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {customInstructions && (
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm text-foreground flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Custom Instructions
                      </h4>
                      <div className="bg-muted/50 p-4 rounded-lg border border-border">
                        <p className="text-sm text-foreground leading-relaxed">
                          {customInstructions}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="bg-muted/50 p-4 rounded-lg border border-border">
                    <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      What will be generated:
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-2">
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        Complete technical proposal with AI-generated content
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        Detailed pricing schedules and tables
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        Compliance checklist with risk assessment
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        Executive summary and company qualifications
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        Ready-to-submit documents in PDF format
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        Real-time progress tracking with Mastra agents
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleGenerate}
                  disabled={generateMaterialsMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {generateMaterialsMutation.isPending ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Generating...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Generate Submission Materials
                    </div>
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Progress Modal */}
      {progressSessionId && (
        <RFPProcessingProgressModal
          sessionId={progressSessionId}
          open={progressDialogOpen}
          onOpenChange={setProgressDialogOpen}
          endpoint={`/api/proposals/submission-materials/stream/${progressSessionId}`}
          onComplete={(data: any) => {
            setProgressDialogOpen(false);
            setProgressSessionId(null);
            queryClient.invalidateQueries({ queryKey: ['/api/rfps', rfpId] });

            if (onComplete) {
              onComplete(data);
            }

            toast({
              title: 'Submission Materials Complete',
              description:
                'Your complete submission package has been generated and is ready for review.',
            });
          }}
          onError={(error: string) => {
            setProgressDialogOpen(false);
            setProgressSessionId(null);

            toast({
              title: 'Generation Failed',
              description: error,
              variant: 'destructive',
            });
          }}
        />
      )}
    </>
  );
}
