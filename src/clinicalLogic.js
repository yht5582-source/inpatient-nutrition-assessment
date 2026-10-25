import { evaluateToolAssessment } from './toolAssessments.js';
import { resolveSwallowingSafety } from './swallowingAssessments.js';

export const pathwayMeta = {
  ICU: { label: 'ICU', tool: 'mNUTRIC', reason: '重症照護路徑', priority: 1 },
  LIVER: { label: 'cirrhosis', tool: 'RFH-NPT', reason: '肝硬化專屬營養風險', priority: 2 },
  RENAL: { label: 'CKD5D / HD / PD', tool: '7-point SGA', reason: '腎臟病 / 透析營養狀態評估', priority: 3 },
  ONCOLOGY: { label: 'active cancer', tool: 'PG-SGA SF', reason: '癌症營養風險與症狀 triage', priority: 4 },
  GERIATRIC: { label: 'geriatric', tool: 'MNA-SF', reason: '老年住院營養篩檢', priority: 5 },
  GENERAL: { label: 'general adult', tool: 'NRS-2002', reason: '一般成人住院營養風險篩檢', priority: 6 }
};

export const modifierLabels = {
  heartFailure: 'heart failure',
  dysphagia: 'dysphagia',
  edemaAscites: 'edema / ascites',
  refeeding: 'refeeding risk',
  age65: 'age >=65',
  poorIntake: 'poor intake'
};

const chineseStatusLabels = {
  RED: '紅色',
  AMBER: '琥珀色',
  GREEN: '綠色',
  GRAY: '灰色',
  HIGH: '高風險',
  LOW: '低風險',
  AT_RISK: '有風險',
  SEVERE: '嚴重',
  MODERATE: '中度',
  NO_MALNUTRITION: '無營養不良',
  MALNOURISHED: '營養不良',
  UNKNOWN: '未知',
  NOT_ASSESSED: '尚未評估',
  NOT_APPLICABLE: '不適用',
  INCOMPLETE: '評估未完成',
  NOT_AVAILABLE: '工具目前不可用',
  TOOL_SCORE_PENDING: '量表計分待完成',
  NOT_STARTED: '尚未開始',
  IN_PROGRESS: '進行中',
  COMPLETE: '已完成',
  IN_APP_AUTOSCORE: '站內自動計分',
  CLINICIAN_RATED: '營養師整體評定',
  OFFICIAL_EXTERNAL: '官方工具結果回填',
  RECOMMENDED: '建議執行',
  CONSIDER: '可考慮',
  CONDITIONAL: '有條件執行',
  PENDING_ASSESSMENT: '待完成評估',
  ASSESS_APPROPRIATENESS: '評估適用性',
  CONTINUE_AND_REVIEW: '持續執行並重新評估',
  BLOCKING: '阻擋中',
  PENDING: '待處理',
  REVIEW: '請檢視',
  'Incomplete assessment': '評估尚未完成',
  'Tool unavailable pending license review': '工具尚待授權審查，目前不可用',
  'Validated tool scoring not completed': '尚未完成經驗證量表計分',
  '原始評估未完成': '原始評估未完成',
  'Validated digital scoring is not available': '目前沒有可用的經驗證數位計分',
  'Required assessment fields are missing': '必要評估欄位尚未完成',
  'Dry weight': '乾體重',
  'Measured weight': '測量體重',
  'Measured weight (review required)': '測量體重（需檢視）',
  'Unavailable': '無可用資料',
  'not assessed': '尚未評估',
  safe: '口服進食安全',
  'suspected dysphagia': '疑似吞嚥障礙',
  unsafe: '口服進食不安全',
  'screen negative': '篩檢陰性',
  'Oral feeding unsafe': '口服進食不安全',
  'Swallowing safety pending': '吞嚥安全待確認',
  'Refeeding risk': '再餵食症候群風險',
  'Refeeding screen required': '需完成再餵食風險篩檢',
  'Fluid-affected weight': '體液狀態影響體重',
  'Swallowing status conflicts with dysphagia modifier': '吞嚥狀態與吞嚥障礙特殊因子不一致',
  'GI tract uncertain': '胃腸道可用性不確定',
  'Intake not assessed': '攝取量尚未評估',
  'Intake status conflicts with poor-intake modifier': '攝取狀態與攝取不足特殊因子不一致',
  'Nutrition screening': '營養風險篩檢',
  'Geriatric screening': '高齡營養篩檢',
  'Nutrition assessment': '營養評估',
  'Liver nutrition risk': '肝病營養風險評估',
  'Oncology triage': '腫瘤營養分流',
  'ICU nutrition risk': '加護病房營養風險評估',
  'cirrhosis': '肝硬化',
  'active cancer': '活動性癌症',
  'geriatric': '高齡病人',
  'general adult': '一般成人',
  'heart failure': '心衰竭',
  'dysphagia': '吞嚥障礙',
  'edema / ascites': '水腫／腹水',
  'refeeding risk': '再餵食症候群風險',
  'age >=65': '年齡 65 歲以上',
  'poor intake': '攝取不足'
};

