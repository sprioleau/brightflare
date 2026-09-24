"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BookOpen, ChevronRight, CircleHelp, MessageCircle, Mic, MicOff, Monitor, Send, ShieldCheck, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppShell } from "@/components/brand/app-shell";
import { NotificationBanner } from "@/components/ui/notification-banner";
import { Textarea } from "@/components/ui/textarea";
import { Logo } from "@/components/brand/Logo";
import { parseAnswerStream } from "@/lib/answer-stream";
import { isPrivateChildQuestion } from "@/lib/question-safety";
import styles from "./parent-desk.module.css";

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

type ConversationTurn = {
  question: string;
  answer: Answer;
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
  const answerAbortControllerRef = useRef<AbortController | null>(null);
  const activeRequestIdRef = useRef(0);
  const askDeadlineTimerRef = useRef<number | null>(null);
  const progressTimerRefs = useRef<number[]>([]);
  const questionInputRef = useRef<HTMLTextAreaElement | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const isTranscriptAtBottomRef = useRef(true);
  const idleTimerRef = useRef<number | null>(null);
  const idleWarningTimerRef = useRef<number | null>(null);
  const privateRequestRef = useRef(false);
  const [isAsking, setIsAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [answerDraft, setAnswerDraft] = useState("");
  const [answerQuestion, setAnswerQuestion] = useState("");
  const [conversationTurns, setConversationTurns] = useState<ConversationTurn[]>([]);
  const [assistantProgress, setAssistantProgress] = useState("Looking for an answer…");
  const [isIdleWarningVisible, setIsIdleWarningVisible] = useState(false);
  const [isAnnouncementExpanded, setIsAnnouncementExpanded] = useState(false);
  const [isPrivateAnswer, setIsPrivateAnswer] = useState(false);
  const [isAnnouncementDismissed, setIsAnnouncementDismissed] = useState(false);
  const [isIpadPreviewOpen, setIsIpadPreviewOpen] = useState(false);
  const [isIpadPreviewFrame, setIsIpadPreviewFrame] = useState(false);
  const [ipadPreviewScale, setIpadPreviewScale] = useState(1);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    setIsIpadPreviewFrame(searchParams.get("ipadPreview") === "1");
  }, []);

  function clearAskTimers() {
    if (askDeadlineTimerRef.current !== null) window.clearTimeout(askDeadlineTimerRef.current);
    askDeadlineTimerRef.current = null;
    progressTimerRefs.current.forEach((timerId) => window.clearTimeout(timerId));
    progressTimerRefs.current = [];
  }

  function clearIdleTimers() {
    if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
    if (idleWarningTimerRef.current !== null) window.clearTimeout(idleWarningTimerRef.current);
    idleTimerRef.current = null;
    idleWarningTimerRef.current = null;
  }

  function scheduleIdleWarning() {
    clearIdleTimers();
    setIsIdleWarningVisible(false);
    if ((!answerQuestion && !conversationTurns.length && !question.trim()) || isPrivateAnswer || isAsking || isListening || document.visibilityState === "hidden") return;
    idleTimerRef.current = window.setTimeout(() => {
      setIsIdleWarningVisible(true);
      idleWarningTimerRef.current = window.setTimeout(() => {
        resetConversation();
      }, 20_000);
    }, 120_000);
  }

  function noteFamilyActivity() {
    if (!isIdleWarningVisible && idleTimerRef.current === null) return;
    scheduleIdleWarning();
  }

  function resetConversation() {
    activeRequestIdRef.current += 1;
    clearAskTimers();
    clearIdleTimers();
    answerAbortControllerRef.current?.abort();
    answerAbortControllerRef.current = null;
    const recognition = speechRecognitionRef.current;
    speechRecognitionRef.current = null;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.stop();
    }
    setIsListening(false);
    setQuestion("");
    setAnswer(null);
    setAnswerDraft("");
    setAnswerQuestion("");
    setConversationTurns([]);
    setAssistantProgress("Looking for an answer…");
    setAskError(null);
    setIsPrivateAnswer(false);
    setIsAsking(false);
    setIsIdleWarningVisible(false);
    window.sessionStorage.removeItem("brightflare-session");
    if (privateRequestRef.current) {
      privateRequestRef.current = false;
      void fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope: "family" }) }).catch(() => undefined);
    }
    questionInputRef.current?.focus();
  }

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
      if (speechRecognitionRef.current !== recognition) return;
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
      if (speechRecognitionRef.current !== recognition) return;
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
      if (speechRecognitionRef.current !== recognition) return;
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
    clearAskTimers();
    clearIdleTimers();
    speechRecognitionRef.current?.stop();
    answerAbortControllerRef.current?.abort();
  }, []);

  async function submitQuestion(submittedQuestion = question) {
    const trimmedQuestion = submittedQuestion.trim();
    if (!trimmedQuestion || isAsking) return;
    clearAskTimers();
    clearIdleTimers();
    answerAbortControllerRef.current?.abort();
    const abortController = new AbortController();
    answerAbortControllerRef.current = abortController;
    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;
    const shouldClearFamilySession = isPrivateChildQuestion(trimmedQuestion);
    if (shouldClearFamilySession) setConversationTurns([]);
    privateRequestRef.current = shouldClearFamilySession;
    speechRecognitionRef.current?.stop();
    speechRecognitionRef.current = null;
    setIsListening(false);
    setIsPrivateAnswer(shouldClearFamilySession);
    setQuestion("");
    setAnswerQuestion(trimmedQuestion.startsWith("@child ") ? trimmedQuestion.replace(/^@child\s*/, "") : trimmedQuestion);
    setAnswer(null);
    setAnswerDraft("");
    setAssistantProgress("Looking for an answer…");
    setAskError(null);
    setIsAsking(true);
    let completedAnswer: Answer | null = null;
    progressTimerRefs.current = [
      window.setTimeout(() => {
        if (activeRequestIdRef.current === requestId) setAssistantProgress("Still waiting for an answer…");
      }, 3_000),
      window.setTimeout(() => {
        if (activeRequestIdRef.current === requestId) setAssistantProgress("Taking longer than expected…");
      }, 6_000),
    ];
    askDeadlineTimerRef.current = window.setTimeout(() => {
      if (activeRequestIdRef.current !== requestId) return;
      activeRequestIdRef.current += 1;
      abortController.abort(new Error("The answer request timed out."));
      answerAbortControllerRef.current = null;
      clearAskTimers();
      setAnswerDraft("");
      setAnswer(null);
      setAskError("We couldn’t get an answer in time. Try again or ask the front desk team.");
      setIsAsking(false);
    }, 8_000);
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
        body: JSON.stringify({
          question: trimmedQuestion,
          sessionId: getSessionId(),
          history: shouldClearFamilySession ? [] : conversationTurns.slice(-4).map((turn) => [
            { role: "user", content: turn.question },
            { role: "assistant", content: turn.answer.answer },
          ]).flat(),
        }),
        signal: abortController.signal,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: unknown } | null;
        const isFamilyPinRequired = response.status === 401 && typeof payload?.error === "string" && payload.error.toLowerCase().includes("family pin");
        throw new Error(isFamilyPinRequired ? "Please speak with the front desk team about your child." : typeof payload?.error === "string" ? payload.error : "We couldn't get an answer just now.");
      }
      if (response.headers?.get("content-type")?.includes("application/x-ndjson") && response.body) {
        let hasFinalAnswer = false;
        for await (const event of parseAnswerStream<string, Answer>(response.body)) {
          if (activeRequestIdRef.current !== requestId || abortController.signal.aborted) return;
          if (event.type === "draft") setAnswerDraft(event.value);
          if (event.type === "reset") setAnswerDraft("");
          if (event.type === "final") {
            setAnswerDraft("");
            setAnswer(event.value);
            completedAnswer = event.value;
            hasFinalAnswer = true;
          }
          if (event.type === "error") throw new Error(event.message);
        }
        if (!hasFinalAnswer) throw new Error("The answer stream ended before the center records were checked. Please try again.");
      } else {
        const payload = (await response.json()) as Answer;
        if (activeRequestIdRef.current !== requestId || abortController.signal.aborted) return;
        completedAnswer = payload;
        setAnswer(payload);
      }
      if (activeRequestIdRef.current !== requestId || abortController.signal.aborted) return;
      if (!shouldClearFamilySession && completedAnswer) {
        setConversationTurns((current) => [...current, { question: trimmedQuestion, answer: completedAnswer! }].slice(-20));
        setAnswerQuestion("");
      }
      if (shouldClearFamilySession && document.visibilityState === "hidden") closeAnswer();
      setAssistantProgress("");
    } catch (error) {
      if (activeRequestIdRef.current === requestId && !abortController.signal.aborted) {
        setAnswerDraft("");
        setAskError(error instanceof Error ? error.message : "We couldn't get an answer just now.");
      }
    } finally {
      if (answerAbortControllerRef.current === abortController) answerAbortControllerRef.current = null;
      if (shouldClearFamilySession) {
        privateRequestRef.current = false;
        await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope: "family" }) }).catch(() => undefined);
      }
      if (activeRequestIdRef.current === requestId) {
        clearAskTimers();
        setIsAsking(false);
      }
    }
  }

  function closeAnswer() {
    activeRequestIdRef.current += 1;
    clearAskTimers();
    clearIdleTimers();
    answerAbortControllerRef.current?.abort();
    answerAbortControllerRef.current = null;
    setAnswer(null);
    setAnswerDraft("");
    setAnswerQuestion("");
    setIsPrivateAnswer(false);
    setIsAsking(false);
  }

  useEffect(() => {
    if (!isPrivateAnswer) return;
    function clearPrivateAnswerWhenHidden() {
      if (document.visibilityState === "hidden") {
        answerAbortControllerRef.current?.abort();
        closeAnswer();
      }
    }
    document.addEventListener("visibilitychange", clearPrivateAnswerWhenHidden);
    const timeout = answer || askError ? window.setTimeout(closeAnswer, 30_000) : null;
    return () => {
      document.removeEventListener("visibilitychange", clearPrivateAnswerWhenHidden);
      if (timeout !== null) window.clearTimeout(timeout);
    };
  }, [isPrivateAnswer, answer, askError]);

  const showingAnswer = Boolean(conversationTurns.length || answerQuestion || answer || isAsking || askError);

  useEffect(() => {
    if (!isIdleWarningVisible) scheduleIdleWarning();
    if ((!answerQuestion && !conversationTurns.length && !question.trim()) || isPrivateAnswer || isAsking || isListening) return;
    function handleFamilyActivity() {
      scheduleIdleWarning();
    }
    document.addEventListener("pointerdown", handleFamilyActivity, { passive: true });
    document.addEventListener("touchstart", handleFamilyActivity, { passive: true });
    document.addEventListener("keydown", handleFamilyActivity);
    document.addEventListener("scroll", handleFamilyActivity, { passive: true, capture: true });
    document.addEventListener("visibilitychange", handleFamilyActivity);
    return () => {
      document.removeEventListener("pointerdown", handleFamilyActivity);
      document.removeEventListener("touchstart", handleFamilyActivity);
      document.removeEventListener("keydown", handleFamilyActivity);
      document.removeEventListener("scroll", handleFamilyActivity, true);
      document.removeEventListener("visibilitychange", handleFamilyActivity);
    };
  }, [answerQuestion, conversationTurns.length, question, isPrivateAnswer, isAsking, isListening, isIdleWarningVisible]);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (!transcript || !isTranscriptAtBottomRef.current) return;
    transcript.scrollTop = transcript.scrollHeight;
  }, [answerQuestion, answer, answerDraft, askError, assistantProgress]);

  useEffect(() => {
    if (!showingAnswer || !window.matchMedia?.("(max-width: 767px)").matches) return;
    document.getElementById("parent-answer")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [showingAnswer, answerQuestion]);

  return (
    <AppShell section="family" centerName={deskData?.center.name} centerHours={deskData?.center.hours} actions={!isIpadPreviewFrame ? <Button type="button" size="icon" variant="icon" aria-label="Preview iPad front desk" title="Preview iPad front desk" onClick={() => setIsIpadPreviewOpen(true)}><Monitor aria-hidden="true" className="size-4" /></Button> : null} className={styles.shellContent}>
      <main id="home" className={`parent-desk ${styles.desk}`}>
        {deskData?.center.announcement && !isAnnouncementDismissed ? <NotificationBanner title={deskData.center.announcement.title.trim() || "Center announcement"} className={`${styles.announcement} ${isAnnouncementExpanded ? styles.announcementExpanded : ""}`} onDismiss={() => setIsAnnouncementDismissed(true)}>
          <p className={isAnnouncementExpanded ? "" : styles.announcementPreview}>{deskData.center.announcement.message}</p>
          {deskData.center.announcement.message.length > 120 ? <Button type="button" variant="link" size="sm" className={styles.readMore} aria-expanded={isAnnouncementExpanded} onClick={() => setIsAnnouncementExpanded((current) => !current)}>{isAnnouncementExpanded ? "Show less" : "Read more"}</Button> : null}
        </NotificationBanner> : null}

        <div className={styles.workspace}>
          <section aria-labelledby="family-heading" className={styles.conversationColumn}>
            <header className={styles.columnHeading}>
              <div><h1 id="family-heading" className="type-page-title">How can we help today?</h1><p className="type-supporting">{deskData?.center.tagline || "Quick answers for your family."}</p></div>
            </header>
      <section id="parent-answer" aria-label="Conversation" className={styles.chatSurface}>
              <header className={styles.chatHeader}>
                <h2 id="conversation-heading" tabIndex={-1} className="type-panel-title">Ask brightflare</h2>
                <Button type="button" variant="secondary" size="sm" onClick={resetConversation}>Clear chat</Button>
              </header>
              {isIdleWarningVisible ? <div className={styles.idleWarning} role="status"><p>Clear this conversation in 20 seconds?</p><div><Button type="button" variant="secondary" size="sm" onClick={() => scheduleIdleWarning()}>Keep reading</Button><Button type="button" variant="secondary" size="sm" onClick={resetConversation}>Clear now</Button></div></div> : null}
              <div ref={transcriptRef} className={styles.transcript} onScroll={(event) => {
                const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
                isTranscriptAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 32;
                noteFamilyActivity();
              }}>
                {!showingAnswer ? <div className={styles.emptyPrompt}><Logo size={36} variant="mark" /><p className="type-body">Ask a new question about schedules or center policies.</p><p className="type-supporting">Your center&apos;s handbook, in plain language.</p></div> : <>
                  {conversationTurns.map((turn, index) => <div className={styles.turn} key={`${index}-${turn.question}`}>
                    <div className={styles.userBubble}><span className="type-metadata">You</span><p className="type-body">{turn.question}</p></div>
                    <div aria-label="Answer" className={styles.assistantBubble}>
                      <span className="type-metadata">brightflare</span>
                      <AnswerPanel answer={turn.answer.answer} sourceLabel={turn.answer.sourceLabel} sourceId={turn.answer.sourceId} reviewedAt={turn.answer.reviewedAt} isHandoff={turn.answer.status === "handoff"} isPrivate={false} />
                      {turn.answer.suggestedQuestions?.length ? <div className={styles.suggestions}><p className="type-supporting-strong">You might also find helpful</p><div>{turn.answer.suggestedQuestions.map((suggestion) => <Button key={suggestion} type="button" variant="secondary" size="sm" className="h-auto whitespace-normal text-left" onClick={() => void submitQuestion(suggestion)}>{suggestion}<ArrowRight data-icon="inline-end" /></Button>)}</div></div> : null}
                    </div>
                  </div>)}
                  {answerQuestion || isAsking || askError ? <>
                  <div className={styles.userBubble}><span className="type-metadata">You</span><p className="type-body">{answerQuestion}</p></div>
                  <div aria-label="Answer" className={styles.assistantBubble}>
                    <span className="type-metadata">brightflare</span>
                    {isAsking && !answerDraft ? <p className="type-body" role="status">{assistantProgress}</p> : null}
                    {answerDraft ? <div aria-label="Draft answer" className={styles.answerDraft}><p className="type-metadata">Draft · not yet verified</p><p className="type-body">{answerDraft}</p></div> : null}
                    {askError ? <div className={styles.errorMessage} role="alert"><p className="type-body">{askError}</p><Button type="button" variant="secondary" size="sm" onClick={() => void submitQuestion(answerQuestion)}>Try again</Button></div> : null}
                    {answer ? <AnswerPanel answer={answer.answer} sourceLabel={answer.sourceLabel} sourceId={answer.sourceId} reviewedAt={answer.reviewedAt} isHandoff={answer.status === "handoff"} isPrivate={isPrivateAnswer} /> : null}
                    {answer?.suggestedQuestions?.length ? <div className={styles.suggestions}><p className="type-supporting-strong">You might also find helpful</p><div>{answer.suggestedQuestions.map((suggestion) => <Button key={suggestion} type="button" variant="secondary" size="sm" className="h-auto whitespace-normal text-left" onClick={() => void submitQuestion(suggestion)}>{suggestion}<ArrowRight data-icon="inline-end" /></Button>)}</div></div> : null}
                  </div>
                  </> : null}
                </>}
              </div>
              <form className={styles.composer} onSubmit={(event) => { event.preventDefault(); void submitQuestion(); }}>
                <label htmlFor="parent-question" className="type-supporting-strong">What can we help you find?</label>
                <div className={styles.composerInputRow}>
                  <Textarea ref={questionInputRef} id="parent-question" value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && event.shiftKey) { event.preventDefault(); void submitQuestion(); } }} placeholder="Type your question here…" className={styles.questionInput} />
                  <div className={styles.composerActions}>
                    <Button type="button" size="icon" variant={isListening ? "secondary" : "icon"} aria-label={isListening ? "Stop voice input" : "Start voice input"} title={isListening ? "Stop voice input" : "Start voice input"} onClick={toggleVoiceInput}>{isListening ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />}</Button>
                    <Button type="submit" size="icon" variant="primary" aria-label={isAsking ? "Finding an answer" : "Ask brightflare"} title={isAsking ? "Finding an answer…" : "Ask brightflare"} disabled={!question.trim() || isAsking}><Send aria-hidden="true" /></Button>
                  </div>
                </div>
                {isListening ? <p role="status" className="type-metadata">Listening… Speak your question, then tap the microphone to stop.</p> : null}
                {speechError ? <p role="alert" className={styles.speechError}>{speechError}</p> : null}
                <p className="type-metadata">Shared iPad · tap Clear chat when you&apos;re finished.</p>
              </form>
            </section>
          </section>
          <section aria-labelledby="faq-heading" className={styles.faqColumn}>
            <header className={styles.columnHeading}>
              <div><h2 id="faq-heading" className="type-page-title">Popular questions</h2><p className="type-supporting">Quick answers from your center</p></div>
              <span className="type-metadata">{featuredFaqs.length} answers</span>
            </header>
            {isLoading ? <p className="type-supporting" role="status">Loading center answers…</p> : null}
            {loadError ? <Alert variant="destructive"><CircleHelp /><AlertTitle>We can&apos;t load the center&apos;s answers</AlertTitle><AlertDescription>{loadError}<Button variant="link" className="ml-1 h-auto p-0" onClick={() => window.location.reload()}>Try again</Button></AlertDescription></Alert> : null}
            {!isLoading && !loadError && featuredFaqs.length === 0 ? <Card><div className="px-5 py-6 text-base text-muted-foreground">No quick answers are available yet. Ask a question and we&apos;ll help you find the right person.</div></Card> : null}
            {!isLoading && !loadError && featuredFaqs.length > 0 ? <div className={styles.faqGrid}>{featuredFaqs.map((faq, index) => <FaqCard faq={faq} key={faq.id} index={index} />)}</div> : null}
          </section>
        </div>

        <footer className={styles.footer}>
          <div className="flex items-center gap-2"><Logo size={20} variant="mark" />brightflare family desk</div>
          <div className="flex items-center gap-1.5"><ShieldCheck aria-hidden="true" className="size-3.5" />Answers come from center-approved information.</div>
        </footer>
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
    </AppShell>
  );
}

