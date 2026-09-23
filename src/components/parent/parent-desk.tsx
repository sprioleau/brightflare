"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, CircleHelp, Clock3, LockKeyhole, MessageCircle, Send, ShieldCheck, UserRound } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
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

function getSessionId() {
  const sessionKey = "brightflare-session";
  const currentId = window.sessionStorage.getItem(sessionKey);
  if (currentId) return currentId;
  const createdId = window.crypto.randomUUID();
  window.sessionStorage.setItem(sessionKey, createdId);
  return createdId;
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
  const [isAsking, setIsAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [answerQuestion, setAnswerQuestion] = useState("");
  const [isPrivateAnswer, setIsPrivateAnswer] = useState(false);
  const [selectedFaq, setSelectedFaq] = useState<Faq | null>(null);
  const [isChildSearchOpen, setIsChildSearchOpen] = useState(false);
  const [childName, setChildName] = useState("");
  const [pin, setPin] = useState("");
  const [isChildVerified, setIsChildVerified] = useState(false);
  const [childVerificationError, setChildVerificationError] = useState<string | null>(null);

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

  const featuredFaqs = useMemo(() => deskData?.faqs.slice(0, 6) ?? [], [deskData]);

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
        setIsChildVerified(false);
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

  async function verifyChildAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setChildVerificationError(null);
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "family", pin, childName }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "We couldn't verify those details.");
      if (typeof payload.childName !== "string" || !payload.childName) throw new Error("We couldn't confirm the child linked to this PIN.");
      setChildName(payload.childName);
      setIsChildVerified(true);
    } catch (error) {
      setChildVerificationError(error instanceof Error ? error.message : "We couldn't verify those details.");
    }
  }

  function resetChildAccess(shouldLogout = true) {
    setChildName("");
    setPin("");
    setIsChildVerified(false);
    setChildVerificationError(null);
    setIsChildSearchOpen(false);
    if (shouldLogout) void fetch("/api/auth/logout", { method: "POST" });
  }

  const showingAnswer = Boolean(answer || selectedFaq || isAsking || askError);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b-2 border-foreground bg-card">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <a className="flex items-center gap-2" href="#home" aria-label="brightflare home" onClick={closeAnswer}>
            <Logo size={32} />
          </a>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{deskData?.center.name ?? "Family help"}</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 pb-12 pt-8 sm:px-6 sm:pt-10" id="home">
        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <span className="mb-3 inline-flex rounded-md border-2 border-foreground bg-brand-amber px-2.5 py-1 text-xs font-bold tracking-wide">FAMILY HELP DESK</span>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{deskData?.center.name ?? "How can we help?"}</h1>
            {deskData?.center.tagline ? <p className="mt-2 text-base text-muted-foreground">{deskData.center.tagline}</p> : <p className="mt-2 text-base text-muted-foreground">Quick answers for your family.</p>}
          </div>
          {deskData?.center.hours ? <div className="flex items-center gap-2 self-start rounded-lg border-2 border-foreground bg-brand-teal px-3 py-2 text-sm font-semibold text-foreground sm:self-auto"><Clock3 aria-hidden="true" className="size-4" />{deskData.center.hours}</div> : null}
        </div>

        {showingAnswer ? (
          <section aria-live="polite" className="mb-8">
            <Button variant="ghost" size="sm" className="mb-3 -ml-2" onClick={closeAnswer}><ArrowLeft data-icon="inline-start" />Back to questions</Button>
            <Card className="gap-0 shadow-hard-lg">
              <div className="p-5 sm:p-6">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-primary">Your question</p>
                <h2 className="text-xl font-bold">{answerQuestion}</h2>
              </div>
              <Separator />
              <div className="flex flex-col gap-5 p-5 sm:p-6">
                {isAsking ? <p className="text-base text-muted-foreground" role="status">Looking through your center&apos;s handbook and updates…</p> : null}
                {askError ? <Alert variant="destructive"><CircleHelp /><AlertTitle>We couldn&apos;t get that answer</AlertTitle><AlertDescription>{askError}<Button variant="link" className="ml-1 h-auto p-0" onClick={() => void submitQuestion(answerQuestion)}>Try again</Button></AlertDescription></Alert> : null}
                {selectedFaq ? <AnswerPanel answer={selectedFaq.answer} sourceLabel={selectedFaq.sourceLabel} reviewedAt={selectedFaq.reviewedAt} isHandoff={false} /> : null}
                {answer ? <AnswerPanel answer={answer.answer} sourceLabel={answer.sourceLabel} reviewedAt={answer.reviewedAt} isHandoff={answer.status === "handoff"} /> : null}
                {answer?.suggestedQuestions?.length ? <div className="flex flex-col gap-2 border-t pt-4"><p className="text-sm font-medium">You might also find helpful</p><div className="flex flex-wrap gap-2">{answer.suggestedQuestions.map((suggestion) => <Button key={suggestion} variant="outline" size="sm" className="h-auto whitespace-normal text-left" onClick={() => void submitQuestion(suggestion)}>{suggestion}<ArrowRight data-icon="inline-end" /></Button>)}</div></div> : null}
              </div>
            </Card>
          </section>
        ) : (
          <>
            <Card className="mb-9 gap-0 shadow-hard-lg">
              <form onSubmit={(event) => { event.preventDefault(); void submitQuestion(); }}>
                <label htmlFor="parent-question" className="block px-5 pt-5 text-lg font-bold">What can we help you find?</label>
                <Textarea id="parent-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Type your question here…" className="mx-5 my-4 min-h-24 w-[calc(100%-2.5rem)]" />
                {askError ? <p role="alert" className="px-4 pb-2 text-sm text-destructive">{askError}</p> : null}
                <div className="flex flex-col justify-between gap-3 border-t-2 bg-accent px-5 py-4 sm:flex-row sm:items-center">
                  <Button type="button" variant="outline" className="justify-start" onClick={() => { setIsChildSearchOpen(true); setIsChildVerified(false); }}><UserRound data-icon="inline-start" />Ask about my child<LockKeyhole data-icon="inline-end" /></Button>
                  <Button type="submit" disabled={!question.trim() || isAsking}>{isAsking ? "Finding an answer…" : "Ask brightflare"}<Send data-icon="inline-end" /></Button>
                </div>
              </form>
            </Card>

            <section aria-labelledby="faq-heading">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div><h2 id="faq-heading" className="text-2xl font-bold">Popular questions</h2><p className="mt-0.5 text-base text-muted-foreground">Quick answers from your center</p></div>
                <span className="hidden text-xs text-muted-foreground sm:block">{featuredFaqs.length} answers</span>
              </div>
              {isLoading ? <p className="py-5 text-sm text-muted-foreground" role="status">Loading center answers…</p> : null}
              {loadError ? <Alert variant="destructive"><CircleHelp /><AlertTitle>We can&apos;t load the center&apos;s answers</AlertTitle><AlertDescription>{loadError}<Button variant="link" className="ml-1 h-auto p-0" onClick={() => window.location.reload()}>Try again</Button></AlertDescription></Alert> : null}
              {!isLoading && !loadError && featuredFaqs.length === 0 ? <Card><div className="px-5 py-6 text-base text-muted-foreground">No quick answers are available yet. Ask a question above and we&apos;ll help you find the right person.</div></Card> : null}
              {!isLoading && !loadError && featuredFaqs.length > 0 ? <Card className="gap-0 shadow-hard">{featuredFaqs.map((faq, index) => <FaqRow faq={faq} key={faq.id} index={index} isLast={index === featuredFaqs.length - 1} onSelect={openFaq} />)}</Card> : null}
            </section>
          </>
        )}

        <footer className="mt-8 flex flex-col justify-between gap-2 border-t pt-4 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <div className="flex items-center gap-2"><Logo size={20} variant="mark" />brightflare family desk</div>
          <div className="flex items-center gap-1.5"><ShieldCheck aria-hidden="true" className="size-3.5" />Answers come from center-approved information.</div>
        </footer>
      </div>

      <Dialog open={isChildSearchOpen} onOpenChange={(isOpen) => { if (!isOpen) resetChildAccess(); else setIsChildSearchOpen(true); }}>
        <DialogContent className="gap-5 rounded-xl border-2 border-foreground shadow-hard-lg sm:max-w-md">
          <DialogHeader>
            <DialogTitle>A private question about your child</DialogTitle>
            <DialogDescription>Verify your access first. Your child&apos;s information stays private on this shared screen.</DialogDescription>
          </DialogHeader>
          {isChildVerified ? <div className="flex flex-col gap-4">
            <Alert><Check /><AlertTitle>Access verified for {childName}</AlertTitle><AlertDescription>Ask about a teacher message or other child-specific information.</AlertDescription></Alert>
            <form onSubmit={(event) => { event.preventDefault(); const questionForChild = question.trim(); if (questionForChild) { resetChildAccess(false); void submitQuestion(`@child ${questionForChild}`); } }} className="flex flex-col gap-3">
              <label htmlFor="child-question" className="text-sm font-medium">What would you like to know?</label>
              <Textarea id="child-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={`Ask about ${childName}`} />
              <Button type="submit" disabled={!question.trim()}>Ask privately<ArrowRight data-icon="inline-end" /></Button>
            </form>
          </div> : <form onSubmit={(event) => void verifyChildAccess(event)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2"><label htmlFor="child-name" className="text-sm font-medium">Child&apos;s name</label><Input id="child-name" autoComplete="off" value={childName} onChange={(event) => setChildName(event.target.value)} placeholder="Enter your child’s name" required /></div>
            <div className="flex flex-col gap-2"><label htmlFor="parent-pin" className="text-sm font-medium">Parent PIN</label><Input id="parent-pin" autoComplete="off" inputMode="numeric" type="password" value={pin} onChange={(event) => setPin(event.target.value)} placeholder="PIN from your center" required /></div>
            {childVerificationError ? <Alert variant="destructive"><AlertDescription>{childVerificationError}</AlertDescription></Alert> : null}
            <p className="text-xs text-muted-foreground">Your center provides this PIN. Your private session ends after your question.</p>
            <Button type="submit" disabled={!childName.trim() || !pin.trim()}>Verify access<ArrowRight data-icon="inline-end" /></Button>
          </form>}
        </DialogContent>
      </Dialog>
    </main>
  );
}

