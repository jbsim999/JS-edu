import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLessonHosts, validateHostPrerequisiteGraphs } from '../scripts/validate-lesson-hosts.mjs';

function fixture() {
  const lesson = {id:'capstone',exerciseId:'browser-exercise',contentRevision:'draft-1',prerequisites:[],
    exerciseByHost:{browser:'browser-exercise',node:'node-exercise'},hostVariants:{node:{exerciseId:'node-exercise',
      steps:Object.fromEntries(['theory','example','quiz','practice','lab'].map(step=>[step,`${step} Node content`])),
      goals:['Use a native host'],sources:[{title:'Node documentation',url:'https://nodejs.org/docs/v24.22.0/api/'}],prerequisites:[],
      quiz:{revision:'node-quiz-v1',questions:[{id:'failure',prompt:'Which output?',correctChoiceId:'a',choices:[
        {id:'a',text:'Error',explanation:'Failure is separate.'},{id:'b',text:'Success',explanation:'No valid output.'}]}]}}}};
  const indexed={exerciseByHost:{...lesson.exerciseByHost}};
  const exercises=new Map([['browser-exercise',{lessonId:'capstone',profileId:'browser-dom'}],
    ['node-exercise',{lessonId:'capstone',profileId:'node-native',hostRequirements:['node-native'] }]]);
  return {lesson,indexed,exercises,ids:new Set(['capstone'])};
}

test('host choices keep one stable lesson and distinct exercises and quiz revisions', () => {
  const {lesson,indexed,exercises,ids}=fixture();
  lesson.hostVariants.node.title = '통합 · Node 구현';
  assert.deepEqual(validateLessonHosts(lesson,indexed,exercises,ids),[]);
});

test('host mappings reject cross-lesson sources, identity replacement and browser quiz reuse', async t => {
  for (const [name,mutate,expected] of [
    ['catalog mismatch',f=>{f.indexed.exerciseByHost.node='other';},/mapping mismatch/],
    ['cross-lesson exercise',f=>{f.exercises.get('node-exercise').lessonId='other';},/cross-lesson/],
    ['wrong runtime',f=>{f.exercises.get('node-exercise').profileId='browser-dom';},/profile mismatch/],
    ['identity override',f=>{f.lesson.hostVariants.node.id='other';},/identity/],
    ['empty display title',f=>{f.lesson.hostVariants.node.title=' ';},/display title/],
    ['missing stage',f=>{delete f.lesson.hostVariants.node.steps.lab;},/five learning/],
    ['quiz reuse',f=>{f.lesson.hostVariants.node.quiz.revision='draft-1';},/revision/],
    ['unknown prerequisite',f=>{f.lesson.hostVariants.node.prerequisites=['missing'];},/prerequisite/],
  ]) await t.test(name,()=>{const f=fixture();mutate(f);assert.ok(validateLessonHosts(f.lesson,f.indexed,f.exercises,f.ids).some(message=>expected.test(message)));});
});

test('a cycle hidden only in the selected host path is rejected', () => {
  const lessons=new Map([['a',{prerequisites:[],hostVariants:{node:{prerequisites:['b']}}}],
    ['b',{prerequisites:['a']}]]);
  assert.match(validateHostPrerequisiteGraphs(lessons).join('\n'),/Host prerequisite cycle: node:a/);
});