function FaqCard({ faq, index }: { faq: Faq; index: number }) {
  const [isExpanded, setIsExpanded] = useState(false);

  function handleSelect() {
    setIsExpanded((current) => !current);
  }

  return <article className={styles.faqCard} data-expanded={isExpanded}>
    <Button type="button" aria-expanded={isExpanded} variant="disclosure" className={styles.faqTrigger} onClick={handleSelect}>
      <span className={styles.faqMarker} data-color={index % 4} aria-hidden="true" />
      <span className="min-w-0 flex-1 text-left type-supporting-strong">{faq.title}</span>
      <ChevronRight aria-hidden="true" className={`size-4 shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
    </Button>
    {isExpanded ? <div className={styles.faqPreview}>
      <p className="type-body">{faq.answer}</p>
      <p className="type-metadata">Answer source · {faq.sourceLabel}</p>
      <a href={`/handbook/${encodeURIComponent(faq.id)}`} className="type-supporting-strong text-primary underline-offset-2 hover:underline">Read the handbook section<ArrowRight aria-hidden="true" className="ml-1 inline size-4" /></a>
      <p className="type-metadata">Reviewed {formatReviewDate(faq.reviewedAt)}</p>
    </div> : null}
  </article>;
}

function AnswerPanel({ answer, sourceLabel, sourceId, reviewedAt, isHandoff, isPrivate }: { answer: string; sourceLabel: string; sourceId: string; reviewedAt: string; isHandoff: boolean; isPrivate: boolean }) {
  return <div className="flex flex-col gap-4">
    <p className="whitespace-pre-wrap type-body">{answer}</p>
    {isHandoff ? <Alert><MessageCircle /><AlertTitle>Let&apos;s get you a definite answer</AlertTitle><AlertDescription>This may depend on your family&apos;s situation. Please check with a member of the center team.</AlertDescription></Alert> : null}
    <div className="flex flex-col gap-1 border-t pt-3">
      <p className="flex items-center gap-1.5 text-sm font-medium"><BookOpen aria-hidden="true" className="size-4" />{isHandoff ? "Staff follow-up" : "Answer source"}</p>
      <p className="pl-[22px] text-sm text-muted-foreground">{sourceLabel || "Center staff"}</p>
      {!isHandoff && !isPrivate && sourceId ? <a href={`/handbook/${encodeURIComponent(sourceId.split(",")[0])}`} target="_blank" rel="noopener noreferrer" className="pl-[22px] text-sm font-medium text-primary underline-offset-2 hover:underline">Read the handbook section</a> : null}
      {reviewedAt ? <p className="pl-[22px] text-xs text-muted-foreground">Reviewed {formatReviewDate(reviewedAt)}</p> : null}
    </div>
  </div>;
}
