import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

const knowledgeStatus = v.union(v.literal("published"), v.literal("draft"));
const topicStatus = v.union(
  v.literal("needs_answer"),
  v.literal("needs_review"),
  v.literal("answered"),
  v.literal("handled_by_staff"),
);

const knowledgeInput = {
  title: v.string(),
  shortAnswer: v.string(),
  answer: v.string(),
  sourceLabel: v.string(),
  category: v.string(),
  isFeatured: v.boolean(),
  startsAt: v.optional(v.number()),
  endsAt: v.optional(v.number()),
  reviewedAt: v.number(),
  status: knowledgeStatus,
};

function assertServerSecret(secret: string) {
  const expected = process.env.BRIGHTFLARE_SERVER_SECRET;
  if (!expected || secret !== expected) {
    throw new Error("Unauthorized");
  }
}

function knowledgeSearchText(entry: {
  title: string;
  shortAnswer: string;
  answer: string;
  category: string;
}) {
  return `${entry.title} ${entry.shortAnswer} ${entry.answer} ${entry.category}`;
}

export const getFrontDesk = query({
  args: { centerSlug: v.string(), now: v.number() },
  returns: v.object({
    center: v.object({ name: v.string(), handbookLabel: v.string(), websiteUrl: v.union(v.string(), v.null()) }),
    featured: v.array(v.object({
      id: v.id("knowledge"), title: v.string(), shortAnswer: v.string(), answer: v.string(),
      sourceLabel: v.string(), category: v.string(), reviewedAt: v.number(),
    })),
    evergreen: v.array(v.object({
      id: v.id("knowledge"), title: v.string(), shortAnswer: v.string(), answer: v.string(),
      sourceLabel: v.string(), category: v.string(), reviewedAt: v.number(),
    })),
  }),
  handler: async (ctx, args) => {
    const center = await ctx.db.query("centers").withIndex("by_slug", (q) => q.eq("slug", args.centerSlug)).unique();
    if (!center) throw new Error("Center not found");
    const rows = await ctx.db.query("knowledge")
      .withIndex("by_center_and_status", (q) => q.eq("centerId", center._id).eq("status", "published"))
      .take(100);
    const active = rows.filter((entry) => (entry.startsAt === undefined || entry.startsAt <= args.now)
      && (entry.endsAt === undefined || entry.endsAt >= args.now));
    const toPublic = (entry: Doc<"knowledge">) => ({
      id: entry._id, title: entry.title, shortAnswer: entry.shortAnswer, answer: entry.answer,
      sourceLabel: entry.sourceLabel, category: entry.category, reviewedAt: entry.reviewedAt,
    });
    return {
      center: { name: center.name, handbookLabel: center.handbookLabel, websiteUrl: center.websiteUrl ?? null },
      featured: active.filter((entry) => entry.isFeatured).slice(0, 8).map(toPublic),
      evergreen: active.filter((entry) => !entry.isFeatured).slice(0, 20).map(toPublic),
    };
  },
});

