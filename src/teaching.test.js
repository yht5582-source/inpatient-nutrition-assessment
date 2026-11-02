import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { getReferenceWeight, getRecommendation, getRoute, normalizeResult, pathwayMeta } from './clinicalLogic.js';
import { evaluateToolAssessment, scoreMNutric, scoreNrs2002, scoreOfficialExternal, scoreRfhNpt, scoreSevenPointSga } from './toolAssessments.js';
import { evaluateGuss, resolveSwallowingSafety } from './swallowingAssessments.js';
import { demoCases, evaluateCase, mindMap, quizQuestions, sources } from './teaching.js';

const baseContext = {
  role: '營養師', patientName: '', age: '', sex: '未填', ward: '一般病房', bed: '', admissionDay: '',
  height: '', weight: '', dryWeight: '', diagnosis: '', dietStatus: '', npoReason: '',
  intake: '', giFunction: '', oralSafety: '', renalModality: 'not assessed',
  pathways: {}, modifiers: {}
};

function contextWith(patch) {
  return {
    ...baseContext, age: 60, height: 170, weight: 65, dietStatus: '一般飲食',
    pathways: { GENERAL: true }, modifiers: {}, ...patch
  };
}

describe('demo cases run through the real engine', () => {
  test('six cases cover all six tools', () => {
    assert.equal(demoCases.length, 6);
    assert.equal(new Set(demoCases.map((item) => item.expected.tool)).size, Object.keys(pathwayMeta).length);
  });

  for (const caseData of demoCases) {
    test(`${caseData.id} matches its written discussion`, () => {
      const { expected } = caseData;
      const { recommendation, native, result, route, validation, context, swallowingAssessments } = evaluateCase(caseData, baseContext);
      assert.deepEqual(validation.blockers, []);
      assert.deepEqual(validation.warnings, []);
      assert.equal(recommendation.primaryTool, expected.tool);
      assert.equal(native.nativeStatus, 'COMPLETE');
      assert.equal(native.nativeScore, expected.score);
      assert.equal(native.nativeCategory, expected.category);
      assert.equal(result.nutritionRisk, expected.risk);
      assert.equal(result.malnutrition, expected.malnutrition);
      assert.equal(result.priority, expected.priority);
      assert.equal(route.level, expected.routeLevel);
      assert.equal(route.status, expected.routeStatus);
      assert.deepEqual(result.safetyFlags, expected.safetyFlags);
      assert.deepEqual(result.dataQualityFlags, expected.qualityFlags);
      if (expected.referenceWeight) assert.equal(getReferenceWeight(context).value, expected.referenceWeight);
      if (expected.gussScore) assert.equal(evaluateGuss(swallowingAssessments['GUSS-T']).nativeScore, expected.gussScore);
    });

    test(`${caseData.id} cites known sources`, () => {
      caseData.refs.forEach((key) => assert.ok(sources[key], key));
    });
  }

  test('quoted numbers in vignettes stay consistent', () => {
    const percentDrop = (from, to) => Math.round(((from - to) / from) * 100);
    assert.equal(percentDrop(64.5, 60), 7);
    assert.equal(percentDrop(49, 43), 12);
    assert.equal((41 / 1.5 ** 2).toFixed(1), '18.2');
    assert.equal((67.2 / 1.65 ** 2).toFixed(1), '24.7');
    assert.equal((43 / 1.55 ** 2).toFixed(1), '17.9');
  });
});

describe('quiz structure', () => {
  test('20 questions, 10 basic then 10 advanced', () => {
    assert.equal(quizQuestions.length, 20);
    assert.deepEqual(quizQuestions.slice(0, 10).map((q) => q.level), Array(10).fill('基礎'));
    assert.deepEqual(quizQuestions.slice(10).map((q) => q.level), Array(10).fill('高階'));
  });

  test('answers spread evenly, A–D five each', () => {
    for (const letter of 'ABCD') {
      assert.equal(quizQuestions.filter((q) => q.answer === letter).length, 5, letter);
    }
  });

  test('every question has four distinct options, an explanation and known refs', () => {
    for (const q of quizQuestions) {
      assert.deepEqual(Object.keys(q.options), ['A', 'B', 'C', 'D'], q.id);
      assert.equal(new Set(Object.values(q.options)).size, 4, q.id);
      assert.ok(q.explain.length > 20, q.id);
      q.refs.forEach((key) => assert.ok(sources[key], `${q.id} ${key}`));
    }
  });

  test('the correct option is not reliably the longest', () => {
    const longest = quizQuestions.filter((q) => {
      const others = Object.entries(q.options).filter(([letter]) => letter !== q.answer).map(([, text]) => text.length);
      return q.options[q.answer].length > Math.max(...others);
    });
    assert.ok(longest.length <= 8, `${longest.length}: ${longest.map((q) => q.id).join(', ')}`);
  });
});

