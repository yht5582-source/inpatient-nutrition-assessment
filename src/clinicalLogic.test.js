import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  applyDiagnosisSelection,
  applyWardSelection,
  calculateBmi,
  getAssessmentStatus,
  getChineseStatus,
  getContextValidation,
  getPathway,
  getRecommendation,
  getReferenceWeight,
  getRoute,
  normalizeResult
} from './clinicalLogic.js';

const baseContext = {
  age: 76,
  height: 168,
  weight: 67.2,
  dryWeight: 63.5,
  dietStatus: '一般飲食',
  npoReason: '',
  intake: '>=75%',
  giFunction: 'functional',
  oralSafety: 'safe',
  pathways: {
    ICU: false,
    LIVER: false,
    RENAL: false,
    ONCOLOGY: false,
    GERIATRIC: false,
    GENERAL: true
  },
  modifiers: {
    heartFailure: false,
    dysphagia: false,
    edemaAscites: false,
    refeeding: false,
    poorIntake: false
  }
};

const completeAnswers = {
  intake: '>=75%',
  weightLoss: '否',
  muscleLoss: '無',
  gi: 'functional',
  swallow: 'safe'
};

describe('patient context validation', () => {
  test('blocks missing or pediatric age from the adult workflow', () => {
    assert.equal(getContextValidation({ ...baseContext, age: '' }).isValid, false);
    assert.equal(getContextValidation({ ...baseContext, age: 17 }).isValid, false);
    assert.equal(getPathway({ ...baseContext, age: 17 }), null);
  });

  test('does not calculate BMI from missing or non-positive measurements', () => {
    assert.equal(calculateBmi('', 168), null);
    assert.equal(calculateBmi(67.2, 0), null);
    assert.equal(calculateBmi(67.2, 168), 23.8);
  });

  test('warns when fluid-affected weight has no usable dry weight', () => {
    const context = {
      ...baseContext,
      dryWeight: '',
      modifiers: { ...baseContext.modifiers, edemaAscites: true }
    };
    const validation = getContextValidation(context);

    assert.equal(validation.isValid, true);
    assert.deepEqual(validation.warnings, ['體液狀態會影響目前體重，請確認可用的 Dry weight。']);
    assert.deepEqual(getReferenceWeight(context), { value: 67.2, type: 'Measured weight (review required)' });
  });

  test('does not treat an unreviewed primary pathway as general adult', () => {
    const context = {
      ...baseContext,
      pathways: { ...baseContext.pathways, GENERAL: false }
    };

    assert.equal(getPathway(context), null);
    assert.equal(getContextValidation(context).isValid, false);
  });

  test('requires renal modality when the renal pathway is selected', () => {
    const context = {
      ...baseContext,
      renalModality: 'not assessed',
      pathways: { ...baseContext.pathways, GENERAL: false, RENAL: true }
    };

    assert.equal(getContextValidation(context).isValid, false);
    assert.ok(getContextValidation(context).blockers.includes('選擇 CKD5D / HD / PD 路徑時，請確認腎臟治療型態。'));
  });

  test('requires an NPO reason before continuing the workflow', () => {
    const context = { ...baseContext, dietStatus: 'NPO', npoReason: '' };

    assert.equal(getContextValidation(context).isValid, false);
    assert.equal(getContextValidation({ ...context, npoReason: '醫療處置 / 手術' }).isValid, true);
  });

  test('selecting ICU ward activates the ICU pathway without clearing other pathways', () => {
    const context = applyWardSelection(baseContext, '加護病房 ICU');

    assert.equal(context.ward, '加護病房 ICU');
    assert.equal(context.pathways.ICU, true);
    assert.equal(context.pathways.GENERAL, true);
  });

  test('warns when ICU ward and ICU pathway are inconsistent', () => {
    const validation = getContextValidation({
      ...baseContext,
      ward: '加護病房 ICU',
      pathways: { ...baseContext.pathways, ICU: false }
    });

    assert.match(validation.warnings.join(' '), /ICU/);
  });

  for (const [diagnosis, group, key] of [
    ['重症／敗血症', 'pathways', 'ICU'],
    ['腎臟病／透析', 'pathways', 'RENAL'],
    ['肝硬化／肝病', 'pathways', 'LIVER'],
    ['活動性癌症', 'pathways', 'ONCOLOGY'],
    ['高齡衰弱', 'pathways', 'GERIATRIC'],
    ['心衰竭', 'modifiers', 'heartFailure'],
    ['吞嚥障礙', 'modifiers', 'dysphagia']
  ]) {
    test(`${diagnosis} activates ${key} without clearing existing selections`, () => {
      const context = applyDiagnosisSelection(baseContext, diagnosis);

      assert.equal(context.diagnosis, diagnosis);
      assert.equal(context[group][key], true);
      assert.equal(context.pathways.GENERAL, true);
    });
  }

  test('warns when diagnosis linkage is manually deactivated', () => {
    const validation = getContextValidation({
      ...baseContext,
      diagnosis: '心衰竭',
      modifiers: { ...baseContext.modifiers, heartFailure: false }
    });

    assert.match(validation.warnings.join(' '), /心衰竭/);
  });
});

