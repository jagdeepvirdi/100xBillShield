const words = (text: string) => text.trim().split(/\s+/).filter(Boolean);

// Word-level edit distance: each word added, removed or replaced counts as one change.
export function wordsChanged(draft: string, sent: string): number {
  const a = words(draft);
  const b = words(sent);

  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
}