export const getAdmin = query({
  args: { secret: v.string(), centerSlug: v.string() },
  returns: v.object({
    center: v.object({ id: v.id("centers"), name: v.string(), handbookLabel: v.string() }),
    knowledge: v.array(v.object({
      id: v.id("knowledge"), title: v.string(), shortAnswer: v.string(), answer: v.string(),
      sourceLabel: v.string(), category: v.string(), isFeatured: v.boolean(), startsAt: v.union(v.number(), v.null()),
      endsAt: v.union(v.number(), v.null()), reviewedAt: v.number(), status: knowledgeStatus,
    })),
    topics: v.array(v.object({
      id: v.id("topics"), canonicalTitle: v.string(), canonicalKey: v.string(), questionCount: v.number(),
      sessionCount: v.number(), status: topicStatus, recentExamples: v.array(v.string()),
      lastAskedAt: v.number(), knowledgeId: v.union(v.id("knowledge"), v.null()),
    })),
    recentQuestions: v.array(v.object({
      id: v.id("questionEvents"), question: v.string(), topicId: v.union(v.id("topics"), v.null()), topicTitle: v.union(v.string(), v.null()),
      askedAt: v.number(), outcome: v.union(v.literal("answered"), v.literal("needs_staff")),
      sourceStatus: v.union(v.literal("sourced"), v.literal("unsourced")), isPrivate: v.boolean(),
    })),
  }),
  handler: async (ctx, args) => {
    assertServerSecret(args.secret);
    const center = await ctx.db.query("centers").withIndex("by_slug", (q) => q.eq("slug", args.centerSlug)).unique();
    if (!center) throw new Error("Center not found");
    const knowledge = await ctx.db.query("knowledge")
      .withIndex("by_center_and_status", (q) => q.eq("centerId", center._id).eq("status", "published"))
      .take(100);
    const drafts = await ctx.db.query("knowledge")
      .withIndex("by_center_and_status", (q) => q.eq("centerId", center._id).eq("status", "draft"))
      .take(100);
    const topics = await ctx.db.query("topics")
      .withIndex("by_center_and_status_and_last_asked", (q) => q.eq("centerId", center._id).eq("status", "needs_answer"))
      .order("desc").take(50);
    const reviewTopics = await ctx.db.query("topics")
      .withIndex("by_center_and_status_and_last_asked", (q) => q.eq("centerId", center._id).eq("status", "needs_review"))
      .order("desc").take(50);
    const answeredTopics = await ctx.db.query("topics")
      .withIndex("by_center_and_status_and_last_asked", (q) => q.eq("centerId", center._id).eq("status", "answered"))
      .order("desc").take(50);
    const handledTopics = await ctx.db.query("topics")
      .withIndex("by_center_and_status_and_last_asked", (q) => q.eq("centerId", center._id).eq("status", "handled_by_staff"))
      .order("desc").take(50);
    const questionEvents = await ctx.db.query("questionEvents")
      .withIndex("by_center_and_asked_at", (q) => q.eq("centerId", center._id))
      .order("desc").take(50);
    const recentQuestions = await Promise.all(questionEvents.map(async (event) => {
      const topic = event.topicId ? await ctx.db.get(event.topicId) : null;
      return {
        id: event._id, question: event.redactedQuestion, topicId: event.topicId ?? null,
        topicTitle: topic?.canonicalTitle ?? null, askedAt: event.askedAt, outcome: event.outcome,
        sourceStatus: event.sourceStatus, isPrivate: event.isPrivate,
      };
    }));
    return {
      center: { id: center._id, name: center.name, handbookLabel: center.handbookLabel },
      knowledge: [...knowledge, ...drafts].map((entry) => ({
        id: entry._id, title: entry.title, shortAnswer: entry.shortAnswer, answer: entry.answer,
        sourceLabel: entry.sourceLabel, category: entry.category, isFeatured: entry.isFeatured,
        startsAt: entry.startsAt ?? null, endsAt: entry.endsAt ?? null, reviewedAt: entry.reviewedAt, status: entry.status,
      })),
      topics: [...topics, ...reviewTopics, ...answeredTopics, ...handledTopics].map((topic) => ({
        id: topic._id, canonicalTitle: topic.canonicalTitle, canonicalKey: topic.canonicalKey,
        questionCount: topic.questionCount, sessionCount: topic.sessionCount, status: topic.status,
        recentExamples: topic.recentExamples, lastAskedAt: topic.lastAskedAt, knowledgeId: topic.knowledgeId ?? null,
      })),
      recentQuestions: recentQuestions.filter((event) => event !== null),
    };
  },
});

