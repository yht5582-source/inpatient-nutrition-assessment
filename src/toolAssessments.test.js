import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  ASSESSMENT_MODES,
  createEmptyToolAssessment,
  createInitialToolAssessments,
  scoreMNutric,
  scoreNrs2002,
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

describe('NRS-2002', () => {
  test('completes a negative four-question initial screen without final scoring', () => {
    const result = scoreNrs2002({
      initialBmiLow: 'no', initialWeightLoss: 'no', initialReducedIntake: 'no', initialSevereIllness: 'no'
    }, { age: 69 });

    assert.equal(result.nativeStatus, 'COMPLETE');
    assert.equal(result.nativeScore, 0);
    assert.equal(result.nativeCategory, '初篩陰性；建議每週重篩');
    assert.equal(result.normalizedNutritionRisk, 'LOW');
    assert.equal(result.normalizedMalnutrition, 'NOT_APPLICABLE');
  });

  test('adds one point for age 70 or older after a positive initial screen', () => {
    const result = scoreNrs2002({
      initialBmiLow: 'yes', initialWeightLoss: 'no', initialReducedIntake: 'no', initialSevereIllness: 'no',
      nutritionScore: '1', diseaseScore: '1'
    }, { age: 70 });

    assert.equal(result.nativeScore, 3);
    assert.equal(result.nativeCategory, '有營養風險');
    assert.equal(result.normalizedNutritionRisk, 'AT_RISK');
    assert.equal(result.normalizedMalnutrition, 'NOT_APPLICABLE');
  });

  test('does not score a positive screen until both final domains are recorded', () => {
    const result = scoreNrs2002({
      initialBmiLow: 'yes', initialWeightLoss: 'no', initialReducedIntake: 'no', initialSevereIllness: 'no',
      nutritionScore: '2'
    }, { age: 55 });

    assert.equal(result.nativeStatus, 'IN_PROGRESS');
    assert.equal(result.nativeScore, null);
    assert.deepEqual(result.missing, ['diseaseScore']);
    assert.equal(result.normalizedMalnutrition, 'NOT_APPLICABLE');
  });
});

describe('mNUTRIC', () => {
  test('scores all lower boundaries as zero', () => {
    const result = scoreMNutric({ apacheIi: '14', sofa: '5', comorbidities: '1', preIcuDays: '0' }, { age: 49 });

    assert.equal(result.nativeScore, 0);
    assert.equal(result.normalizedNutritionRisk, 'LOW');
    assert.equal(result.normalizedMalnutrition, 'NOT_APPLICABLE');
  });

  test('scores the validated upper categories to nine', () => {
    const result = scoreMNutric({ apacheIi: '29', sofa: '10', comorbidities: '2', preIcuDays: '1' }, { age: 75 });

    assert.equal(result.nativeScore, 9);
    assert.equal(result.nativeCategory, '高分');
    assert.equal(result.normalizedNutritionRisk, 'HIGH');
    assert.equal(result.normalizedMalnutrition, 'NOT_APPLICABLE');
  });

  test('uses the five-point high-risk threshold', () => {
    const result = scoreMNutric({ apacheIi: '20', sofa: '6', comorbidities: '2', preIcuDays: '0' }, { age: 50 });

    assert.equal(result.nativeScore, 5);
    assert.equal(result.normalizedNutritionRisk, 'HIGH');
    assert.equal(result.normalizedMalnutrition, 'NOT_APPLICABLE');
  });

  test('rejects out-of-range and non-integer clinical scores', () => {
    const result = scoreMNutric({ apacheIi: '72', sofa: '4.5', comorbidities: '-1', preIcuDays: '0' }, { age: 60 });

    assert.equal(result.nativeStatus, 'IN_PROGRESS');
    assert.deepEqual(result.invalid, ['apacheIi', 'sofa', 'comorbidities']);
  });
});
