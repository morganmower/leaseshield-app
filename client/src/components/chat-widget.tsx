import { useState, useRef, useEffect } from "react";
import { X, MessageCircle, Send, Minimize2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/logo";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

interface ChatMessage {
  text: string;
  type: 'user' | 'bot';
}

export function ChatWidget() {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || isTyping) return;

    if (text.length > 500) {
      toast({
        title: "Message Too Long",
        description: "Please keep your message under 500 characters.",
        variant: "destructive",
      });
      return;
    }

    const userMessage: ChatMessage = { text, type: 'user' };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput("");
    setIsTyping(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json();

      if (!res.ok) {
        const botMessage: ChatMessage = {
          text: data.reply || "Sorry, something went wrong. Please try again.",
          type: 'bot'
        };
        setChatMessages(prev => [...prev, botMessage]);
        
        if (res.status === 429) {
          toast({
            title: "Slow Down",
            description: "You're sending messages too quickly. Please wait a moment.",
            variant: "destructive",
          });
        }
        return;
      }

      const botMessage: ChatMessage = {
        text: data.reply || "Sorry, I had trouble answering that.",
        type: 'bot'
      };
      setChatMessages(prev => [...prev, botMessage]);
    } catch (err) {
      console.error("Chat error:", err);
      toast({
        title: "Connection Error",
        description: "Unable to reach the assistant. Please check your connection.",
        variant: "destructive",
      });
      const errorMessage: ChatMessage = {
        text: "I'm having trouble connecting right now. Please check your connection and try again.",
        type: 'bot'
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="mb-4 fixed inset-4 sm:inset-auto sm:relative sm:mb-4"
          >
            <Card className="w-full h-full sm:w-[380px] sm:h-[500px] flex flex-col shadow-2xl border-primary/20">
              <div className="bg-primary text-primary-foreground rounded-t-lg">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-2">
                    <Logo variant="horizontal" size="sm" className="brightness-0 invert h-6" />
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-primary-foreground hover:bg-primary-foreground/20"
                    onClick={() => setChatOpen(false)}
                    data-testid="button-close-chat"
                  >
                    <Minimize2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="px-4 pb-3 text-xs opacity-90">
                  <AlertCircle className="h-3 w-3 inline mr-1" />
                  Educational information only, not legal advice
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
                {chatMessages.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium mb-1">Hi! I'm your LeaseShield Assistant</p>
                    <p className="text-xs">Ask me anything about landlord-tenant law or LeaseShield features!</p>
                  </div>
                )}
                {chatMessages.map((msg, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                        msg.type === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-card border'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </motion.div>
                ))}
                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start"
                  >
                    <div className="bg-card border rounded-lg px-4 py-2 text-sm">
                      <span className="inline-flex gap-1">
                        <span className="animate-bounce" style={{ animationDelay: '0ms' }}>●</span>
                        <span className="animate-bounce" style={{ animationDelay: '150ms' }}>●</span>
                        <span className="animate-bounce" style={{ animationDelay: '300ms' }}>●</span>
                      </span>
                    </div>
                  </motion.div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleChatSubmit} className="p-4 border-t bg-background">
                <div className="flex gap-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask about leases, compliance, or features..."
                    className="flex-1"
                    disabled={isTyping}
                    data-testid="input-chat-message"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={isTyping || !chatInput.trim()}
                    data-testid="button-send-chat"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {!chatOpen && (
        <div className="flex flex-col items-end gap-2">
          <div className="hidden sm:block bg-card border shadow-lg rounded-lg px-3 py-2 text-xs text-muted-foreground max-w-[200px]">
            <AlertCircle className="h-3 w-3 inline mr-1" />
            AI assistant • Info only, not legal advice
          </div>
          <Button
            size="lg"
            onClick={() => setChatOpen(true)}
            className="h-12 w-12 sm:h-14 sm:w-14 rounded-full shadow-2xl"
            data-testid="button-toggle-chat"
          >
            <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />
          </Button>
        </div>
      )}
    </div>
  );
}
