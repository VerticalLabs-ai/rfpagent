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
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { RFPProcessingProgressModal } from './RFPProcessingProgress';
import { Plus, Trash2, DollarSign, FileText, CheckSquare } from 'lucide-react';

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
  onComplete
}: SubmissionMaterialsDialogProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('settings');
  const [progressSessionId, setProgressSessionId] = useState<string | null>(null);
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);

  // Form state
  const [companyProfileId, setCompanyProfileId] = useState('');
  const [generateCompliance, setGenerateCompliance] = useState(true);
  const [generatePricing, setGeneratePricing] = useState(true);
  const [autoSubmit, setAutoSubmit] = useState(false);
  const [customInstructions, setCustomInstructions] = useState('');

  // Pricing data state
  const [pricingItems, setPricingItems] = useState<PricingItem[]>([
    { name: 'Water Bottles', category: 'Beverages', unitPrice: 4.50, unit: 'case', margin: 40, notes: 'Example: Water bottles at $4.50 per case' }
  ]);
  const [defaultMargin, setDefaultMargin] = useState(40);
  const [laborRate, setLaborRate] = useState(75.00);
  const [overheadRate, setOverheadRate] = useState(25.00);

  // Fetch company profiles for selection
  const { data: companyProfiles } = useQuery({
    queryKey: ['/api/company-profiles'],
    queryFn: async () => {
      const response = await fetch('/api/company-profiles');
      if (!response.ok) throw new Error('Failed to fetch company profiles');
      return response.json();
    },
  });

  // Mutation for generating submission materials
  const generateMaterialsMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', `/api/proposals/${rfpId}/submission-materials`, data);
      return await response.json();
    },
    onSuccess: (data) => {
      console.log('Submission materials generation response:', data);

      if (data.success && data.data.sessionId) {
        // Show progress modal
        setProgressSessionId(data.data.sessionId);
        setProgressDialogOpen(true);
        onOpenChange(false);

        toast({
          title: "Submission Materials Generation Started",
          description: "AI agents are creating your complete submission package. You can track progress in real-time.",
        });
      } else {
        toast({
          title: "Generation Failed",
          description: data.error || "Failed to start submission materials generation.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error?.message || "Failed to generate submission materials. Please try again.",
        variant: "destructive",
      });
    },
  });

  const addPricingItem = () => {
    setPricingItems([...pricingItems, {
      name: '',
      category: '',
      unitPrice: 0,
      unit: '',
      margin: defaultMargin
    }]);
  };

  const removePricingItem = (index: number) => {
    setPricingItems(pricingItems.filter((_, i) => i !== index));
  };

  const updatePricingItem = (index: number, field: keyof PricingItem, value: any) => {
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
        overheadRate
      },
      generateCompliance,
      generatePricing,
      autoSubmit,
      customInstructions: customInstructions || undefined
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
                      onChange={(e) => setCompanyProfileId(e.target.value)}
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
                      <Label htmlFor="generate-compliance">Generate Compliance Checklist</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="generate-pricing"
                        checked={generatePricing}
                        onCheckedChange={setGeneratePricing}
                      />
                      <Label htmlFor="generate-pricing">Generate Pricing Tables</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="auto-submit"
                        checked={autoSubmit}
                        onCheckedChange={setAutoSubmit}
                      />
                      <Label htmlFor="auto-submit">Auto-Submit When Ready</Label>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="custom-instructions">Custom Instructions</Label>
                    <Textarea
                      id="custom-instructions"
                      placeholder="Add any special requirements, emphasis points, or custom instructions for the AI agents..."
                      value={customInstructions}
                      onChange={(e) => setCustomInstructions(e.target.value)}
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
                        onChange={(e) => setDefaultMargin(Number(e.target.value))}
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
                        onChange={(e) => setLaborRate(Number(e.target.value))}
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
                        onChange={(e) => setOverheadRate(Number(e.target.value))}
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
                        <div key={index} className="grid grid-cols-12 gap-2 items-end p-3 border rounded-lg">
                          <div className="col-span-3">
                            <Label className="text-xs">Item Name</Label>
                            <Input
                              placeholder="e.g., Water Bottles"
                              value={item.name}
                              onChange={(e) => updatePricingItem(index, 'name', e.target.value)}
                              size="sm"
                            />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Category</Label>
                            <Input
                              placeholder="e.g., Beverages"
                              value={item.category}
                              onChange={(e) => updatePricingItem(index, 'category', e.target.value)}
                              size="sm"
                            />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Unit Price ($)</Label>
                            <Input
                              type="number"
                              placeholder="4.50"
                              value={item.unitPrice || ''}
                              onChange={(e) => updatePricingItem(index, 'unitPrice', Number(e.target.value))}
                              min="0"
                              step="0.01"
                              size="sm"
                            />
                          </div>
                          <div className="col-span-1">
                            <Label className="text-xs">Unit</Label>
                            <Input
                              placeholder="case"
                              value={item.unit}
                              onChange={(e) => updatePricingItem(index, 'unit', e.target.value)}
                              size="sm"
                            />
                          </div>
                          <div className="col-span-1">
                            <Label className="text-xs">Margin (%)</Label>
                            <Input
                              type="number"
                              value={item.margin || defaultMargin}
                              onChange={(e) => updatePricingItem(index, 'margin', Number(e.target.value))}
                              min="0"
                              max="100"
                              size="sm"
                            />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Notes</Label>
                            <Input
                              placeholder="Optional notes"
                              value={item.notes || ''}
                              onChange={(e) => updatePricingItem(index, 'notes', e.target.value)}
                              size="sm"
                            />
                          </div>
                          <div className="col-span-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
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
                        <p className="text-sm">Add items to generate accurate pricing tables</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="review" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CheckSquare className="w-4 h-4" />
                    Generation Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-sm mb-2">Settings</h4>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>Company Profile: {companyProfileId ? 'Custom Profile' : 'Default Profile'}</p>
                        <p>Generate Compliance: {generateCompliance ? 'Yes' : 'No'}</p>
                        <p>Generate Pricing: {generatePricing ? 'Yes' : 'No'}</p>
                        <p>Auto-Submit: {autoSubmit ? 'Yes' : 'No'}</p>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm mb-2">Pricing Items</h4>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>{pricingItems.length} pricing items configured</p>
                        <p>Default Margin: {defaultMargin}%</p>
                        <p>Labor Rate: ${laborRate}/hour</p>
                        <p>Overhead Rate: {overheadRate}%</p>
                      </div>
                    </div>
                  </div>

                  {customInstructions && (
                    <div>
                      <h4 className="font-medium text-sm mb-2">Custom Instructions</h4>
                      <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                        {customInstructions}
                      </p>
                    </div>
                  )}

                  <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">What will be generated:</h4>
                    <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                      <li>• Complete technical proposal with AI-generated content</li>
                      <li>• Detailed pricing schedules and tables</li>
                      <li>• Compliance checklist with risk assessment</li>
                      <li>• Executive summary and company qualifications</li>
                      <li>• Ready-to-submit documents in PDF format</li>
                      <li>• Real-time progress tracking with Mastra agents</li>
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
          onComplete={(data: any) => {
            setProgressDialogOpen(false);
            setProgressSessionId(null);
            queryClient.invalidateQueries({ queryKey: ['/api/rfps', rfpId] });

            if (onComplete) {
              onComplete(data);
            }

            toast({
              title: "Submission Materials Complete",
              description: "Your complete submission package has been generated and is ready for review.",
            });
          }}
          onError={(error: string) => {
            setProgressDialogOpen(false);
            setProgressSessionId(null);

            toast({
              title: "Generation Failed",
              description: error,
              variant: "destructive",
            });
          }}
        />
      )}
    </>
  );
}