const priorityMeanings = {
  RED: '高優先處理：需安全檢查與營養照護計畫',
  AMBER: '需營養師或專業評估',
  GREEN: '例行營養照護與定期重篩',
  GRAY: '資料不足或不可靠，不硬算結果'
};

export function getPriorityLabel(value) {
  return priorityMeanings[value] ? `${chineseStatusLabels[value]}｜${priorityMeanings[value]}` : getChineseStatus(value);
}

export function getChineseStatus(value) {
  if (value == null || value === '') return '未提供';
  return chineseStatusLabels[value] || value;
}

export const wardOptions = ['一般病房', '加護病房 ICU', '透析病房', '其他'];

export const diagnosisOptions = [
  '一般內科／營養評估',
  '重症／敗血症',
  '腎臟病／透析',
  '肝硬化／肝病',
  '活動性癌症',
  '高齡衰弱',
  '心衰竭',
  '吞嚥障礙',
  '手術／術後',
  '其他'
];

const diagnosisLinkage = {
  '一般內科／營養評估': ['pathways', 'GENERAL'],
  '重症／敗血症': ['pathways', 'ICU'],
  '腎臟病／透析': ['pathways', 'RENAL'],
  '肝硬化／肝病': ['pathways', 'LIVER'],
  '活動性癌症': ['pathways', 'ONCOLOGY'],
  '高齡衰弱': ['pathways', 'GERIATRIC'],
  '心衰竭': ['modifiers', 'heartFailure'],
  '吞嚥障礙': ['modifiers', 'dysphagia']
};

export function applyWardSelection(context, ward) {
  return {
    ...context,
    ward,
    pathways: {
      ...context.pathways,
      ICU: ward === '加護病房 ICU' ? true : context.pathways.ICU
    }
  };
}

export function applyDiagnosisSelection(context, diagnosis) {
  const linkage = diagnosisLinkage[diagnosis];
  if (!linkage) return { ...context, diagnosis };

  const [group, key] = linkage;
  return {
    ...context,
    diagnosis,
    [group]: {
      ...context[group],
      [key]: true
    }
  };
}

export const toolRegistry = {
  'NRS-2002': {
    type: 'Nutrition screening',
    population: 'General adult inpatient',
    version: 'NRS-2002 (ESPEN)',
    assessmentMode: 'IN_APP_AUTOSCORE',
    modeLabel: '站內自動計分',
    sourceUrl: 'https://www.espen.org/documents/Screening.pdf'
  },
  'MNA-SF': {
    type: 'Geriatric screening',
    population: 'Age >=65',
    version: 'MNA-SF official form',
    assessmentMode: 'OFFICIAL_EXTERNAL',
    modeLabel: '官方工具結果回填',
    sourceUrl: 'https://www.mna-elderly.com/mna-forms'
  },
  '7-point SGA': {
    type: 'Nutrition assessment',
    population: 'CKD5D / dialysis',
    version: '7-point SGA (NKF)',
    assessmentMode: 'CLINICIAN_RATED',
    modeLabel: '營養師整體評定',
    sourceUrl: 'https://www.kidney.org/sites/default/files/12-85-0946_ica_crn-pocket-guide_v6_chp_1.pdf'
  },
  'RFH-NPT': {
    type: 'Liver nutrition risk',
    population: 'Cirrhosis',
    version: 'RFH-NPT',
    assessmentMode: 'IN_APP_AUTOSCORE',
    modeLabel: '站內自動計分',
    sourceUrl: 'https://www.frontiersin.org/journals/nutrition/articles/10.3389/fnut.2021.766350/full'
  },
  'PG-SGA SF': {
    type: 'Oncology triage',
    population: 'Active cancer',
    version: 'PG-SGA SF / Pt-Global',
    assessmentMode: 'OFFICIAL_EXTERNAL',
    modeLabel: '官方工具結果回填',
    sourceUrl: 'https://pt-global.org/pt-global-app/'
  },
  mNUTRIC: {
    type: 'ICU nutrition risk',
    population: 'Critical care',
    version: 'mNUTRIC without IL-6 (0-9)',
    assessmentMode: 'IN_APP_AUTOSCORE',
    modeLabel: '站內自動計分',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5842932/'
  }
};

