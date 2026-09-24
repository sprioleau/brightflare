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
const knowledgeSourceType = v.union(
  v.literal("handbook"),
  v.literal("center_update"),
  v.literal("staff_policy"),
  v.literal("other_approved_source"),
);

const knowledgeInput = {
  title: v.string(),
  shortAnswer: v.string(),
  answer: v.string(),
  sourceLabel: v.string(),
  sourceType: v.optional(knowledgeSourceType),
  category: v.string(),
  isFeatured: v.boolean(),
  startsAt: v.optional(v.number()),
  endsAt: v.optional(v.number()),
  reviewedAt: v.number(),
  status: knowledgeStatus,
};

const recommendationStatus = v.union(v.literal("pending"), v.literal("approved"), v.literal("dismissed"));
const recommendationValidator = v.object({
  id: v.id("adminRecommendations"), kind: v.union(v.literal("faq"), v.literal("staff_answer"), v.literal("handbook_update")),
  title: v.string(), shortAnswer: v.string(), answer: v.string(), sourceLabel: v.string(),
  sourceType: knowledgeSourceType, tags: v.array(v.string()),
  category: v.string(), isFeatured: v.boolean(), startsAt: v.union(v.number(), v.null()),
  endsAt: v.union(v.number(), v.null()), rationale: v.string(), evidence: v.string(),
  topicId: v.union(v.id("topics"), v.null()), targetKnowledgeId: v.union(v.id("knowledge"), v.null()),
  sourceKnowledgeId: v.union(v.id("knowledge"), v.null()), requiresStaffInput: v.boolean(), status: recommendationStatus,
  operation: v.union(v.literal("create"), v.literal("update")), target: v.string(),
});

function getRecommendationView(entry: Doc<"adminRecommendations">) {
  return {
    id: entry._id, kind: entry.kind, title: entry.title, shortAnswer: entry.shortAnswer,
    answer: entry.answer, sourceLabel: entry.sourceLabel, category: entry.category,
    sourceType: entry.sourceType ?? "other_approved_source", tags: entry.tags ?? [],
    isFeatured: entry.isFeatured, startsAt: entry.startsAt ?? null, endsAt: entry.endsAt ?? null,
    rationale: entry.rationale, evidence: entry.evidence, topicId: entry.topicId ?? null,
    targetKnowledgeId: entry.targetKnowledgeId ?? null, sourceKnowledgeId: entry.sourceKnowledgeId,
    requiresStaffInput: entry.requiresStaffInput,
    status: entry.status, operation: entry.operation,
    target: entry.kind === "staff_answer" ? "Staff answer" : entry.kind === "handbook_update" ? "Handbook article" : "Front desk FAQ",
  };
}

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
    center: v.object({
      name: v.string(), handbookLabel: v.string(), websiteUrl: v.union(v.string(), v.null()),
      hours: v.string(), tagline: v.string(),
      announcement: v.union(v.null(), v.object({ title: v.string(), message: v.string() })),
    }),
    featured: v.array(v.object({
      id: v.id("knowledge"), title: v.string(), shortAnswer: v.string(), answer: v.string(),
      sourceLabel: v.string(), category: v.string(), tags: v.array(v.string()),
      featuredOrder: v.union(v.number(), v.null()), reviewedAt: v.number(),
    })),
    evergreen: v.array(v.object({
      id: v.id("knowledge"), title: v.string(), shortAnswer: v.string(), answer: v.string(),
      sourceLabel: v.string(), category: v.string(), tags: v.array(v.string()),
      featuredOrder: v.union(v.number(), v.null()), reviewedAt: v.number(),
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
      sourceLabel: entry.sourceLabel, category: entry.category, tags: entry.tags ?? [],
      featuredOrder: entry.featuredOrder ?? null, reviewedAt: entry.reviewedAt,
    });
    return {
      center: {
        name: center.name, handbookLabel: center.handbookLabel, websiteUrl: center.websiteUrl ?? null,
        hours: center.hours ?? "Monday–Friday · 7:30 AM–5:30 PM", tagline: center.tagline ?? "A little more clarity in every day.",
        announcement: center.announcement?.isActive && center.announcement.message.trim()
          ? { title: center.announcement.title, message: center.announcement.message }
          : null,
      },
      featured: active.filter((entry) => entry.isFeatured)
        .sort((left, right) => (left.featuredOrder ?? Number.MAX_SAFE_INTEGER) - (right.featuredOrder ?? Number.MAX_SAFE_INTEGER)
          || left._creationTime - right._creationTime || String(left._id).localeCompare(String(right._id)))
        .slice(0, 8).map(toPublic),
      evergreen: active.filter((entry) => !entry.isFeatured).slice(0, 20).map(toPublic),
    };
  },
});

