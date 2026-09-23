import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const knowledgeStatus = v.union(v.literal("published"), v.literal("draft"));
const topicStatus = v.union(
  v.literal("needs_answer"),
  v.literal("needs_review"),
  v.literal("answered"),
  v.literal("handled_by_staff"),
);

export default defineSchema({
  centers: defineTable({
    slug: v.string(),
    name: v.string(),
    timezone: v.string(),
    handbookLabel: v.string(),
    websiteUrl: v.optional(v.string()),
  }).index("by_slug", ["slug"]),
  knowledge: defineTable({
    centerId: v.id("centers"),
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
    searchText: v.string(),
  })
    .index("by_center_and_status", ["centerId", "status"])
    .index("by_center_and_featured_and_status", ["centerId", "isFeatured", "status"])
    .searchIndex("search_knowledge", {
      searchField: "searchText",
      filterFields: ["centerId", "status"],
    }),
  topics: defineTable({
    centerId: v.id("centers"),
    canonicalTitle: v.string(),
    canonicalKey: v.string(),
    questionCount: v.number(),
    sessionCount: v.number(),
    status: topicStatus,
    recentExamples: v.array(v.string()),
    lastAskedAt: v.number(),
    knowledgeId: v.optional(v.id("knowledge")),
  })
    .index("by_center_and_key", ["centerId", "canonicalKey"])
    .index("by_center_and_knowledge", ["centerId", "knowledgeId"])
    .index("by_center_and_status_and_last_asked", ["centerId", "status", "lastAskedAt"]),
  seasonalHistory: defineTable({
    centerId: v.id("centers"),
    canonicalTitle: v.string(),
    month: v.number(),
    year: v.number(),
    questionCount: v.number(),
  }).index("by_center_month_and_year", ["centerId", "month", "year"]),
  children: defineTable({
    centerId: v.id("centers"),
    firstName: v.string(),
    lastName: v.string(),
    ageGroup: v.string(),
  }).index("by_center_and_name", ["centerId", "firstName", "lastName"]),
  childMessages: defineTable({
    centerId: v.id("centers"),
    childId: v.id("children"),
    dateLabel: v.string(),
    summary: v.string(),
    sourceLabel: v.string(),
  }).index("by_child_and_center", ["childId", "centerId"]),
  questionSessions: defineTable({
    topicId: v.id("topics"),
    sessionKey: v.string(),
  }).index("by_topic_and_session", ["topicId", "sessionKey"]),
  questionEvents: defineTable({
    centerId: v.id("centers"),
    topicId: v.optional(v.id("topics")),
    redactedQuestion: v.string(),
    askedAt: v.number(),
    isPrivate: v.boolean(),
    outcome: v.union(v.literal("answered"), v.literal("needs_staff")),
    sourceStatus: v.union(v.literal("sourced"), v.literal("unsourced")),
  }).index("by_center_and_asked_at", ["centerId", "askedAt"]),
});