export const questions = [
  {
    id: 'intake',
    label: '目前攝取量約為估計需求的多少？',
    options: ['>=75%', '50-74%', '25-49%', '<25% 或幾乎無攝取', 'not assessed']
  },
  {
    id: 'weightLoss',
    label: '近期是否有非預期體重下降？',
    options: ['否', '不確定', '是，輕度', '是，明顯']
  },
  {
    id: 'muscleLoss',
    label: '臨床觀察是否有肌肉流失？',
    options: ['無', '不確定', '輕度', '中度', '嚴重']
  },
  {
    id: 'gi',
    label: '目前 GI tract 是否可使用？',
    options: ['functional', 'partially functional', 'uncertain', 'unavailable']
  },
  {
    id: 'swallow',
    label: 'Oral feeding safety',
    options: ['safe', 'suspected dysphagia', 'unsafe', 'not assessed']
  }
];

const requiredQuestionIds = questions.map((question) => question.id);

function isPositiveNumber(value) {
  return value !== '' && Number.isFinite(Number(value)) && Number(value) > 0;
}

export function calculateBmi(weight, height) {
  if (!isPositiveNumber(weight) || !isPositiveNumber(height)) return null;
  return Number((Number(weight) / Math.pow(Number(height) / 100, 2)).toFixed(1));
}

export function getReferenceWeight(context) {
  const fluidAffected = context.modifiers.edemaAscites || context.modifiers.heartFailure;
  if (fluidAffected && isPositiveNumber(context.dryWeight)) {
    return { value: Number(context.dryWeight), type: 'Dry weight' };
  }
  if (isPositiveNumber(context.weight)) {
    return {
      value: Number(context.weight),
      type: fluidAffected ? 'Measured weight (review required)' : 'Measured weight'
    };
  }
  return { value: null, type: 'Unavailable' };
}

export function getContextValidation(context) {
  const blockers = [];
  const warnings = [];
  const age = Number(context.age);

  if (context.age === '' || !Number.isFinite(age)) blockers.push('請輸入年齡。');
  else if (age < 18) blockers.push('成人 V1 不適用於未滿 18 歲病人。');
  else if (age > 120) warnings.push('年齡超出常見範圍，請再次確認。');

  if (!isPositiveNumber(context.height)) blockers.push('請輸入有效的身高。');
  else if (Number(context.height) < 100 || Number(context.height) > 250) warnings.push('身高超出常見成人範圍，請再次確認。');
  if (!isPositiveNumber(context.weight)) blockers.push('請輸入有效的目前體重。');
  else if (Number(context.weight) < 20 || Number(context.weight) > 400) warnings.push('目前體重超出常見成人範圍，請再次確認。');
  if (!context.dietStatus) blockers.push('請確認目前飲食狀態。');

  const selectedPathways = Object.entries(context.pathways || {}).filter(([, selected]) => selected).map(([key]) => key);
  if (selectedPathways.length === 0) blockers.push('請至少確認一項主要臨床路徑（包含 general adult）。');
  if (selectedPathways.includes('RENAL') && (!context.renalModality || context.renalModality === 'not assessed')) {
    blockers.push('選擇 CKD5D / HD / PD 路徑時，請確認腎臟治療型態。');
  }
  if (context.dietStatus === 'NPO' && !context.npoReason) blockers.push('目前飲食狀態為 NPO，請確認 NPO 原因。');

  if (context.ward === '加護病房 ICU' && !context.pathways?.ICU) {
    warnings.push('病房為加護病房 ICU，但 ICU 主要臨床路徑未啟用。');
  }
  const diagnosisSelection = diagnosisLinkage[context.diagnosis];
  if (diagnosisSelection) {
    const [group, key] = diagnosisSelection;
    if (!context[group]?.[key]) warnings.push(`入院原因／診斷為「${context.diagnosis}」，但對應臨床選項未啟用。`);
  }

  const fluidAffected = context.modifiers.edemaAscites || context.modifiers.heartFailure;
  if (fluidAffected && !isPositiveNumber(context.dryWeight)) {
    warnings.push('體液狀態會影響目前體重，請確認可用的 Dry weight。');
  }

  return { blockers, warnings, isValid: blockers.length === 0 };
}