describe('assessment completeness', () => {
  test('starts a new assessment at zero until fields are explicitly recorded', () => {
    const status = getAssessmentStatus({
      intake: '',
      gi: '',
      swallow: '',
      weightLoss: '',
      muscleLoss: ''
    });

    assert.equal(status.answered, 0);
    assert.equal(status.total, 5);
    assert.equal(status.percent, 0);
    assert.equal(status.isComplete, false);
    assert.deepEqual(status.missing, ['intake', 'weightLoss', 'muscleLoss', 'gi', 'swallow']);
  });

  test('counts explicitly selected unknown states as recorded answers', () => {
    const status = getAssessmentStatus({
      ...completeAnswers,
      intake: 'not assessed',
      gi: 'uncertain',
      swallow: 'not assessed'
    });

    assert.equal(status.percent, 100);
    assert.equal(status.isComplete, true);
  });
});

describe('Chinese display labels', () => {
  test('translates result and workflow codes for display', () => {
    assert.equal(getChineseStatus('RED'), '紅色');
    assert.equal(getChineseStatus('UNKNOWN'), '未知');
    assert.equal(getChineseStatus('TOOL_SCORE_PENDING'), '量表計分待完成');
    assert.equal(getChineseStatus('RECOMMENDED'), '建議執行');
    assert.equal(getChineseStatus('PENDING_ASSESSMENT'), '待完成評估');
  });

  test('preserves an unmapped native result instead of hiding it', () => {
    assert.equal(getChineseStatus('NRS-2002'), 'NRS-2002');
  });
});

describe('normalization boundaries', () => {
  test('keeps refeeding and fluid reliability separate from the native nutrition result', () => {
    const plainRecommendation = getRecommendation(baseContext);
    const plain = normalizeResult(baseContext, completeAnswers, plainRecommendation, 'mNUTRIC');
    const context = {
      ...baseContext,
      modifiers: {
        ...baseContext.modifiers,
        refeeding: true,
        edemaAscites: true
      }
    };
    const flagged = normalizeResult(context, completeAnswers, getRecommendation(context), 'mNUTRIC');

    assert.equal(flagged.native, plain.native);
    assert.equal(flagged.nutritionRisk, plain.nutritionRisk);
    assert.equal(flagged.nutritionRisk, 'UNKNOWN');
    assert.deepEqual(flagged.safetyFlags, ['Refeeding risk']);
    assert.deepEqual(flagged.dataQualityFlags, ['Fluid-affected weight']);
    assert.equal(flagged.priority, 'RED');
  });

  test('does not treat common clinical questions as a validated native tool score', () => {
    const result = normalizeResult(
      baseContext,
      completeAnswers,
      getRecommendation(baseContext),
      'mNUTRIC'
    );

    assert.equal(result.native, 'Validated tool scoring not completed');
    assert.equal(result.nutritionRisk, 'UNKNOWN');
    assert.equal(result.malnutrition, 'UNKNOWN');
    assert.equal(result.assessmentStatus, 'TOOL_SCORE_PENDING');
  });

  test('flags contradictory intake data instead of silently choosing one value', () => {
    const context = {
      ...baseContext,
      modifiers: { ...baseContext.modifiers, poorIntake: true }
    };
    const result = normalizeResult(context, completeAnswers, getRecommendation(context), 'NRS-2002');

    assert.ok(result.dataQualityFlags.includes('Intake status conflicts with poor-intake modifier'));
  });

  test('returns an incomplete result rather than inventing missing answers', () => {
    const result = normalizeResult(
      baseContext,
      { ...completeAnswers, weightLoss: '' },
      getRecommendation(baseContext),
      'NRS-2002'
    );

    assert.equal(result.native, 'Incomplete assessment');
    assert.equal(result.nutritionRisk, 'UNKNOWN');
    assert.equal(result.malnutrition, 'UNKNOWN');
    assert.equal(result.priority, 'GRAY');
    assert.equal(result.assessmentStatus, 'INCOMPLETE');
  });

  test('does not generate a native result for a tool pending license review', () => {
    const result = normalizeResult(
      baseContext,
      completeAnswers,
      getRecommendation(baseContext),
      'MNA-SF'
    );

    assert.equal(result.native, 'Tool unavailable pending license review');
    assert.equal(result.nutritionRisk, 'UNKNOWN');
    assert.equal(result.assessmentStatus, 'NOT_AVAILABLE');
  });
});

