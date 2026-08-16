import { useCompany } from "@/contexts/CompanyContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ADVISOR_NAME_ERROR, ADVISOR_NAME_MAX_LENGTH, ADVISOR_NAME_PATTERN, ADVISOR_PROFILES, resolveAdvisorName } from "@shared/types";
import type { AdvisorType } from "@shared/types";
import { Send, Loader2, ArrowLeft, MessageSquare, Plus, Pencil } from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

type ViewMode = "list" | "chat";

export default function Advisors() {
  const { activeCompany } = useCompany();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedAdvisor, setSelectedAdvisor] = useState<AdvisorType | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [renameTarget, setRenameTarget] = useState<AdvisorType | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const startConversation = trpc.advisor.startConversation.useMutation();
  const sendMessage = trpc.advisor.sendMessage.useMutation();
  const { data: conversations } = trpc.advisor.listConversations.useQuery(
    { companyId: activeCompany?.id ?? 0 },
    { enabled: !!activeCompany }
  );
  const { data: advisorProfiles } = trpc.advisor.profiles.useQuery(
    { companyId: activeCompany?.id ?? 0 },
    { enabled: !!activeCompany }
  );

  // Custom names only; resolveAdvisorName falls back to the built-in default.
  const nameOverrides = useMemo(() => {
    const map: Partial<Record<AdvisorType, string>> = {};
    advisorProfiles?.forEach(p => {
      if (p.isCustomName) map[p.advisorType] = p.name;
    });
    return map;
  }, [advisorProfiles]);

  const advisorName = (type: AdvisorType) => resolveAdvisorName(type, nameOverrides);

  const setAdvisorName = trpc.advisor.setName.useMutation({
    // Optimistic rename, rolled back if the server rejects it.
    onMutate: async variables => {
      await utils.advisor.profiles.cancel({ companyId: variables.companyId });
      const previous = utils.advisor.profiles.getData({ companyId: variables.companyId });
      utils.advisor.profiles.setData({ companyId: variables.companyId }, old =>
        old?.map(p =>
          p.advisorType === variables.advisorType
            ? { ...p, name: variables.name, isCustomName: true }
            : p
        )
      );
      return { previous };
    },
    onSuccess: () => {
      toast.success("Advisor renamed");
    },
    onError: (error, variables, context) => {
      if (context?.previous) {
        utils.advisor.profiles.setData({ companyId: variables.companyId }, context.previous);
      }
      toast.error(error.message || "Failed to rename advisor");
    },
    onSettled: (_data, _error, variables) => {
      utils.advisor.profiles.invalidate({ companyId: variables.companyId });
    },
  });

  const openRename = (type: AdvisorType) => {
    setRenameTarget(type);
    setRenameValue(advisorName(type));
  };

  const handleRenameSubmit = () => {
    if (!renameTarget || !activeCompany) return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      toast.error("Advisor name cannot be empty");
      return;
    }
    if (trimmed.length > ADVISOR_NAME_MAX_LENGTH) {
      toast.error(`Advisor name must be ${ADVISOR_NAME_MAX_LENGTH} characters or fewer`);
      return;
    }
    if (!ADVISOR_NAME_PATTERN.test(trimmed)) {
      toast.error(ADVISOR_NAME_ERROR);
      return;
    }
    setAdvisorName.mutate({
      companyId: activeCompany.id,
      advisorType: renameTarget,
      name: trimmed,
    });
    setRenameTarget(null);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSelectAdvisor = async (type: AdvisorType) => {
    if (!activeCompany) return;
    setSelectedAdvisor(type);
    setViewMode("chat");
    try {
      const result = await startConversation.mutateAsync({
        companyId: activeCompany.id,
        advisorType: type,
      });
      setActiveConversationId(result.id);
      setMessages([]);
      // Send initial greeting
      setSending(true);
      const greeting = await sendMessage.mutateAsync({
        conversationId: result.id,
        message: `Hello, I'd like to speak with you about my company ${activeCompany.name}. Please introduce yourself briefly.`,
      });
      setMessages(greeting.messages.filter((m: any) => m.role !== "system"));
      setSending(false);
      inputRef.current?.focus();
    } catch (e: any) {
      toast.error(e.message);
      setSending(false);
    }
  };

  const handleResumeConversation = async (convo: any) => {
    setSelectedAdvisor(convo.advisorType);
    setActiveConversationId(convo.id);
    setMessages((convo.messages || []).filter((m: any) => m.role !== "system"));
    setViewMode("chat");
    inputRef.current?.focus();
  };

  const handleSend = async () => {
    if (!inputMessage.trim() || !activeConversationId || sending) return;
    const msg = inputMessage.trim();
    setInputMessage("");
    setMessages(prev => [...prev, { role: "user", content: msg, timestamp: Date.now() }]);
    setSending(true);
    try {
      const result = await sendMessage.mutateAsync({
        conversationId: activeConversationId,
        message: msg,
      });
      setMessages(result.messages.filter((m: any) => m.role !== "system"));
    } catch (e: any) {
      toast.error("Failed to send message");
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (viewMode === "chat" && selectedAdvisor) {
    const profile = ADVISOR_PROFILES[selectedAdvisor];
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        {/* Chat Header */}
        <div className="flex items-center gap-3 pb-4 border-b">
          <Button variant="ghost" size="icon" onClick={() => setViewMode("list")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Avatar className="h-10 w-10">
            <AvatarFallback style={{ backgroundColor: profile.color, color: "white" }}>
              {profile.avatar}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-semibold">{advisorName(selectedAdvisor)}</h2>
            <p className="text-xs text-muted-foreground">{profile.title}</p>
          </div>
          <Badge variant="outline" className="ml-auto" style={{ borderColor: profile.color, color: profile.color }}>
            Online
          </Badge>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 py-4" ref={scrollRef}>
          <div className="space-y-4 px-1">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                {msg.role === "assistant" && (
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback style={{ backgroundColor: profile.color, color: "white" }} className="text-xs">
                      {profile.avatar}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-muted rounded-bl-md"
                }`}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <Streamdown>{msg.content}</Streamdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex gap-3">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback style={{ backgroundColor: profile.color, color: "white" }} className="text-xs">
                    {profile.avatar}
                  </AvatarFallback>
                </Avatar>
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="pt-4 border-t">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${advisorName(selectedAdvisor)}...`}
              disabled={sending}
              className="flex-1"
            />
            <Button onClick={handleSend} disabled={!inputMessage.trim() || sending} size="icon">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Advisor List View
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Expert Advisors</h1>
        <p className="text-muted-foreground">Talk to your team of financial experts. Each has their own expertise and personality.</p>
      </div>

      {/* Advisor Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(Object.entries(ADVISOR_PROFILES) as [AdvisorType, typeof ADVISOR_PROFILES[AdvisorType]][]).map(([type, profile]) => (
          <Card key={type} className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => handleSelectAdvisor(type)}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback style={{ backgroundColor: profile.color, color: "white" }} className="text-lg font-semibold">
                    {profile.avatar}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <CardTitle className="text-base truncate">{advisorName(type)}</CardTitle>
                  <CardDescription className="text-xs">{profile.title}</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto h-8 w-8 shrink-0 text-muted-foreground"
                  aria-label={`Rename ${advisorName(type)}`}
                  title="Rename advisor"
                  onClick={e => {
                    e.stopPropagation();
                    openRename(type);
                  }}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">{profile.description}</p>
              <Button variant="outline" className="w-full mt-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <MessageSquare className="w-4 h-4 mr-2" />
                Start Conversation
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Rename Advisor Dialog */}
      <Dialog open={!!renameTarget} onOpenChange={open => !open && setRenameTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Advisor</DialogTitle>
            <DialogDescription>
              {renameTarget
                ? `Give your ${ADVISOR_PROFILES[renameTarget].title} a custom name. This applies to ${activeCompany?.name ?? "this company"} only and takes effect on your next conversation.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="advisor-name">Name</Label>
            <Input
              id="advisor-name"
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleRenameSubmit();
                }
              }}
              maxLength={ADVISOR_NAME_MAX_LENGTH}
              placeholder={renameTarget ? ADVISOR_PROFILES[renameTarget].name : ""}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              {renameValue.trim().length}/{ADVISOR_NAME_MAX_LENGTH} characters
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>Cancel</Button>
            <Button onClick={handleRenameSubmit} disabled={!renameValue.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Previous Conversations */}
      {conversations && conversations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Conversations</CardTitle>
            <CardDescription>Continue a previous discussion</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {conversations.slice(0, 10).map((convo: any) => {
                const profile = ADVISOR_PROFILES[convo.advisorType as AdvisorType];
                return (
                  <button
                    key={convo.id}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                    onClick={() => handleResumeConversation(convo)}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback style={{ backgroundColor: profile?.color, color: "white" }} className="text-xs">
                        {profile?.avatar}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{convo.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {advisorName(convo.advisorType as AdvisorType)} · {new Date(convo.updatedAt).toLocaleDateString("en-MY")}
                      </p>
                    </div>
                    <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180" />
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