export function getPathway(context) {
  const age = Number(context.age);
  if (context.age === '' || !Number.isFinite(age) || age < 18) return null;

  const selected = Object.entries(context.pathways)
    .filter(([, value]) => value)
    .map(([key]) => key);

  if (!selected.length) return null;
  if (age >= 65 && !selected.includes('GERIATRIC')) selected.push('GERIATRIC');

  return selected.sort((a, b) => pathwayMeta[a].priority - pathwayMeta[b].priority)[0];
}

export function getRecommendation(context) {
  const primary = getPathway(context);
  if (!primary) return null;

  const meta = pathwayMeta[primary];
  const modifiers = [];
  if (Number(context.age) >= 65) modifiers.push('age65');
  Object.entries(context.modifiers).forEach(([key, value]) => {
    if (value) modifiers.push(key);
  });

  const alternatives = Object.entries(pathwayMeta)
    .filter(([key]) => key !== primary)
    .map(([key, value]) => ({
      tool: value.tool,
      use: value.reason,
      judgment: toolRegistry[value.tool].modeLabel,
      nextStep: '完成共同與原始評估'
    }));

  return {
    primary,
    primaryTool: meta.tool,
    primaryPathway: meta.label,
    reasons: [
      meta.reason,
      ...(context.pathways.RENAL ? [`renal modality: ${context.renalModality}`] : []),
      ...modifiers.map((item) => modifierLabels[item]).filter(Boolean)
    ],
    modifiers,
    alternatives,
    nextStep: '完成共同與原始評估'
  };
}

export function getAssessmentStatus(answers) {
  const missing = requiredQuestionIds.filter((id) => answers[id] === '' || answers[id] == null);
  const answered = requiredQuestionIds.length - missing.length;
  return {
    answered,
    total: requiredQuestionIds.length,
    percent: Math.round((answered / requiredQuestionIds.length) * 100),
    missing,
    isComplete: missing.length === 0
  };
}

function getSafetyAndQuality(context, answers, swallowingScreening, nativeMalnutrition) {
  const swallowingResolution = resolveSwallowingSafety(
    answers.swallow || context.oralSafety,
    context.modifiers.dysphagia,
    swallowingScreening
  );
  const swallow = swallowingResolution.status;
  const intake = answers.intake || context.intake;
  const safetyFlags = [];
  const dataQualityFlags = [];

  if (swallow === 'unsafe') safetyFlags.push('Oral feeding unsafe');
  else if (swallow === 'suspected dysphagia' || swallow === 'not assessed' || (!swallow && context.modifiers.dysphagia)) {
    safetyFlags.push('Swallowing safety pending');
  }
  if (context.modifiers.refeeding) safetyFlags.push('Refeeding risk');
  else if (
    intake === '<25% 或幾乎無攝取'
    || answers.weightLoss === '是，明顯'
    || answers.muscleLoss === '嚴重'
    || nativeMalnutrition === 'SEVERE'
    || nativeMalnutrition === 'MALNOURISHED'
  ) {
    // Spec 10.4: severe malnutrition, very low intake or marked weight loss require a refeeding screen.
    safetyFlags.push('Refeeding screen required');
  }

  if (context.modifiers.edemaAscites || context.modifiers.heartFailure) dataQualityFlags.push('Fluid-affected weight');
  if (context.modifiers.dysphagia && swallow === 'safe') dataQualityFlags.push('Swallowing status conflicts with dysphagia modifier');
  if ((answers.gi || context.giFunction) === 'uncertain') dataQualityFlags.push('GI tract uncertain');
  if (intake === 'not assessed') dataQualityFlags.push('Intake not assessed');
  if (context.modifiers.poorIntake && intake === '>=75%') dataQualityFlags.push('Intake status conflicts with poor-intake modifier');

  return { safetyFlags, dataQualityFlags, swallowingResolution };
}

