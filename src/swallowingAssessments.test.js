import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  createInitialSwallowingAssessments,
  evaluateGuss,
  evaluateRsst,
  evaluateSwallowingAssessments,
  resolveSwallowingSafety,
  updateSwallowingAssessment
} from './swallowingAssessments.js';

const indirectPass = {
  alertness: 'yes',
  voluntaryCough: 'yes',
  salivaSwallow: 'yes',
  drooling: 'no',
  voiceChange: 'no'
};

const directPass = {
  swallow: 'successful',
  involuntaryCough: 'no',
  drooling: 'no',
  voiceChange: 'no'
};

describe('GUSS-T staged evaluation', () => {
  test('a complete four-stage pass scores 20', () => {
    const result = evaluateGuss({
      answers: {
        indirect: indirectPass,
        semisolid: directPass,
        liquid: directPass,
        solid: directPass
      }
    });

    assert.equal(result.nativeStatus, 'COMPLETE');
    assert.equal(result.nativeScore, 20);
    assert.equal(result.nativeCategory, '輕度吞嚥障礙或無吞嚥障礙');
    assert.equal(result.stopAfter, null);
  });

  test('an indirect score below five stops before food or liquid trials', () => {
    const result = evaluateGuss({
      answers: {
        indirect: { ...indirectPass, alertness: 'no' },
        semisolid: directPass
      }
    });

    assert.equal(result.nativeStatus, 'COMPLETE');
    assert.equal(result.nativeScore, 4);
    assert.equal(result.nativeCategory, '重度吞嚥障礙伴隨高吸入風險');
    assert.equal(result.stopAfter, 'indirect');
    assert.equal(result.stageAccess.semisolid, false);
  });

  test('a delayed semisolid swallow stops at a total score of nine', () => {
    const result = evaluateGuss({
      answers: {
        indirect: indirectPass,
        semisolid: { ...directPass, swallow: 'delayed' }
      }
    });

    assert.equal(result.nativeStatus, 'COMPLETE');
    assert.equal(result.nativeScore, 9);
    assert.equal(result.stopAfter, 'semisolid');
    assert.equal(result.stageAccess.liquid, false);
  });

  test('a liquid-stage warning produces the 10 to 14 category', () => {
    const result = evaluateGuss({
      answers: {
        indirect: indirectPass,
        semisolid: directPass,
        liquid: { ...directPass, voiceChange: 'yes' }
      }
    });

    assert.equal(result.nativeScore, 14);
    assert.equal(result.nativeCategory, '中度吞嚥障礙伴隨吸入風險');
    assert.equal(result.stopAfter, 'liquid');
  });

  test('missing current-stage observations remain in progress', () => {
    const result = evaluateGuss({ answers: { indirect: { alertness: 'yes' } } });

    assert.equal(result.nativeStatus, 'IN_PROGRESS');
    assert.equal(result.nativeScore, null);
    assert.deepEqual(result.missing, [
      'indirect.voluntaryCough',
      'indirect.salivaSwallow',
      'indirect.drooling',
      'indirect.voiceChange'
    ]);
  });
});

describe('RSST evaluation', () => {
  test('two swallows in 30 seconds is a positive screen', () => {
    const result = evaluateRsst({ answers: { swallowCount: 2 } });

    assert.equal(result.nativeStatus, 'COMPLETE');
    assert.equal(result.nativeScore, 2);
    assert.equal(result.nativeCategory, '篩檢陽性：疑似吞嚥障礙');
    assert.equal(result.safetyStatus, 'suspected dysphagia');
  });

  test('three swallows in 30 seconds is a negative screen', () => {
    const result = evaluateRsst({ answers: { swallowCount: 3 } });

    assert.equal(result.nativeStatus, 'COMPLETE');
    assert.equal(result.nativeCategory, '篩檢陰性');
    assert.equal(result.safetyStatus, 'screen negative');
  });

  test('unable to assess stays distinct from a negative result', () => {
    const result = evaluateRsst({ answers: { unableToAssess: true } });

    assert.equal(result.nativeStatus, 'COMPLETE');
    assert.equal(result.nativeScore, null);
    assert.equal(result.nativeCategory, '無法評估');
    assert.equal(result.safetyStatus, 'not assessed');
  });

  test('negative and fractional counts are invalid', () => {
    assert.deepEqual(evaluateRsst({ answers: { swallowCount: -1 } }).invalid, ['swallowCount']);
    assert.deepEqual(evaluateRsst({ answers: { swallowCount: 2.5 } }).invalid, ['swallowCount']);
  });
});

describe('optional multi-select swallowing assessments', () => {
  test('selected tools preserve independent records and completion timestamps', () => {
    const now = new Date('2026-08-22T03:04:05.000Z');
    let store = createInitialSwallowingAssessments();
    store = { ...store, selectedTools: ['GUSS-T', 'RSST'], assessorRole: '護理師' };
    store = updateSwallowingAssessment(store, 'RSST', { swallowCount: 2 }, now);

    assert.deepEqual(store.selectedTools, ['GUSS-T', 'RSST']);
    assert.equal(store.assessorRole, '護理師');
    assert.equal(store.RSST.completedAt, '2026-08-22T03:04:05.000Z');
    assert.deepEqual(store['GUSS-T'].answers, {});
  });

  test('an incomplete selected screen remains pending without blocking the nutrition assessment', () => {
    const store = {
      ...createInitialSwallowingAssessments(),
      selectedTools: ['GUSS-T'],
      assessorRole: '醫師'
    };
    const result = evaluateSwallowingAssessments(store);

    assert.equal(result.isOptional, true);
    assert.equal(result.hasIncompleteSelection, true);
    assert.equal(result.GUSS.nativeStatus, 'NOT_STARTED');
  });
});

describe('worst-risk swallowing safety resolution', () => {
  test('an abnormal GUSS-T result overrides a normal RSST and manual safe entry', () => {
    const screening = {
      ...createInitialSwallowingAssessments(),
      selectedTools: ['GUSS-T', 'RSST'],
      'GUSS-T': {
        answers: {
          indirect: indirectPass,
          semisolid: { ...directPass, swallow: 'none' }
        }
      },
      RSST: { answers: { swallowCount: 4 } }
    };

    const result = resolveSwallowingSafety('safe', false, screening);

    assert.equal(result.status, 'unsafe');
    assert.match(result.reason, /GUSS-T/);
  });

  test('a positive RSST escalates safety but a negative RSST cannot clear dysphagia', () => {
    const positive = {
      ...createInitialSwallowingAssessments(),
      selectedTools: ['RSST'],
      RSST: { answers: { swallowCount: 2 } }
    };
    const negative = {
      ...positive,
      RSST: { answers: { swallowCount: 5 } }
    };

    assert.equal(resolveSwallowingSafety('', false, positive).status, 'suspected dysphagia');
    assert.equal(resolveSwallowingSafety('', true, negative).status, 'suspected dysphagia');
    assert.equal(resolveSwallowingSafety('', false, negative).status, 'not assessed');
  });

  test('a completed normal GUSS-T can establish safe status when no higher-risk signal exists', () => {
    const screening = {
      ...createInitialSwallowingAssessments(),
      selectedTools: ['GUSS-T'],
      'GUSS-T': {
        answers: {
          indirect: indirectPass,
          semisolid: directPass,
          liquid: directPass,
          solid: directPass
        }
      }
    };

    assert.equal(resolveSwallowingSafety('', false, screening).status, 'safe');
  });
});
