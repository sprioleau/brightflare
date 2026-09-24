export function isPrivateChildQuestion(question: string): boolean {
  if (/@child\b/i.test(question)) return true;
  return /\b(my child|my son|my daughter|my kid)\b.{0,70}\b(today|yesterday|last week|teacher said|messages?|ate|nap|diaper|photo|daily report)\b/i.test(
    question,
  );
}

export function shouldSuppressAnswerDraft(question: string): boolean {
  return isPrivateChildQuestion(question)
    || /\b(allerg(?:y|ies|ic)|asthma|chok(?:e|ing)|emergency|fever|injur(?:y|ies)|medicat(?:e|ed|ion)|medical|rash|seizure|sick|symptom|vomit(?:ing)?)\b/i.test(question);
}

export function makeCanonicalKey(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 120);
}

export function makeRedactedTopicExample(title: string): string {
  return title.replace(/\b\d{2,}\b/g, "[date or number]").slice(0, 180);
}

const topicSynonyms: Record<string, string> = {
  meals: "lunch",
  meal: "lunch",
  food: "lunch",
  workday: "learning",
};

function topicWords(title: string): Set<string> {
  const stopWords = new Set(["a", "an", "the", "on", "for", "at", "in", "of", "is", "are", "what", "when", "will"]);
  return new Set(title.toLowerCase().match(/[a-z]+/g)?.map((word) => topicSynonyms[word] || word).filter((word) => !stopWords.has(word)) || []);
}

export function matchExistingTopic(title: string, existingTitles: string[]): string | null {
  const words = topicWords(title);
  if (words.size < 2) return null;
  let bestTitle: string | null = null;
  let bestScore = 0;
  for (const existingTitle of existingTitles) {
    const existingWords = topicWords(existingTitle);
    const matchingWords = [...words].filter((word) => existingWords.has(word)).length;
    const score = matchingWords / new Set([...words, ...existingWords]).size;
    if (matchingWords >= 2 && score > bestScore) {
      bestTitle = existingTitle;
      bestScore = score;
    }
  }
  return bestScore >= 0.6 ? bestTitle : null;
}