function getClinicalPriority(answers, intake, safetyFlags, dataQualityFlags, nativeEvaluation) {
  const severeSignals = [
    answers.muscleLoss === '嚴重',
    answers.weightLoss === '是，明顯',
    intake === '<25% 或幾乎無攝取'
  ].filter(Boolean).length;
  const moderateSignals = [
    answers.muscleLoss === '中度',
    answers.weightLoss === '是，輕度',
    intake === '25-49%'
  ].filter(Boolean).length;
  const nativeComplete = nativeEvaluation?.nativeStatus === 'COMPLETE';
  const nativeRisk = nativeComplete ? nativeEvaluation.normalizedNutritionRisk : 'UNKNOWN';
  const nativeMalnutrition = nativeComplete ? nativeEvaluation.normalizedMalnutrition : 'UNKNOWN';
  // Spec 13.5: priority explains native result + safety flags + intake + modifiers.
  const nativeRed = nativeRisk === 'HIGH' || nativeMalnutrition === 'SEVERE' || nativeMalnutrition === 'MALNOURISHED';
  const nativeAmber = nativeRisk === 'AT_RISK' || nativeMalnutrition === 'MODERATE';
  const red = severeSignals >= 2 || safetyFlags.includes('Refeeding risk') || nativeRed;
  const amber = severeSignals === 1 || moderateSignals >= 1 || nativeAmber || safetyFlags.length > 0 || dataQualityFlags.length > 0;
  const criticalUnknown = !nativeComplete
    || dataQualityFlags.includes('GI tract uncertain')
    || dataQualityFlags.includes('Intake not assessed');
  return red ? 'RED' : criticalUnknown ? 'GRAY' : amber ? 'AMBER' : 'GREEN';
}

export function normalizeResult(context, answers, recommendation, overrideTool, toolAssessment, swallowingScreening) {
  const tool = overrideTool || recommendation?.primaryTool;
  const intake = answers.intake || context.intake;
  const assessmentStatus = getAssessmentStatus(answers);
  const nativeEvaluation = !tool
    ? null
    : toolAssessment?.answered == null
      ? evaluateToolAssessment(tool, toolAssessment, context)
      : toolAssessment;
  const nativeMalnutrition = nativeEvaluation?.nativeStatus === 'COMPLETE' ? nativeEvaluation.normalizedMalnutrition : 'UNKNOWN';
  const { safetyFlags, dataQualityFlags, swallowingResolution } = getSafetyAndQuality(context, answers, swallowingScreening, nativeMalnutrition);

  if (!assessmentStatus.isComplete) {
    return {
      tool,
      native: 'Incomplete assessment',
      nutritionRisk: 'UNKNOWN',
      malnutrition: 'UNKNOWN',
      priority: safetyFlags.includes('Refeeding risk') ? 'RED' : 'GRAY',
      safetyFlags,
      dataQualityFlags,
      effectiveSwallowingStatus: swallowingResolution.status,
      swallowingSafetyReason: swallowingResolution.reason,
      reasons: ['Required assessment fields are missing', ...safetyFlags, ...dataQualityFlags],
      assessmentStatus: 'INCOMPLETE'
    };
  }

  const priority = getClinicalPriority(answers, intake, safetyFlags, dataQualityFlags, nativeEvaluation);
  const nativeComplete = nativeEvaluation.nativeStatus === 'COMPLETE';
  const native = nativeComplete ? nativeEvaluation.nativeCategory : '原始評估未完成';
  const reasons = [...new Set([
    native,
    intake,
    ...safetyFlags,
    ...dataQualityFlags,
    ...(recommendation?.modifiers || []).map((item) => modifierLabels[item]).filter(Boolean)
  ])];

  return {
    tool,
    native,
    nativeScore: nativeComplete ? nativeEvaluation.nativeScore : null,
    nativeCategory: nativeComplete ? nativeEvaluation.nativeCategory : '',
    nativeStatus: nativeEvaluation.nativeStatus,
    sourceMode: nativeEvaluation.sourceMode,
    completedAt: nativeEvaluation.completedAt,
    answered: nativeEvaluation.answered,
    total: nativeEvaluation.total,
    percent: nativeEvaluation.percent,
    missing: nativeEvaluation.missing,
    invalid: nativeEvaluation.invalid,
    nutritionRisk: nativeComplete ? nativeEvaluation.normalizedNutritionRisk : 'UNKNOWN',
    malnutrition: nativeComplete ? nativeEvaluation.normalizedMalnutrition : 'UNKNOWN',
    priority,
    safetyFlags,
    dataQualityFlags,
    effectiveSwallowingStatus: swallowingResolution.status,
    swallowingSafetyReason: swallowingResolution.reason,
    reasons,
    assessmentStatus: nativeComplete ? 'COMPLETE' : 'TOOL_SCORE_PENDING'
  };
}