describe('quiz answers agree with the engine', () => {
  const pick = (id) => quizQuestions.find((q) => q.id === id);

  test('q1 dialysis outranks age and HF', () => {
    const recommendation = getRecommendation(contextWith({
      age: 76, renalModality: 'HD', pathways: { RENAL: true }, modifiers: { heartFailure: true }
    }));
    assert.equal(recommendation.primaryTool, '7-point SGA');
    assert.match(pick('q1').options[pick('q1').answer], /7-point SGA/);
  });

  test('q2 age point reaches the NRS threshold', () => {
    const out = scoreNrs2002({
      initialBmiLow: 'no', initialWeightLoss: 'yes', initialReducedIntake: 'no', initialSevereIllness: 'no',
      nutritionScore: '1', diseaseScore: '1'
    }, { age: 71 });
    assert.equal(out.nativeScore, 3);
    assert.equal(out.normalizedNutritionRisk, 'AT_RISK');
  });

  test('q3 unfinished native tool stays gray', () => {
    const context = contextWith({ intake: '>=75%', giFunction: 'functional', oralSafety: 'safe' });
    const answers = { intake: '>=75%', weightLoss: '否', muscleLoss: '無', gi: 'functional', swallow: 'safe' };
    const recommendation = getRecommendation(context);
    const native = evaluateToolAssessment(recommendation.primaryTool, { answers: {} }, context);
    assert.equal(normalizeResult(context, answers, recommendation, '', native).priority, 'GRAY');
  });

  test('q4 mNUTRIC totals five and is high', () => {
    const out = scoreMNutric({ apacheIi: '16', sofa: '7', comorbidities: '2', preIcuDays: '2' }, { age: 60 });
    assert.equal(out.nativeScore, 5);
    assert.equal(out.nativeCategory, '高分');
  });

  test('q5 and q8 official bands', () => {
    assert.equal(scoreOfficialExternal('MNA-SF', { officialScore: '9', officialCategory: '有營養不良風險', completedDate: '2026-01-01', confirmed: true }).normalizedNutritionRisk, 'AT_RISK');
    assert.equal(scoreOfficialExternal('PG-SGA SF', { officialScore: '7', officialCategory: '4–8 分', completedDate: '2026-01-01', confirmed: true }).normalizedNutritionRisk, 'AT_RISK');
  });

  test('q6 overall SGA score is what counts', () => {
    const out = scoreSevenPointSga({
      weightChange: 'stable', intakeChange: 'moderate_reduction', giSymptoms: 'mild', functionalCapacity: 'reduced',
      diseaseBurden: 'moderate', subcutaneousFat: 'moderate', muscleWasting: 'moderate', overallScore: '4'
    });
    assert.equal(out.nativeCategory, '輕至中度營養不良');
  });

  test('q7 tube feeding is high risk straight away', () => {
    const out = scoreRfhNpt({ tubeFeeding: 'yes' }, {});
    assert.equal(out.nativeStatus, 'COMPLETE');
    assert.equal(out.normalizedNutritionRisk, 'HIGH');
  });

  test('q9 dry weight wins and the measured value is kept', () => {
    const context = contextWith({ weight: 67.2, dryWeight: 63.5, modifiers: { heartFailure: true } });
    assert.equal(getReferenceWeight(context).value, 63.5);
    assert.equal(context.weight, 67.2);
  });

  const gussRecord = {
    answers: {
      indirect: { alertness: 'yes', voluntaryCough: 'yes', salivaSwallow: 'yes', drooling: 'no', voiceChange: 'no' },
      semisolid: { swallow: 'successful', involuntaryCough: 'no', drooling: 'no', voiceChange: 'no' },
      liquid: { swallow: 'delayed', involuntaryCough: 'yes', drooling: 'no', voiceChange: 'yes' }
    }
  };

  test('q10 GUSS-T stops at the liquid stage on 12', () => {
    const out = evaluateGuss(gussRecord);
    assert.equal(out.nativeScore, 12);
    assert.equal(out.stopAfter, 'liquid');
  });

  test('q13 negative RSST does not override GUSS-T', () => {
    const out = resolveSwallowingSafety('safe', false, {
      selectedTools: ['GUSS-T', 'RSST'], assessorRole: '護理師', 'GUSS-T': gussRecord, RSST: { answers: { swallowCount: '3' } }
    });
    assert.equal(out.status, 'suspected dysphagia');
    assert.match(out.reason, /GUSS-T 12/);
  });

  test('q18 NPO stays pending and carries the refeeding condition', () => {
    const context = contextWith({ dietStatus: 'NPO', npoReason: '醫療處置 / 手術' });
    const answers = { intake: '<25% 或幾乎無攝取', weightLoss: '否', muscleLoss: '無', gi: 'functional', swallow: 'safe' };
    const recommendation = getRecommendation(context);
    const result = normalizeResult(context, answers, recommendation, '', { nativeStatus: 'NOT_STARTED', answers: {}, answered: 0 });
    const route = getRoute(context, answers, result);
    assert.equal(route.status, 'PENDING_ASSESSMENT');
    assert.match(route.title, /NPO 原因與解除條件/);
    assert.match(route.title, /再餵食/);
  });
});

describe('mind map', () => {
  test('tool thresholds agree with the engine', () => {
    const text = JSON.stringify(mindMap);
    Object.values(pathwayMeta).forEach((meta) => assert.ok(text.includes(meta.tool), meta.tool));
    assert.ok(text.includes('NRS-2002 ≥3'));
    assert.equal(scoreNrs2002({
      initialBmiLow: 'yes', initialWeightLoss: 'no', initialReducedIntake: 'no', initialSevereIllness: 'no',
      nutritionScore: '1', diseaseScore: '1'
    }, { age: 60 }).normalizedNutritionRisk, 'LOW');
    assert.equal(scoreMNutric({ apacheIi: '0', sofa: '6', comorbidities: '2', preIcuDays: '1' }, { age: 75 }).nativeCategory, '高分');
    assert.equal(scoreMNutric({ apacheIi: '0', sofa: '6', comorbidities: '2', preIcuDays: '0' }, { age: 60 }).nativeCategory, '低分');
  });
});
