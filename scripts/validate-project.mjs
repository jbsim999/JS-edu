import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function validateProject(directory) {
  const root = await realpath(directory);
  const errors = [];
  const need = (condition, message) => { if (!condition) errors.push(message); };
  const read = async name => {
    need(typeof name === 'string' && name.length > 0, 'Missing file path');
    if (typeof name !== 'string' || !name) return null;
    const candidate = path.resolve(root, name);
    if (!candidate.startsWith(root + path.sep)) { errors.push(`Path escapes project: ${name}`); return null; }
    try {
      const actual = await realpath(candidate);
      if (!actual.startsWith(root + path.sep)) { errors.push(`Linked path escapes project: ${name}`); return null; }
      return JSON.parse(await readFile(actual, 'utf8'));
    } catch (error) { errors.push(`${name}: ${error.message}`); return null; }
  };
  const verifyFile = async (reference, label) => {
    const name = typeof reference === 'string' ? reference : reference?.path;
    if (typeof name !== 'string' || !name) { errors.push(`Missing file path: ${label}`); return; }
    const candidate = path.resolve(root, name);
    if (path.isAbsolute(name) || !candidate.startsWith(root + path.sep)) {
      errors.push(`File path escapes project: ${label}:${name}`); return;
    }
    try {
      const actual = await realpath(candidate);
      if (!actual.startsWith(root + path.sep)) { errors.push(`Linked file escapes project: ${label}:${name}`); return; }
      need((await stat(actual)).isFile(), `Not a file: ${label}:${name}`);
    } catch (error) { errors.push(`Missing or unreadable file: ${label}:${name}: ${error.message}`); }
  };
  const [config, catalog, exerciseData, profileData] = await Promise.all([
    read('education.config.json'), read('curriculum/catalog.json'), read('curriculum/exercises.json'), read('runtime/profiles.json'),
  ]);
  const list = (value, label) => { need(Array.isArray(value), `${label} must be an array`); return Array.isArray(value) ? value : []; };
  const versions = list(config?.languageVersions, 'languageVersions');
  need(versions.length > 0 && versions.every(value => typeof value === 'string' && value.length > 0) && new Set(versions).size === versions.length,
    'languageVersions must be distinct nonempty string IDs');
  const unique = (items, label) => {
    const map = new Map();
    for (const item of items) {
      if (!item || typeof item.id !== 'string' || !item.id) { errors.push(`${label}: missing ID`); continue; }
      need(!map.has(item.id), `${label}: duplicate ID ${item.id}`);
      map.set(item.id, item);
    }
    return map;
  };
  const entries = unique(list(catalog?.lessons, 'catalog.lessons'), 'catalog');
  const exercises = unique(list(exerciseData?.exercises, 'exercises'), 'exercise');
  const profiles = unique(list(profileData?.profiles, 'profiles'), 'profile');
  const lessons = new Map();
  for (const [id, entry] of entries) {
    const lesson = await read(entry.file);
    if (!lesson) continue;
    need(lesson.id === id, `Catalog/file ID mismatch: ${id}`);
    need(typeof lesson.contentRevision === 'string' && lesson.contentRevision.length > 0, `Missing contentRevision: ${id}`);
    need(['draft', 'reviewed'].includes(lesson.status), `Invalid lesson status: ${id}`);
    need(['theory', 'example', 'quiz', 'practice', 'lab'].every(step => Object.hasOwn(lesson.steps ?? {}, step)), `Missing lesson step: ${id}`);
    const supported = list(lesson.supportedVersions, `${id}.supportedVersions`);
    need(supported.length > 0 && supported.every(version => versions.includes(version)), `Unsupported lesson version: ${id}`);
    const prerequisites = list(lesson.prerequisites, `${id}.prerequisites`);
    const indexedPrerequisites = list(entry.prerequisites, `catalog:${id}.prerequisites`);
    need(new Set(prerequisites).size === prerequisites.length, `Duplicate prerequisite: ${id}`);
    need(new Set(indexedPrerequisites).size === indexedPrerequisites.length &&
      indexedPrerequisites.length === prerequisites.length && indexedPrerequisites.every(value => prerequisites.includes(value)),
      `Catalog/lesson prerequisites mismatch: ${id}`);
    need(entry.exerciseId === lesson.exerciseId, `Catalog/lesson exercise mismatch: ${id}`);
    need(exercises.has(lesson.exerciseId), `Missing exercise for lesson: ${id}`);
    if (lesson.status === 'reviewed') {
      need(Array.isArray(lesson.goals) && lesson.goals.length > 0 && Array.isArray(lesson.sources) && lesson.sources.length > 0,
        `Reviewed lesson lacks goals/sources: ${id}`);
      need(['theory', 'example', 'quiz', 'practice', 'lab'].every(step => typeof lesson.steps?.[step] === 'string' && lesson.steps[step].trim()),
        `Reviewed lesson contains an empty step: ${id}`);
    }
    lessons.set(id, lesson);
  }
  const visit = (id, active = new Set(), done = new Set()) => {
    if (active.has(id)) { errors.push(`Prerequisite cycle: ${id}`); return; }
    if (done.has(id)) return;
    const lesson = lessons.get(id);
    if (!lesson) { errors.push(`Unknown prerequisite: ${id}`); return; }
    active.add(id);
    for (const prerequisite of Array.isArray(lesson.prerequisites) ? lesson.prerequisites : []) visit(prerequisite, active, done);
    active.delete(id);
    done.add(id);
  };
  const done = new Set();
  for (const id of lessons.keys()) visit(id, new Set(), done);
  for (const [id, profile] of profiles) {
    need(versions.includes(profile.languageVersion), `Unsupported profile version: ${id}`);
    need(typeof profile.execution?.available === 'boolean', `Profile availability missing: ${id}`);
    if (profile.execution?.available === false) need(typeof profile.execution.reason === 'string' && profile.execution.reason.trim(), `Unavailable profile needs reason: ${id}`);
  }
  for (const [id, exercise] of exercises) {
    for (const field of ['files', 'testFiles']) {
      const references = list(exercise[field], `${id}.${field}`);
      for (const [index, reference] of references.entries()) await verifyFile(reference, `${id}.${field}[${index}]`);
    }
    need(lessons.has(exercise.lessonId), `Unknown exercise lesson: ${id}`);
    need(lessons.get(exercise.lessonId)?.exerciseId === id, `Exercise/lesson mismatch: ${id}`);
    need(profiles.has(exercise.profileId), `Unknown exercise profile: ${id}`);
    need(lessons.get(exercise.lessonId)?.supportedVersions?.includes(profiles.get(exercise.profileId)?.languageVersion),
      `Exercise profile version not supported by lesson: ${id}`);
    const supportedVersions = lessons.get(exercise.lessonId)?.supportedVersions ?? [];
    if (supportedVersions.length > 1) need(exercise.profileByVersion !== undefined, `Missing multi-version profile mapping: ${id}`);
    if (exercise.profileByVersion !== undefined) {
      const mapping = exercise.profileByVersion;
      const supported = supportedVersions;
      need(mapping && typeof mapping === 'object' && !Array.isArray(mapping), `Invalid profileByVersion: ${id}`);
      if (mapping && typeof mapping === 'object' && !Array.isArray(mapping)) {
        need(Object.keys(mapping).length === supported.length && supported.every(version => Object.hasOwn(mapping, version)),
          `Incomplete version/profile mapping: ${id}`);
        for (const [version, profileId] of Object.entries(mapping)) {
          need(supported.includes(version) && profiles.get(profileId)?.languageVersion === version,
            `Mismatched version/profile mapping: ${id}:${version}`);
        }
      }
    }
    need(['structure', 'body', 'project'].includes(exercise.mode), `Invalid exercise mode: ${id}`);
    need(typeof exercise.executionVerified === 'boolean', `Missing executionVerified: ${id}`);
    if (exercise.executionVerified === true) {
      need(profiles.get(exercise.profileId)?.execution?.available === true, `Verified exercise has unavailable runner: ${id}`);
      need(Array.isArray(exercise.behaviorCriteria) && exercise.behaviorCriteria.length > 0, `Verified exercise lacks behavior criteria: ${id}`);
      // A record is only a reference to evidence, not automatic approval of its claims.
      const evidence = await read(exercise.verificationRecord);
      need(evidence?.status === 'passed' && Number.isInteger(evidence?.executedTests) && evidence.executedTests > 0,
        `Missing passing nonzero-test evidence: ${id}`);
      need(evidence?.exerciseId === id && evidence?.contentRevision === lessons.get(exercise.lessonId)?.contentRevision,
        `Stale or mismatched evidence: ${id}`);
    }
  }
  return { status: errors.length ? 'FAIL' : 'PASS', scope: 'structure-only', errors, lessons: lessons.size,
    drafts: [...lessons.values()].filter(lesson => lesson.status === 'draft').length,
    actualExecutionTestedByValidator: false, contentAccuracyReviewedByValidator: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node validate-project.mjs <project-directory>');
    const result = await validateProject(process.argv[2]);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.status === 'PASS' ? 0 : 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