function FaqRow({ faq, index, isLast, onSelect }: { faq: Faq; index: number; isLast: boolean; onSelect: (faq: Faq) => void }) {
  return <div className="px-4 sm:px-5">
    <button type="button" className="flex w-full items-start justify-between gap-4 rounded-lg py-4 text-left focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring" onClick={() => onSelect(faq)}>
      <span className="flex min-w-0 gap-3">
        <span className={`mt-1.5 size-3 shrink-0 rounded-sm border border-foreground ${["bg-brand-amber", "bg-brand-teal", "bg-brand-pink", "bg-brand-blue"][index % 4]}`} aria-hidden="true" />
        <span className="flex min-w-0 flex-col gap-1.5">
          <span className="text-base font-bold">{faq.title}</span>
          <span className="text-base leading-6 text-muted-foreground">{faq.shortAnswer}</span>
          <span className="flex items-center gap-1.5 text-sm font-medium text-foreground"><BookOpen aria-hidden="true" className="size-4" />{faq.sourceLabel}</span>
        </span>
      </span>
      <ChevronRight aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
    </button>
    {!isLast ? <Separator /> : null}
  </div>;
}

function AnswerPanel({ answer, sourceLabel, reviewedAt, isHandoff }: { answer: string; sourceLabel: string; reviewedAt: string; isHandoff: boolean }) {
  return <div className="flex flex-col gap-4">
    <p className="whitespace-pre-wrap text-base leading-7">{answer}</p>
    {isHandoff ? <Alert><MessageCircle /><AlertTitle>Let&apos;s get you a definite answer</AlertTitle><AlertDescription>This may depend on your family&apos;s situation. Please check with a member of the center team.</AlertDescription></Alert> : null}
    <div className="flex flex-col gap-1 border-t pt-3">
      <p className="flex items-center gap-1.5 text-sm font-medium"><BookOpen aria-hidden="true" className="size-4" />{isHandoff ? "Staff follow-up" : "Answer source"}</p>
      <p className="pl-[22px] text-sm text-muted-foreground">{sourceLabel || "Center staff"}</p>
      {reviewedAt ? <p className="pl-[22px] text-xs text-muted-foreground">Reviewed {formatReviewDate(reviewedAt)}</p> : null}
    </div>
  </div>;
}