describe('feeding route safety gate', () => {
  test('keeps GI-uncertain escalation pending', () => {
    const route = getRoute(
      { ...baseContext, giFunction: 'uncertain' },
      { ...completeAnswers, gi: 'uncertain', swallow: 'unsafe' },
      { priority: 'AMBER', safetyFlags: [] }
    );

    assert.equal(route.level, 'Pending');
    assert.equal(route.status, 'PENDING_ASSESSMENT');
    assert.match(route.title, /胃腸道可用性/);
  });

  test('routes unsafe oral feeding through EN appropriateness assessment when GI is usable', () => {
    const route = getRoute(
      baseContext,
      { ...completeAnswers, swallow: 'unsafe' },
      { priority: 'AMBER', safetyFlags: ['Oral feeding unsafe'] }
    );

    assert.equal(route.level, 'R3');
    assert.equal(route.status, 'ASSESS_APPROPRIATENESS');
    assert.match(route.title, /EN 適用性/);
  });

  test('makes feeding advancement conditional when refeeding risk is active', () => {
    const route = getRoute(
      baseContext,
      { ...completeAnswers, intake: '25-49%' },
      { priority: 'RED', safetyFlags: ['Refeeding risk'] }
    );

    assert.equal(route.level, 'R2');
    assert.equal(route.status, 'CONDITIONAL');
    assert.match(route.title, /再餵食安全流程/);
  });

  test('applies refeeding conditions to oral continuation, EN, and PN branches', () => {
    const refeedingResult = { priority: 'RED', safetyFlags: ['Refeeding risk'] };
    const cases = [
      {
        context: baseContext,
        answers: completeAnswers,
        level: 'R0'
      },
      {
        context: baseContext,
        answers: { ...completeAnswers, swallow: 'unsafe' },
        level: 'R3'
      },
      {
        context: baseContext,
        answers: { ...completeAnswers, gi: 'unavailable' },
        level: 'R4'
      }
    ];

    cases.forEach(({ context, answers, level }) => {
      const route = getRoute(context, answers, refeedingResult);
      assert.equal(route.level, level);
      assert.equal(route.status, 'CONDITIONAL');
      assert.match(route.title, /再餵食安全流程/);
    });
  });

  test('does not recommend oral feeding while NPO is active', () => {
    const route = getRoute(
      { ...baseContext, dietStatus: 'NPO', npoReason: '醫療處置 / 手術' },
      completeAnswers,
      { priority: 'GRAY', safetyFlags: [] }
    );

    assert.equal(route.level, 'Pending');
    assert.equal(route.status, 'PENDING_ASSESSMENT');
    assert.match(route.title, /NPO/);
    assert.doesNotMatch(route.title, /維持 therapeutic oral diet/);
  });

  test('recognizes current tube feeding as an enteral route', () => {
    const route = getRoute(
      { ...baseContext, dietStatus: '管灌' },
      { ...completeAnswers, swallow: 'unsafe' },
      { priority: 'AMBER', safetyFlags: ['Oral feeding unsafe'] }
    );

    assert.equal(route.level, 'R3');
    assert.equal(route.status, 'CONTINUE_AND_REVIEW');
    assert.match(route.title, /EN/);
  });
});
