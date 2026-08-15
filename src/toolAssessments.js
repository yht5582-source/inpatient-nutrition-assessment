export const ASSESSMENT_MODES = Object.freeze({
  IN_APP_AUTOSCORE: 'IN_APP_AUTOSCORE',
  CLINICIAN_RATED: 'CLINICIAN_RATED',
  OFFICIAL_EXTERNAL: 'OFFICIAL_EXTERNAL'
});

export const TOOL_ASSESSMENT_MODES = Object.freeze({
  'NRS-2002': ASSESSMENT_MODES.IN_APP_AUTOSCORE,
  'MNA-SF': ASSESSMENT_MODES.OFFICIAL_EXTERNAL,
  '7-point SGA': ASSESSMENT_MODES.CLINICIAN_RATED,
  'RFH-NPT': ASSESSMENT_MODES.IN_APP_AUTOSCORE,
  'PG-SGA SF': ASSESSMENT_MODES.OFFICIAL_EXTERNAL,
  mNUTRIC: ASSESSMENT_MODES.IN_APP_AUTOSCORE
});

const NRS_INITIAL_FIELDS = [
  'initialBmiLow',
  'initialWeightLoss',
  'initialReducedIntake',
  'initialSevereIllness'
];

const NRS_FINAL_FIELDS = ['nutritionScore', 'diseaseScore'];
const MNUTRIC_FIELDS = ['apacheIi', 'sofa', 'comorbidities', 'preIcuDays'];
const RFH_INITIAL_FIELDS = ['alcoholicHepatitis', 'tubeFeeding'];
const RFH_FLUID_FIELDS = ['incompleteMealsFromFluid', 'intakeReducedFifty', 'fluidWeightLoss'];
const SEVEN_POINT_SGA_FIELDS = [
  'weightChange',
  'intakeChange',
  'giSymptoms',
  'functionalCapacity',
  'diseaseBurden',
  'subcutaneousFat',
  'muscleWasting',
  'overallScore'
];
const OFFICIAL_EXTERNAL_FIELDS = ['officialScore', 'officialCategory', 'completedDate', 'confirmed'];

function isRecorded(value) {
  return value !== '' && value != null;
}

