export const GUSS_SOURCE_URL = 'https://www.donau-uni.ac.at/dam/jcr%3Ab58a247c-f865-4e7f-aca7-350cb4b5d580/GUSS%20Taiwan%20incl%20instructions.pdf';
export const RSST_SOURCE_URL = 'https://doi.org/10.2490/jjrm1963.37.383';

const indirectFields = ['alertness', 'voluntaryCough', 'salivaSwallow', 'drooling', 'voiceChange'];
const directFields = ['swallow', 'involuntaryCough', 'drooling', 'voiceChange'];
const stageOrder = ['indirect', 'semisolid', 'liquid', 'solid'];

const validValues = {
  alertness: ['yes', 'no'],
  voluntaryCough: ['yes', 'no'],
  salivaSwallow: ['yes', 'no'],
  drooling: ['yes', 'no'],
  voiceChange: ['yes', 'no'],
  swallow: ['none', 'delayed', 'successful'],
  involuntaryCough: ['yes', 'no']
};

function hasRecordedAnswer(answers = {}) {
  return Object.values(answers).some((stage) => (
    stage && typeof stage === 'object'
      ? Object.values(stage).some((value) => value !== '' && value != null)
      : stage !== '' && stage != null
  ));
}

function scoreIndirect(answers) {
  return Number(answers.alertness === 'yes')
    + Number(answers.voluntaryCough === 'yes')
    + Number(answers.salivaSwallow === 'yes')
    + Number(answers.drooling === 'no')
    + Number(answers.voiceChange === 'no');
}

function scoreDirect(answers) {
  const swallowScore = answers.swallow === 'successful' ? 2 : answers.swallow === 'delayed' ? 1 : 0;
  return swallowScore
    + Number(answers.involuntaryCough === 'no')
    + Number(answers.drooling === 'no')
    + Number(answers.voiceChange === 'no');
}

function getGussCategory(score) {
  if (score === 20) return '輕度吞嚥障礙或無吞嚥障礙';
  if (score >= 15) return '輕度吞嚥障礙伴隨吸入風險';
  if (score >= 10) return '中度吞嚥障礙伴隨吸入風險';
  return '重度吞嚥障礙伴隨高吸入風險';
}

function evaluationBase(nativeStatus, overrides = {}) {
  return {
    nativeStatus,
    nativeScore: null,
    nativeCategory: '',
    safetyStatus: 'not assessed',
    missing: [],
    invalid: [],
    stopAfter: null,
    completedAt: '',
    ...overrides
  };
}

export function createInitialSwallowingAssessments() {
  return {
    selectedTools: [],
    assessorRole: '',
    'GUSS-T': { answers: {}, completedAt: '' },
    RSST: { answers: {}, completedAt: '' }
  };
}

export function evaluateGuss(record = {}) {
  const answers = record.answers || {};
  const stageAccess = { indirect: true, semisolid: false, liquid: false, solid: false };
  let totalScore = 0;
  let answered = 0;
  let fieldsSoFar = 0;

  for (let index = 0; index < stageOrder.length; index += 1) {
    const stage = stageOrder[index];
    const fields = stage === 'indirect' ? indirectFields : directFields;
    const stageAnswers = answers[stage] || {};
    const invalid = fields
      .filter((field) => stageAnswers[field] !== '' && stageAnswers[field] != null && !validValues[field].includes(stageAnswers[field]))
      .map((field) => `${stage}.${field}`);
    const missing = fields
      .filter((field) => stageAnswers[field] === '' || stageAnswers[field] == null)
      .map((field) => `${stage}.${field}`);
    answered += fields.length - missing.length;
    fieldsSoFar += fields.length;

    if (invalid.length > 0 || missing.length > 0) {
      const denominator = fieldsSoFar;
      return evaluationBase(hasRecordedAnswer(answers) ? 'IN_PROGRESS' : 'NOT_STARTED', {
        missing,
        invalid,
        answered,
        total: denominator,
        percent: Math.round((answered / denominator) * 100),
        stageAccess,
        completedAt: record.completedAt || ''
      });
    }

    const stageScore = stage === 'indirect' ? scoreIndirect(stageAnswers) : scoreDirect(stageAnswers);
    totalScore += stageScore;
    if (stageScore < 5) {
      return evaluationBase('COMPLETE', {
        nativeScore: totalScore,
        nativeCategory: getGussCategory(totalScore),
        safetyStatus: totalScore <= 9 ? 'unsafe' : 'suspected dysphagia',
        answered,
        total: answered,
        percent: 100,
        stopAfter: stage,
        stageAccess,
        completedAt: record.completedAt || ''
      });
    }

    if (index < stageOrder.length - 1) stageAccess[stageOrder[index + 1]] = true;
  }

  return evaluationBase('COMPLETE', {
    nativeScore: totalScore,
    nativeCategory: getGussCategory(totalScore),
    safetyStatus: 'safe',
    answered: 17,
    total: 17,
    percent: 100,
    stageAccess,
    completedAt: record.completedAt || ''
  });
}

