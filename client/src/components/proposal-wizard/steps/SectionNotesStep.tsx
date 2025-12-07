import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { FileText, Lightbulb } from 'lucide-react';
import { useWizard } from '../context';

const SECTION_TIPS: Record<string, string> = {
  executiveSummary:
    'Highlight your unique value proposition and why your company is the best fit for this RFP.',
  companyOverview:
    'Include years of experience, key achievements, and relevant past performance.',
  technicalApproach:
    'Describe your methodology, tools, and how you will meet the technical requirements.',
  qualifications:
    'List relevant certifications, team expertise, and similar project experience.',
  timeline:
    'Provide key milestones, deliverable dates, and any phased approach you plan to use.',
  pricing:
    'Note any pricing constraints, preferred payment terms, or cost optimization strategies.',
  compliance:
    'Mention any certifications or documentation you have ready to demonstrate compliance.',
};

export function SectionNotesStep() {
  const { state, dispatch } = useWizard();

  const handleNotesChange = (sectionId: string, notes: string) => {
    dispatch({ type: 'UPDATE_SECTION_NOTES', payload: { sectionId, notes } });
  };

  const selectedRequirements = state.requirements.filter(r => r.selected);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Add Section Notes</h2>
        <p className="text-muted-foreground">
          Provide custom input for each proposal section. The AI will
          incorporate your notes during generation.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Section Notes */}
        <div className="lg:col-span-2">
          <ScrollArea className="h-[450px] pr-4">
            <Accordion
              type="multiple"
              defaultValue={state.sections.map(s => s.id)}
              className="space-y-3"
            >
              {state.sections.map(section => (
                <AccordionItem
                  key={section.id}
                  value={section.id}
                  className="border rounded-lg px-4"
                >
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{section.displayName}</span>
                      {section.userNotes && (
                        <Badge variant="secondary" className="text-xs">
                          Has notes
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 space-y-3">
                    {SECTION_TIPS[section.id] && (
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-sm">
                        <Lightbulb className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                        <p className="text-muted-foreground">
                          {SECTION_TIPS[section.id]}
                        </p>
                      </div>
                    )}
                    <div>
                      <Label
                        htmlFor={`notes-${section.id}`}
                        className="text-xs text-muted-foreground"
                      >
                        Custom notes for {section.displayName}
                      </Label>
                      <Textarea
                        id={`notes-${section.id}`}
                        placeholder={`Add any specific points, key messages, or custom content you want included in the ${section.displayName}...`}
                        value={section.userNotes}
                        onChange={e =>
                          handleNotesChange(section.id, e.target.value)
                        }
                        className="mt-1 min-h-[100px]"
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </ScrollArea>
        </div>

        {/* Selected Requirements Summary */}
        <div>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Selected Requirements ({selectedRequirements.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[380px]">
                <div className="space-y-2">
                  {selectedRequirements.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No requirements selected
                    </p>
                  ) : (
                    selectedRequirements.map(req => (
                      <div
                        key={req.id}
                        className="p-2 text-xs border rounded bg-muted/30"
                      >
                        <p className="line-clamp-2">{req.text}</p>
                        <Badge variant="outline" className="mt-1 text-[10px]">
                          {req.section}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
