import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mail, Send, Clock, Check, ChevronDown, ChevronUp, MessageSquare, ArrowLeft, User } from "lucide-react";
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

interface DirectConversation {
  id: string;
  subject: string;
  userId: string;
  createdByAdminId: string;
  lastMessageAt: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  lastMessage: {
    content: string;
    createdAt: string;
    isFromAdmin: boolean;
  } | null;
  unreadCount: number;
}

interface DirectMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  isFromAdmin: boolean;
  createdAt: string;
}

interface ConversationDetail {
  conversation: DirectConversation;
  messages: DirectMessage[];
}

export default function Messages() {
  const { toast } = useToast();
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [replyContent, setReplyContent] = useState<Record<string, string>>({});
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [directReplyContent, setDirectReplyContent] = useState("");

  const { data: messages = [], isLoading: broadcastsLoading } = useQuery<UserMessage[]>({
    queryKey: ["/api/messages"],
  });

  const { data: directConversations = [], isLoading: directLoading } = useQuery<DirectConversation[]>({
    queryKey: ["/api/messages/direct"],
  });

  const { data: conversationDetail, isLoading: detailLoading } = useQuery<ConversationDetail>({
    queryKey: ["/api/messages/direct", selectedConversationId],
    enabled: !!selectedConversationId,
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

  const markDirectReadMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      return apiRequest("POST", `/api/messages/direct/${conversationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages/direct"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/direct/unread-count"] });
    },
  });

  const directReplyMutation = useMutation({
    mutationFn: async ({ conversationId, content }: { conversationId: string; content: string }) => {
      return apiRequest("POST", `/api/messages/direct/${conversationId}/reply`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages/direct"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/direct", selectedConversationId] });
      setDirectReplyContent("");
      toast({
        title: "Message sent",
        description: "Your reply has been sent.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to send message",
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

  const openConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    markDirectReadMutation.mutate(conversationId);
  };

  const handleDirectReply = () => {
    if (!selectedConversationId || !directReplyContent.trim()) return;
    directReplyMutation.mutate({ 
      conversationId: selectedConversationId, 
      content: directReplyContent.trim() 
    });
  };

  const totalDirectUnread = directConversations.reduce((sum, c) => sum + c.unreadCount, 0);

  if (broadcastsLoading || directLoading) {
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

      <Tabs defaultValue="direct" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger 
            value="direct" 
            className={`flex items-center gap-2 ${totalDirectUnread > 0 ? 'animate-attention-blink' : ''}`} 
            data-testid="tab-direct"
          >
            <MessageSquare className="h-4 w-4" />
            Direct Messages
            {totalDirectUnread > 0 && (
              <Badge variant="destructive" className="ml-1 animate-pulse">{totalDirectUnread}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="broadcasts" 
            className={`flex items-center gap-2 ${messages.filter(m => !m.isRead).length > 0 ? 'animate-attention-blink' : ''}`} 
            data-testid="tab-broadcasts"
          >
            <Mail className="h-4 w-4" />
            Announcements
            {messages.filter(m => !m.isRead).length > 0 && (
              <Badge variant="destructive" className="ml-1 animate-pulse">{messages.filter(m => !m.isRead).length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="direct">
          {selectedConversationId && conversationDetail ? (
            <div className="space-y-4">
              <Button 
                variant="ghost" 
                onClick={() => setSelectedConversationId(null)}
                className="mb-2"
                data-testid="button-back-to-conversations"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to conversations
              </Button>

              <Card>
                <CardHeader>
                  <CardTitle>{conversationDetail.conversation.subject}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Started {format(new Date(conversationDetail.conversation.createdAt), "MMM d, yyyy")}
                  </p>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-4">
                      {conversationDetail.messages.map((msg) => (
                        <div 
                          key={msg.id}
                          className={`flex ${msg.isFromAdmin ? 'justify-start' : 'justify-end'}`}
                        >
                          <div 
                            className={`max-w-[80%] rounded-lg p-3 ${
                              msg.isFromAdmin 
                                ? 'bg-muted' 
                                : 'bg-primary text-primary-foreground'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              {msg.isFromAdmin && (
                                <Badge variant="outline" className="text-xs">LeaseShield</Badge>
                              )}
                              <span className="text-xs opacity-70">
                                {format(new Date(msg.createdAt), "MMM d 'at' h:mm a")}
                              </span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <Separator className="my-4" />

                  <div className="space-y-3">
                    <Textarea
                      placeholder="Type your reply... (up to 5000 characters)"
                      value={directReplyContent}
                      onChange={(e) => setDirectReplyContent(e.target.value)}
                      className="min-h-[100px]"
                      maxLength={5000}
                      data-testid="input-direct-reply"
                    />
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">
                        {directReplyContent.length}/5000 characters
                      </span>
                      <Button
                        onClick={handleDirectReply}
                        disabled={!directReplyContent.trim() || directReplyMutation.isPending}
                        data-testid="button-send-direct-reply"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {directReplyMutation.isPending ? "Sending..." : "Send"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <>
              {directConversations.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground text-center">
                      No direct messages yet. When LeaseShield reaches out to you directly, conversations will appear here.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {directConversations.map(conv => (
                    <Card 
                      key={conv.id}
                      className={`cursor-pointer transition-all hover-elevate ${conv.unreadCount > 0 ? 'border-primary/50 bg-primary/5' : ''}`}
                      onClick={() => openConversation(conv.id)}
                      data-testid={`card-conversation-${conv.id}`}
                    >
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-medium truncate">{conv.subject}</h3>
                              {conv.unreadCount > 0 && (
                                <Badge variant="default" className="text-xs">
                                  {conv.unreadCount} new
                                </Badge>
                              )}
                            </div>
                            {conv.lastMessage && (
                              <p className="text-sm text-muted-foreground truncate mt-1">
                                {conv.lastMessage.isFromAdmin ? 'LeaseShield: ' : 'You: '}
                                {conv.lastMessage.content}
                              </p>
                            )}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                              <Clock className="h-3 w-3" />
                              {format(new Date(conv.lastMessageAt), "MMM d, yyyy 'at' h:mm a")}
                            </div>
                          </div>
                          <MessageSquare className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="broadcasts">
          {messages.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Mail className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  No announcements yet. Important updates from LeaseShield will appear here.
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
