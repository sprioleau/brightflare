export type SearchableSource = {
  id: string;
  sourceLabel: string;
  reviewedAt: number;
  text: string;
};

export function findRelevantSources<T extends SearchableSource>(sources: T[], query: string, limit = 4): T[] {
  const tokens = [...new Set(query.toLowerCase().match(/[a-z0-9]+/g) ?? [])]
    .filter((token) => token.length > 2);
  if (tokens.length === 0) return [];
  return sources
    .map((source) => {
      const label = source.sourceLabel.toLowerCase();
      const text = source.text.toLowerCase();
      const score = tokens.reduce((total, token) => total + (label.includes(token) ? 2 : 0) + (text.includes(token) ? 1 : 0), 0);
      return { source, score };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ source }) => source);
}
