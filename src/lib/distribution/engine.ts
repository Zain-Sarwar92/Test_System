export type DistributionMode = "BALANCED" | "RANDOM";

export type PoolQuestion = {
  id: string;
  topicId: string;
  chapterId: string;
  type: string;
  marks: number;
};

export type ChapterQuota = {
  chapterId: string;
  count: number;
};

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Balanced: round-robin one question per topic per round */
export function selectBalanced(pool: PoolQuestion[], count: number): PoolQuestion[] {
  if (count <= 0 || pool.length === 0) return [];

  const byTopic = new Map<string, PoolQuestion[]>();
  for (const q of shuffle(pool)) {
    const list = byTopic.get(q.topicId) ?? [];
    list.push(q);
    byTopic.set(q.topicId, list);
  }

  const topicIds = shuffle([...byTopic.keys()]);
  const pointers = new Map(topicIds.map((id) => [id, 0]));
  const selected: PoolQuestion[] = [];
  const used = new Set<string>();

  let madeProgress = true;
  while (selected.length < count && madeProgress) {
    madeProgress = false;
    for (const topicId of topicIds) {
      if (selected.length >= count) break;
      const list = byTopic.get(topicId) ?? [];
      let idx = pointers.get(topicId) ?? 0;
      while (idx < list.length && used.has(list[idx].id)) idx += 1;
      if (idx < list.length) {
        selected.push(list[idx]);
        used.add(list[idx].id);
        pointers.set(topicId, idx + 1);
        madeProgress = true;
      }
    }
  }

  return selected;
}

/** Pure random unique selection */
export function selectRandom(pool: PoolQuestion[], count: number): PoolQuestion[] {
  return shuffle(pool).slice(0, Math.max(0, count));
}

export function selectQuestions(
  pool: PoolQuestion[],
  count: number,
  mode: DistributionMode,
): PoolQuestion[] {
  const uniquePool = [...new Map(pool.map((q) => [q.id, q])).values()];
  if (mode === "RANDOM") return selectRandom(uniquePool, count);
  return selectBalanced(uniquePool, count);
}

/**
 * Build initial chapter quotas for preview.
 * Spreads total across chapters that have available questions.
 */
export function buildInitialChapterQuotas(
  availableByChapter: Record<string, number>,
  total: number,
): ChapterQuota[] {
  const chapters = Object.entries(availableByChapter)
    .filter(([, available]) => available > 0)
    .map(([chapterId, available]) => ({ chapterId, available }));

  if (chapters.length === 0 || total <= 0) return [];

  const cappedTotal = Math.min(
    total,
    chapters.reduce((sum, c) => sum + c.available, 0),
  );

  const quotas = chapters.map((c) => ({ chapterId: c.chapterId, count: 0 }));
  let remaining = cappedTotal;
  let round = 0;

  while (remaining > 0 && round < cappedTotal + 5) {
    let progressed = false;
    for (let i = 0; i < chapters.length && remaining > 0; i += 1) {
      if (quotas[i].count < chapters[i].available) {
        quotas[i].count += 1;
        remaining -= 1;
        progressed = true;
      }
    }
    if (!progressed) break;
    round += 1;
  }

  return quotas.filter((q) => q.count > 0);
}

/** Select questions respecting per-chapter quotas */
export function selectByChapterQuotas(
  pool: PoolQuestion[],
  quotas: ChapterQuota[],
  mode: DistributionMode,
): PoolQuestion[] {
  const selected: PoolQuestion[] = [];
  const used = new Set<string>();

  for (const quota of quotas) {
    const chapterPool = pool.filter(
      (q) => q.chapterId === quota.chapterId && !used.has(q.id),
    );
    const picks = selectQuestions(chapterPool, quota.count, mode);
    for (const p of picks) {
      selected.push(p);
      used.add(p.id);
    }
  }

  return selected;
}
