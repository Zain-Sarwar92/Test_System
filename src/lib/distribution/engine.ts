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

/** How many questions of the current section each topic has already contributed. */
export type TopicUsage = Record<string, number>;

/** Count how many times each topic appears in an existing selection session. */
export function buildTopicUsage(
  questions: Array<{ topicId: string }>,
): TopicUsage {
  const usage: TopicUsage = {};
  for (const q of questions) {
    usage[q.topicId] = (usage[q.topicId] ?? 0) + 1;
  }
  return usage;
}

export type SelectionOptions = {
  /**
   * Topic usage carried over from earlier picks in the same selection session.
   * Passing it makes a follow-up pick (e.g. replacing one question) continue the
   * round-robin instead of restarting it, so a topic is only reused once every
   * eligible topic has been used the same number of times.
   */
  topicUsage?: TopicUsage;
};

/**
 * Balanced: round-robin one question per topic per round, always drawing from the
 * least-used topics first. Random within each round and within a topic.
 */
export function selectBalanced(
  pool: PoolQuestion[],
  count: number,
  topicUsage: TopicUsage = {},
): PoolQuestion[] {
  if (count <= 0 || pool.length === 0) return [];

  const byTopic = new Map<string, PoolQuestion[]>();
  for (const q of shuffle(pool)) {
    const list = byTopic.get(q.topicId) ?? [];
    list.push(q);
    byTopic.set(q.topicId, list);
  }

  const topicIds = [...byTopic.keys()];
  const pointers = new Map(topicIds.map((id) => [id, 0]));
  const usage = new Map(topicIds.map((id) => [id, topicUsage[id] ?? 0]));
  const selected: PoolQuestion[] = [];

  while (selected.length < count) {
    const available = topicIds.filter(
      (id) => (pointers.get(id) ?? 0) < (byTopic.get(id)?.length ?? 0),
    );
    if (available.length === 0) break;

    const minUsage = Math.min(...available.map((id) => usage.get(id) ?? 0));
    const round = shuffle(available.filter((id) => (usage.get(id) ?? 0) === minUsage));

    for (const topicId of round) {
      if (selected.length >= count) break;
      const list = byTopic.get(topicId)!;
      const idx = pointers.get(topicId) ?? 0;
      selected.push(list[idx]!);
      pointers.set(topicId, idx + 1);
      usage.set(topicId, (usage.get(topicId) ?? 0) + 1);
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
  options?: SelectionOptions,
): PoolQuestion[] {
  const uniquePool = [...new Map(pool.map((q) => [q.id, q])).values()];
  const topicUsage = options?.topicUsage;
  // Session usage means this pick continues an existing selection, where topic
  // spread must hold even for a RANDOM section.
  const hasSessionUsage = Boolean(topicUsage && Object.keys(topicUsage).length > 0);
  if (mode === "RANDOM" && !hasSessionUsage) return selectRandom(uniquePool, count);
  return selectBalanced(uniquePool, count, topicUsage ?? {});
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
  options?: SelectionOptions,
): PoolQuestion[] {
  const selected: PoolQuestion[] = [];
  const used = new Set<string>();
  const topicUsage: TopicUsage = { ...(options?.topicUsage ?? {}) };

  for (const quota of quotas) {
    const chapterPool = pool.filter(
      (q) => q.chapterId === quota.chapterId && !used.has(q.id),
    );
    const picks = selectQuestions(chapterPool, quota.count, mode, { topicUsage });
    for (const p of picks) {
      selected.push(p);
      used.add(p.id);
      topicUsage[p.topicId] = (topicUsage[p.topicId] ?? 0) + 1;
    }
  }

  return selected;
}
