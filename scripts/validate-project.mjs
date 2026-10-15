import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateModuleExercise } from './verify-module-curriculum.mjs';

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const normalizedLines = value => value.replace(/\r\n/g, '\n');

// JSON.parse accepts duplicate members. Reject them before an earlier contract is silently replaced.
function duplicateMembers(source) {
  const tokens = source.match(/"(?:\\[\s\S]|[^"\\])*"|[{}\[\]:,]|[^\s{}\[\]:,]+/g) ?? [];
  const duplicates = [];
  let index = 0;
  const visit = location => {
    const token = tokens[index++];
    if (token === '{') {
      const members = new Set();
      while (tokens[index] !== '}') {
        const name = JSON.parse(tokens[index++]);
        if (members.has(name)) duplicates.push(`${location}.${name}`);
        members.add(name);
        index++; // colon; JSON.parse has already checked syntax.
        visit(`${location}.${name}`);
        if (tokens[index] === ',') index++;
      }
      index++;
    } else if (token === '[') {
      let item = 0;
      while (tokens[index] !== ']') {
        visit(`${location}[${item++}]`);
        if (tokens[index] === ',') index++;
      }
      index++;
    }
  };
  visit('$');
  return duplicates;
}

function isJsonValue(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return value !== null && typeof value === 'object' && Object.values(value).every(isJsonValue);
}