export const getAdminQuestionEvents = query({
  args: { secret: v.string(), centerSlug: v.string(), paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(v.object({
      id: v.id("questionEvents"), question: v.string(), topicId: v.union(v.id("topics"), v.null()),
      topicTitle: v.union(v.string(), v.null()), askedAt: v.number(),
      outcome: v.union(v.literal("answered"), v.literal("needs_staff")),
      sourceStatus: v.union(v.literal("sourced"), v.literal("unsourced")), isPrivate: v.boolean(),
    })),
    isDone: v.boolean(), continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    assertServerSecret(args.secret);
    const center = await ctx.db.query("centers").withIndex("by_slug", (q) => q.eq("slug", args.centerSlug)).unique();
    if (!center) throw new Error("Center not found");
    const result = await ctx.db.query("questionEvents")
      .withIndex("by_center_and_asked_at", (q) => q.eq("centerId", center._id))
      .order("desc").paginate(args.paginationOpts);
    const page = await Promise.all(result.page.map(async (event) => {
      const topic = event.topicId ? await ctx.db.get(event.topicId) : null;
      return {
        id: event._id, question: event.redactedQuestion, topicId: event.topicId ?? null,
        topicTitle: topic?.canonicalTitle ?? null, askedAt: event.askedAt, outcome: event.outcome,
        sourceStatus: event.sourceStatus, isPrivate: event.isPrivate,
      };
    }));
    return { page, isDone: result.isDone, continueCursor: result.continueCursor };
  },
});

export const getSeasonalHistory = query({
  args: { secret: v.string(), centerSlug: v.string(), month: v.number() },
  returns: v.array(v.object({ canonicalTitle: v.string(), questionCount: v.number(), year: v.number() })),
  handler: async (ctx, args) => {
    assertServerSecret(args.secret);
    if (!Number.isInteger(args.month) || args.month < 1 || args.month > 12) throw new Error("Month must be between 1 and 12");
    const center = await ctx.db.query("centers").withIndex("by_slug", (q) => q.eq("slug", args.centerSlug)).unique();
    if (!center) return [];
    const history = await ctx.db.query("seasonalHistory")
      .withIndex("by_center_month_and_year", (q) => q.eq("centerId", center._id).eq("month", args.month))
      .order("desc").take(30);
    return history.map((entry) => ({ canonicalTitle: entry.canonicalTitle, questionCount: entry.questionCount, year: entry.year }));
  },
});

export const getChildContext = query({
  args: { secret: v.string(), centerSlug: v.string(), childName: v.string() },
  returns: v.union(v.null(), v.object({
    child: v.object({ id: v.id("children"), name: v.string(), ageGroup: v.string() }),
    messages: v.array(v.object({ id: v.id("childMessages"), dateLabel: v.string(), summary: v.string(), sourceLabel: v.string() })),
    relevantNotes: v.array(v.object({ id: v.id("knowledge"), title: v.string(), shortAnswer: v.string(), sourceLabel: v.string() })),
  })),
  handler: async (ctx, args) => {
    assertServerSecret(args.secret);
    const center = await ctx.db.query("centers").withIndex("by_slug", (q) => q.eq("slug", args.centerSlug)).unique();
    if (!center) return null;
    const normalizedName = args.childName.trim().toLocaleLowerCase();
    const children = await ctx.db.query("children")
      .withIndex("by_center_and_name", (q) => q.eq("centerId", center._id)).take(50);
    const child = children.find((candidate) => `${candidate.firstName} ${candidate.lastName}`.toLocaleLowerCase() === normalizedName);
    if (!child) return null;
    const messages = await ctx.db.query("childMessages")
      .withIndex("by_child_and_center", (q) => q.eq("childId", child._id).eq("centerId", center._id))
      .order("desc").take(8);
    const notes = await ctx.db.query("knowledge")
      .withIndex("by_center_and_status", (q) => q.eq("centerId", center._id).eq("status", "published"))
      .take(100);
    return {
      child: { id: child._id, name: `${child.firstName} ${child.lastName}`, ageGroup: child.ageGroup },
      messages: messages.map((message) => ({ id: message._id, dateLabel: message.dateLabel, summary: message.summary, sourceLabel: message.sourceLabel })),
      relevantNotes: notes.filter((entry) => ["Health", "Safety", "Daily routines"].includes(entry.category)).slice(0, 8)
        .map((entry) => ({ id: entry._id, title: entry.title, shortAnswer: entry.shortAnswer, sourceLabel: entry.sourceLabel })),
    };
  },
});

