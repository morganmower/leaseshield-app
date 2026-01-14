import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Send, Mail, Users, MessageSquare, Clock, ChevronDown, ChevronUp, User as UserIcon } from "lucide-react";
import { format } from "date-fns";
import type { BroadcastMessage, BroadcastReply, User } from "@shared/schema";

type BroadcastWithReplies = BroadcastMessage & {
  replies: (BroadcastReply & { user: User })[];
  recipientCount: number;
  readCount: number;
};

export default function AdminBroadcasts() {
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [audience, setAudience] = useState<"trial" | "active" | "all" | "individual">("all");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [expandedBroadcast, setExpandedBroadcast] = useState<string | null>(null);

  const { data: broadcasts, isLoading: broadcastsLoading } = useQuery<BroadcastWithReplies[]>({
    queryKey: ["/api/admin/broadcasts"],
  });

  const { data: audienceCounts } = useQuery<{ trial: number; active: number; all: number }>({
    queryKey: ["/api/admin/broadcasts/audience-counts"],
  });

  const { data: allUsers } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const sendBroadcastMutation = useMutation({
    mutationFn: async (data: { subject: string; content: string; audience: string; userId?: string }) => {
      const res = await apiRequest("POST", "/api/admin/broadcasts", data);
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/broadcasts"] });
      toast({
        title: "Message Sent",
        description: data.recipientCount === 1 
          ? "Message sent to 1 user." 
          : `Message sent to ${data.recipientCount} users.`,
      });
      setSubject("");
      setContent("");
      setSelectedUserId("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message.",
        variant: "destructive",
      });
    },
  });

  const markReplyReadMutation = useMutation({
    mutationFn: async (replyId: string) => {
      const res = await apiRequest("POST", `/api/admin/broadcasts/replies/${replyId}/read`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/broadcasts"] });
    },
  });

  const resendBroadcastMutation = useMutation({
    mutationFn: async (broadcastId: string) => {
      const res = await apiRequest("POST", `/api/admin/broadcasts/${broadcastId}/resend`);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Emails Sent",
        description: `Email notification sent to ${data.emailsSent} active subscriber${data.emailsSent === 1 ? '' : 's'}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to resend emails.",
        variant: "destructive",
      });
    },
  });

  const handleSendBroadcast = () => {
    if (!subject.trim() || !content.trim()) {
      toast({
        title: "Missing Fields",
        description: "Please enter both a subject and message.",
        variant: "destructive",
      });
      return;
    }
    if (audience === "individual" && !selectedUserId) {
      toast({
        title: "Select a User",
        description: "Please select a user to send the message to.",
        variant: "destructive",
      });
      return;
    }
    sendBroadcastMutation.mutate({ 
      subject, 
      content, 
      audience,
      userId: audience === "individual" ? selectedUserId : undefined,
    });
  };

  const getAudienceLabel = (aud: string) => {
    switch (aud) {
      case "trial": return "Trial Users";
      case "active": return "Active Subscribers";
      case "all": return "All Users";
      case "individual": return "Individual User";
      default: return aud;
    }
  };

  const getAudienceCount = (aud: "trial" | "active" | "all") => {
    if (!audienceCounts) return "...";
    return audienceCounts[aud];
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Broadcast Messages</h1>
        <p className="text-muted-foreground">
          Send messages to your trial and active users. They'll receive an email notification and can reply privately.
        </p>
      </div>

      <Tabs defaultValue="compose" className="space-y-6">
        <TabsList>
          <TabsTrigger value="compose" data-testid="tab-compose">
            <Send className="h-4 w-4 mr-2" />
            Compose
          </TabsTrigger>
          <TabsTrigger value="sent" data-testid="tab-sent">
            <Mail className="h-4 w-4 mr-2" />
            Sent Messages
          </TabsTrigger>
          <TabsTrigger value="replies" data-testid="tab-replies">
            <MessageSquare className="h-4 w-4 mr-2" />
            User Replies
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compose">
          <Card>
            <CardHeader>
              <CardTitle>Compose New Broadcast</CardTitle>
              <CardDescription>
                Write a message to send to your users. They'll receive an email alert to check their messages.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Select Audience</Label>
                <RadioGroup
                  value={audience}
                  onValueChange={(val) => setAudience(val as typeof audience)}
                  className="flex flex-wrap gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="all" data-testid="radio-audience-all" />
                    <Label htmlFor="all" className="cursor-pointer">
                      All Users ({getAudienceCount("all")})
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="trial" id="trial" data-testid="radio-audience-trial" />
                    <Label htmlFor="trial" className="cursor-pointer">
                      Trial Only ({getAudienceCount("trial")})
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="active" id="active" data-testid="radio-audience-active" />
                    <Label htmlFor="active" className="cursor-pointer">
                      Active Subscribers ({getAudienceCount("active")})
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="individual" id="individual" data-testid="radio-audience-individual" />
                    <Label htmlFor="individual" className="cursor-pointer">
                      <UserIcon className="h-4 w-4 inline mr-1" />
                      Individual User
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {audience === "individual" && (
                <div className="space-y-2">
                  <Label>Select User</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger data-testid="select-user">
                      <SelectValue placeholder="Choose a user..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allUsers?.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.email} {user.firstName ? `(${user.firstName} ${user.lastName || ''})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  placeholder="Enter message subject..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  data-testid="input-broadcast-subject"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Message</Label>
                <Textarea
                  id="content"
                  placeholder="Write your message here..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={8}
                  data-testid="textarea-broadcast-content"
                />
              </div>

              <Button
                onClick={handleSendBroadcast}
                disabled={sendBroadcastMutation.isPending || !subject.trim() || !content.trim()}
                data-testid="button-send-broadcast"
              >
                {sendBroadcastMutation.isPending ? (
                  "Sending..."
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Broadcast
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sent">
          <Card>
            <CardHeader>
              <CardTitle>Sent Broadcasts</CardTitle>
              <CardDescription>
                View all broadcasts you've sent and see how many users have read them.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {broadcastsLoading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : broadcasts && broadcasts.length > 0 ? (
                <div className="space-y-4">
                  {broadcasts.map((broadcast) => (
                    <Card key={broadcast.id} className="hover-elevate" data-testid={`card-broadcast-${broadcast.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <CardTitle className="text-lg">{broadcast.subject}</CardTitle>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <Badge variant="secondary">{getAudienceLabel(broadcast.audience)}</Badge>
                              <span className="text-sm text-muted-foreground flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {broadcast.recipientCount} recipients
                              </span>
                              <span className="text-sm text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(broadcast.createdAt), "MMM d, yyyy 'at' h:mm a")}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => resendBroadcastMutation.mutate(broadcast.id)}
                              disabled={resendBroadcastMutation.isPending}
                              data-testid={`button-resend-${broadcast.id}`}
                            >
                              {resendBroadcastMutation.isPending ? (
                                "Sending..."
                              ) : (
                                <>
                                  <Mail className="h-3 w-3 mr-1" />
                                  Resend Email
                                </>
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setExpandedBroadcast(expandedBroadcast === broadcast.id ? null : broadcast.id)}
                              data-testid={`button-expand-${broadcast.id}`}
                            >
                              {expandedBroadcast === broadcast.id ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      {expandedBroadcast === broadcast.id && (
                        <CardContent>
                          <p className="text-sm whitespace-pre-wrap">{broadcast.content}</p>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No broadcasts sent yet. Compose your first message above.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="replies">
          <Card>
            <CardHeader>
              <CardTitle>User Replies</CardTitle>
              <CardDescription>
                Private replies from users to your broadcasts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {broadcastsLoading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : broadcasts ? (
                (() => {
                  const allReplies = broadcasts.flatMap((b) =>
                    (b.replies || []).map((r) => ({ ...r, broadcastSubject: b.subject }))
                  );
                  const sortedReplies = allReplies.sort(
                    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                  );

                  if (sortedReplies.length === 0) {
                    return (
                      <p className="text-center text-muted-foreground py-8">
                        No replies yet. Users can reply to your broadcasts from their Messages page.
                      </p>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {sortedReplies.map((reply) => (
                        <Card
                          key={reply.id}
                          className={`hover-elevate ${!reply.isReadByAdmin ? "border-primary" : ""}`}
                          data-testid={`card-reply-${reply.id}`}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <CardTitle className="text-base">
                                  {reply.user?.firstName} {reply.user?.lastName || reply.user?.email}
                                  {!reply.isReadByAdmin && (
                                    <Badge variant="default" className="ml-2 text-xs">New</Badge>
                                  )}
                                </CardTitle>
                                <p className="text-sm text-muted-foreground">
                                  Re: {reply.broadcastSubject}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(reply.createdAt), "MMM d, yyyy 'at' h:mm a")}
                                </p>
                              </div>
                              {!reply.isReadByAdmin && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => markReplyReadMutation.mutate(reply.id)}
                                  data-testid={`button-mark-read-${reply.id}`}
                                >
                                  Mark Read
                                </Button>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm whitespace-pre-wrap">{reply.content}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  );
                })()
              ) : (
                <p className="text-center text-destructive py-8">
                  Failed to load replies.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
