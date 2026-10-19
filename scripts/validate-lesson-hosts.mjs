const steps = ['theory', 'example', 'quiz', 'practice', 'lab'];
const hosts = ['browser', 'node'];
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function validateLessonHosts(lesson, indexed, exercises, lessonIds) {
  const errors = [];
  const need = (condition, message) => { if (!condition) errors.push(`${message}: ${lesson.id}`); };
  const mapping = lesson.exerciseByHost;
  if (mapping === undefined) {
    need(indexed.exerciseByHost === undefined && lesson.hostVariants === undefined, 'Unmapped host variant');
    return errors;
  }
  if (!record(mapping) || Object.keys(mapping).sort().join(',') !== 'browser,node') {
    errors.push(`Invalid exerciseByHost: ${lesson.id}`);
    return errors;
  }
  need(record(indexed.exerciseByHost) && Object.keys(indexed.exerciseByHost).sort().join(',') === 'browser,node' &&
    hosts.every(host => mapping[host] === indexed.exerciseByHost[host]), 'Catalog/lesson host mapping mismatch');
  need(mapping.browser === lesson.exerciseId && mapping.browser !== mapping.node, 'Default host exercise mismatch');
  for (const host of hosts) {
    const exercise = exercises.get(mapping[host]);
    need(nonempty(mapping[host]) && exercise?.lessonId === lesson.id, 'Missing or cross-lesson host exercise');
    need(host === 'node' ? exercise?.profileId === 'node-native' && exercise?.hostRequirements?.includes('node-native')
      : exercise?.profileId !== 'node-native' && !exercise?.hostRequirements?.includes('node-native'), 'Host/profile mismatch');
  }
  const variants = lesson.hostVariants;
  if (!record(variants) || Object.keys(variants).join(',') !== 'node' || !record(variants.node)) {
    errors.push(`Missing Node learning content: ${lesson.id}`);
    return errors;
  }
  const node = variants.node;
  const allowed = ['exerciseId', 'title', 'steps', 'goals', 'quiz', 'sources', 'prerequisites'];
  need(Object.keys(node).every(key => allowed.includes(key)), 'Host content cannot replace lesson identity');
  need(node.title === undefined || nonempty(node.title), 'Host display title must be nonempty');
  need(node.exerciseId === mapping.node, 'Host content/exercise mismatch');
  need(record(node.steps) && Object.keys(node.steps).sort().join(',') === [...steps].sort().join(',') &&
    steps.every(step => nonempty(node.steps[step])), 'Host content needs five learning stages');
  need(Array.isArray(node.goals) && node.goals.length > 0 && node.goals.every(nonempty), 'Host learning goals missing');
  need(Array.isArray(node.sources) && node.sources.length > 0 && node.sources.every(source => {
    try { return nonempty(source.title) && new URL(source.url).protocol === 'https:'; } catch { return false; }
  }), 'Host official sources missing');
  need(Array.isArray(node.prerequisites) && new Set(node.prerequisites).size === node.prerequisites.length &&
    node.prerequisites.every(id => lessonIds.has(id)), 'Unknown host prerequisite');
  const quiz = node.quiz;
  need(nonempty(quiz?.revision) && quiz.revision !== (lesson.quiz?.revision ?? lesson.contentRevision), 'Host quiz revision must be distinct');
  const questions = Array.isArray(quiz?.questions) ? quiz.questions : [];
  need(questions.length > 0 && new Set(questions.map(question => question?.id)).size === questions.length, 'Host quiz questions missing or duplicate');
  for (const question of questions) {
    const choices = Array.isArray(question?.choices) ? question.choices : [];
    need(nonempty(question?.id) && nonempty(question?.prompt) && choices.length >= 2 &&
      new Set(choices.map(choice => choice?.id)).size === choices.length && choices.every(choice =>
        nonempty(choice?.id) && nonempty(choice?.text) && nonempty(choice?.explanation)) &&
      choices.some(choice => choice.id === question.correctChoiceId), 'Invalid host quiz question');
  }
  return errors;
}

export function validateHostPrerequisiteGraphs(lessons) {
  const errors = [];
  for (const host of hosts) {
    const done = new Set();
    const visit = (id, active) => {
      if (active.has(id)) { errors.push(`Host prerequisite cycle: ${host}:${id}`); return; }
      if (done.has(id)) return;
      const lesson = lessons.get(id);
      if (!lesson) { errors.push(`Unknown host prerequisite: ${host}:${id}`); return; }
      active.add(id);
      const prerequisites = lesson.hostVariants?.[host]?.prerequisites ?? lesson.prerequisites;
      for (const prerequisite of Array.isArray(prerequisites) ? prerequisites : []) visit(prerequisite, active);
      active.delete(id);
      done.add(id);
    };
    for (const id of lessons.keys()) visit(id, new Set());
  }
  return errors;
}
