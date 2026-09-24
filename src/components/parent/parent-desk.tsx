"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, ChevronRight, CircleHelp, Clock3, Megaphone, MessageCircle, Mic, MicOff, Monitor, Send, ShieldCheck, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Logo } from "@/components/brand/Logo";

type Faq = {
  id: string;
  title: string;
  shortAnswer: string;
  answer: string;
  sourceLabel: string;
  reviewedAt: string;
  category: string;
};

type Center = {
  name: string;
  tagline: string;
  hours: string;
  announcement: { title: string; message: string } | null;
};

type DeskData = {
  center: Center;
  faqs: Faq[];
};

type Answer = {
  answer: string;
  sourceLabel: string;
  sourceId: string;
  reviewedAt: string;
  status: "answered" | "handoff";
  suggestedQuestions?: string[];
};

type SpeechRecognitionResultEvent = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

type SpeechRecognitionErrorEvent = {
  error: string;
};

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getSessionId() {
  const sessionKey = "brightflare-session";
  const currentId = window.sessionStorage.getItem(sessionKey);
  if (currentId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentId)) return currentId;
  const createdId = window.crypto.randomUUID?.() ?? createFallbackUuid();
  window.sessionStorage.setItem(sessionKey, createdId);
  return createdId;
}

function createFallbackUuid() {
  const bytes = window.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function formatReviewDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

export default function ParentDesk() {
  const [deskData, setDeskData] = useState<DeskData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [answerQuestion, setAnswerQuestion] = useState("");
  const [isPrivateAnswer, setIsPrivateAnswer] = useState(false);
  const [selectedFaq, setSelectedFaq] = useState<Faq | null>(null);
  const [isIpadPreviewOpen, setIsIpadPreviewOpen] = useState(false);
  const [isIpadPreviewFrame, setIsIpadPreviewFrame] = useState(false);
  const [ipadPreviewScale, setIpadPreviewScale] = useState(1);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    setIsIpadPreviewFrame(searchParams.get("ipadPreview") === "1");
  }, []);

  useEffect(() => {
    if (!isIpadPreviewOpen) return;
    function updateIpadPreviewScale() {
      setIpadPreviewScale(Math.min((window.innerWidth - 48) / 1180, (window.innerHeight - 190) / 820, 1));
    }
    updateIpadPreviewScale();
    window.addEventListener("resize", updateIpadPreviewScale);
    return () => window.removeEventListener("resize", updateIpadPreviewScale);
  }, [isIpadPreviewOpen]);

  useEffect(() => {
    let isMounted = true;
    async function loadDesk() {
      try {
        const response = await fetch("/api/front-desk", { cache: "no-store" });
        if (!response.ok) throw new Error("We couldn't load your center's answers.");
        const data = (await response.json()) as DeskData;
        if (isMounted) setDeskData(data);
      } catch (error) {
        if (isMounted) setLoadError(error instanceof Error ? error.message : "Something went wrong while loading this page.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    void loadDesk();
    return () => {
      isMounted = false;
    };
  }, []);

  const featuredFaqs = useMemo(() => deskData?.faqs.slice(0, 8) ?? [], [deskData]);

  function toggleVoiceInput() {
    if (speechRecognitionRef.current && isListening) {
      speechRecognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechError("Voice input isn't supported in this browser. Type your question instead.");
      return;
    }

    setSpeechError(null);
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = navigator.language || "en-US";
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .slice(event.resultIndex)
        .filter((result) => result.isFinal)
        .map((result) => result[0].transcript.trim())
        .filter(Boolean)
        .join(" ");
      if (transcript) {
        setQuestion((current) => `${current.trim()}${current.trim() ? " " : ""}${transcript}`);
      }
    };
    recognition.onerror = (event) => {
      const errorMessage = event.error === "not-allowed" || event.error === "service-not-allowed"
        ? "Microphone access was blocked. Allow microphone access to use voice input."
        : event.error === "no-speech"
          ? "No speech was detected. Try speaking again."
          : "Voice input stopped. You can continue typing your question.";
      setSpeechError(errorMessage);
      setIsListening(false);
      speechRecognitionRef.current = null;
    };
    recognition.onend = () => {
      setIsListening(false);
      speechRecognitionRef.current = null;
    };

    try {
      speechRecognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch {
      speechRecognitionRef.current = null;
      setIsListening(false);
      setSpeechError("Voice input couldn't start. Check microphone access or type your question instead.");
    }
  }

  useEffect(() => () => {
    speechRecognitionRef.current?.stop();
  }, []);

  async function submitQuestion(submittedQuestion = question) {
    const trimmedQuestion = submittedQuestion.trim();
    if (!trimmedQuestion || isAsking) return;
    const shouldClearFamilySession = trimmedQuestion.startsWith("@child ");
    setIsPrivateAnswer(shouldClearFamilySession);
    setQuestion(trimmedQuestion);
    setAnswerQuestion(trimmedQuestion.startsWith("@child ") ? trimmedQuestion.replace(/^@child\s*/, "") : trimmedQuestion);
    setAnswer(null);
    setSelectedFaq(null);
    setAskError(null);
    setIsAsking(true);
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmedQuestion, sessionId: getSessionId() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "We couldn't get an answer just now.");
      if (shouldClearFamilySession && document.visibilityState === "hidden") {
        closeAnswer();
      } else {
        setAnswer(payload as Answer);
      }
      setQuestion("");
    } catch (error) {
      setAskError(error instanceof Error ? error.message : "We couldn't get an answer just now.");
    } finally {
      if (shouldClearFamilySession) {
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
      }
      setIsAsking(false);
    }
  }

  function openFaq(faq: Faq) {
    setSelectedFaq(faq);
    setAnswer(null);
    setAnswerQuestion(faq.title);
    setAskError(null);
  }

  function closeAnswer() {
    setAnswer(null);
    setSelectedFaq(null);
    setAnswerQuestion("");
    setIsPrivateAnswer(false);
  }

  useEffect(() => {
    if (!isPrivateAnswer) return;
    function clearPrivateAnswerWhenHidden() {
      if (document.visibilityState === "hidden") closeAnswer();
    }
    document.addEventListener("visibilitychange", clearPrivateAnswerWhenHidden);
    const timeout = answer || askError ? window.setTimeout(closeAnswer, 30_000) : null;
    return () => {
      document.removeEventListener("visibilitychange", clearPrivateAnswerWhenHidden);
      if (timeout !== null) window.clearTimeout(timeout);
    };
  }, [isPrivateAnswer, answer, askError]);

  const showingAnswer = Boolean(answer || selectedFaq || isAsking || askError);

  useEffect(() => {
    if (!showingAnswer || !window.matchMedia?.("(max-width: 767px)").matches) return;
    document.getElementById("parent-answer")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [showingAnswer, answerQuestion]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a className="flex items-center gap-2" href="#home" aria-label="brightflare home" onClick={closeAnswer}>
            <Logo size={32} />
            <span className="hidden text-sm font-semibold sm:inline sm:text-base">Family Help Desk</span>
          </a>
          <div className="flex items-center gap-3 text-xs font-medium text-foreground sm:gap-4 sm:text-base">
            <a href="/handbook" className="inline-flex items-center gap-1.5 text-primary underline-offset-2 hover:underline"><BookOpen aria-hidden="true" className="size-4" />Handbook</a>
            {!isIpadPreviewFrame ? <Button type="button" size="icon-sm" variant="outline" aria-label="Preview iPad front desk" title="Preview iPad front desk" onClick={() => setIsIpadPreviewOpen(true)}><Monitor aria-hidden="true" className="size-4" /></Button> : null}
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-6xl flex-col px-4 pb-5 pt-5 sm:px-6 lg:px-8" id="home">
        {deskData?.center.announcement ? <aside aria-label="Important center announcement" className="mb-5 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-sm sm:mb-6 sm:p-5">
          <Megaphone aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="min-w-0">
            {deskData.center.announcement.title.trim() ? <h2 className="text-sm font-semibold sm:text-base">{deskData.center.announcement.title}</h2> : null}
            <p className="text-sm leading-6 text-foreground sm:text-base sm:leading-7">{deskData.center.announcement.message}</p>
          </div>
        </aside> : null}
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end lg:mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">{deskData?.center.name ?? "How can we help?"}</h1>
            {deskData?.center.tagline ? <p className="mt-1 text-sm text-muted-foreground sm:text-base">{deskData.center.tagline}</p> : <p className="mt-1 text-sm text-muted-foreground sm:text-base">Quick answers for your family.</p>}
          </div>
          {deskData?.center.hours ? <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-foreground"><Clock3 aria-hidden="true" className="size-4" />{deskData.center.hours}</p> : null}
        </div>

        <div className="grid flex-1 items-stretch gap-7 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
          <div className="flex h-full flex-col gap-4">
            <Card className="flex flex-1 flex-col gap-0 py-0 shadow-sm">
              <form className="flex h-full flex-col" onSubmit={(event) => { event.preventDefault(); void submitQuestion(); }}>
                <label htmlFor="parent-question" className="block px-5 pt-4 text-base font-semibold sm:text-lg">What can we help you find?</label>
                <div className="flex min-h-40 flex-1 flex-col justify-between gap-3 p-3 sm:min-h-48">
                  <Textarea id="parent-question" value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && event.shiftKey) { event.preventDefault(); void submitQuestion() } }} placeholder="Type your question here…" className="min-h-24 flex-1 resize-none border-0 bg-transparent p-2 shadow-none focus-visible:ring-0" />
                  {isListening ? <p role="status" className="px-2 text-xs text-muted-foreground">Listening… Speak your question, then tap the microphone to stop.</p> : null}
                  {speechError ? <p role="alert" className="px-2 text-xs text-destructive">{speechError}</p> : null}
                  <div className="flex justify-end gap-2">
                    <Button type="button" size="icon" variant={isListening ? "secondary" : "outline"} aria-label={isListening ? "Stop voice input" : "Start voice input"} title={isListening ? "Stop voice input" : "Start voice input"} onClick={toggleVoiceInput}>{isListening ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />}</Button>
                    <Button type="submit" size="icon" aria-label={isAsking ? "Finding an answer" : "Ask brightflare"} title={isAsking ? "Finding an answer…" : "Ask brightflare"} disabled={!question.trim() || isAsking}><Send aria-hidden="true" /></Button>
                  </div>
                </div>
              </form>
            </Card>
            {showingAnswer ? <section id="parent-answer" aria-live="polite" aria-label="Answer" className="scroll-mt-4 rounded-lg border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-3"><h2 className="text-lg font-semibold">{answerQuestion}</h2><Button variant="ghost" size="icon-sm" aria-label="Close answer" onClick={closeAnswer}><ArrowLeft aria-hidden="true" /></Button></div>
              {isAsking ? <p className="text-base text-muted-foreground" role="status">Looking through your center&apos;s handbook and updates…</p> : null}
              {askError ? <Alert variant="destructive"><CircleHelp /><AlertTitle>We couldn&apos;t get that answer</AlertTitle><AlertDescription>{askError}<Button variant="link" className="ml-1 h-auto p-0" onClick={() => void submitQuestion(answerQuestion)}>Try again</Button></AlertDescription></Alert> : null}
              {selectedFaq ? <AnswerPanel answer={selectedFaq.answer} sourceLabel={selectedFaq.sourceLabel} sourceId={selectedFaq.id} reviewedAt={selectedFaq.reviewedAt} isHandoff={false} isPrivate={false} /> : null}
              {answer ? <AnswerPanel answer={answer.answer} sourceLabel={answer.sourceLabel} sourceId={answer.sourceId} reviewedAt={answer.reviewedAt} isHandoff={answer.status === "handoff"} isPrivate={isPrivateAnswer} /> : null}
              {answer?.suggestedQuestions?.length ? <div className="mt-4 flex flex-col gap-2 border-t pt-4"><p className="text-sm font-medium">You might also find helpful</p><div className="flex flex-wrap gap-2">{answer.suggestedQuestions.map((suggestion) => <Button key={suggestion} variant="outline" size="sm" className="h-auto whitespace-normal text-left" onClick={() => void submitQuestion(suggestion)}>{suggestion}<ArrowRight data-icon="inline-end" /></Button>)}</div></div> : null}
            </section> : null}
          </div>
          <section aria-labelledby="faq-heading" className="flex h-full flex-col">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div><h2 id="faq-heading" className="text-xl font-semibold sm:text-2xl">Popular questions</h2><p className="mt-0.5 text-sm text-muted-foreground sm:text-base">Quick answers from your center</p></div>
              <span className="hidden text-xs text-muted-foreground sm:block">{featuredFaqs.length} answers</span>
            </div>
            {isLoading ? <p className="py-5 text-sm text-muted-foreground" role="status">Loading center answers…</p> : null}
            {loadError ? <Alert variant="destructive"><CircleHelp /><AlertTitle>We can&apos;t load the center&apos;s answers</AlertTitle><AlertDescription>{loadError}<Button variant="link" className="ml-1 h-auto p-0" onClick={() => window.location.reload()}>Try again</Button></AlertDescription></Alert> : null}
            {!isLoading && !loadError && featuredFaqs.length === 0 ? <Card><div className="px-5 py-6 text-base text-muted-foreground">No quick answers are available yet. Ask a question and we&apos;ll help you find the right person.</div></Card> : null}
            {!isLoading && !loadError && featuredFaqs.length > 0 ? <div className="grid content-start gap-3 md:flex-1 md:auto-rows-fr md:grid-cols-2">{featuredFaqs.map((faq, index) => <FaqCard faq={faq} key={faq.id} index={index} onSelect={openFaq} />)}</div> : null}
          </section>
        </div>

        <footer className="mt-auto flex flex-col justify-between gap-2 border-t pt-3 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <div className="flex items-center gap-2"><Logo size={20} variant="mark" />brightflare family desk</div>
          <div className="flex items-center gap-1.5"><ShieldCheck aria-hidden="true" className="size-3.5" />Answers come from center-approved information.</div>
        </footer>
      </div>

      <Dialog open={isIpadPreviewOpen} onOpenChange={setIsIpadPreviewOpen}>
        <DialogContent showCloseButton={false} className="w-[calc(100%-1rem)] max-w-[calc(100%-1rem)] gap-3 p-3 sm:w-[calc(100%-2rem)] sm:max-w-[calc(100%-2rem)] sm:p-4">
          <DialogHeader className="flex-row items-center justify-between gap-3 pr-1">
            <div className="flex flex-col gap-1">
              <DialogTitle>iPad front desk preview</DialogTitle>
              <DialogDescription>Landscape preview at 1180 × 820 pixels.</DialogDescription>
            </div>
            <Button type="button" variant="outline" size="sm" aria-label="Close iPad preview" onClick={() => setIsIpadPreviewOpen(false)}><X data-icon="inline-start" />Close</Button>
          </DialogHeader>
          <div className="mx-auto overflow-hidden rounded-lg border bg-background shadow-sm" style={{ width: 1180 * ipadPreviewScale, height: 820 * ipadPreviewScale }}>
            <iframe title="Family help desk at iPad landscape resolution" src="/?ipadPreview=1" className="origin-top-left border-0" style={{ width: 1180, height: 820, transform: `scale(${ipadPreviewScale})` }} />
          </div>
        </DialogContent>
      </Dialog>

    </main>
  );
}

