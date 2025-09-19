import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Send, Bot, User, Loader2, Search, FileText, Lightbulb } from "lucide-react";

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  messageType: string;
  createdAt: Date;
}

interface ChatResponse {
  conversationId: string;
  message: string;
  messageType: 'text' | 'rfp_results' | 'search_results' | 'analysis' | 'follow_up';
  data?: any;
  followUpQuestions?: string[];
  actionSuggestions?: string[];
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
  const [inputValue, setInputValue] = useState("");
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch user conversations
  const { data: conversations } = useQuery({
    queryKey: ["/api/ai/conversations"],
  });

  // Fetch current conversation history
  const { data: conversationHistory, refetch: refetchHistory } = useQuery({
    queryKey: ["/api/ai/conversations", currentConversationId],
    enabled: !!currentConversationId,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { query: string; conversationId?: string }): Promise<ChatResponse> => {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return response.json() as Promise<ChatResponse>;
    },
    onSuccess: (response) => {
      if (response.conversationId && !currentConversationId) {
        setCurrentConversationId(response.conversationId);
      }
      // Refetch conversation history to show the new messages
      refetchHistory();
      // Invalidate conversations list to update with new conversation
      queryClient.invalidateQueries({ queryKey: ["/api/ai/conversations"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const messageContent = inputValue.trim();
    setInputValue("");

    try {
      await sendMessageMutation.mutateAsync({
        query: messageContent,
        conversationId: currentConversationId || undefined,
      });
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const startNewConversation = () => {
    setCurrentConversationId(null);
    queryClient.removeQueries({ queryKey: ["/api/ai/conversations", currentConversationId] });
  };

  const selectConversation = (conversationId: string) => {
    setCurrentConversationId(conversationId);
    refetchHistory();
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

  const renderMessageContent = (message: any) => {
    return (
      <div className="space-y-3">
        <p className="text-foreground whitespace-pre-wrap">{message.content}</p>
        
        {message.followUpQuestions && message.followUpQuestions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Follow-up questions:</h4>
            <div className="flex flex-wrap gap-2">
              {message.followUpQuestions.map((question: string, index: number) => (
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
              ))}
            </div>
          </div>
        )}

        {message.actionSuggestions && message.actionSuggestions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Suggested actions:</h4>
            <div className="flex flex-wrap gap-2">
              {message.actionSuggestions.map((suggestion: string, index: number) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {suggestion}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {message.relatedRfps && message.relatedRfps.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Related RFPs:</h4>
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

  return (
    <div className="flex h-full">
      {/* Conversations Sidebar */}
      <div className="w-80 border-r bg-card">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">AI Conversations</h2>
            <Button 
              size="sm" 
              onClick={startNewConversation}
              data-testid="button-new-conversation"
            >
              New Chat
            </Button>
          </div>
          
          <ScrollArea className="h-[calc(100vh-200px)]">
            <div className="space-y-2">
              {(conversations as Conversation[])?.map((conversation: Conversation) => (
                <Card
                  key={conversation.id}
                  className={`cursor-pointer transition-colors hover:bg-accent ${
                    currentConversationId === conversation.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => selectConversation(conversation.id)}
                  data-testid={`conversation-card-${conversation.id}`}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-foreground truncate">
                        {conversation.title}
                      </h3>
                      <Badge variant="secondary" className="text-xs">
                        {conversation.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(conversation.updatedAt).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              ))}
              
              {(!conversations || (conversations as Conversation[])?.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  <Bot className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No conversations yet</p>
                  <p className="text-xs">Start chatting with the AI agent</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
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
                Ask me anything about RFPs, search for opportunities, or get help with proposals
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4" data-testid="chat-messages-area">
          <div className="space-y-4">
            {(conversationHistory as any)?.messages?.map((message: ChatMessage) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
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
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  ) : (
                    renderMessageContent(message)
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
            ))}

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

            {!(conversationHistory as any)?.messages && !sendMessageMutation.isPending && (
              <div className="text-center py-12 text-muted-foreground">
                <Bot className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Welcome to RFP AI Agent</h3>
                <p className="text-sm mb-4 max-w-md mx-auto">
                  I can help you search for RFPs, analyze requirements, craft proposals, 
                  and research past bids. What would you like to know?
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setInputValue("Find construction RFPs in Austin")}
                    data-testid="suggestion-search-rfps"
                  >
                    Search for RFPs
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setInputValue("How do I write a winning proposal?")}
                    data-testid="suggestion-proposal-help"
                  >
                    Get proposal help
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setInputValue("Show me recent bid analysis")}
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
              onChange={(e) => setInputValue(e.target.value)}
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
  );
}