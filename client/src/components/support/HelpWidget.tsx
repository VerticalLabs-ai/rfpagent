import React, { useState } from 'react';
import {
  HelpCircle,
  X,
  ChevronRight,
  ChevronLeft,
  Mail,
  ExternalLink,
  MessageCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { helpTopics, faqItems, supportLinks, HelpTopic } from './HelpContent';
import { cn } from '@/lib/utils';

type View = 'main' | 'topic' | 'faq' | 'contact';

export function HelpWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<View>('main');
  const [selectedTopic, setSelectedTopic] = useState<HelpTopic | null>(null);

  const handleTopicClick = (topic: HelpTopic) => {
    setSelectedTopic(topic);
    setView('topic');
  };

  const handleBack = () => {
    setView('main');
    setSelectedTopic(null);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={cn(
            'fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg z-50',
            'bg-primary text-primary-foreground hover:bg-primary/90',
            'transition-transform hover:scale-105'
          )}
          aria-label="Help and Support"
        >
          <HelpCircle className="h-6 w-6" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="w-80 p-0 mb-2"
        sideOffset={8}
      >
        <div className="flex flex-col h-[400px]">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            {view !== 'main' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="p-0 h-auto"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            <h3 className={cn('font-semibold', view === 'main' && 'flex-1')}>
              {view === 'main' && 'Help & Support'}
              {view === 'topic' && selectedTopic?.title}
              {view === 'faq' && 'FAQ'}
              {view === 'contact' && 'Contact Support'}
            </h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1">
            {view === 'main' && (
              <div className="p-4 space-y-4">
                {/* Quick Help Topics */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Quick Help
                  </h4>
                  <div className="space-y-1">
                    {helpTopics.map(topic => (
                      <Button
                        key={topic.id}
                        variant="ghost"
                        className="w-full justify-between h-auto py-2"
                        onClick={() => handleTopicClick(topic)}
                      >
                        <span className="flex items-center gap-2">
                          {topic.icon}
                          {topic.title}
                        </span>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    ))}
                  </div>
                </div>

                {/* FAQ Link */}
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => setView('faq')}
                >
                  <span className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    Frequently Asked Questions
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>

                {/* Contact Support */}
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => setView('contact')}
                >
                  <span className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Contact Support
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {view === 'topic' && selectedTopic && (
              <div className="p-4">{selectedTopic.content}</div>
            )}

            {view === 'faq' && (
              <Accordion type="single" collapsible className="px-4">
                {faqItems.map((item, index) => (
                  <AccordionItem key={index} value={`faq-${index}`}>
                    <AccordionTrigger className="text-sm text-left">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}

            {view === 'contact' && (
              <div className="p-4 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Need help? We&apos;re here for you.
                </p>

                <div className="space-y-2">
                  <a
                    href={`mailto:${supportLinks.email}`}
                    className="flex items-center gap-2 p-3 rounded-md border hover:bg-muted transition-colors"
                  >
                    <Mail className="h-4 w-4" />
                    <div>
                      <div className="text-sm font-medium">Email Support</div>
                      <div className="text-xs text-muted-foreground">
                        {supportLinks.email}
                      </div>
                    </div>
                  </a>

                  <a
                    href={supportLinks.documentation}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 rounded-md border hover:bg-muted transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <div>
                      <div className="text-sm font-medium">Documentation</div>
                      <div className="text-xs text-muted-foreground">
                        Browse our guides
                      </div>
                    </div>
                  </a>

                  <a
                    href={supportLinks.status}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 rounded-md border hover:bg-muted transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <div>
                      <div className="text-sm font-medium">System Status</div>
                      <div className="text-xs text-muted-foreground">
                        Check service health
                      </div>
                    </div>
                  </a>
                </div>
              </div>
            )}
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
