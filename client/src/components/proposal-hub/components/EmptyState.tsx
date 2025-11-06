import { FileText, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface EmptyStateProps {
  onGenerate: () => void;
  isGenerating?: boolean;
}

export function EmptyState({ onGenerate, isGenerating }: EmptyStateProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 px-6">
        <div className="rounded-full bg-muted p-6 mb-6">
          <FileText className="w-12 h-12 text-muted-foreground" />
        </div>

        <h3 className="text-2xl font-bold mb-2">No Proposals Yet</h3>

        <p className="text-muted-foreground text-center mb-6 max-w-md">
          Generate your first AI-powered proposal for this RFP. Our intelligent
          agents will analyze requirements and create a comprehensive, compliant
          response.
        </p>

        <Button
          onClick={onGenerate}
          disabled={isGenerating}
          size="lg"
          className="gap-2"
        >
          <Wand2 className="w-5 h-5" />
          Generate Proposal
        </Button>

        <div className="mt-8 grid grid-cols-3 gap-6 text-center text-sm text-muted-foreground max-w-2xl">
          <div>
            <div className="font-semibold text-foreground mb-1">AI-Powered</div>
            <div>
              Uses GPT-5 and Claude 4.5 for intelligent content generation
            </div>
          </div>
          <div>
            <div className="font-semibold text-foreground mb-1">Compliant</div>
            <div>Automatically checks against all RFP requirements</div>
          </div>
          <div>
            <div className="font-semibold text-foreground mb-1">Editable</div>
            <div>Review, edit, and refine with AI assistance</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
