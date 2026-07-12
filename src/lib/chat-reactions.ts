export interface MessageReactionRow {
  message_id: string;
  user_id: string;
  emoji: string;
}

export type GroupedReactions = Record<string, { emoji: string; count: number; userIds: string[] }[]>;

export function groupReactions(reactionsList: MessageReactionRow[]): GroupedReactions {
  const grouped: GroupedReactions = {};

  for (const reaction of reactionsList) {
    grouped[reaction.message_id] ??= [];
    const existing = grouped[reaction.message_id].find((item) => item.emoji === reaction.emoji);
    if (existing) {
      if (!existing.userIds.includes(reaction.user_id)) {
        existing.userIds.push(reaction.user_id);
        existing.count++;
      }
    } else {
      grouped[reaction.message_id].push({
        emoji: reaction.emoji,
        count: 1,
        userIds: [reaction.user_id],
      });
    }
  }

  return grouped;
}

export function addReaction(current: GroupedReactions, reaction: MessageReactionRow): GroupedReactions {
  const groups = current[reaction.message_id] ?? [];
  const index = groups.findIndex((item) => item.emoji === reaction.emoji);

  if (index >= 0) {
    const group = groups[index];
    if (group.userIds.includes(reaction.user_id)) return current;

    const nextGroups = [...groups];
    const userIds = [...group.userIds, reaction.user_id];
    nextGroups[index] = { ...group, count: userIds.length, userIds };
    return { ...current, [reaction.message_id]: nextGroups };
  }

  return {
    ...current,
    [reaction.message_id]: [
      ...groups,
      { emoji: reaction.emoji, count: 1, userIds: [reaction.user_id] },
    ],
  };
}

export function removeReaction(current: GroupedReactions, reaction: MessageReactionRow): GroupedReactions {
  const groups = current[reaction.message_id];
  if (!groups) return current;

  const index = groups.findIndex((item) => item.emoji === reaction.emoji);
  if (index < 0) return current;

  const group = groups[index];
  if (!group.userIds.includes(reaction.user_id)) return current;

  const userIds = group.userIds.filter((id) => id !== reaction.user_id);
  const nextGroups =
    userIds.length > 0
      ? groups.map((item, itemIndex) =>
          itemIndex === index ? { ...item, count: userIds.length, userIds } : item
        )
      : groups.filter((_, itemIndex) => itemIndex !== index);

  const next = { ...current };
  if (nextGroups.length > 0) {
    next[reaction.message_id] = nextGroups;
  } else {
    delete next[reaction.message_id];
  }

  return next;
}

export function pruneReactions(current: GroupedReactions, messageIds: Set<string>): GroupedReactions {
  let changed = false;
  const next: GroupedReactions = {};

  for (const [messageId, groups] of Object.entries(current)) {
    if (messageIds.has(messageId)) {
      next[messageId] = groups;
    } else {
      changed = true;
    }
  }

  return changed ? next : current;
}