export const getKnowledgeForAsk = query({
  args: { secret: v.string(), centerSlug: v.string(), now: v.number(), searchText: v.optional(v.string()) },
  returns: v.array(v.object({
    id: v.id("knowledge"), title: v.string(), answer: v.string(), sourceLabel: v.string(), reviewedAt: v.number(),
  })),
  handler: async (ctx, args) => {
    assertServerSecret(args.secret);
    const center = await ctx.db.query("centers").withIndex("by_slug", (q) => q.eq("slug", args.centerSlug)).unique();
    if (!center) return [];
    const matches = await ctx.db.query("knowledge")
      .withIndex("by_center_and_status", (q) => q.eq("centerId", center._id).eq("status", "published"))
      .take(100);
    return matches.filter((entry) => (entry.startsAt === undefined || entry.startsAt <= args.now)
      && (entry.endsAt === undefined || entry.endsAt >= args.now))
      .map((entry) => ({ id: entry._id, title: entry.title, answer: entry.answer, sourceLabel: entry.sourceLabel, reviewedAt: entry.reviewedAt }));
  },
});

export const upsertKnowledge = mutation({
  args: { secret: v.string(), centerSlug: v.string(), id: v.union(v.id("knowledge"), v.null()), topicId: v.optional(v.id("topics")), ...knowledgeInput },
  returns: v.id("knowledge"),
  handler: async (ctx, args) => {
    assertServerSecret(args.secret);
    const center = await ctx.db.query("centers").withIndex("by_slug", (q) => q.eq("slug", args.centerSlug)).unique();
    if (!center) throw new Error("Center not found");
    if (args.startsAt !== undefined && args.endsAt !== undefined && args.startsAt > args.endsAt) throw new Error("Start date must be before end date");
    const { secret: _secret, centerSlug: _centerSlug, id, topicId, ...entry } = args;
    const document = { ...entry, centerId: center._id, searchText: knowledgeSearchText(entry) };
    let knowledgeId: Id<"knowledge">;
    if (id) {
      const existing = await ctx.db.get(id);
      if (!existing || existing.centerId !== center._id) throw new Error("Knowledge entry not found");
      await ctx.db.patch(id, document);
      knowledgeId = id;
    } else {
      knowledgeId = await ctx.db.insert("knowledge", document);
    }
    const linkedTopics = await ctx.db.query("topics")
      .withIndex("by_center_and_knowledge", (q) => q.eq("centerId", center._id).eq("knowledgeId", knowledgeId)).take(100);
    for (const topic of linkedTopics) await ctx.db.patch(topic._id, { status: entry.status === "published" ? "answered" : "needs_review" });
    if (topicId) {
      const topic = await ctx.db.get(topicId);
      if (!topic || topic.centerId !== center._id) throw new Error("Topic not found");
      await ctx.db.patch(topicId, { status: entry.status === "published" ? "answered" : "needs_review", knowledgeId });
    }
    return knowledgeId;
  },
});

