import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  ASSESSMENT_MODES,
  createEmptyToolAssessment,
  createInitialToolAssessments,
  evaluateToolAssessment,
  scoreMNutric,
  scoreNrs2002,
  scoreOfficialExternal,
  scoreRfhNpt,
  scoreSevenPointSga,
  updateToolAssessment
} from './toolAssessments.js';

const completeSgaObservations = {
  weightChange: 'stable',
  intakeChange: 'none',
  giSymptoms: 'none',
  functionalCapacity: 'normal',
  diseaseBurden: 'low',
  subcutaneousFat: 'preserved',
  muscleWasting: 'preserved'
};

function getLocalToday() {
  const now = new Date();
  const year = String(now.getFullYear()).padStart(4, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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

describe('tool assessment evaluation', () => {
  test('dispatches every native tool through its reviewed scorer', () => {
    const cases = [
      ['NRS-2002', {
        initialBmiLow: 'no', initialWeightLoss: 'no', initialReducedIntake: 'no', initialSevereIllness: 'no'
      }, { age: 60 }, 0],
      ['MNA-SF', {
        officialScore: '12', officialCategory: '營養正常', completedDate: '2026-08-15', confirmed: true
      }, {}, 12],
      ['7-point SGA', { ...completeSgaObservations, overallScore: '6' }, {}, 6],
      ['RFH-NPT', { alcoholicHepatitis: 'yes' }, {}, 6],
      ['PG-SGA SF', {
        officialScore: '4', officialCategory: '4–8 分', completedDate: '2026-08-15', confirmed: true
      }, {}, 4],
      ['mNUTRIC', { apacheIi: '20', sofa: '6', comorbidities: '2', preIcuDays: '0' }, { age: 50 }, 5]
    ];

    for (const [toolId, answers, context, expectedScore] of cases) {
      const result = evaluateToolAssessment(toolId, {
        ...createEmptyToolAssessment(toolId),
        answers
      }, context);

      assert.equal(result.nativeStatus, 'COMPLETE', toolId);
      assert.equal(result.nativeScore, expectedScore, toolId);
      assert.equal(result.percent, 100, toolId);
      assert.deepEqual(result.missing, [], toolId);
      assert.deepEqual(result.invalid, [], toolId);
    }
  });

  test('keeps both normalized domains unknown until a native tool is complete', () => {
    const notStarted = evaluateToolAssessment(
      'NRS-2002',
      createEmptyToolAssessment('NRS-2002'),
      { age: 60 }
    );
    const inProgress = evaluateToolAssessment('mNUTRIC', {
      ...createEmptyToolAssessment('mNUTRIC'),
      answers: { apacheIi: '20' }
    }, { age: 60 });

    assert.equal(notStarted.nativeStatus, 'NOT_STARTED');
    assert.equal(notStarted.normalizedNutritionRisk, 'UNKNOWN');
    assert.equal(notStarted.normalizedMalnutrition, 'UNKNOWN');
    assert.equal(inProgress.nativeStatus, 'IN_PROGRESS');
    assert.equal(inProgress.normalizedNutritionRisk, 'UNKNOWN');
    assert.equal(inProgress.normalizedMalnutrition, 'UNKNOWN');
  });

  test('reports dynamic completion metrics without counting hidden RFH fields', () => {
    const result = evaluateToolAssessment('RFH-NPT', {
      ...createEmptyToolAssessment('RFH-NPT'),
      answers: {
        alcoholicHepatitis: 'no', tubeFeeding: 'no', fluidOverload: 'yes',
        incompleteMealsFromFluid: 'sometimes'
      }
    }, { height: 170, weight: 70 });

    assert.equal(result.answered, 4);
    assert.equal(result.total, 6);
    assert.equal(result.percent, 67);
    assert.deepEqual(result.missing, ['intakeReducedFifty', 'fluidWeightLoss']);
    assert.deepEqual(result.invalid, []);
  });

  test('treats an explicit false confirmation as progress rather than not started', () => {
    const result = evaluateToolAssessment('MNA-SF', {
      ...createEmptyToolAssessment('MNA-SF'),
      answers: { confirmed: false }
    }, {});

    assert.equal(result.nativeStatus, 'IN_PROGRESS');
    assert.equal(result.answered, 1);
    assert.equal(result.total, 4);
  });

  test('sets, preserves, sources, and clears completion timestamps', () => {
    const now = '2026-08-15T08:00:00.000Z';
    const completeNrs = {
      initialBmiLow: 'no', initialWeightLoss: 'no', initialReducedIntake: 'no', initialSevereIllness: 'no'
    };
    const first = updateToolAssessment(
      createInitialToolAssessments(), 'NRS-2002', completeNrs, { age: 60 }, now
    );
    const preserved = updateToolAssessment(
      first, 'NRS-2002', { initialWeightLoss: 'yes', nutritionScore: '1', diseaseScore: '1' }, { age: 60 },
      '2026-08-16T08:00:00.000Z'
    );
    const incomplete = updateToolAssessment(
      preserved, 'NRS-2002', { diseaseScore: '' }, { age: 60 }, '2026-08-17T08:00:00.000Z'
    );
    const external = updateToolAssessment(createInitialToolAssessments(), 'MNA-SF', {
      officialScore: '12', officialCategory: '營養正常', completedDate: '2026-08-14', confirmed: true
    }, {}, now);

    assert.equal(first['NRS-2002'].nativeStatus, 'COMPLETE');
    assert.equal(first['NRS-2002'].completedAt, now);
    assert.equal(preserved['NRS-2002'].nativeStatus, 'COMPLETE');
    assert.equal(preserved['NRS-2002'].completedAt, now);
    assert.equal(incomplete['NRS-2002'].nativeStatus, 'IN_PROGRESS');
    assert.equal(incomplete['NRS-2002'].completedAt, '');
    assert.equal(external['MNA-SF'].completedAt, '2026-08-14');
  });

  test('ignores a stale timestamp when an in-progress record first becomes complete', () => {
    const staleCompletedAt = '2026-08-01T08:00:00.000Z';
    const now = '2026-08-15T08:00:00.000Z';
    const store = createInitialToolAssessments();
    store['NRS-2002'] = {
      ...store['NRS-2002'],
      nativeStatus: 'IN_PROGRESS',
      completedAt: staleCompletedAt,
      answers: { initialBmiLow: 'no' }
    };
    store['MNA-SF'] = {
      ...store['MNA-SF'],
      nativeStatus: 'IN_PROGRESS',
      completedAt: staleCompletedAt,
      answers: { officialScore: '12' }
    };

    const nrs = updateToolAssessment(store, 'NRS-2002', {
      initialWeightLoss: 'no', initialReducedIntake: 'no', initialSevereIllness: 'no'
    }, { age: 60 }, now);
    const external = updateToolAssessment(store, 'MNA-SF', {
      officialCategory: '營養正常', completedDate: '2026-08-14', confirmed: true
    }, {}, now);

    assert.equal(nrs['NRS-2002'].nativeStatus, 'COMPLETE');
    assert.equal(nrs['NRS-2002'].completedAt, now);
    assert.equal(external['MNA-SF'].nativeStatus, 'COMPLETE');
    assert.equal(external['MNA-SF'].completedAt, '2026-08-14');
  });
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

  test('does not complete when age is missing or non-numeric', () => {
    const missingAge = scoreNrs2002({
      initialBmiLow: 'no', initialWeightLoss: 'no', initialReducedIntake: 'no', initialSevereIllness: 'no'
    }, {});
    const invalidAge = scoreNrs2002({
      initialBmiLow: 'no', initialWeightLoss: 'no', initialReducedIntake: 'no', initialSevereIllness: 'no'
    }, { age: 'unknown' });

    assert.equal(missingAge.nativeStatus, 'IN_PROGRESS');
    assert.deepEqual(missingAge.missing, ['age']);
    assert.equal(invalidAge.nativeStatus, 'IN_PROGRESS');
    assert.deepEqual(invalidAge.invalid, ['age']);
  });

  test('rejects boolean final scores', () => {
    const result = scoreNrs2002({
      initialBmiLow: 'yes', initialWeightLoss: 'no', initialReducedIntake: 'no', initialSevereIllness: 'no',
      nutritionScore: false, diseaseScore: true
    }, { age: 55 });

    assert.equal(result.nativeStatus, 'IN_PROGRESS');
    assert.deepEqual(result.invalid, ['nutritionScore', 'diseaseScore']);
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

  test('does not complete when age is missing or non-numeric', () => {
    const answers = { apacheIi: '14', sofa: '5', comorbidities: '1', preIcuDays: '0' };
    const missingAge = scoreMNutric(answers, {});
    const invalidAge = scoreMNutric(answers, { age: 'unknown' });

    assert.equal(missingAge.nativeStatus, 'IN_PROGRESS');
    assert.deepEqual(missingAge.missing, ['age']);
    assert.equal(invalidAge.nativeStatus, 'IN_PROGRESS');
    assert.deepEqual(invalidAge.invalid, ['age']);
  });

  test('rejects boolean clinical inputs', () => {
    const result = scoreMNutric({
      apacheIi: false, sofa: true, comorbidities: false, preIcuDays: true
    }, { age: 60 });

    assert.equal(result.nativeStatus, 'IN_PROGRESS');
    assert.deepEqual(result.invalid, ['apacheIi', 'sofa', 'comorbidities', 'preIcuDays']);
  });
});

describe('RFH-NPT', () => {
  test('classifies alcoholic hepatitis directly as high risk without tube feeding', () => {
    const result = scoreRfhNpt({ alcoholicHepatitis: 'yes' }, {});

    assert.equal(result.nativeStatus, 'COMPLETE');
    assert.equal(result.nativeScore, 6);
    assert.equal(result.nativeCategory, '高風險');
    assert.equal(result.normalizedNutritionRisk, 'HIGH');
  });

  test('classifies tube feeding directly as high risk without alcoholic hepatitis', () => {
    const result = scoreRfhNpt({ tubeFeeding: 'yes' }, {});

    assert.equal(result.nativeStatus, 'COMPLETE');
    assert.equal(result.nativeScore, 6);
    assert.equal(result.nativeCategory, '高風險');
    assert.equal(result.normalizedNutritionRisk, 'HIGH');
  });

  test('scores the no-fluid-overload BMI path', () => {
    const result = scoreRfhNpt({
      alcoholicHepatitis: 'no', tubeFeeding: 'no', fluidOverload: 'no',
      weightLossPercent: '7', acuteNoIntakeFiveDays: 'no'
    }, { height: 170, weight: 53.5 });

    assert.equal(result.nativeScore, 2);
    assert.equal(result.nativeCategory, '高風險');
  });

  test('scores only the fluid-overload branch fields', () => {
    const result = scoreRfhNpt({
      alcoholicHepatitis: 'no', tubeFeeding: 'no', fluidOverload: 'yes',
      incompleteMealsFromFluid: 'sometimes', intakeReducedFifty: 'yes', fluidWeightLoss: 'uncertain'
    }, { height: 170, weight: 90 });

    assert.equal(result.nativeScore, 5);
    assert.equal(result.nativeCategory, '高風險');
  });

  test('does not require hidden fields from the other RFH branch', () => {
    const result = scoreRfhNpt({
      alcoholicHepatitis: 'no', tubeFeeding: 'no', fluidOverload: 'yes',
      incompleteMealsFromFluid: 'no', intakeReducedFifty: 'no', fluidWeightLoss: 'no'
    }, { height: 170, weight: 70 });

    assert.equal(result.nativeStatus, 'COMPLETE');
    assert.equal(result.nativeScore, 1);
    assert.equal(result.nativeCategory, '中度風險');
  });

  test('maps BMI boundaries to the exact RFH points', () => {
    const answers = {
      alcoholicHepatitis: 'no', tubeFeeding: 'no', fluidOverload: 'no',
      weightLossPercent: '0', acuteNoIntakeFiveDays: 'no'
    };

    assert.equal(scoreRfhNpt(answers, { height: 100, weight: 20.1 }).nativeScore, 0);
    assert.equal(scoreRfhNpt(answers, { height: 100, weight: 20 }).nativeScore, 1);
    assert.equal(scoreRfhNpt(answers, { height: 100, weight: 18.4 }).nativeScore, 2);
  });

  test('maps weight-loss boundaries to the exact RFH points', () => {
    const answers = {
      alcoholicHepatitis: 'no', tubeFeeding: 'no', fluidOverload: 'no',
      acuteNoIntakeFiveDays: 'no'
    };

    assert.equal(scoreRfhNpt({ ...answers, weightLossPercent: '4.9' }, { height: 100, weight: 20.1 }).nativeScore, 0);
    assert.equal(scoreRfhNpt({ ...answers, weightLossPercent: '5' }, { height: 100, weight: 20.1 }).nativeScore, 1);
    assert.equal(scoreRfhNpt({ ...answers, weightLossPercent: '10' }, { height: 100, weight: 20.1 }).nativeScore, 1);
    assert.equal(scoreRfhNpt({ ...answers, weightLossPercent: '10.1' }, { height: 100, weight: 20.1 }).nativeScore, 2);
  });

  test('accepts RFH weight-loss percentage boundaries 0 and 100', () => {
    const answers = {
      alcoholicHepatitis: 'no', tubeFeeding: 'no', fluidOverload: 'no',
      acuteNoIntakeFiveDays: 'no'
    };

    for (const weightLossPercent of ['0', '100']) {
      const result = scoreRfhNpt(
        { ...answers, weightLossPercent },
        { height: 170, weight: 70 }
      );

      assert.equal(result.nativeStatus, 'COMPLETE', weightLossPercent);
      assert.notEqual(result.nativeScore, null, weightLossPercent);
    }
  });

  test('rejects RFH weight-loss percentages outside 0 to 100', () => {
    const answers = {
      alcoholicHepatitis: 'no', tubeFeeding: 'no', fluidOverload: 'no',
      acuteNoIntakeFiveDays: 'no'
    };

    for (const weightLossPercent of ['-1', '101']) {
      const result = scoreRfhNpt(
        { ...answers, weightLossPercent },
        { height: 170, weight: 70 }
      );

      assert.equal(result.nativeStatus, 'IN_PROGRESS', weightLossPercent);
      assert.equal(result.nativeScore, null, weightLossPercent);
      assert.deepEqual(result.invalid, ['weightLossPercent'], weightLossPercent);
    }
  });

  test('requires positive height and weight for the no-fluid-overload BMI path', () => {
    const answers = {
      alcoholicHepatitis: 'no', tubeFeeding: 'no', fluidOverload: 'no',
      weightLossPercent: '0', acuteNoIntakeFiveDays: 'no'
    };

    const missing = scoreRfhNpt(answers, { height: '', weight: 70 });
    const invalid = scoreRfhNpt(answers, { height: 0, weight: -1 });

    assert.equal(missing.nativeStatus, 'IN_PROGRESS');
    assert.deepEqual(missing.missing, ['height']);
    assert.equal(invalid.nativeStatus, 'IN_PROGRESS');
    assert.deepEqual(invalid.invalid, ['height', 'weight']);
  });

  test('reports only the visible branch field when RFH-NPT is incomplete', () => {
    const result = scoreRfhNpt({
      alcoholicHepatitis: 'no', tubeFeeding: 'no', fluidOverload: 'yes',
      incompleteMealsFromFluid: 'sometimes', intakeReducedFifty: 'yes'
    }, { height: 170, weight: 70 });

    assert.equal(result.nativeStatus, 'IN_PROGRESS');
    assert.deepEqual(result.missing, ['fluidWeightLoss']);
  });
});

describe('7-point SGA', () => {
  for (const field of [...Object.keys(completeSgaObservations), 'overallScore']) {
    test(`requires the ${field} observation before a clinician rating can complete`, () => {
      const result = scoreSevenPointSga({
        ...completeSgaObservations,
        overallScore: '6',
        [field]: ''
      });

      assert.equal(result.nativeStatus, 'IN_PROGRESS');
      assert.deepEqual(result.missing, [field]);
    });
  }

  for (const [score, category, normalized] of [
    [1, '嚴重營養不良', 'SEVERE'],
    [2, '嚴重營養不良', 'SEVERE'],
    [3, '輕至中度營養不良', 'MODERATE'],
    [4, '輕至中度營養不良', 'MODERATE'],
    [5, '輕至中度營養不良', 'MODERATE'],
    [6, '營養良好', 'NO_MALNUTRITION'],
    [7, '營養良好', 'NO_MALNUTRITION']
  ]) {
    test(`maps clinician-rated SGA score ${score} without summing observations`, () => {
      const result = scoreSevenPointSga({ ...completeSgaObservations, overallScore: String(score) });

      assert.equal(result.nativeStatus, 'COMPLETE');
      assert.equal(result.nativeScore, score);
      assert.equal(result.nativeCategory, category);
      assert.equal(result.normalizedMalnutrition, normalized);
      assert.equal(result.normalizedNutritionRisk, 'NOT_APPLICABLE');
    });
  }

  test('rejects an out-of-range, fractional, or boolean clinician rating', () => {
    for (const overallScore of ['0', '8', '4.5', false]) {
      const result = scoreSevenPointSga({ ...completeSgaObservations, overallScore });

      assert.equal(result.nativeStatus, 'IN_PROGRESS');
      assert.deepEqual(result.invalid, ['overallScore']);
    }
  });

  for (const field of Object.keys(completeSgaObservations)) {
    test(`rejects an option that is not available for ${field}`, () => {
      const result = scoreSevenPointSga({
        ...completeSgaObservations,
        overallScore: '6',
        [field]: 'arbitrary-value'
      });

      assert.equal(result.nativeStatus, 'IN_PROGRESS');
      assert.equal(result.nativeScore, null);
      assert.equal(result.nativeCategory, '');
      assert.deepEqual(result.invalid, [field]);
    });
  }
});

describe('official external result entry', () => {
  test('accepts the user local current date for both official external tools', () => {
    const today = getLocalToday();
    const cases = [
      ['MNA-SF', '12', '營養正常'],
      ['PG-SGA SF', '4', '4–8 分']
    ];

    for (const [toolId, officialScore, officialCategory] of cases) {
      const result = scoreOfficialExternal(toolId, {
        officialScore,
        officialCategory,
        completedDate: today,
        confirmed: true
      });

      assert.equal(result.nativeStatus, 'COMPLETE', toolId);
    }
  });

  for (const completedDate of ['2026-02-30', '15/08/2026', '2999-01-01']) {
    test(`rejects invalid or future official completion date ${completedDate}`, () => {
      for (const [toolId, officialScore, officialCategory] of [
        ['MNA-SF', '12', '營養正常'],
        ['PG-SGA SF', '4', '4–8 分']
      ]) {
        const result = scoreOfficialExternal(toolId, {
          officialScore,
          officialCategory,
          completedDate,
          confirmed: true
        });

        assert.equal(result.nativeStatus, 'IN_PROGRESS', toolId);
        assert.equal(result.nativeScore, null, toolId);
        assert.equal(result.nativeCategory, '', toolId);
        assert.deepEqual(result.invalid, ['completedDate'], toolId);
      }
    });
  }

  test('keeps an external score in progress until official completion is confirmed', () => {
    const result = scoreOfficialExternal('MNA-SF', {
      officialScore: '10', officialCategory: '有營養不良風險', completedDate: '2026-08-15', confirmed: false
    });

    assert.equal(result.nativeStatus, 'IN_PROGRESS');
    assert.equal(result.nativeScore, null);
    assert.deepEqual(result.invalid, ['confirmed']);
  });

  test('requires the official score, category, completion date, and confirmation', () => {
    for (const field of ['officialScore', 'officialCategory', 'completedDate', 'confirmed']) {
      const result = scoreOfficialExternal('MNA-SF', {
        officialScore: '10',
        officialCategory: '有營養不良風險',
        completedDate: '2026-08-15',
        confirmed: true,
        [field]: ''
      });

      assert.equal(result.nativeStatus, 'IN_PROGRESS');
      assert.deepEqual(result.missing, [field]);
    }
  });

  for (const [score, category, risk, malnutrition] of [
    [0, '營養不良', 'AT_RISK', 'MALNOURISHED'],
    [7, '營養不良', 'AT_RISK', 'MALNOURISHED'],
    [8, '有營養不良風險', 'AT_RISK', 'UNKNOWN'],
    [11, '有營養不良風險', 'AT_RISK', 'UNKNOWN'],
    [12, '營養正常', 'LOW', 'NO_MALNUTRITION'],
    [14, '營養正常', 'LOW', 'NO_MALNUTRITION']
  ]) {
    test(`validates MNA-SF score ${score} against the official category`, () => {
      const result = scoreOfficialExternal('MNA-SF', {
        officialScore: String(score), officialCategory: category, confirmed: true, completedDate: '2026-08-15'
      });

      assert.equal(result.nativeStatus, 'COMPLETE');
      assert.equal(result.nativeScore, score);
      assert.equal(result.nativeCategory, category);
      assert.equal(result.normalizedNutritionRisk, risk);
      assert.equal(result.normalizedMalnutrition, malnutrition);
    });
  }

  for (const [score, category] of [
    [0, '營養正常'],
    [8, '營養不良'],
    [12, '有營養不良風險']
  ]) {
    test(`rejects an MNA-SF score ${score} whose official category does not match`, () => {
      const result = scoreOfficialExternal('MNA-SF', {
        officialScore: String(score), officialCategory: category, confirmed: true, completedDate: '2026-08-15'
      });

      assert.equal(result.nativeStatus, 'IN_PROGRESS');
      assert.equal(result.nativeScore, null);
      assert.deepEqual(result.invalid, ['officialCategory']);
    });
  }

  test('rejects out-of-range, fractional, and boolean MNA-SF scores', () => {
    for (const officialScore of ['-1', '15', '8.5', false]) {
      const result = scoreOfficialExternal('MNA-SF', {
        officialScore, officialCategory: '有營養不良風險', confirmed: true, completedDate: '2026-08-15'
      });

      assert.equal(result.nativeStatus, 'IN_PROGRESS');
      assert.deepEqual(result.invalid, ['officialScore']);
    }
  });

  for (const [score, category, risk] of [
    [0, '0–1 分', 'LOW'],
    [1, '0–1 分', 'LOW'],
    [2, '2–3 分', 'LOW'],
    [3, '2–3 分', 'LOW'],
    [4, '4–8 分', 'AT_RISK'],
    [8, '4–8 分', 'AT_RISK'],
    [9, '9 分以上', 'HIGH'],
    [36, '9 分以上', 'HIGH']
  ]) {
    test(`validates PG-SGA SF score ${score} against its official triage band`, () => {
      const result = scoreOfficialExternal('PG-SGA SF', {
        officialScore: String(score), officialCategory: category, confirmed: true, completedDate: '2026-08-15'
      });

      assert.equal(result.nativeStatus, 'COMPLETE');
      assert.equal(result.nativeScore, score);
      assert.equal(result.nativeCategory, category);
      assert.equal(result.normalizedNutritionRisk, risk);
      assert.equal(result.normalizedMalnutrition, 'NOT_APPLICABLE');
    });
  }

  for (const [score, category] of [
    [1, '2–3 分'],
    [3, '4–8 分'],
    [8, '9 分以上'],
    [9, '0–1 分']
  ]) {
    test(`rejects PG-SGA SF score ${score} with a mismatched triage band`, () => {
      const result = scoreOfficialExternal('PG-SGA SF', {
        officialScore: String(score), officialCategory: category, confirmed: true, completedDate: '2026-08-15'
      });

      assert.equal(result.nativeStatus, 'IN_PROGRESS');
      assert.equal(result.nativeScore, null);
      assert.deepEqual(result.invalid, ['officialCategory']);
    });
  }

  test('rejects out-of-range, fractional, and boolean PG-SGA SF scores', () => {
    for (const officialScore of ['-1', '37', '8.5', false]) {
      const result = scoreOfficialExternal('PG-SGA SF', {
        officialScore, officialCategory: '4–8 分', confirmed: true, completedDate: '2026-08-15'
      });

      assert.equal(result.nativeStatus, 'IN_PROGRESS');
      assert.deepEqual(result.invalid, ['officialScore']);
    }
  });
});
