function normalizeTopicName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function buildTopicGroups(topics) {
  const groups = [];
  const indexByKey = new Map();

  for (const topic of Array.isArray(topics) ? topics : []) {
    const key = `${topic.direction_id || ''}::${normalizeTopicName(topic.name)}`;
    const existingIndex = indexByKey.get(key);

    if (existingIndex !== undefined) {
      const existing = groups[existingIndex];
      existing.topicIds.push(topic.id);
      existing.items.push(topic);
      continue;
    }

    indexByKey.set(key, groups.length);
    groups.push({
      id: topic.id,
      name: topic.name,
      faculty_id: topic.faculty_id,
      direction_id: topic.direction_id,
      topicIds: [topic.id],
      items: [topic]
    });
  }

  return groups;
}
