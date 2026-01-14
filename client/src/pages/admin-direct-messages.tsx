import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MessageSquare, Send, Plus, Clock, User, ArrowLeft, Archive, Check, ChevronsUpDown } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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

interface UserForMessaging {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  preferredState: string | null;
}

export default function AdminDirectMessages() {
  const { toast } = useToast();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [userSelectorOpen, setUserSelectorOpen] = useState(false);

  const { data: conversations = [], isLoading } = useQuery<DirectConversation[]>({
    queryKey: ["/api/messages/direct"],
  });

  const { data: conversationDetail, isLoading: detailLoading } = useQuery<ConversationDetail>({
    queryKey: ["/api/messages/direct", selectedConversationId],
    enabled: !!selectedConversationId,
  });

  const { data: usersForMessaging = [] } = useQuery<UserForMessaging[]>({
    queryKey: ["/api/admin/users-for-messaging"],
  });

  const markReadMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      return apiRequest("POST", `/api/messages/direct/${conversationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages/direct"] });
    },
  });

  const replyMutation = useMutation({
    mutationFn: async ({ conversationId, content }: { conversationId: string; content: string }) => {
      return apiRequest("POST", `/api/messages/direct/${conversationId}/reply`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages/direct"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/direct", selectedConversationId] });
      setReplyContent("");
      toast({
        title: "Message sent",
        description: "Your reply has been sent to the user.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to send",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const createConversationMutation = useMutation({
    mutationFn: async (data: { userId: string; subject: string; initialMessage: string }) => {
      const res = await apiRequest("POST", "/api/messages/direct", data);
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages/direct"] });
      setNewConversationOpen(false);
      setNewSubject("");
      setNewMessage("");
      setSelectedUserId("");
      setSelectedConversationId(data.id);
      toast({
        title: "Conversation started",
        description: "Your message has been sent.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to create conversation",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      return apiRequest("POST", `/api/messages/direct/${conversationId}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages/direct"] });
      setSelectedConversationId(null);
      toast({
        title: "Conversation archived",
        description: "The conversation has been archived.",
      });
    },
  });

  const openConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    markReadMutation.mutate(conversationId);
  };

  const handleReply = () => {
    if (!selectedConversationId || !replyContent.trim()) return;
    replyMutation.mutate({ conversationId: selectedConversationId, content: replyContent.trim() });
  };

  const handleCreateConversation = () => {
    if (!selectedUserId || !newSubject.trim() || !newMessage.trim()) {
      toast({
        title: "Missing fields",
        description: "Please select a user and enter a subject and message.",
        variant: "destructive",
      });
      return;
    }
    createConversationMutation.mutate({
      userId: selectedUserId,
      subject: newSubject.trim(),
      initialMessage: newMessage.trim(),
    });
  };

  const getUserDisplayName = (user: { email: string; firstName?: string | null; lastName?: string | null } | null) => {
    if (!user) return "Unknown User";
    if (user.firstName || user.lastName) {
      return [user.firstName, user.lastName].filter(Boolean).join(" ");
    }
    return user.email;
  };

  const selectedUser = usersForMessaging.find(u => u.id === selectedUserId);
  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <MessageSquare className="h-8 w-8 text-primary" />
            Direct Messages
            {totalUnread > 0 && (
              <Badge variant="default">{totalUnread} unread</Badge>
            )}
          </h1>
          <p className="text-muted-foreground">
            Have private conversations with individual users
          </p>
        </div>

        <Dialog open={newConversationOpen} onOpenChange={setNewConversationOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-conversation">
              <Plus className="h-4 w-4 mr-2" />
              New Conversation
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Start a New Conversation</DialogTitle>
              <DialogDescription>
                Send a direct message to a user. They will be able to reply.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Select User</Label>
                <Popover open={userSelectorOpen} onOpenChange={setUserSelectorOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={userSelectorOpen}
                      className="w-full justify-between"
                      data-testid="select-user-trigger"
                    >
                      {selectedUser ? getUserDisplayName(selectedUser) : "Select a user..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0">
                    <Command>
                      <CommandInput placeholder="Search users by email or name..." />
                      <CommandList>
                        <CommandEmpty>No users found.</CommandEmpty>
                        <CommandGroup>
                          {usersForMessaging.map((user) => (
                            <CommandItem
                              key={user.id}
                              value={`${user.email} ${user.firstName || ''} ${user.lastName || ''}`}
                              onSelect={() => {
                                setSelectedUserId(user.id);
                                setUserSelectorOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedUserId === user.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span>{getUserDisplayName(user)}</span>
                                <span className="text-xs text-muted-foreground">{user.email}</span>
                              </div>
                              {user.preferredState && (
                                <Badge variant="outline" className="ml-auto text-xs">
                                  {user.preferredState}
                                </Badge>
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  placeholder="Enter a subject..."
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  data-testid="input-new-subject"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  placeholder="Type your message... (up to 5000 characters)"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="min-h-[150px]"
                  maxLength={5000}
                  data-testid="input-new-message"
                />
                <span className="text-xs text-muted-foreground">
                  {newMessage.length}/5000 characters
                </span>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setNewConversationOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateConversation}
                disabled={createConversationMutation.isPending}
                data-testid="button-send-new-message"
              >
                <Send className="h-4 w-4 mr-2" />
                {createConversationMutation.isPending ? "Sending..." : "Send Message"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Conversations</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {conversations.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>No conversations yet.</p>
                  <p className="text-sm">Start a new conversation above.</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="divide-y">
                    {conversations.map((conv) => (
                      <div
                        key={conv.id}
                        className={cn(
                          "p-4 cursor-pointer transition-colors hover-elevate",
                          selectedConversationId === conv.id && "bg-muted",
                          conv.unreadCount > 0 && "bg-primary/5"
                        )}
                        onClick={() => openConversation(conv.id)}
                        data-testid={`conversation-item-${conv.id}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="font-medium truncate text-sm">
                              {conv.user ? getUserDisplayName(conv.user) : "Unknown"}
                            </span>
                          </div>
                          {conv.unreadCount > 0 && (
                            <Badge variant="default" className="text-xs flex-shrink-0">
                              {conv.unreadCount}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium truncate">{conv.subject}</p>
                        {conv.lastMessage && (
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            {conv.lastMessage.isFromAdmin ? "You: " : "User: "}
                            {conv.lastMessage.content}
                          </p>
                        )}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                          <Clock className="h-3 w-3" />
                          {format(new Date(conv.lastMessageAt), "MMM d 'at' h:mm a")}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {selectedConversationId && conversationDetail ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mb-2 -ml-2 lg:hidden"
                      onClick={() => setSelectedConversationId(null)}
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                    <CardTitle className="text-lg">{conversationDetail.conversation.subject}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      With: {conversationDetail.conversation.user ? getUserDisplayName(conversationDetail.conversation.user) : "Unknown"}
                      {conversationDetail.conversation.user?.email && (
                        <span className="ml-2">({conversationDetail.conversation.user.email})</span>
                      )}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => archiveMutation.mutate(selectedConversationId)}
                    disabled={archiveMutation.isPending}
                    data-testid="button-archive"
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    Archive
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[350px] pr-4 mb-4">
                  <div className="space-y-4">
                    {conversationDetail.messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex",
                          msg.isFromAdmin ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[80%] rounded-lg p-3",
                            msg.isFromAdmin
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          )}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {!msg.isFromAdmin && (
                              <Badge variant="outline" className="text-xs">User</Badge>
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
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    className="min-h-[100px]"
                    maxLength={5000}
                    data-testid="input-admin-reply"
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">
                      {replyContent.length}/5000 characters
                    </span>
                    <Button
                      onClick={handleReply}
                      disabled={!replyContent.trim() || replyMutation.isPending}
                      data-testid="button-send-admin-reply"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {replyMutation.isPending ? "Sending..." : "Send"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <MessageSquare className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  Select a conversation from the list or start a new one.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
