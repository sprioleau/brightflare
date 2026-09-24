export function hasForbiddenTerm(text: string, terms: string[]) {
  const normalizedText = text.toLocaleLowerCase();
  return terms.some((term) => {
    const normalizedTerm = term.trim().toLocaleLowerCase();
    if (!normalizedTerm) return false;
    const escapedTerm = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escapedTerm}(?=$|[^\\p{L}\\p{N}])`, "iu").test(normalizedText);
  });
}
