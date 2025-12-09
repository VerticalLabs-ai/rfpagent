import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  BarChart3,
  Bot,
  Calendar,
  CheckSquare,
  Clock,
  Download,
  FileEdit,
  FileSearch,
  FileText,
  Lightbulb,
  Loader2,
  RefreshCcw,
  Search,
  Send,
  Trash2,
  TrendingUp,
  User,
} from 'lucide-react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  messageType: string;
  createdAt: Date;
}

interface ActionSuggestion {
  id: string;
  label: string;
  action: 'workflow' | 'agent' | 'tool' | 'navigation';
  priority: 'high' | 'medium' | 'low';
  estimatedTime: string;
  description: string;
  icon: string;
  payload?: Record<string, any>;
}

interface ChatResponse {
  conversationId: string;
  message: string;
  messageType:
    | 'text'
    | 'rfp_results'
    | 'search_results'
    | 'analysis'
    | 'follow_up';
  data?: any;
  followUpQuestions?: string[];
  actionSuggestions?: ActionSuggestion[];
  relatedRfps?: any[];
  researchFindings?: any[];
}

interface Conversation {
  id: string;
  title: string;
  type: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export default function AIChat() {
  const [inputValue, setInputValue] = useState('');
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);
  const { toast } = useToast();

  // Fetch user conversations
  const {
    data: conversations,
    isLoading: conversationsLoading,
    isError: conversationsError,
    error: conversationsErrorDetails,
  } = useQuery({
    queryKey: ['/api/ai/conversations'],
  });

  // Fetch current conversation history
  const {
    data: conversationHistory,
    refetch: refetchHistory,
    isLoading: historyLoading,
    isError: historyError,
  } = useQuery({
    queryKey: ['/api/ai/conversations', currentConversationId],
    enabled: !!currentConversationId,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: {
      query: string;
      conversationId?: string;
    }): Promise<ChatResponse> => {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json() as Promise<ChatResponse>;
    },
    onSuccess: response => {
      // Set the conversation ID in state if this is a new conversation
      if (response.conversationId && !currentConversationId) {
        setCurrentConversationId(response.conversationId);
      }

      // Use the response's conversationId directly for refetching
      // This avoids the race condition where currentConversationId hasn't updated yet
      const conversationIdToFetch = response.conversationId || currentConversationId;

      if (conversationIdToFetch) {
        // Invalidate the specific conversation query to trigger a refetch
        queryClient.invalidateQueries({
          queryKey: ['/api/ai/conversations', conversationIdToFetch]
        });
      }

      // Invalidate conversations list to update with new conversation
      queryClient.invalidateQueries({ queryKey: ['/api/ai/conversations'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send message',
        variant: 'destructive',
      });
    },
  });