function toNumber(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toIntegerInRange(value, minimum, maximum = Infinity) {
  const number = toNumber(value);
  return number != null && Number.isInteger(number) && number >= minimum && number <= maximum
    ? number
    : null;
}

function getAgeIssue(context) {
  const age = context?.age;
  if (!isRecorded(age)) return { missing: ['age'], invalid: [] };
  return toNumber(age) == null ? { missing: [], invalid: ['age'] } : null;
}

function incompleteEvaluation(missing = [], invalid = []) {
  const result = {
    nativeStatus: 'IN_PROGRESS',
    nativeScore: null,
    nativeCategory: '',
    missing,
    normalizedNutritionRisk: 'NOT_ASSESSED',
    normalizedMalnutrition: 'NOT_APPLICABLE'
  };

  if (invalid.length > 0) result.invalid = invalid;
  return result;
}

function completeEvaluation(nativeScore, nativeCategory, normalizedNutritionRisk) {
  return {
    nativeStatus: 'COMPLETE',
    nativeScore,
    nativeCategory,
    missing: [],
    normalizedNutritionRisk,
    normalizedMalnutrition: 'NOT_APPLICABLE'
  };
}

function completeEvaluationWithMalnutrition(
  nativeScore,
  nativeCategory,
  normalizedNutritionRisk,
  normalizedMalnutrition
) {
  return {
    ...completeEvaluation(nativeScore, nativeCategory, normalizedNutritionRisk),
    normalizedMalnutrition
  };
}

export function scoreNrs2002(answers = {}, context = {}) {
  const ageIssue = getAgeIssue(context);
  if (ageIssue) return incompleteEvaluation(ageIssue.missing, ageIssue.invalid);

  const missingInitial = NRS_INITIAL_FIELDS.filter((field) => !isRecorded(answers[field]));
  if (missingInitial.length > 0) return incompleteEvaluation(missingInitial);

  const invalidInitial = NRS_INITIAL_FIELDS.filter(
    (field) => answers[field] !== 'yes' && answers[field] !== 'no'
  );
  if (invalidInitial.length > 0) return incompleteEvaluation([], invalidInitial);

  if (NRS_INITIAL_FIELDS.every((field) => answers[field] === 'no')) {
    return completeEvaluation(0, '初篩陰性；建議每週重篩', 'LOW');
  }

  const missingFinal = NRS_FINAL_FIELDS.filter((field) => !isRecorded(answers[field]));
  if (missingFinal.length > 0) return incompleteEvaluation(missingFinal);

  const invalidFinal = NRS_FINAL_FIELDS.filter(
    (field) => toIntegerInRange(answers[field], 0, 3) == null
  );
  if (invalidFinal.length > 0) return incompleteEvaluation([], invalidFinal);

  const agePoint = toNumber(context.age) >= 70 ? 1 : 0;
  const nativeScore = Number(answers.nutritionScore) + Number(answers.diseaseScore) + agePoint;
  return completeEvaluation(nativeScore, nativeScore < 3 ? '無營養風險' : '有營養風險', nativeScore < 3 ? 'LOW' : 'AT_RISK');
}

export function scoreMNutric(answers = {}, context = {}) {
  const ageIssue = getAgeIssue(context);
  if (ageIssue) return incompleteEvaluation(ageIssue.missing, ageIssue.invalid);

  const missing = MNUTRIC_FIELDS.filter((field) => !isRecorded(answers[field]));
  if (missing.length > 0) return incompleteEvaluation(missing);

  const invalid = [];
  const apache = toIntegerInRange(answers.apacheIi, 0, 71);
  const sofa = toIntegerInRange(answers.sofa, 0, 24);
  const comorbidities = toIntegerInRange(answers.comorbidities, 0);
  const preIcuDays = toNumber(answers.preIcuDays);

  if (apache == null) invalid.push('apacheIi');
  if (sofa == null) invalid.push('sofa');
  if (comorbidities == null) invalid.push('comorbidities');
  if (preIcuDays == null || preIcuDays < 0) invalid.push('preIcuDays');
  if (invalid.length > 0) return incompleteEvaluation([], invalid);

  const age = toNumber(context.age);
  const agePoints = age < 50 ? 0 : age < 75 ? 1 : 2;
  const apachePoints = apache < 15 ? 0 : apache < 20 ? 1 : apache <= 28 ? 2 : 3;
  const sofaPoints = sofa < 6 ? 0 : sofa < 10 ? 1 : 2;
  const comorbidityPoints = comorbidities < 2 ? 0 : 1;
  const preIcuPoints = preIcuDays < 1 ? 0 : 1;
  const nativeScore = agePoints + apachePoints + sofaPoints + comorbidityPoints + preIcuPoints;
  const highRisk = nativeScore >= 5;

  return completeEvaluation(nativeScore, highRisk ? '高分' : '低分', highRisk ? 'HIGH' : 'LOW');
}

function classifyRfhScore(score) {
  if (score === 0) return { nativeScore: score, nativeCategory: '低風險', normalizedNutritionRisk: 'LOW' };
  if (score === 1) return { nativeScore: score, nativeCategory: '中度風險', normalizedNutritionRisk: 'AT_RISK' };
  return { nativeScore: score, nativeCategory: '高風險', normalizedNutritionRisk: 'HIGH' };
}

function completeRfhEvaluation(score) {
  return {
    nativeStatus: 'COMPLETE',
    ...classifyRfhScore(score),
    missing: [],
    normalizedMalnutrition: 'NOT_APPLICABLE'
  };
}

function getPositiveMeasurementIssue(context) {
  const missing = [];
  const invalid = [];
  const measurements = [['height', context?.height], ['weight', context?.weight]];

  for (const [field, value] of measurements) {
    if (!isRecorded(value)) {
      missing.push(field);
      continue;
    }
    const number = toNumber(value);
    if (number == null || number <= 0) invalid.push(field);
  }

  return { missing, invalid };
}

export function scoreRfhNpt(answers = {}, context = {}) {
  const invalidInitial = RFH_INITIAL_FIELDS.filter(
    (field) => isRecorded(answers[field]) && answers[field] !== 'yes' && answers[field] !== 'no'
  );
  if (invalidInitial.length > 0) return incompleteEvaluation([], invalidInitial);

  if (answers.alcoholicHepatitis === 'yes' || answers.tubeFeeding === 'yes') {
    return completeRfhEvaluation(6);
  }

  const missingInitial = RFH_INITIAL_FIELDS.filter((field) => !isRecorded(answers[field]));
  if (missingInitial.length > 0) return incompleteEvaluation(missingInitial);

  if (!isRecorded(answers.fluidOverload)) return incompleteEvaluation(['fluidOverload']);
  if (answers.fluidOverload !== 'yes' && answers.fluidOverload !== 'no') {
    return incompleteEvaluation([], ['fluidOverload']);
  }

  if (answers.fluidOverload === 'no') {
    const missing = ['weightLossPercent', 'acuteNoIntakeFiveDays']
      .filter((field) => !isRecorded(answers[field]));
    const invalid = [];

    if (isRecorded(answers.weightLossPercent) && toNumber(answers.weightLossPercent) == null) {
      invalid.push('weightLossPercent');
    }
    if (
      isRecorded(answers.acuteNoIntakeFiveDays)
      && answers.acuteNoIntakeFiveDays !== 'yes'
      && answers.acuteNoIntakeFiveDays !== 'no'
    ) {
      invalid.push('acuteNoIntakeFiveDays');
    }

    const measurementIssue = getPositiveMeasurementIssue(context);
    if (measurementIssue.missing.length > 0) missing.push(...measurementIssue.missing);
    invalid.push(...measurementIssue.invalid);
    if (missing.length > 0 || invalid.length > 0) return incompleteEvaluation(missing, invalid);

    const heightCm = toNumber(context.height);
    const weightKg = toNumber(context.weight);
    const bmi = weightKg / (heightCm / 100) ** 2;
    const bmiPoints = bmi > 20 ? 0 : bmi >= 18.5 ? 1 : 2;
    const weightLossPoints = toNumber(answers.weightLossPercent) < 5
      ? 0
      : toNumber(answers.weightLossPercent) <= 10 ? 1 : 2;
    const acutePoints = answers.acuteNoIntakeFiveDays === 'yes' ? 2 : 0;
    return completeRfhEvaluation(bmiPoints + weightLossPoints + acutePoints);
  }

  const missing = RFH_FLUID_FIELDS.filter((field) => !isRecorded(answers[field]));
  const invalid = [];
  const mealPoints = { no: 0, sometimes: 1, yes: 2 }[answers.incompleteMealsFromFluid];
  const weightPoints = { no: 0, uncertain: 1, yes: 2 }[answers.fluidWeightLoss];

  if (
    isRecorded(answers.incompleteMealsFromFluid)
    && mealPoints === undefined
  ) invalid.push('incompleteMealsFromFluid');
  if (
    isRecorded(answers.intakeReducedFifty)
    && answers.intakeReducedFifty !== 'yes'
    && answers.intakeReducedFifty !== 'no'
  ) invalid.push('intakeReducedFifty');
  if (
    isRecorded(answers.fluidWeightLoss)
    && weightPoints === undefined
  ) invalid.push('fluidWeightLoss');
  if (missing.length > 0 || invalid.length > 0) return incompleteEvaluation(missing, invalid);

  const fluidPoints = 1;
  const intakePoints = answers.intakeReducedFifty === 'yes' ? 2 : 0;
  return completeRfhEvaluation(fluidPoints + mealPoints + intakePoints + weightPoints);
}

export function scoreSevenPointSga(answers = {}) {
  const missing = SEVEN_POINT_SGA_FIELDS.filter((field) => !isRecorded(answers[field]));
  if (missing.length > 0) return incompleteEvaluation(missing);

  const overallScore = toIntegerInRange(answers.overallScore, 1, 7);
  if (overallScore == null) return incompleteEvaluation([], ['overallScore']);

  if (overallScore <= 2) {
    return completeEvaluationWithMalnutrition(
      overallScore,
      '嚴重營養不良',
      'NOT_APPLICABLE',
      'SEVERE'
    );
  }
  if (overallScore <= 5) {
    return completeEvaluationWithMalnutrition(
      overallScore,
      '輕至中度營養不良',
      'NOT_APPLICABLE',
      'MODERATE'
    );
  }
  return completeEvaluationWithMalnutrition(
    overallScore,
    '營養良好',
    'NOT_APPLICABLE',
    'NO_MALNUTRITION'
  );
}

function classifyMnaSf(score) {
  if (score <= 7) {
    return {
      category: '營養不良',
      normalizedNutritionRisk: 'AT_RISK',
      normalizedMalnutrition: 'MALNOURISHED'
    };
  }
  if (score <= 11) {
    return {
      category: '有營養不良風險',
      normalizedNutritionRisk: 'AT_RISK',
      normalizedMalnutrition: 'UNKNOWN'
    };
  }
  return {
    category: '營養正常',
    normalizedNutritionRisk: 'LOW',
    normalizedMalnutrition: 'NO_MALNUTRITION'
  };
}

function classifyPgSgaSf(score) {
  if (score <= 1) return { category: '0–1 分', normalizedNutritionRisk: 'LOW' };
  if (score <= 3) return { category: '2–3 分', normalizedNutritionRisk: 'LOW' };
  if (score <= 8) return { category: '4–8 分', normalizedNutritionRisk: 'AT_RISK' };
  return { category: '9 分以上', normalizedNutritionRisk: 'HIGH' };
}

export function scoreOfficialExternal(toolId, answers = {}) {
  const missing = OFFICIAL_EXTERNAL_FIELDS.filter((field) => !isRecorded(answers[field]));
  if (missing.length > 0) return incompleteEvaluation(missing);

  if (answers.confirmed !== true) return incompleteEvaluation([], ['confirmed']);

  const maximumScore = toolId === 'MNA-SF' ? 14 : toolId === 'PG-SGA SF' ? 36 : null;
  const officialScore = maximumScore == null
    ? null
    : toIntegerInRange(answers.officialScore, 0, maximumScore);
  if (officialScore == null) return incompleteEvaluation([], [maximumScore == null ? 'toolId' : 'officialScore']);

  const classification = toolId === 'MNA-SF'
    ? classifyMnaSf(officialScore)
    : classifyPgSgaSf(officialScore);
  if (answers.officialCategory !== classification.category) {
    return incompleteEvaluation([], ['officialCategory']);
  }

  return completeEvaluationWithMalnutrition(
    officialScore,
    classification.category,
    classification.normalizedNutritionRisk,
    classification.normalizedMalnutrition || 'NOT_APPLICABLE'
  );
}

export function createEmptyToolAssessment(toolId) {
  return {
    answers: {},
    nativeStatus: 'NOT_STARTED',
    nativeScore: null,
    nativeCategory: '',
    completedAt: '',
    sourceMode: TOOL_ASSESSMENT_MODES[toolId]
  };
}

export function createInitialToolAssessments() {
  return Object.fromEntries(
    Object.keys(TOOL_ASSESSMENT_MODES).map((toolId) => [toolId, createEmptyToolAssessment(toolId)])
  );
}

function getAssessmentFields(toolId, answers, context, evaluation) {
  const answerField = (field) => ({ field, value: answers[field] });
  const contextField = (field) => ({ field, value: context?.[field] });

  if (toolId === 'NRS-2002') {
    const fields = [...NRS_INITIAL_FIELDS.map(answerField), contextField('age')];
    if (NRS_INITIAL_FIELDS.some((field) => answers[field] === 'yes')) {
      fields.push(...NRS_FINAL_FIELDS.map(answerField));
    }
    return fields;
  }
  if (toolId === 'mNUTRIC') {
    return [...MNUTRIC_FIELDS.map(answerField), contextField('age')];
  }
  if (toolId === '7-point SGA') return SEVEN_POINT_SGA_FIELDS.map(answerField);
  if (toolId === 'MNA-SF' || toolId === 'PG-SGA SF') {
    return OFFICIAL_EXTERNAL_FIELDS.map(answerField);
  }
  if (toolId === 'RFH-NPT') {
    const affirmativeFields = RFH_INITIAL_FIELDS.filter((field) => answers[field] === 'yes');
    if (evaluation.nativeStatus === 'COMPLETE' && affirmativeFields.length > 0) {
      return affirmativeFields.map(answerField);
    }

    const fields = RFH_INITIAL_FIELDS.map(answerField);
    if (RFH_INITIAL_FIELDS.every((field) => answers[field] === 'no')) {
      fields.push(answerField('fluidOverload'));
      if (answers.fluidOverload === 'no') {
        fields.push(answerField('weightLossPercent'), answerField('acuteNoIntakeFiveDays'));
        fields.push(contextField('height'), contextField('weight'));
      } else if (answers.fluidOverload === 'yes') {
        fields.push(...RFH_FLUID_FIELDS.map(answerField));
      }
    }
    return fields;
  }
  return [];
}

const toolEvaluators = {
  'NRS-2002': (answers, context) => scoreNrs2002(answers, context),
  'MNA-SF': (answers) => scoreOfficialExternal('MNA-SF', answers),
  '7-point SGA': (answers) => scoreSevenPointSga(answers),
  'RFH-NPT': (answers, context) => scoreRfhNpt(answers, context),
  'PG-SGA SF': (answers) => scoreOfficialExternal('PG-SGA SF', answers),
  mNUTRIC: (answers, context) => scoreMNutric(answers, context)
};

export function evaluateToolAssessment(toolId, record = {}, context = {}) {
  const evaluate = toolEvaluators[toolId];
  if (!evaluate) throw new RangeError(`Unknown tool assessment: ${toolId}`);

  const answers = record.answers || {};
  const evaluation = evaluate(answers, context);
  const hasRecordedAnswer = Object.values(answers).some(isRecorded);
  const nativeStatus = hasRecordedAnswer ? evaluation.nativeStatus : 'NOT_STARTED';
  const fields = getAssessmentFields(toolId, answers, context, evaluation);
  const answered = fields.filter(({ value }) => isRecorded(value)).length;
  const total = fields.length;
  const missing = fields.filter(({ value }) => !isRecorded(value)).map(({ field }) => field);
  const complete = nativeStatus === 'COMPLETE';

  return {
    ...record,
    answers,
    nativeStatus,
    nativeScore: complete ? evaluation.nativeScore : null,
    nativeCategory: complete ? evaluation.nativeCategory : '',
    completedAt: record.completedAt || '',
    sourceMode: record.sourceMode || TOOL_ASSESSMENT_MODES[toolId],
    normalizedNutritionRisk: complete ? evaluation.normalizedNutritionRisk : 'UNKNOWN',
    normalizedMalnutrition: complete ? evaluation.normalizedMalnutrition : 'UNKNOWN',
    answered,
    total,
    percent: total === 0 ? 0 : Math.round((answered / total) * 100),
    missing,
    invalid: evaluation.invalid || []
  };
}

export function updateToolAssessment(
  store,
  toolId,
  patch,
  context,
  now = new Date().toISOString()
) {
  const current = store[toolId] || createEmptyToolAssessment(toolId);
  const answers = { ...current.answers, ...patch };
  const evaluation = evaluateToolAssessment(toolId, { ...current, answers }, context);
  const completedAt = evaluation.nativeStatus === 'COMPLETE'
    ? current.completedAt || answers.completedDate || now
    : '';

  return {
    ...store,
    [toolId]: {
      ...evaluation,
      completedAt
    }
  };
}
