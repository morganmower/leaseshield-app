import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Mail, Send, Clock, Check, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface BroadcastReply {
  id: string;
  broadcastId: string;
  userId: string;
  content: string;
  createdAt: string;
  isReadByAdmin: boolean;
}

interface BroadcastMessage {
  id: string;
  subject: string;
  content: string;
  audience: string;
  createdAt: string;
}

interface UserMessage {
  id: string;
  broadcastId: string;
  userId: string;
  isRead: boolean;
  readAt: string | null;
  broadcast: BroadcastMessage;
  userReplies: BroadcastReply[];
}

export default function Messages() {
  const { toast } = useToast();
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [replyContent, setReplyContent] = useState<Record<string, string>>({});

  const { data: messages = [], isLoading } = useQuery<UserMessage[]>({
    queryKey: ["/api/messages"],
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (broadcastId: string) => {
      return apiRequest("POST", `/api/messages/${broadcastId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/unread-count"] });
    },
  });

  const replyMutation = useMutation({
    mutationFn: async ({ broadcastId, content }: { broadcastId: string; content: string }) => {
      return apiRequest("POST", `/api/messages/${broadcastId}/reply`, { content });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      setReplyContent(prev => ({ ...prev, [variables.broadcastId]: "" }));
      toast({
        title: "Reply sent",
        description: "Your message has been sent to LeaseShield support.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to send reply",
        description: "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const toggleMessage = (messageId: string, broadcastId: string, isRead: boolean) => {
    setExpandedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
        if (!isRead) {
          markAsReadMutation.mutate(broadcastId);
        }
      }
      return newSet;
    });
  };

  const handleReply = (broadcastId: string) => {
    const content = replyContent[broadcastId]?.trim();
    if (!content) return;
    replyMutation.mutate({ broadcastId, content });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 bg-muted rounded w-1/3"></div>
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-muted rounded w-full mb-2"></div>
                <div className="h-4 bg-muted rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Mail className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Messages</h1>
      </div>

      {messages.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No messages yet. Important updates from LeaseShield will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {messages.map(message => {
            const isExpanded = expandedMessages.has(message.id);
            const hasReplies = message.userReplies.length > 0;
            
            return (
              <Card 
                key={message.id}
                className={`transition-all ${!message.isRead ? 'border-primary/50 bg-primary/5' : ''}`}
                data-testid={`card-message-${message.id}`}
              >
                <CardHeader 
                  className="cursor-pointer hover-elevate"
                  onClick={() => toggleMessage(message.id, message.broadcastId, message.isRead)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-lg">{message.broadcast.subject}</CardTitle>
                        {!message.isRead && (
                          <Badge variant="default" className="text-xs">
                            New
                          </Badge>
                        )}
                        {hasReplies && (
                          <Badge variant="outline" className="text-xs">
                            <MessageSquare className="h-3 w-3 mr-1" />
                            {message.userReplies.length} {message.userReplies.length === 1 ? 'reply' : 'replies'}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(message.broadcast.createdAt), "MMM d, yyyy 'at' h:mm a")}
                        {message.isRead && message.readAt && (
                          <span className="flex items-center gap-1">
                            <Check className="h-3 w-3" />
                            Read
                          </span>
                        )}
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      data-testid={`button-toggle-message-${message.id}`}
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-0">
                    <Separator className="mb-4" />
                    
                    <div 
                      className="prose prose-sm dark:prose-invert max-w-none mb-6"
                      dangerouslySetInnerHTML={{ __html: message.broadcast.content.replace(/\n/g, '<br/>') }}
                    />

                    {hasReplies && (
                      <div className="mb-6">
                        <h4 className="text-sm font-medium mb-3">Your conversation:</h4>
                        <div className="space-y-3 pl-4 border-l-2 border-muted">
                          {message.userReplies.map(reply => (
                            <div key={reply.id} className="text-sm">
                              <div className="text-muted-foreground text-xs mb-1">
                                {format(new Date(reply.createdAt), "MMM d, yyyy 'at' h:mm a")}
                                {reply.isReadByAdmin && (
                                  <span className="ml-2 text-primary">
                                    <Check className="h-3 w-3 inline" /> Seen
                                  </span>
                                )}
                              </div>
                              <p className="text-foreground">{reply.content}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      <h4 className="text-sm font-medium">Reply to this message:</h4>
                      <Textarea
                        placeholder="Type your reply here..."
                        value={replyContent[message.broadcastId] || ""}
                        onChange={(e) => setReplyContent(prev => ({ 
                          ...prev, 
                          [message.broadcastId]: e.target.value 
                        }))}
                        className="min-h-[100px]"
                        data-testid={`input-reply-${message.id}`}
                      />
                      <div className="flex justify-end">
                        <Button
                          onClick={() => handleReply(message.broadcastId)}
                          disabled={!replyContent[message.broadcastId]?.trim() || replyMutation.isPending}
                          data-testid={`button-send-reply-${message.id}`}
                        >
                          <Send className="h-4 w-4 mr-2" />
                          {replyMutation.isPending ? "Sending..." : "Send Reply"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