function FaqCard({ faq, index, onSelect }: { faq: Faq; index: number; onSelect: (faq: Faq) => void }) {
  const [isExpanded, setIsExpanded] = useState(false);

  function handleSelect() {
    if (window.matchMedia?.("(max-width: 767px)").matches) {
      setIsExpanded((current) => !current);
      return;
    }
    onSelect(faq);
  }

  return <Card className="gap-0 py-0 shadow-sm">
    <CardContent className="h-full px-0">
      <button type="button" aria-expanded={isExpanded} className="flex h-full min-h-16 w-full items-stretch gap-3 overflow-hidden rounded-lg p-0 text-left focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring md:min-h-28" onClick={handleSelect}>
        <span className={`w-1 shrink-0 self-stretch rounded-[5px] ${["bg-brand-blue", "bg-brand-teal", "bg-brand-pink", "bg-brand-amber"][index % 4]}`} aria-hidden="true" />
        <span className="flex min-w-0 flex-1 flex-col items-start gap-2 py-3 pr-4">
        <span className="flex w-full items-center gap-3">
          <span className="flex-1 text-sm font-bold leading-snug sm:text-base">{faq.title}</span>
          <ChevronRight aria-hidden="true" className={`size-4 shrink-0 text-muted-foreground transition-transform md:hidden ${isExpanded ? "rotate-90" : ""}`} />
        </span>
        <span className={`text-sm leading-6 text-muted-foreground ${isExpanded ? "block" : "hidden md:block"}`}>{faq.shortAnswer}</span>
        <span className={`mt-auto items-center gap-1.5 pt-1 text-xs font-medium text-foreground ${isExpanded ? "flex" : "hidden md:flex"}`}><BookOpen aria-hidden="true" className="size-4 shrink-0" />{faq.sourceLabel}</span>
        </span>
      </button>
      {isExpanded ? <div className="px-4 pb-3 md:hidden"><Button type="button" size="sm" variant="outline" onClick={() => onSelect(faq)}>Read full answer<ArrowRight data-icon="inline-end" /></Button></div> : null}
    </CardContent>
  </Card>;
}