  // Delete conversation mutation
  const deleteConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const response = await fetch(`/api/ai/conversations/${conversationId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: (_, conversationId) => {
      // If deleted conversation was currently selected, clear selection
      if (currentConversationId === conversationId) {
        setCurrentConversationId(null);
      }
      // Refetch conversations list
      queryClient.invalidateQueries({ queryKey: ['/api/ai/conversations'] });
      toast({
        title: 'Success',
        description: 'Conversation deleted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete conversation',
        variant: 'destructive',
      });
    },
  });

  // Execute action suggestion mutation
  const executeActionMutation = useMutation({
    mutationFn: async (data: {
      suggestionId: string;
      conversationId: string;
      suggestion: ActionSuggestion;
    }) => {
      const response = await fetch('/api/ai/execute-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: response => {
      toast({
        title: 'Action Executed',
        description: response.message || 'Action completed successfully',
      });
      // Refetch conversation history to show results
      refetchHistory();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to execute action',
        variant: 'destructive',
      });
    },
  });

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const messageContent = inputValue.trim();
    setInputValue('');

    try {
      await sendMessageMutation.mutateAsync({
        query: messageContent,
        conversationId: currentConversationId || undefined,
      });
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const startNewConversation = () => {
    setCurrentConversationId(null);
    queryClient.removeQueries({
      queryKey: ['/api/ai/conversations', currentConversationId],
    });
  };

  const selectConversation = (conversationId: string) => {
    setCurrentConversationId(conversationId);
    // The query will automatically refetch when currentConversationId changes
    // due to the query key dependency, so we don't need to manually refetch
  };

  const handleDeleteConversation = async (conversationId: string) => {
    if (
      window.confirm(
        'Are you sure you want to delete this conversation? This action cannot be undone.'
      )
    ) {
      await deleteConversationMutation.mutateAsync(conversationId);
    }
  };

  const getMessageIcon = (messageType: string) => {
    switch (messageType) {
      case 'rfp_results':
      case 'search_results':
        return <Search className="h-4 w-4" />;
      case 'analysis':
        return <FileText className="h-4 w-4" />;
      case 'follow_up':
        return <Lightbulb className="h-4 w-4" />;
      default:
        return <Bot className="h-4 w-4" />;
    }
  };

  const getSuggestionIcon = (iconName: string) => {
    const icons: Record<string, any> = {
      FileSearch: FileSearch,
      TrendingUp: TrendingUp,
      FileEdit: FileEdit,
      CheckSquare: CheckSquare,
      Calendar: Calendar,
      Download: Download,
      BarChart3: BarChart3,
      Search: Search,
      Clock: Clock,
      Bot: Bot,
      FileText: FileText,
      Lightbulb: Lightbulb,
    };
    const IconComponent = icons[iconName] || FileText;
    return <IconComponent className="h-4 w-4" />;
  };

  const getPriorityColor = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high':
        return 'border-red-200 bg-red-50 hover:bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200';
      case 'medium':
        return 'border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-800 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200';
      case 'low':
        return 'border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200';
      default:
        return 'border-border bg-muted hover:bg-muted/80';
    }
  };

  const handleActionClick = async (suggestion: ActionSuggestion) => {
    if (!currentConversationId) return;

    executeActionMutation.mutate({
      suggestionId: suggestion.id,
      conversationId: currentConversationId,
      suggestion,
    });
  };

  const renderMessageContent = (message: any) => {
    // Always render action suggestions and follow-up questions, regardless of message type
    const hasAdditionalContent =
      (message.followUpQuestions && message.followUpQuestions.length > 0) ||
      (message.actionSuggestions && message.actionSuggestions.length > 0);

    if (!hasAdditionalContent) {
      return null;
    }

    return (
      <div className="space-y-3 mt-3 border-t border-border pt-3">
        {message.followUpQuestions && message.followUpQuestions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">
              Follow-up questions:
            </h4>
            <div className="flex flex-wrap gap-2">
              {message.followUpQuestions.map(
                (question: string, index: number) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setInputValue(question)}
                    data-testid={`follow-up-question-${index}`}
                  >
                    {question}
                  </Button>
                )
              )}
            </div>
          </div>
        )}

        {message.actionSuggestions && message.actionSuggestions.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">
              Suggested Actions:
            </h4>
            <div className="grid gap-2">
              {message.actionSuggestions.map((suggestion: ActionSuggestion) => (
                <div
                  key={suggestion.id}
                  className={`p-3 rounded-lg border transition-colors cursor-pointer ${getPriorityColor(suggestion.priority)}`}
                  onClick={() => handleActionClick(suggestion)}
                  data-testid={`action-suggestion-${suggestion.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5">
                      {getSuggestionIcon(suggestion.icon)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h5 className="text-sm font-medium truncate">
                          {suggestion.label}
                        </h5>
                        <div className="flex items-center gap-1 text-xs opacity-75">
                          <Clock className="h-3 w-3" />
                          {suggestion.estimatedTime}
                        </div>
                      </div>
                      <p className="text-xs opacity-75 mt-1 line-clamp-2">
                        {suggestion.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge
                          variant="outline"
                          className="text-xs px-1.5 py-0.5"
                        >
                          {suggestion.action}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className={`text-xs px-1.5 py-0.5 ${
                            suggestion.priority === 'high'
                              ? 'bg-red-950 text-red-200 border-red-800'
                              : suggestion.priority === 'medium'
                                ? 'bg-orange-950 text-orange-200 border-orange-800'
                                : 'bg-blue-950 text-blue-200 border-blue-800'
                          }`}
                        >
                          {suggestion.priority}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  {executeActionMutation.isPending && (
                    <div className="flex items-center gap-2 mt-2 text-xs opacity-75">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Executing...
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {message.relatedRfps && message.relatedRfps.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">
              Related RFPs:
            </h4>
            <div className="space-y-1">
              {message.relatedRfps.map((rfp: any, index: number) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {rfp.title || rfp.name || `RFP ${index + 1}`}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Check if AI service appears to be down (conversations query failed)
  const aiServiceUnavailable = conversationsError && !conversationsLoading;

  return (
    <div className="flex h-full flex-col">
      {/* AI Service Status Banner */}
      {aiServiceUnavailable && (
        <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-3 shrink-0">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">
              AI service is currently unavailable. Some features may not work.
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto text-destructive hover:text-destructive"
              onClick={() =>
                queryClient.invalidateQueries({
                  queryKey: ['/api/ai/conversations'],
                })
              }
            >
              <RefreshCcw className="h-3 w-3 mr-2" />
              Retry Connection
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Conversations Sidebar */}
        <div className="w-80 border-r bg-card flex flex-col h-full">
          <div className="p-4 border-b shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">
                AI Conversations
              </h2>
              <Button
                size="sm"
                onClick={startNewConversation}
                data-testid="button-new-conversation"
              >
                New Chat
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-2">
              {conversationsLoading && (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Loading conversations...
                  </p>
                </div>
              )}

              {conversationsError && (
                <div className="p-2">
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Failed to load conversations</AlertTitle>
                    <AlertDescription className="mt-2">
                      <p className="text-sm mb-3">
                        {(conversationsErrorDetails as Error)?.message ||
                          'Unable to connect to AI service'}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          queryClient.invalidateQueries({
                            queryKey: ['/api/ai/conversations'],
                          })
                        }
                      >
                        <RefreshCcw className="h-3 w-3 mr-2" />
                        Retry
                      </Button>
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {!conversationsLoading &&
                !conversationsError &&
                (conversations as Conversation[])?.map(
                  (conversation: Conversation) => (
                    <Card
                      key={conversation.id}
                      className={`cursor-pointer transition-colors hover:bg-muted/30 ${
                        currentConversationId === conversation.id
                          ? 'ring-2 ring-primary'
                          : ''
                      }`}
                      onClick={() => selectConversation(conversation.id)}
                      data-testid={`conversation-card-${conversation.id}`}
                    >
                      <CardContent className="p-3">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-sm font-medium text-foreground line-clamp-2 leading-tight">
                              {conversation.title}
                            </h3>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive -mt-1 -mr-1"
                              onClick={e => {
                                e.stopPropagation();
                                handleDeleteConversation(conversation.id);
                              }}
                              title="Delete conversation"
                              data-testid={`button-delete-conversation-${conversation.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-1.5 h-5 font-normal"
                            >
                              {conversation.type}
                            </Badge>
                            <span>
                              {new Date(
                                conversation.updatedAt
                              ).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                )}

              {!conversationsLoading &&
                !conversationsError &&
                (!conversations ||
                  (conversations as Conversation[])?.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Bot className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No conversations yet</p>
                    <p className="text-xs">Start chatting with the AI agent</p>
                  </div>
                )}
            </div>
          </ScrollArea>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          <div className="border-b bg-card p-4">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback>
                  <Bot className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="font-semibold text-foreground">RFP AI Agent</h1>
                <p className="text-sm text-muted-foreground">
                  Ask me anything about RFPs, search for opportunities, or get
                  help with proposals
                </p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4" data-testid="chat-messages-area">
            <div className="space-y-4">
              {historyError && currentConversationId && (
                <div className="p-4">
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Failed to load conversation</AlertTitle>
                    <AlertDescription>
                      <p className="text-sm mb-3">
                        Unable to load this conversation&apos;s history.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => refetchHistory()}
                      >
                        <RefreshCcw className="h-3 w-3 mr-2" />
                        Retry
                      </Button>
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {historyLoading && currentConversationId && (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Loading conversation...
                  </p>
                </div>
              )}

              {!historyLoading &&
                !historyError &&
                (conversationHistory as any)?.messages?.map(
                  (message: ChatMessage) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${
                        message.role === 'user'
                          ? 'justify-end'
                          : 'justify-start'
                      }`}
                    >
                      {message.role !== 'user' && (
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {getMessageIcon(message.messageType)}
                          </AvatarFallback>
                        </Avatar>
                      )}

                      <div
                        className={`max-w-[70%] rounded-lg px-4 py-2 ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                        data-testid={`message-${message.role}-${message.id}`}
                      >
                        {message.role === 'user' ? (
                          <p className="whitespace-pre-wrap">
                            {message.content}
                          </p>
                        ) : (
                          <div className="space-y-3 text-foreground">
                            <ReactMarkdown
                              components={{
                                a: ({ href, children }) => (
                                  <a
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 underline font-medium"
                                  >
                                    {children}
                                  </a>
                                ),
                                p: ({ children }) => (
                                  <p className="text-foreground leading-relaxed mb-2">
                                    {children}
                                  </p>
                                ),
                                ul: ({ children }) => (
                                  <ul className="text-foreground space-y-1 ml-4 list-disc">
                                    {children}
                                  </ul>
                                ),
                                li: ({ children }) => (
                                  <li className="text-foreground">
                                    {children}
                                  </li>
                                ),
                                h3: ({ children }) => (
                                  <h3 className="text-foreground font-semibold text-sm mb-2">
                                    {children}
                                  </h3>
                                ),
                                h4: ({ children }) => (
                                  <h4 className="text-foreground font-medium text-sm mb-1">
                                    {children}
                                  </h4>
                                ),
                                strong: ({ children }) => (
                                  <strong className="text-foreground font-semibold">
                                    {children}
                                  </strong>
                                ),
                                em: ({ children }) => (
                                  <em className="text-foreground italic">
                                    {children}
                                  </em>
                                ),
                              }}
                            >
                              {message.content}
                            </ReactMarkdown>
                            {renderMessageContent(message)}
                          </div>
                        )}
                      </div>

                      {message.role === 'user' && (
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            <User className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  )
                )}

              {sendMessageMutation.isPending && (
                <div className="flex gap-3 justify-start">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-muted rounded-lg px-4 py-2">
                    <p className="text-muted-foreground">AI is thinking...</p>
                  </div>
                </div>
              )}

              {!historyLoading &&
                !historyError &&
                !(conversationHistory as any)?.messages &&
                !sendMessageMutation.isPending && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Bot className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">
                      Welcome to RFP AI Agent
                    </h3>
                    <p className="text-sm mb-4 max-w-md mx-auto">
                      I can help you search for RFPs, analyze requirements,
                      craft proposals, and research past bids. What would you
                      like to know?
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setInputValue('Find construction RFPs in Austin')
                        }
                        data-testid="suggestion-search-rfps"
                      >
                        Search for RFPs
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setInputValue('How do I write a winning proposal?')
                        }
                        data-testid="suggestion-proposal-help"
                      >
                        Get proposal help
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setInputValue('Show me recent bid analysis')
                        }
                        data-testid="suggestion-bid-analysis"
                      >
                        Analyze past bids
                      </Button>
                    </div>
                  </div>
                )}
            </div>
          </ScrollArea>

          <Separator />

          {/* Input Area */}
          <div className="p-4">
            <div className="flex gap-2">
              <Input
                placeholder="Ask me about RFPs, proposals, or get help with research..."
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={sendMessageMutation.isPending}
                className="flex-1"
                data-testid="input-chat-message"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || sendMessageMutation.isPending}
                data-testid="button-send-message"
              >
                {sendMessageMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className="flex justify-center mt-2">
              <p className="text-xs text-muted-foreground">
                Press Enter to send • Shift+Enter for new line
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