export const recordQuestion = mutation({
  args: {
    secret: v.string(), centerSlug: v.string(), canonicalTitle: v.string(), canonicalKey: v.string(),
    sessionKey: v.string(), redactedExample: v.string(), question: v.string(), hasRelevantKnowledge: v.boolean(),
    outcome: v.union(v.literal("answered"), v.literal("needs_staff")),
    sourceStatus: v.union(v.literal("sourced"), v.literal("unsourced")),
  },
  returns: v.object({ topicId: v.id("topics"), questionCount: v.number(), sessionCount: v.number(), status: topicStatus }),
  handler: async (ctx, args) => {
    assertServerSecret(args.secret);
    if (args.canonicalTitle.length > 100 || args.canonicalKey.length > 120 || args.redactedExample.length > 180 || args.sessionKey.length > 80 || args.question.length > 500) {
      throw new Error("Question metadata is too long");
    }
    const center = await ctx.db.query("centers").withIndex("by_slug", (q) => q.eq("slug", args.centerSlug)).unique();
    if (!center) throw new Error("Center not found");
    const topic = await ctx.db.query("topics").withIndex("by_center_and_key", (q) => q.eq("centerId", center._id).eq("canonicalKey", args.canonicalKey)).unique();
    const now = Date.now();
    const redactedQuestion = args.question
      .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "[email]")
      .replace(/\b(?:\+?\d[\d(). -]{7,}\d)\b/g, "[phone]")
      .replace(/\b\d{1,4}\b/g, "[number]")
      .replace(/\s+/g, " ").trim().slice(0, 180);
    if (!redactedQuestion) throw new Error("Question text is required");
    if (!topic) {
      const sessionCount = 1;
      const status = args.hasRelevantKnowledge ? "needs_review" as const : "needs_answer" as const;
      const topicId = await ctx.db.insert("topics", {
        centerId: center._id, canonicalTitle: args.canonicalTitle, canonicalKey: args.canonicalKey,
        questionCount: 1, sessionCount, status, recentExamples: [args.redactedExample], lastAskedAt: now,
      });
      await ctx.db.insert("questionSessions", { topicId, sessionKey: args.sessionKey });
      await ctx.db.insert("questionEvents", {
        centerId: center._id, topicId, redactedQuestion, askedAt: now,
        outcome: args.outcome, sourceStatus: args.sourceStatus, isPrivate: false,
      });
      return { topicId, questionCount: 1, sessionCount, status };
    }
    const priorSession = await ctx.db.query("questionSessions")
      .withIndex("by_topic_and_session", (q) => q.eq("topicId", topic._id).eq("sessionKey", args.sessionKey)).unique();
    const questionCount = topic.questionCount + 1;
    const sessionCount = topic.sessionCount + (priorSession ? 0 : 1);
    const hasAnswer = topic.status === "answered" || topic.status === "handled_by_staff";
    const status = hasAnswer ? topic.status : args.hasRelevantKnowledge ? "needs_review" as const : "needs_answer" as const;
    const recentExamples = [args.redactedExample, ...topic.recentExamples].filter((example, index, all) => all.indexOf(example) === index).slice(0, 3);
    await ctx.db.patch(topic._id, { questionCount, sessionCount, status, recentExamples, lastAskedAt: now });
    if (!priorSession) await ctx.db.insert("questionSessions", { topicId: topic._id, sessionKey: args.sessionKey });
    await ctx.db.insert("questionEvents", {
      centerId: center._id, topicId: topic._id, redactedQuestion, askedAt: now,
      outcome: args.outcome, sourceStatus: args.sourceStatus, isPrivate: false,
    });
    return { topicId: topic._id, questionCount, sessionCount, status };
  },
});