export function evaluateRsst(record = {}) {
  const answers = record.answers || {};
  if (answers.unableToAssess === true) {
    return evaluationBase('COMPLETE', {
      nativeCategory: '無法評估',
      safetyStatus: 'not assessed',
      answered: 1,
      total: 1,
      percent: 100,
      completedAt: record.completedAt || ''
    });
  }

  const rawCount = answers.swallowCount;
  if (rawCount === '' || rawCount == null) {
    return evaluationBase('NOT_STARTED', {
      missing: ['swallowCount'],
      answered: 0,
      total: 1,
      percent: 0,
      completedAt: record.completedAt || ''
    });
  }

  const count = Number(rawCount);
  if (!Number.isInteger(count) || count < 0) {
    return evaluationBase('IN_PROGRESS', {
      invalid: ['swallowCount'],
      answered: 0,
      total: 1,
      percent: 0,
      completedAt: record.completedAt || ''
    });
  }

  const positive = count <= 2;
  return evaluationBase('COMPLETE', {
    nativeScore: count,
    nativeCategory: positive ? '篩檢陽性：疑似吞嚥障礙' : '篩檢陰性',
    safetyStatus: positive ? 'suspected dysphagia' : 'screen negative',
    answered: 1,
    total: 1,
    percent: 100,
    completedAt: record.completedAt || ''
  });
}

export function updateSwallowingAssessment(store, toolId, patch, now = new Date()) {
  if (!['GUSS-T', 'RSST'].includes(toolId)) throw new RangeError(`Unknown swallowing assessment: ${toolId}`);
  const current = store[toolId] || { answers: {}, completedAt: '' };
  const nextRecord = {
    ...current,
    answers: { ...current.answers, ...patch }
  };
  const evaluation = toolId === 'GUSS-T' ? evaluateGuss(nextRecord) : evaluateRsst(nextRecord);
  return {
    ...store,
    [toolId]: {
      ...nextRecord,
      completedAt: evaluation.nativeStatus === 'COMPLETE'
        ? current.completedAt || now.toISOString()
        : ''
    }
  };
}

export function evaluateSwallowingAssessments(store = createInitialSwallowingAssessments()) {
  const GUSS = evaluateGuss(store['GUSS-T']);
  const RSST = evaluateRsst(store.RSST);
  const selectedTools = Array.isArray(store.selectedTools) ? store.selectedTools : [];
  const evaluations = { 'GUSS-T': GUSS, RSST };
  const selectedEvaluations = selectedTools.map((tool) => evaluations[tool]).filter(Boolean);
  return {
    isOptional: true,
    selectedTools,
    assessorRole: store.assessorRole || '',
    hasIncompleteSelection: selectedTools.length > 0 && (
      !store.assessorRole || selectedEvaluations.some((evaluation) => evaluation.nativeStatus !== 'COMPLETE')
    ),
    GUSS,
    RSST
  };
}

export function resolveSwallowingSafety(manualStatus = '', dysphagiaModifier = false, store) {
  const screening = evaluateSwallowingAssessments(store);
  const signals = [];
  const pushSignal = (status, rank, reason) => signals.push({ status, rank, reason });

  if (manualStatus === 'unsafe') pushSignal('unsafe', 3, '人工判定：口服進食不安全');
  else if (manualStatus === 'suspected dysphagia') pushSignal('suspected dysphagia', 2, '人工判定：疑似吞嚥障礙');
  else if (manualStatus === 'not assessed') pushSignal('not assessed', 1, '人工判定：尚未評估');
  else if (manualStatus === 'safe') pushSignal('safe', 0, '人工判定：口服進食安全');

  if (dysphagiaModifier) pushSignal('suspected dysphagia', 2, '病人背景：吞嚥障礙特殊因子');

  if (screening.selectedTools.includes('GUSS-T')) {
    if (screening.GUSS.nativeStatus !== 'COMPLETE') {
      pushSignal('not assessed', 1, 'GUSS-T 尚未完成');
    } else if (screening.GUSS.safetyStatus === 'unsafe') {
      pushSignal('unsafe', 3, `GUSS-T ${screening.GUSS.nativeScore} 分`);
    } else if (screening.GUSS.safetyStatus === 'suspected dysphagia') {
      pushSignal('suspected dysphagia', 2, `GUSS-T ${screening.GUSS.nativeScore} 分`);
    } else {
      pushSignal('safe', 0, 'GUSS-T 20 分');
    }
  }

  if (screening.selectedTools.includes('RSST')) {
    if (screening.RSST.nativeStatus !== 'COMPLETE') {
      pushSignal('not assessed', 1, 'RSST 尚未完成');
    } else if (screening.RSST.safetyStatus === 'suspected dysphagia') {
      pushSignal('suspected dysphagia', 2, `RSST ${screening.RSST.nativeScore} 次／30 秒`);
    } else if (screening.RSST.safetyStatus === 'not assessed') {
      pushSignal('not assessed', 1, 'RSST 無法評估');
    }
  }

  if (signals.length === 0) {
    return { status: 'not assessed', reason: '尚未完成可建立口服安全性的評估', screening };
  }

  const worst = signals.reduce((current, signal) => signal.rank > current.rank ? signal : current);
  return { status: worst.status, reason: worst.reason, screening };
}