export async function validateProject(directory) {
  const root = await realpath(directory);
  const errors = [];
  const need = (condition, message) => { if (!condition) errors.push(message); };
  const read = async name => {
    need(typeof name === 'string' && name.length > 0, 'Missing file path');
    if (typeof name !== 'string' || !name) return null;
    const candidate = path.resolve(root, name);
    if (path.isAbsolute(name) || !candidate.startsWith(root + path.sep)) { errors.push(`Path escapes project: ${name}`); return null; }
    try {
      const actual = await realpath(candidate);
      if (!actual.startsWith(root + path.sep)) { errors.push(`Linked path escapes project: ${name}`); return null; }
      const source = await readFile(actual, 'utf8');
      const value = JSON.parse(source);
      for (const member of duplicateMembers(source)) errors.push(`Duplicate JSON member: ${name}:${member}`);
      return value;
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
      if (!(await stat(actual)).isFile()) { errors.push(`Not a file: ${label}:${name}`); return; }
      return actual;
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
  need(entries.size > 0, 'Catalog must contain at least one actual lesson');
  need(exercises.size > 0, 'At least one actual exercise is required');
  need(profiles.size > 0, 'At least one execution profile is required');
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
    if (entry.contentRevision !== undefined) need(entry.contentRevision === lesson.contentRevision, `Catalog/lesson revision mismatch: ${id}`);
    if (lesson.example?.expectedLogs !== undefined) need(Array.isArray(lesson.example.expectedLogs) && lesson.example.expectedLogs.every(value => typeof value === 'string'),
      `Invalid lesson example.expectedLogs: ${id}`);
    if (lesson.quiz !== undefined) {
      const questions = list(lesson.quiz?.questions, `${id}.quiz.questions`);
      need(questions.length > 0, `Quiz must contain questions: ${id}`);
      for (const [questionId, question] of unique(questions, `quiz:${id}`)) {
        need(nonempty(question.prompt), `Missing quiz prompt: ${id}:${questionId}`);
        const choices = list(question.choices, `${id}:${questionId}.choices`);
        need(choices.length >= 2, `Quiz needs at least two choices: ${id}:${questionId}`);
        const indexedChoices = unique(choices, `quiz choice:${id}:${questionId}`);
        need(indexedChoices.has(question.correctChoiceId), `Unknown correct quiz choice: ${id}:${questionId}`);
        for (const [choiceId, choice] of indexedChoices) {
          need(nonempty(choice.text) && nonempty(choice.explanation), `Missing quiz choice text/explanation: ${id}:${questionId}:${choiceId}`);
        }
      }
    }
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
      const names = references.map(reference => typeof reference === 'string' ? reference : reference?.path);
      need(new Set(names).size === names.length, `Duplicate file reference: ${id}.${field}`);
      const namedFiles = references.filter(reference => reference && typeof reference === 'object' && reference.id !== undefined);
      unique(namedFiles, `${id}.${field}`);
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
    need(['structure', 'body', 'project', 'files'].includes(exercise.mode), `Invalid exercise mode: ${id}`);
    if (exercise.mode === 'files') need(exercise.runner?.kind === 'module-files', `Files mode requires a module-files runner: ${id}`);
    need(typeof exercise.executionVerified === 'boolean', `Missing executionVerified: ${id}`);
    if (exercise.contentRevision !== undefined || exercise.runner !== undefined) {
      need(nonempty(exercise.contentRevision) && exercise.contentRevision === lessons.get(exercise.lessonId)?.contentRevision,
        `Exercise/lesson revision mismatch: ${id}`);
    }
    for (const [label, requirements] of [['exercise', exercise.hostRequirements], ['runner', exercise.runner?.hostRequirements]]) {
      if (requirements !== undefined) {
        need(Array.isArray(requirements) && requirements.every(nonempty) && new Set(requirements).size === requirements.length,
          `Invalid host requirements: ${id}:${label}`);
      }
    }
    if (exercise.runner !== undefined) {
      const runner = exercise.runner;
      need(['function-body', 'module-files'].includes(runner?.kind), `Unsupported runner kind: ${id}`);
      need(nonempty(exercise.graderRevision), `Missing graderRevision: ${id}`);
      need(Array.isArray(exercise.files) && exercise.files.length > 0, `Runner requires a starter file: ${id}`);
      need(Array.isArray(exercise.behaviorCriteria) && exercise.behaviorCriteria.length > 0 && exercise.behaviorCriteria.every(nonempty),
        `Runner requires behavior criteria: ${id}`);
      if (runner?.kind === 'module-files') {
        errors.push(...validateModuleExercise(exercise));
      } else if (runner?.kind === 'function-body') {
        need(nonempty(runner.exportName) && /^[A-Za-z_$][\w$]*$/.test(runner.exportName), `Invalid runner exportName: ${id}`);
        need(typeof runner.async === 'boolean', `Runner async flag missing: ${id}`);
        need(runner.generator === undefined || typeof runner.generator === 'boolean', `Invalid runner generator flag: ${id}`);
        const parameters = list(runner.parameters, `${id}.runner.parameters`);
        need(parameters.every(nonempty), `Runner parameters must be nonempty strings: ${id}`);
        const editable = exercise.editable;
        need(editable && ['prefix', 'suffix', 'initialBody'].every(field => typeof editable[field] === 'string'), `Missing editable template parts: ${id}`);
        if (editable && ['prefix', 'suffix', 'initialBody'].every(field => typeof editable[field] === 'string')) {
          need(editable.prefix + editable.initialBody + editable.suffix === exercise.template, `Editable/template mismatch: ${id}`);
          const declaration = `export ${runner.async ? 'async ' : ''}function${runner.generator ? '*' : ''} ${runner.exportName}(${parameters.join(', ')}) {\n`;
          need(normalizedLines(editable.prefix) === declaration && /^\s*\}\s*$/u.test(editable.suffix), `Displayed declaration/runner mismatch: ${id}`);
          try {
            // A strict outer factory also supports default/rest parameters, whose bodies cannot
            // contain their own "use strict" directive. It matches the authored ES module contract.
            new Function(`"use strict"; return ${runner.async ? 'async ' : ''}function${runner.generator ? '*' : ''} ${runner.exportName}(${parameters.join(',')}) {\n${editable.initialBody}\n}`);
          } catch (error) { errors.push(`Invalid runner function syntax: ${id}: ${error.message}`); }
        }
      }
      if (runner?.runProbe !== undefined) {
        need(nonempty(runner.runProbe), `Empty runProbe: ${id}`);
        try {
          if (runner.kind === 'module-files') new AsyncFunction('submission', 'observe', `"use strict";\n${runner.runProbe}`);
          else new AsyncFunction('submission', runner.runProbe);
        }
        catch (error) { errors.push(`Invalid runProbe syntax: ${id}: ${error.message}`); }
      }
      for (const field of ['graderFile', 'referenceFile', 'incorrectFile', 'exampleFile']) await verifyFile(exercise[field], `${id}.${field}`);
      need(exercise.referenceFile !== exercise.incorrectFile, `Reference and incorrect files must differ: ${id}`);
      const studentFiles = (Array.isArray(exercise.files) ? exercise.files : []).filter(file => typeof file === 'string' || file?.editable === true);
      for (const file of studentFiles) {
        const filename = typeof file === 'string' ? file : file.path;
        need(![exercise.graderFile, exercise.referenceFile, exercise.incorrectFile].includes(filename), `Trusted file exposed as editable: ${id}:${filename}`);
      }
      if (studentFiles.length === 1 && typeof exercise.template === 'string') {
        const starterPath = await verifyFile(studentFiles[0], `${id}.starter`);
        if (starterPath) need(normalizedLines(await readFile(starterPath, 'utf8')) === normalizedLines(exercise.template), `Starter/template mismatch: ${id}`);
      }
      const grader = await read(exercise.graderFile);
      need(grader?.exerciseId === id && grader?.contentRevision === exercise.contentRevision && grader?.graderRevision === exercise.graderRevision,
        `Stale or mismatched grader: ${id}`);
      need(grader?.observationMode === 'callback', `Grader requires callback observationMode: ${id}`);
      const cases = list(grader?.cases, `${id}.grader.cases`);
      need(cases.length > 0, `Grader must contain nonzero cases: ${id}`);
      for (const [caseId, check] of unique(cases, `grader:${id}`)) {
        need(nonempty(check.label), `Missing grader case label: ${id}:${caseId}`);
        need(nonempty(check.probe), `Missing grader probe: ${id}:${caseId}`);
        need(Object.hasOwn(check, 'expected') && isJsonValue(check.expected), `Missing or invalid grader expected value: ${id}:${caseId}`);
        if (nonempty(check.probe)) {
          try { new AsyncFunction('submission', 'observe', `"use strict";\n${check.probe}`); }
          catch (error) { errors.push(`Invalid grader probe syntax: ${id}:${caseId}: ${error.message}`); }
        }
      }
      if (exercise.exampleExpectedLogs !== undefined) need(Array.isArray(exercise.exampleExpectedLogs) && exercise.exampleExpectedLogs.every(value => typeof value === 'string'),
        `Invalid exampleExpectedLogs: ${id}`);
    }
    if (exercise.executionVerified === true) {
      need(profiles.get(exercise.profileId)?.execution?.available === true, `Verified exercise has unavailable runner: ${id}`);
      need(Array.isArray(exercise.behaviorCriteria) && exercise.behaviorCriteria.length > 0, `Verified exercise lacks behavior criteria: ${id}`);
      // A record is only a reference to evidence, not automatic approval of its claims.
      const evidence = await read(exercise.verificationRecord);
      need(evidence?.status === 'passed' && Number.isInteger(evidence?.executedTests) && evidence.executedTests > 0,
        `Missing passing nonzero-test evidence: ${id}`);
      need(evidence?.exerciseId === id && evidence?.contentRevision === lessons.get(exercise.lessonId)?.contentRevision,
        `Stale or mismatched evidence: ${id}`);
      if (exercise.runner !== undefined) need(evidence?.graderRevision === exercise.graderRevision, `Stale evidence graderRevision: ${id}`);
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