export const recordPrivateQuestionEvent = mutation({
  args: {
    secret: v.string(), centerSlug: v.string(),
    outcome: v.union(v.literal("answered"), v.literal("needs_staff")),
    sourceStatus: v.union(v.literal("sourced"), v.literal("unsourced")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertServerSecret(args.secret);
    const center = await ctx.db.query("centers").withIndex("by_slug", (q) => q.eq("slug", args.centerSlug)).unique();
    if (!center) throw new Error("Center not found");
    await ctx.db.insert("questionEvents", {
      centerId: center._id, redactedQuestion: "Private child question", askedAt: Date.now(),
      isPrivate: true, outcome: args.outcome, sourceStatus: args.sourceStatus,
    });
    return null;
  },
});

export const updateTopicStatus = mutation({
  args: { secret: v.string(), topicId: v.id("topics"), status: topicStatus, knowledgeId: v.union(v.id("knowledge"), v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertServerSecret(args.secret);
    const topic = await ctx.db.get(args.topicId);
    if (!topic) throw new Error("Topic not found");
    if (args.knowledgeId) {
      const entry = await ctx.db.get(args.knowledgeId);
      if (!entry || entry.centerId !== topic.centerId) throw new Error("Knowledge entry not found");
    }
    await ctx.db.patch(topic._id, { status: args.status, knowledgeId: args.knowledgeId ?? undefined });
    return null;
  },
});

export const seedLittleLantern = internalMutation({
  args: {},
  returns: v.object({ centerId: v.id("centers"), knowledgeCount: v.number(), topicCount: v.number(), historyCount: v.number(), childMessageCount: v.number() }),
  handler: async (ctx) => {
    const existing = await ctx.db.query("centers").withIndex("by_slug", (q) => q.eq("slug", "little-lantern")).unique();
    if (existing) return { centerId: existing._id, knowledgeCount: 0, topicCount: 0, historyCount: 0, childMessageCount: 0 };
    const centerId = await ctx.db.insert("centers", {
      slug: "little-lantern", name: "Little Lantern Learning Center", timezone: "America/New_York",
      handbookLabel: "Little Lantern Family Handbook", websiteUrl: "https://littlelantern.example/families/handbook",
    });
    const reviewedAt = Date.UTC(2026, 8, 1);
    const data = [
      { title: "What are your hours?", shortAnswer: "We welcome children from 7:30 AM to 5:30 PM, Monday through Friday.", answer: "Little Lantern is open Monday through Friday from 7:30 AM to 5:30 PM. Please pick up your child by closing time so our team can finish the daily room close.", sourceLabel: "Family Handbook · Hours", category: "Hours", isFeatured: true, status: "published" as const },
      { title: "What should my child bring?", shortAnswer: "Please bring a labeled change of clothes, a water bottle, and weather-ready outerwear.", answer: "Bring a labeled change of clothes, a refillable water bottle, and outerwear for the day's weather. Infants should also have labeled bottles and any needed feeding supplies.", sourceLabel: "Family Handbook · What to bring", category: "Daily routines", isFeatured: true, status: "published" as const },
      { title: "When should my child stay home?", shortAnswer: "Keep your child home for fever, vomiting, or symptoms that prevent comfortable participation.", answer: "Children should stay home with a fever of 100.4°F (38°C) or higher, vomiting, diarrhea, or symptoms that prevent them from comfortably joining the day's activities. Call the office if you are unsure.", sourceLabel: "Family Handbook · Health and wellness", category: "Health", isFeatured: true, status: "published" as const },
      { title: "Who can pick up my child?", shortAnswer: "Only adults listed on your approved pickup list may take your child home.", answer: "We release children only to adults authorized in the family account. Bring a photo ID if a staff member does not recognize you. Contact the office to update your authorized pickup list.", sourceLabel: "Family Handbook · Safe arrival and pickup", category: "Safety", isFeatured: true, status: "published" as const },
      { title: "How do you handle allergies?", shortAnswer: "Tell the office about allergies so staff can review the care plan with your family.", answer: "Please share allergy information and any required care plan with the office before your child's first day or when information changes. Teachers follow the plan on file and will contact you with questions.", sourceLabel: "Family Handbook · Health plans", category: "Health", isFeatured: false, status: "published" as const },
      { title: "What happens on the October staff learning day?", shortAnswer: "The center is open regular hours on Monday, October 12, for enrolled children.", answer: "Little Lantern will be open from 7:30 AM to 5:30 PM on Monday, October 12, 2026. This is a staff learning day for the local school district; the center remains open for enrolled children.", sourceLabel: "Center update · October 2026 calendar", category: "Closures and events", isFeatured: true, startsAt: Date.UTC(2026, 8, 21), endsAt: Date.UTC(2026, 9, 12, 23, 59), status: "published" as const },
      { title: "Is the center open on Veterans Day?", shortAnswer: "The center will be closed Wednesday, November 11, for Veterans Day.", answer: "Little Lantern will be closed Wednesday, November 11, 2026, for Veterans Day. Regular care resumes Thursday, November 12.", sourceLabel: "Center update · November 2026 calendar", category: "Closures and events", isFeatured: true, startsAt: Date.UTC(2026, 9, 26), endsAt: Date.UTC(2026, 10, 11, 23, 59), status: "published" as const },
      { title: "What is the late pickup fee?", shortAnswer: "Please call the office if you may arrive after closing; staff will explain the handbook policy.", answer: "The handbook describes a late pickup fee when a child remains after closing. Please contact the office for the current fee and to let staff know if you are delayed.", sourceLabel: "Family Handbook · Hours and fees", category: "Tuition and fees", isFeatured: false, status: "draft" as const },
    ];
    const ids: Id<"knowledge">[] = [];
    for (const entry of data) ids.push(await ctx.db.insert("knowledge", {
      ...entry, centerId, reviewedAt, searchText: knowledgeSearchText(entry),
    }));
    const examples = [
      { canonicalTitle: "Lunch on the October staff learning day", canonicalKey: "lunch-october-staff-learning-day", questionCount: 14, sessionCount: 11, status: "needs_answer" as const, recentExamples: ["Will lunch be provided on the district workday?", "Should I pack lunch for teacher training day?", "Does the center serve meals during the school closure?"] },
      { canonicalTitle: "Allergy care plans", canonicalKey: "allergy-care-plan", questionCount: 8, sessionCount: 6, status: "needs_review" as const, recentExamples: ["How do I share a new allergy plan?", "Can staff give my child an epinephrine auto-injector?", "Where do I send allergy paperwork?"] },
      { canonicalTitle: "Pickup authorization updates", canonicalKey: "pickup-authorization-updates", questionCount: 5, sessionCount: 5, status: "answered" as const, recentExamples: ["How do I add grandma for pickup?", "Can I change who is picking up today?"] },
    ];
    for (const topic of examples) {
      await ctx.db.insert("topics", {
        centerId, ...topic, lastAskedAt: Date.UTC(2026, 8, 22),
        ...(topic.status === "answered" ? { knowledgeId: ids[3] } : {}),
      });
    }
    const historicalData = [
      { canonicalTitle: "District learning day care", month: 9, year: 2025, questionCount: 18 },
      { canonicalTitle: "Fall illness and return-to-care guidance", month: 10, year: 2025, questionCount: 11 },
      { canonicalTitle: "Veterans Day closure", month: 10, year: 2025, questionCount: 9 },
      { canonicalTitle: "Fall family picnic schedule", month: 9, year: 2025, questionCount: 7 },
    ];
    for (const item of historicalData) await ctx.db.insert("seasonalHistory", { centerId, ...item });
    const childId = await ctx.db.insert("children", { centerId, firstName: "Mia", lastName: "Carter", ageGroup: "Preschool" });
    const messages = [
      { dateLabel: "Sep 18, 2026", summary: "Mia enjoyed the garden walk and chose a pumpkin to bring home.", sourceLabel: "Teacher message · Ms. Ava · Sep 18, 2026" },
      { dateLabel: "Sep 16, 2026", summary: "Mia tried the new snack and asked for another serving.", sourceLabel: "Daily note · Sep 16, 2026" },
      { dateLabel: "Sep 12, 2026", summary: "A spare set of clothes was used after outdoor water play; please replace it when convenient.", sourceLabel: "Teacher message · Ms. Ava · Sep 12, 2026" },
    ];
    for (const message of messages) await ctx.db.insert("childMessages", { centerId, childId, ...message });
    return { centerId, knowledgeCount: data.length, topicCount: examples.length, historyCount: historicalData.length, childMessageCount: messages.length };
  },
});