export function getRoute(context, answers, result, swallowingScreening) {
  const oralSafety = resolveSwallowingSafety(
    answers.swallow || context.oralSafety,
    context.modifiers.dysphagia,
    swallowingScreening
  ).status;
  const gi = answers.gi || context.giFunction;
  const intake = answers.intake || context.intake;
  const refeedingRisk = result.safetyFlags.includes('Refeeding risk') || result.safetyFlags.includes('Refeeding screen required');
  const conditionForRefeeding = (route) => {
    if (!refeedingRisk) return route;
    if (route.level === 'Pending') {
      return {
        ...route,
        title: `${route.title}；任何營養供應增加前先完成再餵食安全流程`,
        why: [...route.why, '增加營養供應前需完成再餵食安全流程']
      };
    }
    return {
      ...route,
      title: `完成再餵食安全流程後，${route.title}`,
      status: 'CONDITIONAL',
      why: [...route.why, '增加營養供應前需完成再餵食安全流程']
    };
  };

  if (gi === 'uncertain' || !gi) {
    return conditionForRefeeding({
      level: 'Pending',
      title: '先確認胃腸道可用性，再評估 EN／PN 適用性',
      status: 'PENDING_ASSESSMENT',
      why: ['胃腸道可用性尚未確認']
    });
  }

  if (gi === 'unavailable') {
    return conditionForRefeeding({
      level: 'R4',
      title: '評估 PN 適用性',
      status: 'ASSESS_APPROPRIATENESS',
      why: ['胃腸道無法使用', '無法以口服或腸道營養途徑滿足需求']
    });
  }

  if (context.dietStatus === 'NPO') {
    return conditionForRefeeding({
      level: 'Pending',
      title: '目前為 NPO；先確認 NPO 原因與解除條件，再評估營養支持適用性',
      status: 'PENDING_ASSESSMENT',
      why: [`NPO 原因：${context.npoReason || '尚未評估'}`, 'NPO 期間不可直接建議口服進食']
    });
  }

  if (context.dietStatus === '管灌') {
    return conditionForRefeeding({
      level: 'R3',
      title: '檢視目前 EN 適用性、供應量與胃腸耐受性',
      status: 'CONTINUE_AND_REVIEW',
      why: ['目前途徑為管灌腸道營養', '胃腸道可使用']
    });
  }

  if (oralSafety !== 'safe') {
    return conditionForRefeeding({
      level: 'R3',
      title: oralSafety === 'unsafe' ? '口服進食不安全，評估 EN 適用性' : '先完成吞嚥安全評估，必要時評估 EN 適用性',
      status: oralSafety === 'unsafe' ? 'ASSESS_APPROPRIATENESS' : 'PENDING_ASSESSMENT',
      why: ['口服進食安全未通過', '胃腸道可使用']
    });
  }

  if (intake === 'not assessed' || !intake) {
    return conditionForRefeeding({
      level: 'Pending',
      title: '先確認目前攝取量，再決定營養介入層級',
      status: 'PENDING_ASSESSMENT',
      why: ['攝取充足度尚未確認']
    });
  }

  if (intake === '>=75%') {
    return conditionForRefeeding({
      level: 'R0',
      title: '維持治療飲食並追蹤口服攝取量',
      status: 'RECOMMENDED',
      why: ['口服進食安全', '目前攝取量充足']
    });
  }

  return conditionForRefeeding({
    level: result.priority === 'RED' ? 'R2' : 'R1',
    title: '優化口服營養，並考慮 ONS',
    status: 'RECOMMENDED',
    why: ['口服進食安全', '目前攝取不足', '若持續不足再評估 EN']
  });
}

export function getResultTone(domain, value) {
  if (value === 'HIGH' || value === 'SEVERE' || value === 'MALNOURISHED' || value === 'RED') return 'red';
  if (value === 'AT_RISK' || value === 'MODERATE' || value === 'AMBER') return 'amber';
  if (value === 'UNKNOWN' || value === 'NOT_APPLICABLE' || value === 'NOT_ASSESSED' || value === 'GRAY') return 'gray';
  return 'green';
}