function AnswerPanel({ answer, sourceLabel, sourceId, reviewedAt, isHandoff, isPrivate }: { answer: string; sourceLabel: string; sourceId: string; reviewedAt: string; isHandoff: boolean; isPrivate: boolean }) {
  return <div className="flex flex-col gap-4">
    <p className="whitespace-pre-wrap text-sm leading-6 sm:text-base sm:leading-7">{answer}</p>
    {isHandoff ? <Alert><MessageCircle /><AlertTitle>Let&apos;s get you a definite answer</AlertTitle><AlertDescription>This may depend on your family&apos;s situation. Please check with a member of the center team.</AlertDescription></Alert> : null}
    <div className="flex flex-col gap-1 border-t pt-3">
      <p className="flex items-center gap-1.5 text-sm font-medium"><BookOpen aria-hidden="true" className="size-4" />{isHandoff ? "Staff follow-up" : "Answer source"}</p>
      <p className="pl-[22px] text-sm text-muted-foreground">{sourceLabel || "Center staff"}</p>
      {!isHandoff && !isPrivate && sourceId ? <a href={`/handbook/${encodeURIComponent(sourceId.split(",")[0])}`} target="_blank" rel="noopener noreferrer" className="pl-[22px] text-sm font-medium text-primary underline-offset-2 hover:underline">Read the handbook section</a> : null}
      {reviewedAt ? <p className="pl-[22px] text-xs text-muted-foreground">Reviewed {formatReviewDate(reviewedAt)}</p> : null}
    </div>
  </div>;
}
