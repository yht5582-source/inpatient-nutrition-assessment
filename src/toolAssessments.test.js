import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ASSESSMENT_MODES,
  createEmptyToolAssessment,
  createInitialToolAssessments,
  updateToolAssessment
} from './toolAssessments.js';

test('creates one isolated assessment record for every tool', () => {
  const store = createInitialToolAssessments();

  assert.deepEqual(Object.keys(store), [
    'NRS-2002', 'MNA-SF', '7-point SGA', 'RFH-NPT', 'PG-SGA SF', 'mNUTRIC'
  ]);
  assert.equal(store['NRS-2002'].nativeStatus, 'NOT_STARTED');
  assert.equal(store['MNA-SF'].sourceMode, ASSESSMENT_MODES.OFFICIAL_EXTERNAL);
});

test('updating one tool does not clear another tool', () => {
  const first = updateToolAssessment(
    createInitialToolAssessments(),
    'NRS-2002',
    { initialBmiLow: 'yes' },
    { age: 60 }
  );
  const second = updateToolAssessment(
    first,
    'mNUTRIC',
    { apacheIi: '20' },
    { age: 60 }
  );

  assert.equal(second['NRS-2002'].answers.initialBmiLow, 'yes');
  assert.equal(second.mNUTRIC.answers.apacheIi, '20');
});