export const getPublicHandbook = query({
  args: { centerSlug: v.string(), now: v.number() },
  returns: v.object({
    center: v.object({ name: v.string(), handbookLabel: v.string() }),
    entries: v.array(v.object({
      id: v.id("knowledge"), title: v.string(), shortAnswer: v.string(), answer: v.string(),
      sourceLabel: v.string(), category: v.string(), tags: v.array(v.string()), reviewedAt: v.number(),
    })),
  }),
  handler: async (ctx, args) => {
    const center = await ctx.db.query("centers").withIndex("by_slug", (q) => q.eq("slug", args.centerSlug)).unique();
    if (!center) throw new Error("Center not found");
    const entries = await ctx.db.query("knowledge")
      .withIndex("by_center_and_status", (q) => q.eq("centerId", center._id).eq("status", "published"))
      .take(100);
    return {
      center: { name: center.name, handbookLabel: center.handbookLabel },
      entries: entries.filter((entry) => (entry.startsAt === undefined || entry.startsAt <= args.now)
        && (entry.endsAt === undefined || entry.endsAt >= args.now))
        .map((entry) => ({
          id: entry._id, title: entry.title, shortAnswer: entry.shortAnswer, answer: entry.answer,
          sourceLabel: entry.sourceLabel, category: entry.category, tags: entry.tags ?? [], reviewedAt: entry.reviewedAt,
        })),
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
      tags: v.array(v.string()), featuredOrder: v.union(v.number(), v.null()),
      sourceType: v.union(knowledgeSourceType, v.null()),
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
        tags: entry.tags ?? [], featuredOrder: entry.featuredOrder ?? null,
        sourceType: entry.sourceType ?? null,
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

export const getAdminRecommendationContext = query({
  args: { secret: v.string(), centerSlug: v.string(), month: v.number(), now: v.number() },
  returns: v.object({
    centerName: v.string(),
    voiceSettings: v.object({ tone: v.string(), audience: v.string(), preferredTerms: v.array(v.string()), forbiddenTerms: v.array(v.string()), glossary: v.array(v.object({ term: v.string(), meaning: v.string() })) }),
    shouldGenerate: v.boolean(),
    knowledge: v.array(v.object({ id: v.id("knowledge"), title: v.string(), shortAnswer: v.string(), answer: v.string(), sourceLabel: v.string(), category: v.string(), isFeatured: v.boolean(), reviewedAt: v.number() })),
    topics: v.array(v.object({ id: v.id("topics"), title: v.string(), questionCount: v.number(), sessionCount: v.number(), status: topicStatus, examples: v.array(v.string()) })),
    seasonalHistory: v.array(v.object({ title: v.string(), year: v.number(), questionCount: v.number() })),
    suppressedSourceIds: v.array(v.id("knowledge")),
    suppressedTopicIds: v.array(v.id("topics")),
  }),
  handler: async (ctx, args) => {
    assertServerSecret(args.secret);
    const center = await ctx.db.query("centers").withIndex("by_slug", (q) => q.eq("slug", args.centerSlug)).unique();
    if (!center) throw new Error("Center not found");
    const knowledgeRows = await ctx.db.query("knowledge")
      .withIndex("by_center_and_status", (q) => q.eq("centerId", center._id).eq("status", "published")).take(100);
    const knowledge = knowledgeRows.filter((entry) =>
      (entry.startsAt === undefined || entry.startsAt <= args.now)
      && (entry.endsAt === undefined || entry.endsAt >= args.now),
    );
    const allTopics = await Promise.all(["needs_answer", "needs_review", "answered", "handled_by_staff"].map((status) =>
      ctx.db.query("topics")
        .withIndex("by_center_and_status_and_last_asked", (q) => q.eq("centerId", center._id).eq("status", status as "needs_answer" | "needs_review" | "answered" | "handled_by_staff"))
        .order("desc").take(25),
    ));
    const history = await ctx.db.query("seasonalHistory")
      .withIndex("by_center_month_and_year", (q) => q.eq("centerId", center._id).eq("month", args.month))
      .order("desc").take(30);
    const pending = await ctx.db.query("adminRecommendations")
      .withIndex("by_center_and_status", (q) => q.eq("centerId", center._id).eq("status", "pending")).take(20);
    const recentDecisions = (await Promise.all(["approved", "dismissed"].map((status) =>
      ctx.db.query("adminRecommendations")
        .withIndex("by_center_and_status", (q) => q.eq("centerId", center._id).eq("status", status as "approved" | "dismissed"))
        .order("desc").take(50),
    ))).flat().filter((entry) => args.now - entry.updatedAt < 30 * 24 * 60 * 60 * 1000);
    const suppressed = [...pending, ...recentDecisions];
    return {
      centerName: center.name,
      voiceSettings: {
        tone: center.voiceTone ?? "Warm, clear, and practical",
        audience: center.voiceAudience ?? "Parents and guardians of enrolled children",
        preferredTerms: center.preferredTerms ?? [],
        forbiddenTerms: center.forbiddenTerms ?? [],
        glossary: center.glossary ?? [],
      },
      shouldGenerate: center.recommendationsAnalyzedAt === undefined || args.now - center.recommendationsAnalyzedAt >= 10 * 60 * 1000,
      knowledge: knowledge.map((entry) => ({ id: entry._id, title: entry.title, shortAnswer: entry.shortAnswer, answer: entry.answer, sourceLabel: entry.sourceLabel, category: entry.category, isFeatured: entry.isFeatured, reviewedAt: entry.reviewedAt })),
      topics: allTopics.flat().map((topic) => ({ id: topic._id, title: topic.canonicalTitle, questionCount: topic.questionCount, sessionCount: topic.sessionCount, status: topic.status, examples: topic.recentExamples })),
      seasonalHistory: history.map((entry) => ({ title: entry.canonicalTitle, year: entry.year, questionCount: entry.questionCount })),
      suppressedSourceIds: suppressed.flatMap((entry) => entry.sourceKnowledgeId ? [entry.sourceKnowledgeId] : []),
      suppressedTopicIds: suppressed.flatMap((entry) => entry.topicId ? [entry.topicId] : []),
    };
  },
});

export const claimAdminRecommendationRun = mutation({
  args: { secret: v.string(), centerSlug: v.string(), now: v.number() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    assertServerSecret(args.secret);
    const center = await ctx.db.query("centers").withIndex("by_slug", (q) => q.eq("slug", args.centerSlug)).unique();
    if (!center) throw new Error("Center not found");
    if (center.recommendationsAnalyzedAt !== undefined && args.now - center.recommendationsAnalyzedAt < 10 * 60 * 1000) return false;
    await ctx.db.patch(center._id, { recommendationsAnalyzedAt: args.now });
    return true;
  },
});

export const saveCenterVoiceSettings = mutation({
  args: {
    secret: v.string(), centerSlug: v.string(), tone: v.string(), audience: v.string(),
    preferredTerms: v.array(v.string()), forbiddenTerms: v.array(v.string()),
    glossary: v.array(v.object({ term: v.string(), meaning: v.string() })),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertServerSecret(args.secret);
    const center = await ctx.db.query("centers").withIndex("by_slug", (q) => q.eq("slug", args.centerSlug)).unique();
    if (!center) throw new Error("Center not found");
    await ctx.db.patch(center._id, {
      voiceTone: args.tone, voiceAudience: args.audience,
      preferredTerms: args.preferredTerms, forbiddenTerms: args.forbiddenTerms,
      glossary: args.glossary,
      recommendationsAnalyzedAt: undefined,
    });
    return null;
  },
});

export const listAdminRecommendations = query({
  args: { secret: v.string(), centerSlug: v.string() },
  returns: v.array(recommendationValidator),
  handler: async (ctx, args) => {
    assertServerSecret(args.secret);
    const center = await ctx.db.query("centers").withIndex("by_slug", (q) => q.eq("slug", args.centerSlug)).unique();
    if (!center) throw new Error("Center not found");
    const pending = await ctx.db.query("adminRecommendations")
      .withIndex("by_center_and_status", (q) => q.eq("centerId", center._id).eq("status", "pending"))
      .order("desc").take(20);
    return pending.map(getRecommendationView);
  },
});

export const saveAdminRecommendations = mutation({
  args: {
    secret: v.string(), centerSlug: v.string(),
    recommendations: v.array(v.object({
      sourceKnowledgeId: v.union(v.id("knowledge"), v.null()), targetKnowledgeId: v.union(v.id("knowledge"), v.null()),
      topicId: v.union(v.id("topics"), v.null()), kind: v.union(v.literal("faq"), v.literal("staff_answer"), v.literal("handbook_update")),
      targetReviewedAt: v.union(v.number(), v.null()), operation: v.union(v.literal("create"), v.literal("update")),
      title: v.string(), shortAnswer: v.string(), answer: v.string(), sourceLabel: v.string(), category: v.string(), isFeatured: v.boolean(),
      sourceType: v.optional(knowledgeSourceType), tags: v.optional(v.array(v.string())),
      requiresStaffInput: v.boolean(), rationale: v.string(), evidence: v.string(),
    })),
  },
  returns: v.array(recommendationValidator),
  handler: async (ctx, args) => {
    assertServerSecret(args.secret);
    const center = await ctx.db.query("centers").withIndex("by_slug", (q) => q.eq("slug", args.centerSlug)).unique();
    if (!center) throw new Error("Center not found");
    const results: ReturnType<typeof getRecommendationView>[] = [];
    for (const candidate of args.recommendations.slice(0, 4)) {
      const source = candidate.sourceKnowledgeId ? await ctx.db.get(candidate.sourceKnowledgeId) : null;
      if (candidate.sourceKnowledgeId && (!source || source.centerId !== center._id || source.status !== "published")) continue;
      const target = candidate.targetKnowledgeId ? await ctx.db.get(candidate.targetKnowledgeId) : null;
      if (candidate.targetKnowledgeId && (!target || target.centerId !== center._id || target.status !== "published")) continue;
      const pending = await ctx.db.query("adminRecommendations")
        .withIndex("by_center_and_status", (q) => q.eq("centerId", center._id).eq("status", "pending")).take(20);
      const existing = pending.find((entry) => entry.sourceKnowledgeId === candidate.sourceKnowledgeId && entry.topicId === candidate.topicId && entry.kind === candidate.kind);
      if (existing) {
        results.push(getRecommendationView(existing));
        continue;
      }
      const recentDecisions = (await Promise.all(["approved", "dismissed"].map((status) =>
        ctx.db.query("adminRecommendations")
          .withIndex("by_center_and_status", (q) => q.eq("centerId", center._id).eq("status", status as "approved" | "dismissed"))
          .order("desc").take(50),
      ))).flat();
      if (recentDecisions.some((entry) => Date.now() - entry.updatedAt < 30 * 24 * 60 * 60 * 1000
        && ((candidate.sourceKnowledgeId && entry.sourceKnowledgeId === candidate.sourceKnowledgeId)
          || (candidate.topicId && entry.topicId === candidate.topicId)))) continue;
      const topic = candidate.topicId ? await ctx.db.get(candidate.topicId) : null;
      if (topic && topic.centerId !== center._id) continue;
      const now = Date.now();
      const id = await ctx.db.insert("adminRecommendations", {
        centerId: center._id, sourceKnowledgeId: source?._id ?? null, targetKnowledgeId: target?._id,
        targetReviewedAt: candidate.targetReviewedAt ?? target?.reviewedAt, operation: candidate.operation, topicId: topic?._id,
        kind: candidate.kind, title: candidate.title, shortAnswer: candidate.shortAnswer, answer: candidate.answer,
        sourceLabel: candidate.sourceLabel, sourceType: candidate.sourceType ?? target?.sourceType ?? source?.sourceType ?? "other_approved_source",
        tags: candidate.tags ?? target?.tags ?? source?.tags ?? [], category: candidate.category, isFeatured: candidate.isFeatured,
        startsAt: target?.startsAt, endsAt: target?.endsAt,
        rationale: candidate.rationale.slice(0, 400), evidence: candidate.evidence.slice(0, 400),
        requiresStaffInput: candidate.requiresStaffInput, status: "pending", createdAt: now, updatedAt: now,
      });
      const saved = await ctx.db.get(id);
      if (saved) results.push(getRecommendationView(saved));
    }
    return results;
  },
});

export const decideAdminRecommendation = mutation({
  args: {
    secret: v.string(), centerSlug: v.string(), id: v.id("adminRecommendations"),
    action: v.union(v.literal("approve"), v.literal("dismiss"), v.literal("edit")),
    editedEntry: v.optional(v.object({
      title: v.string(), shortAnswer: v.string(), answer: v.string(), sourceLabel: v.string(),
      sourceType: v.optional(knowledgeSourceType), tags: v.optional(v.array(v.string())),
      category: v.string(), isFeatured: v.boolean(), startsAt: v.union(v.number(), v.null()), endsAt: v.union(v.number(), v.null()),
    })),
  },
  returns: v.union(v.null(), v.object({ id: v.id("knowledge") })),
  handler: async (ctx, args) => {
    assertServerSecret(args.secret);
    const center = await ctx.db.query("centers").withIndex("by_slug", (q) => q.eq("slug", args.centerSlug)).unique();
    const recommendation = await ctx.db.get(args.id);
    if (!center || !recommendation || recommendation.centerId !== center._id) throw new Error("Recommendation not found");
    if (recommendation.status !== "pending") throw new Error("Recommendation is no longer pending");
    const now = Date.now();
    if (args.action === "dismiss") {
      await ctx.db.patch(recommendation._id, { status: "dismissed", updatedAt: now });
      return null;
    }
    if (args.action === "edit") {
      if (!args.editedEntry) throw new Error("Edited FAQ content is required");
      if (recommendation.requiresStaffInput && (
        args.editedEntry.answer.trim() === recommendation.answer.trim()
        || args.editedEntry.sourceLabel.trim() === recommendation.sourceLabel.trim()
      )) throw new Error("Add the center's confirmed answer and source before publishing");
      await ctx.db.patch(recommendation._id, {
        title: args.editedEntry.title, shortAnswer: args.editedEntry.shortAnswer,
        answer: args.editedEntry.answer, sourceLabel: args.editedEntry.sourceLabel,
        category: args.editedEntry.category, isFeatured: args.editedEntry.isFeatured,
        ...(args.editedEntry.sourceType === undefined ? {} : { sourceType: args.editedEntry.sourceType }),
        ...(args.editedEntry.tags === undefined ? {} : { tags: args.editedEntry.tags }),
        startsAt: args.editedEntry.startsAt ?? undefined, endsAt: args.editedEntry.endsAt ?? undefined,
        requiresStaffInput: false, updatedAt: now,
      });
      return null;
    }
    if (recommendation.requiresStaffInput && !args.editedEntry) throw new Error("Staff must confirm the answer before publishing");
    const entry = args.editedEntry ?? recommendation;
    let knowledgeId: Id<"knowledge">;
    const targetForUpdate = recommendation.operation === "update" && recommendation.targetKnowledgeId
      ? await ctx.db.get(recommendation.targetKnowledgeId)
      : null;
    const sourceForCreate = recommendation.sourceKnowledgeId
      ? await ctx.db.get(recommendation.sourceKnowledgeId)
      : null;
    const document = {
      title: entry.title, shortAnswer: entry.shortAnswer, answer: entry.answer,
      sourceLabel: entry.sourceLabel,
      sourceType: entry.sourceType ?? targetForUpdate?.sourceType ?? sourceForCreate?.sourceType ?? "other_approved_source",
      tags: entry.tags ?? targetForUpdate?.tags ?? sourceForCreate?.tags ?? [],
      category: entry.category, isFeatured: entry.isFeatured,
      startsAt: entry.startsAt ?? undefined, endsAt: entry.endsAt ?? undefined,
      reviewedAt: now, status: "published" as const, searchText: knowledgeSearchText(entry),
    };
    if (recommendation.operation === "update") {
      const target = targetForUpdate;
      if (!target || target.centerId !== center._id || target.status !== "published") throw new Error("The handbook section has changed");
      if (recommendation.targetReviewedAt !== target.reviewedAt) throw new Error("The handbook section has changed since this suggestion was drafted");
      await ctx.db.patch(target._id, document);
      knowledgeId = target._id;
    } else {
      knowledgeId = await ctx.db.insert("knowledge", { centerId: center._id, ...document });
    }
    await ctx.db.patch(recommendation._id, { status: "approved", publishedKnowledgeId: knowledgeId, updatedAt: now });
    if (recommendation.topicId) {
      const topic = await ctx.db.get(recommendation.topicId);
      if (topic && topic.centerId === center._id) await ctx.db.patch(topic._id, { status: "answered", knowledgeId });
    }
    return { id: knowledgeId };
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

export const getCenterVoiceSettings = query({
  args: { secret: v.string(), centerSlug: v.string() },
  returns: v.object({
    tone: v.string(), audience: v.string(), preferredTerms: v.array(v.string()),
    forbiddenTerms: v.array(v.string()), glossary: v.array(v.object({ term: v.string(), meaning: v.string() })),
  }),
  handler: async (ctx, args) => {
    assertServerSecret(args.secret);
    const center = await ctx.db.query("centers").withIndex("by_slug", (q) => q.eq("slug", args.centerSlug)).unique();
    if (!center) throw new Error("Center not found");
    return {
      tone: center.voiceTone ?? "Warm, clear, and practical",
      audience: center.voiceAudience ?? "Parents and guardians of enrolled children",
      preferredTerms: center.preferredTerms ?? [], forbiddenTerms: center.forbiddenTerms ?? [],
      glossary: center.glossary ?? [],
    };
  },
});

export const getCenterSettings = query({
  args: { secret: v.string(), centerSlug: v.string() },
  returns: v.object({
    name: v.string(), hours: v.string(), tagline: v.string(), timezone: v.string(),
    handbookLabel: v.string(), websiteUrl: v.string(), tone: v.string(), audience: v.string(),
    preferredTerms: v.array(v.string()), forbiddenTerms: v.array(v.string()),
    glossary: v.array(v.object({ term: v.string(), meaning: v.string() })),
  }),
  handler: async (ctx, args) => {
    assertServerSecret(args.secret);
    const center = await ctx.db.query("centers").withIndex("by_slug", (q) => q.eq("slug", args.centerSlug)).unique();
    if (!center) throw new Error("Center not found");
    return {
      name: center.name, hours: center.hours ?? "Monday–Friday · 7:30 AM–5:30 PM",
      tagline: center.tagline ?? "A little more clarity in every day.", timezone: center.timezone,
      handbookLabel: center.handbookLabel, websiteUrl: center.websiteUrl ?? "",
      tone: center.voiceTone ?? "Warm, clear, and practical",
      audience: center.voiceAudience ?? "Parents and guardians of enrolled children",
      preferredTerms: center.preferredTerms ?? [], forbiddenTerms: center.forbiddenTerms ?? [],
      glossary: center.glossary ?? [],
    };
  },
});

export const getCenterAnnouncement = query({
  args: { secret: v.string(), centerSlug: v.string() },
  returns: v.object({ title: v.string(), message: v.string(), isActive: v.boolean() }),
  handler: async (ctx, args) => {
    assertServerSecret(args.secret);
    const center = await ctx.db.query("centers").withIndex("by_slug", (q) => q.eq("slug", args.centerSlug)).unique();
    if (!center) throw new Error("Center not found");
    return center.announcement ?? { title: "", message: "", isActive: false };
  },
});

export const saveCenterAnnouncement = mutation({
  args: {
    secret: v.string(), centerSlug: v.string(), title: v.string(), message: v.string(), isActive: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertServerSecret(args.secret);
    if (args.title.length > 80 || args.message.length > 500 || (args.isActive && !args.message.trim())) {
      throw new Error("Announcement details are invalid");
    }
    const center = await ctx.db.query("centers").withIndex("by_slug", (q) => q.eq("slug", args.centerSlug)).unique();
    if (!center) throw new Error("Center not found");
    await ctx.db.patch(center._id, {
      announcement: { title: args.title.trim(), message: args.message.trim(), isActive: args.isActive },
    });
    return null;
  },
});

export const saveCenterSettings = mutation({
  args: {
    secret: v.string(), centerSlug: v.string(), name: v.string(), hours: v.string(),
    tagline: v.string(), timezone: v.string(), handbookLabel: v.string(), websiteUrl: v.string(),
    tone: v.string(), audience: v.string(), preferredTerms: v.array(v.string()),
    forbiddenTerms: v.array(v.string()), glossary: v.array(v.object({ term: v.string(), meaning: v.string() })),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertServerSecret(args.secret);
    const center = await ctx.db.query("centers").withIndex("by_slug", (q) => q.eq("slug", args.centerSlug)).unique();
    if (!center) throw new Error("Center not found");
    await ctx.db.patch(center._id, {
      name: args.name, hours: args.hours, tagline: args.tagline, timezone: args.timezone,
      handbookLabel: args.handbookLabel, websiteUrl: args.websiteUrl || undefined,
      voiceTone: args.tone, voiceAudience: args.audience,
      preferredTerms: args.preferredTerms, forbiddenTerms: args.forbiddenTerms,
      glossary: args.glossary, recommendationsAnalyzedAt: undefined,
    });
    return null;
  },
});

export const upsertKnowledge = mutation({
  args: { secret: v.string(), centerSlug: v.string(), id: v.union(v.id("knowledge"), v.null()), topicId: v.optional(v.id("topics")), tags: v.optional(v.array(v.string())), ...knowledgeInput },
  returns: v.id("knowledge"),
  handler: async (ctx, args) => {
    assertServerSecret(args.secret);
    const center = await ctx.db.query("centers").withIndex("by_slug", (q) => q.eq("slug", args.centerSlug)).unique();
    if (!center) throw new Error("Center not found");
    if (args.startsAt !== undefined && args.endsAt !== undefined && args.startsAt > args.endsAt) throw new Error("Start date must be before end date");
    const { secret: _secret, centerSlug: _centerSlug, id, topicId, tags, sourceType, ...entry } = args;
    const document = {
      ...entry,
      ...(tags === undefined ? {} : { tags }),
      ...(sourceType === undefined ? {} : { sourceType }),
      centerId: center._id,
      searchText: knowledgeSearchText(entry),
    };
    let knowledgeId: Id<"knowledge">;
    if (id) {
      const existing = await ctx.db.get(id);
      if (!existing || existing.centerId !== center._id) throw new Error("Knowledge entry not found");
      await ctx.db.patch(id, document);
      knowledgeId = id;
    } else {
      knowledgeId = await ctx.db.insert("knowledge", {
        ...document,
        tags: tags ?? [],
        sourceType: sourceType ?? "other_approved_source",
      });
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

export const reorderFeaturedKnowledge = mutation({
  args: { secret: v.string(), centerSlug: v.string(), orderedIds: v.array(v.id("knowledge")) },
  returns: v.array(v.id("knowledge")),
  handler: async (ctx, args) => {
    assertServerSecret(args.secret);
    if (args.orderedIds.length > 8 || new Set(args.orderedIds).size !== args.orderedIds.length) {
      throw new Error("Choose up to eight unique featured answers");
    }
    const center = await ctx.db.query("centers").withIndex("by_slug", (q) => q.eq("slug", args.centerSlug)).unique();
    if (!center) throw new Error("Center not found");
    const featuredRows = await ctx.db.query("knowledge")
      .withIndex("by_center_and_featured_and_status", (q) => q.eq("centerId", center._id).eq("isFeatured", true).eq("status", "published"))
      .take(100);
    const featuredById = new Map(featuredRows.map((entry) => [entry._id, entry]));
    for (const id of args.orderedIds) {
      if (!featuredById.has(id)) throw new Error("Every selected answer must be a published featured item from this center");
    }
    const selectedIds = new Set(args.orderedIds);
    const orderedExisting = [...featuredRows].sort((left, right) =>
      (left.featuredOrder ?? Number.MAX_SAFE_INTEGER) - (right.featuredOrder ?? Number.MAX_SAFE_INTEGER)
      || left._creationTime - right._creationTime || String(left._id).localeCompare(String(right._id)));
    const finalOrder = [...args.orderedIds, ...orderedExisting.filter((entry) => !selectedIds.has(entry._id)).map((entry) => entry._id)];
    for (const [index, id] of finalOrder.entries()) await ctx.db.patch(id, { featuredOrder: index });
    return args.orderedIds;
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

const littleLanternAdditionalKnowledge = [
  {
    seedKey: "little-lantern-tuition-2026",
    title: "What is tuition for each age group?",
    shortAnswer: "Five-day tuition is $2,150 per month for infants, $1,950 for toddlers, and $1,750 for preschoolers.",
    answer: "Little Lantern's fictional five-day weekly tuition is $2,150 per month for infants, $1,950 for toddlers, and $1,750 for preschoolers. Tuition is billed on the first business day of each month and is due by the fifth. Part-time availability and current openings vary; contact the office before making enrollment plans.",
    sourceLabel: "Family Handbook · Tuition and enrollment",
    category: "Tuition and fees", isFeatured: false, status: "published" as const,
  },
  {
    seedKey: "little-lantern-tours-2026",
    title: "How can I schedule a tour?",
    shortAnswer: "Tours are offered Tuesday and Thursday mornings by appointment; contact the office to choose a time.",
    answer: "Little Lantern offers family tours on Tuesday and Thursday mornings, between 9:00 and 11:30 AM, by appointment. Contact the office to confirm a time and which classrooms are available to visit. A tour does not reserve a space or guarantee enrollment.",
    sourceLabel: "Family Handbook · Tours and enrollment",
    category: "Tours and enrollment", isFeatured: true, status: "published" as const,
  },
  {
    seedKey: "little-lantern-lunch-2026",
    title: "Does the center provide lunch?",
    shortAnswer: "Families pack lunch and snacks; label each container and include an ice pack for perishable food.",
    answer: "Little Lantern does not provide lunch. Please pack a labeled lunch and snacks each day, with an ice pack for perishable food. Send water in a labeled, reusable bottle. If your child has a food allergy or needs a dietary accommodation, contact the office so staff can review the care plan with your family before the first day.",
    sourceLabel: "Family Handbook · Meals and nutrition",
    category: "Meals and nutrition", isFeatured: true, status: "published" as const,
  },
  {
    seedKey: "little-lantern-illness-return-2026",
    title: "When can my child return after an illness?",
    shortAnswer: "After a fever, vomiting, or diarrhea, wait 24 hours without symptoms or symptom-reducing medicine before returning.",
    answer: "For this fictional center's policy, a child may return after a fever, vomiting, or diarrhea when they have been free of that symptom for at least 24 hours without medicine used to reduce it. A child also needs to feel well enough to take part in the regular day. Please call the office if symptoms return or you are unsure whether the policy applies. This policy does not replace medical advice.",
    sourceLabel: "Family Handbook · Health and wellness",
    category: "Health", isFeatured: false, status: "published" as const,
  },
  {
    seedKey: "little-lantern-medication-2026",
    title: "Can staff give my child medication?",
    shortAnswer: "Contact the office before bringing medication so staff can confirm the authorization and care-plan steps.",
    answer: "The office must review the medication, written family authorization, and any required health-care instructions before staff can administer it. Keep medication in its original labeled container and hand it directly to a staff member; do not leave it in a child's bag. Contact the office to confirm what paperwork is needed. Staff cannot advise on a dose or whether medication is medically appropriate.",
    sourceLabel: "Family Handbook · Medication and health plans",
    category: "Health", isFeatured: false, status: "published" as const,
  },
  {
    seedKey: "little-lantern-rest-time-2026",
    title: "What is the rest-time routine?",
    shortAnswer: "Preschool children have a quiet rest period after lunch; children who do not sleep are offered quiet activities.",
    answer: "After lunch, preschool classrooms have a quiet rest period. Children are not required to sleep; those who are awake may choose a quiet activity while classmates rest. Ask your child's teacher about the classroom routine for their age group.",
    sourceLabel: "Family Handbook · Daily schedule and rest",
    category: "Daily routines", isFeatured: false, status: "published" as const,
  },
  {
    seedKey: "little-lantern-thanksgiving-2026",
    title: "Is the center open on Thanksgiving?",
    shortAnswer: "Little Lantern will be closed Thursday, November 26, and Friday, November 27, 2026.",
    answer: "Little Lantern will be closed on Thursday, November 26, and Friday, November 27, 2026, for Thanksgiving. Regular care resumes Monday, November 30. These are the center's confirmed 2026 dates.",
    sourceLabel: "Center update · 2026 holiday calendar",
    category: "Closures and events", isFeatured: true, startsAt: Date.UTC(2026, 10, 2), endsAt: Date.UTC(2026, 10, 27, 23, 59), status: "published" as const,
  },
  {
    seedKey: "little-lantern-winter-holidays-2026",
    title: "What are the winter holiday closures?",
    shortAnswer: "The center will be closed December 24–25, 2026, and January 1, 2027.",
    answer: "Little Lantern will be closed Thursday and Friday, December 24 and 25, 2026, and Friday, January 1, 2027. The center is open regular hours on December 21–23 and December 28–31. Care resumes Monday, January 4, 2027.",
    sourceLabel: "Center update · 2026–27 holiday calendar",
    category: "Closures and events", isFeatured: true, startsAt: Date.UTC(2026, 10, 30), endsAt: Date.UTC(2027, 0, 4, 23, 59), status: "published" as const,
  },
] as const;

export const seedLittleLanternAdditions = internalMutation({
  args: {},
  returns: v.object({ centerId: v.union(v.id("centers"), v.null()), insertedCount: v.number() }),
  handler: async (ctx) => {
    const center = await ctx.db.query("centers").withIndex("by_slug", (q) => q.eq("slug", "little-lantern")).unique();
    if (!center) return { centerId: null, insertedCount: 0 };

    const published = await ctx.db.query("knowledge")
      .withIndex("by_center_and_status", (q) => q.eq("centerId", center._id).eq("status", "published"))
      .take(101);
    const drafts = await ctx.db.query("knowledge")
      .withIndex("by_center_and_status", (q) => q.eq("centerId", center._id).eq("status", "draft"))
      .take(101);
    if (published.length > 100 || drafts.length > 100) {
      throw new Error("Seed update stopped because the center has more than 100 handbook records in one status. Increase the seed scan limit before retrying.");
    }
    const existingRows = [...published, ...drafts];
    const rowsBySeedKey = new Map<string, (typeof existingRows)[number]>();
    for (const entry of existingRows) {
      if (entry.seedKey) rowsBySeedKey.set(entry.seedKey, entry);
    }
    const existingByContentKey = new Map<string, (typeof existingRows)[number]>(
      existingRows.map((entry) => [`${entry.title}::${entry.sourceLabel}`, entry] as const),
    );
    let insertedCount = 0;
    const reviewedAt = Date.UTC(2026, 8, 24);

    for (const entry of littleLanternAdditionalKnowledge) {
      const seededRow = rowsBySeedKey.get(entry.seedKey);
      if (seededRow) continue;
      const key = `${entry.title}::${entry.sourceLabel}`;
      const existingRow = existingByContentKey.get(key);
      if (existingRow) {
        if (existingRow.seedKey === undefined) {
          await ctx.db.patch(existingRow._id, { seedKey: entry.seedKey });
        }
        continue;
      }
      await ctx.db.insert("knowledge", {
        ...entry,
        centerId: center._id,
        reviewedAt,
        searchText: knowledgeSearchText(entry),
      });
      insertedCount += 1;
    }

    return { centerId: center._id, insertedCount };
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
      ...littleLanternAdditionalKnowledge,
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
