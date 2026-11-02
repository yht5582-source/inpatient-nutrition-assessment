import {
  getContextValidation,
  getRecommendation,
  getRoute,
  normalizeResult
} from './clinicalLogic.js';
import {
  createInitialToolAssessments,
  evaluateToolAssessment,
  getLocalDateString,
  updateToolAssessment
} from './toolAssessments.js';
import {
  createInitialSwallowingAssessments,
  updateSwallowingAssessment
} from './swallowingAssessments.js';

export const teachingViews = [
  { id: 'cases', title: '示範病例', subtitle: '6 例，可帶入工具' },
  { id: 'quiz', title: '考題', subtitle: '一般、高階各 10 題' },
  { id: 'map', title: '心智圖', subtitle: '整體判斷路徑' }
];

export const sources = {
  kondrup: {
    label: 'Kondrup 2003，ESPEN Guidelines for Nutrition Screening 2002（NRS-2002 Table 1–2）',
    url: 'https://www.espen.org/documents/Screening.pdf'
  },
  glim: {
    label: 'Cederholm 2019，GLIM criteria（Table 3–4）',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6438340/'
  },
  heyland: {
    label: 'Heyland 2011，NUTRIC score（Table 4）',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3388687/'
  },
  sccm: {
    label: 'McClave 2016，SCCM／ASPEN 重症營養指引（A1、B1、C4、G1）',
    url: 'https://doi.org/10.1177/0148607115621863'
  },
  aspenRs: {
    label: 'da Silva 2020，ASPEN 再餵食症候群共識（Table 3、6）',
    url: 'https://doi.org/10.1002/ncp.10474'
  },
  kaiser: {
    label: 'Kaiser 2009，MNA-SF 驗證（0–7／8–11／12–14）',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12878690/'
  },
  kdoqi: {
    label: 'KDOQI 2020 CKD 營養指引（1.5.1、3.0.3、3.1.1）',
    url: 'https://www.ajkd.org/article/S0272-6386(20)30726-5/fulltext'
  },
  espenLiver: {
    label: 'ESPEN 2019 肝病營養指引（Rec 52–53、63–64）',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6686849/'
  },
  rfh: {
    label: 'Wang 2021，RFH-NPT 分級（低 0、中 1、高 2–7）',
    url: 'https://www.frontiersin.org/journals/nutrition/articles/10.3389/fnut.2021.766350/full'
  },
  pgsga: {
    label: 'J Hum Nutr Diet 研究，PG-SGA SF 4–8 有風險、≥9 高風險（摘要）',
    url: 'https://doi.org/10.1111/jhn.70359'
  },
  guss: {
    label: '臺灣版 GUSS-T 正式表單與指導手冊',
    url: 'https://www.donau-uni.ac.at/dam/jcr%3Ab58a247c-f865-4e7f-aca7-350cb4b5d580/GUSS%20Taiwan%20incl%20instructions.pdf'
  },
  rsst: {
    label: 'RSST 原始效度研究',
    url: 'https://doi.org/10.2490/jjrm1963.37.383'
  }
};

const noModifiers = { heartFailure: false, dysphagia: false, edemaAscites: false, refeeding: false, poorIntake: false };
const noPathways = { ICU: false, LIVER: false, RENAL: false, ONCOLOGY: false, GERIATRIC: false, GENERAL: false };

export const demoCases = [
  {
    id: 'general-surgery',
    tag: '一般成人｜NRS-2002',
    title: '大腸術後攝取差：篩檢陽性不等於營養不良',
    vignette: '58 歲男性，反覆憩室炎，乙狀結腸切除術後第 5 天。平常體重 64.5 kg，3 個月內降到 60 kg（−7%）。入院以來連續 9 天攝取約需求的 45%，吞嚥正常，腸道可用。',
    context: {
      patientName: '示範一', age: 58, sex: '男', ward: '一般病房', bed: '示範-1', admissionDay: 9,
      height: 168, weight: 60, diagnosis: '手術／術後', dietStatus: '軟質飲食',
      pathways: { GENERAL: true }
    },
    answers: { intake: '25-49%', intakeDuration: '>7 天', weightLoss: '是，輕度', muscleLoss: '輕度', gi: 'functional', swallow: 'safe' },
    toolAnswers: {
      initialBmiLow: 'no', initialWeightLoss: 'yes', initialReducedIntake: 'yes', initialSevereIllness: 'no',
      nutritionScore: '2', diseaseScore: '2'
    },
    expected: {
      tool: 'NRS-2002', score: 4, category: '有營養風險', risk: 'AT_RISK', malnutrition: 'NOT_APPLICABLE',
      priority: 'AMBER', routeLevel: 'R1', routeStatus: 'CONDITIONAL', safetyFlags: ['Refeeding screen required'], qualityFlags: []
    },
    reasoning: [
      '體重 3 個月 >5% 只有 1 分，但前一週攝取 25–60% 為 2 分，營養狀態取最高的一項：2 分。',
      '重大腹部手術 2 分；未滿 70 歲不加分，總分 4，達 ≥3 的風險門檻。',
      '工具把結果放在「營養風險」，「營養不良狀態」顯示不適用：NRS-2002 只是篩檢。'
    ],
    points: [
      '要下營養不良診斷需走 GLIM 第二步：體重下降 7%（6 個月內 5–10%）為外表型準則、攝取 ≤50% 超過 1 週為病因準則，分級 Stage 1。',
      'GLIM 由臨床人員判定，本工具目前不計算。',
      '口服安全且攝取不足時，先優化口服並考慮 ONS；持續不足才評估 EN。',
      '攝取 <50% 超過 5 天的急性病況，單項即符合 ASPEN 明顯再餵食風險。此例已 9 天，工具自動要求再餵食篩檢，ONS 建議變成完成流程後才執行。'
    ],
    refs: ['kondrup', 'glim', 'aspenRs']
  },
  {
    id: 'geriatric-dysphagia',
    tag: '高齡｜MNA-SF＋吞嚥篩檢',
    title: '高齡衰弱：RSST 陰性不能蓋掉 GUSS-T 異常',
    vignette: '84 歲女性，衰弱，肺炎治療中。身高 150 cm、體重 41 kg（BMI 18.2）。攝取少於需求一半已 8 天。護理紀錄寫「吞嚥正常」，但床邊喝水會嗆。官方 MNA-SF 9 分。RSST 3 次／30 秒；GUSS-T 半固體通過，液體延遲吞嚥、嗆咳且聲音濕濡。',
    context: {
      patientName: '示範二', age: 84, sex: '女', ward: '一般病房', bed: '示範-2', admissionDay: 8,
      height: 150, weight: 41, diagnosis: '高齡衰弱', dietStatus: '軟質飲食',
      pathways: { GERIATRIC: true }
    },
    answers: { intake: '25-49%', intakeDuration: '>7 天', weightLoss: '是，輕度', muscleLoss: '中度', gi: 'functional', swallow: 'safe' },
    toolAnswers: { officialScore: '9', officialCategory: '有營養不良風險', confirmed: true },
    swallowing: {
      assessorRole: '護理師',
      'GUSS-T': {
        indirect: { alertness: 'yes', voluntaryCough: 'yes', salivaSwallow: 'yes', drooling: 'no', voiceChange: 'no' },
        semisolid: { swallow: 'successful', involuntaryCough: 'no', drooling: 'no', voiceChange: 'no' },
        liquid: { swallow: 'delayed', involuntaryCough: 'yes', drooling: 'no', voiceChange: 'yes' }
      },
      RSST: { swallowCount: '3' }
    },
    expected: {
      tool: 'MNA-SF', score: 9, category: '有營養不良風險', risk: 'AT_RISK', malnutrition: 'UNKNOWN',
      priority: 'AMBER', routeLevel: 'R3', routeStatus: 'CONDITIONAL',
      safetyFlags: ['Swallowing safety pending', 'Refeeding screen required'], qualityFlags: [], gussScore: 12
    },
    reasoning: [
      '未符合其他疾病路徑，年齡 ≥65，首選 MNA-SF；9 分落在 8–11 有風險，分數由官方工具回填，本站不重算。',
      'GUSS-T：間接 5＋半固體 5＋液體 2＝12 分，液體階段停止，屬中度吞嚥障礙伴吸入風險。',
      '吞嚥安全採最高風險優先：人工「安全」與 RSST 陰性都不能覆蓋 GUSS-T，途徑轉為先完成吞嚥評估。'
    ],
    points: [
      'GUSS-T 10–14 分的表單建議：泥狀質地（IDDSI 3–4）、所有液體增稠，並可考慮 FEES／VFSS 或轉介語言治療。',
      'MNA-SF「有風險」不代表程度輕：BMI 18.2、≥70 歲已達 GLIM Stage 2 的 BMI 門檻（<20），亞洲 BMI 分級仍待共識，需臨床確認。',
      '此例攝取 <50% 已 8 天，單項即符合 ASPEN 明顯風險，工具自動要求再餵食篩檢。工具不看 BMI，BMI 與合併症仍需人工判斷。'
    ],
    refs: ['kaiser', 'guss', 'rsst', 'glim', 'aspenRs']
  },
  {
    id: 'renal-hd-hf',
    tag: '透析＋心衰竭｜7-point SGA',
    title: '透析合併水腫：BMI 正常但嚴重營養不良',
    vignette: '76 歲男性，血液透析合併心衰竭。測量體重 67.2 kg，乾體重 63.5 kg，身高 165 cm（以測量體重算 BMI 24.7）。近期體重持續下降，攝取約需求的三到四成已約 2 週。皮下脂肪與肌肉皆嚴重流失，營養師整體評定 2 分。',
    context: {
      patientName: '示範三', age: 76, sex: '男', ward: '透析病房', bed: '示範-3', admissionDay: 3,
      height: 165, weight: 67.2, dryWeight: 63.5, diagnosis: '腎臟病／透析', dietStatus: '一般飲食', renalModality: 'HD',
      pathways: { RENAL: true }, modifiers: { heartFailure: true, edemaAscites: true }
    },
    answers: { intake: '25-49%', intakeDuration: '>7 天', weightLoss: '是，明顯', muscleLoss: '嚴重', gi: 'functional', swallow: 'safe' },
    toolAnswers: {
      weightChange: 'loss', intakeChange: 'marked_reduction', giSymptoms: 'mild', functionalCapacity: 'reduced',
      diseaseBurden: 'high', subcutaneousFat: 'severe', muscleWasting: 'severe', overallScore: '2'
    },
    expected: {
      tool: '7-point SGA', score: 2, category: '嚴重營養不良', risk: 'NOT_APPLICABLE', malnutrition: 'SEVERE',
      priority: 'RED', routeLevel: 'R2', routeStatus: 'CONDITIONAL',
      safetyFlags: ['Refeeding screen required'], qualityFlags: ['Fluid-affected weight'], referenceWeight: 63.5
    },
    reasoning: [
      '路徑優先序：ICU > 肝硬化 > 透析 > 癌症 > 高齡 > 一般。76 歲只保留為修飾因子，不改走 MNA-SF。',
      '7-point SGA 是營養師整體評定，不由七個欄位加總；本工具把 1–2 分對應到嚴重營養不良。',
      '嚴重營養不良自動要求再餵食風險篩檢，因此 ONS 建議變成「完成再餵食安全流程後」。'
    ],
    points: [
      '水腫時參考體重改用乾體重 63.5 kg，測量值 67.2 kg 保留、不被覆蓋。BMI 正常不能排除營養不良。',
      'KDOQI 2020 建議 CKD 5D 成人以 7-point SGA 評估營養狀態（1B）。',
      '代謝穩定的透析病人蛋白質 1.0–1.2 g/kg/d、熱量 25–35 kcal/kg/d（KDOQI）；此例需個別調整，並與團隊協調水分、鈉、鉀、磷。'
    ],
    refs: ['kdoqi', 'aspenRs']
  },
  {
    id: 'cirrhosis-ascites',
    tag: '肝硬化＋腹水｜RFH-NPT',
    title: '酒精性肝硬化合併腹水：走體液超載分支',
    vignette: '62 歲男性，酒精性肝硬化併大量腹水與食道靜脈曲張，無酒精性肝炎、未管灌。體重 72 kg，估計乾體重 64 kg，身高 170 cm。腹脹時有時吃不完正餐，最近 6 天攝取減少超過一半，因使用利尿劑難判斷體重變化。',
    context: {
      patientName: '示範四', age: 62, sex: '男', ward: '一般病房', bed: '示範-4', admissionDay: 6,
      height: 170, weight: 72, dryWeight: 64, diagnosis: '肝硬化／肝病', dietStatus: '一般飲食',
      pathways: { LIVER: true }, modifiers: { edemaAscites: true, refeeding: true }
    },
    answers: { intake: '25-49%', intakeDuration: '6-7 天', weightLoss: '不確定', muscleLoss: '中度', gi: 'functional', swallow: 'safe' },
    toolAnswers: {
      alcoholicHepatitis: 'no', tubeFeeding: 'no', fluidOverload: 'yes',
      incompleteMealsFromFluid: 'sometimes', intakeReducedFifty: 'yes', fluidWeightLoss: 'uncertain'
    },
    expected: {
      tool: 'RFH-NPT', score: 5, category: '高風險', risk: 'HIGH', malnutrition: 'NOT_APPLICABLE',
      priority: 'RED', routeLevel: 'R2', routeStatus: 'CONDITIONAL',
      safetyFlags: ['Refeeding risk'], qualityFlags: ['Fluid-affected weight'], referenceWeight: 64
    },
    reasoning: [
      '有體液超載，不用 BMI 分支：體液超載 1＋有時吃不完 1＋攝取減少 >50% 2＋體重難判斷 1＝5 分。',
      'RFH-NPT 低 0、中 1、高 2–7，5 分為高風險，處置優先度為紅色。',
      '攝取 <50% 超過 5 天的急性病況，單項即符合 ASPEN 明顯風險；臨床評估後勾選再餵食風險，途徑因此變有條件。'
    ],
    points: [
      'ESPEN：RFH-NPT 辨識肝病營養風險比 NRS-2002 更敏感。腹水使體重與 BMI 難以解讀，參考體重改用估計乾體重。',
      '營養不良或肌少的肝硬化病人蛋白質 1.5 g/kg/d（Rec 53）。',
      '需要 EN 時，食道靜脈曲張不是鼻胃管的絕對禁忌（Rec 63）；PEG 因腹水與靜脈曲張併發症較高，僅例外使用（Rec 64）。'
    ],
    refs: ['rfh', 'espenLiver', 'aspenRs']
  },
  {
    id: 'oncology-aspiration',
    tag: '活動性癌症｜PG-SGA SF',
    title: '頭頸癌放化療：口服不安全時先過再餵食關',
    vignette: '66 歲女性，下咽癌同步放化療，嚴重黏膜炎。平常體重 49 kg，3 個月降到 43 kg（−12%），身高 155 cm（BMI 17.9）。攝取不到需求的四分之一。VFSS 顯示吸入，腸道可用。官方 PG-SGA SF 11 分。',
    context: {
      patientName: '示範五', age: 66, sex: '女', ward: '一般病房', bed: '示範-5', admissionDay: 2,
      height: 155, weight: 43, diagnosis: '活動性癌症', dietStatus: '軟質飲食',
      pathways: { ONCOLOGY: true }
    },
    answers: { intake: '<25% 或幾乎無攝取', weightLoss: '是，明顯', muscleLoss: '中度', gi: 'functional', swallow: 'unsafe' },
    toolAnswers: { officialScore: '11', officialCategory: '9 分以上', confirmed: true },
    expected: {
      tool: 'PG-SGA SF', score: 11, category: '9 分以上', risk: 'HIGH', malnutrition: 'NOT_APPLICABLE',
      priority: 'RED', routeLevel: 'R3', routeStatus: 'CONDITIONAL',
      safetyFlags: ['Oral feeding unsafe', 'Refeeding screen required'], qualityFlags: []
    },
    reasoning: [
      '活動性癌症優先於高齡路徑，首選 PG-SGA SF；11 分落在 ≥9，對應高風險。',
      '口服不安全、腸道可用：途徑是評估 EN 適用性，而不是加 ONS。',
      '攝取極低與體重明顯下降啟動再餵食篩檢，EN 評估變成「完成再餵食安全流程後」。'
    ],
    points: [
      'ASPEN：3 個月體重下降 7.5% 單項即明顯風險。餵食前查鉀、鎂、磷，給 thiamin 100 mg；首 24 小時 100–150 g 葡萄糖或 10–20 kcal/kg，每 1–2 天增加目標的 33%。',
      'GLIM：體重 6 個月內 >10%、BMI <18.5（<70 歲）都達 Stage 2。',
      '工具只提示評估 EN，不開立醫囑；途徑與時機由團隊決定。'
    ],
    refs: ['pgsga', 'aspenRs', 'glim']
  },
  {
    id: 'icu-pn',
    tag: 'ICU｜mNUTRIC',
    title: '敗血性休克術後：腸道不可用時評估 PN',
    vignette: '72 歲男性，住院 2 天後因腸穿孔敗血性休克手術，腸道不連續，插管入 ICU。APACHE II 26、SOFA 11、共病 3 項。身高 172 cm、體重 70 kg。目前 NPO，近日幾乎無攝取。',
    context: {
      patientName: '示範六', age: 72, sex: '男', ward: '加護病房 ICU', bed: '示範-6', admissionDay: 3,
      height: 172, weight: 70, diagnosis: '重症／敗血症', dietStatus: 'NPO', npoReason: 'GI contraindication',
      pathways: { ICU: true }
    },
    answers: { intake: '<25% 或幾乎無攝取', weightLoss: '否', muscleLoss: '輕度', gi: 'unavailable', swallow: 'not assessed' },
    toolAnswers: { apacheIi: '26', sofa: '11', comorbidities: '3', preIcuDays: '2' },
    expected: {
      tool: 'mNUTRIC', score: 7, category: '高分', risk: 'HIGH', malnutrition: 'NOT_APPLICABLE',
      priority: 'RED', routeLevel: 'R4', routeStatus: 'CONDITIONAL',
      safetyFlags: ['Swallowing safety pending', 'Refeeding screen required'], qualityFlags: []
    },
    reasoning: [
      '計分：年齡 50–74 為 1、APACHE II 20–27 為 2、SOFA ≥10 為 2、共病 ≥2 為 1、入 ICU 前 ≥1 天為 1，合計 7。',
      '無 IL-6 版本 ≥5 為高分，對應高營養風險；這不是營養不良診斷。',
      '腸道不可用時先判 R4，不等吞嚥評估：工具提示評估 PN 適用性，再加上再餵食條件。'
    ],
    points: [
      'SCCM／ASPEN：能用腸道者 24–48 小時內開始 EN；高風險或營養不良且 EN 不可行時，應儘早開始 PN。',
      '低風險、原本營養尚可者若 EN 不可行，前 7 天不給 exclusive PN（G1）。',
      'SCCM／ASPEN 引用的 NUTRIC ≥5 同時寫「低風險 ≤5」，邊界 5 分有重疊；本工具將 5 分列為高分。'
    ],
    refs: ['heyland', 'sccm', 'aspenRs']
  }
];

export function buildCaseState(caseData, baseContext, now = new Date()) {
  const { answers } = caseData;
  const context = {
    ...baseContext,
    ...caseData.context,
    intake: answers.intake,
    giFunction: answers.gi,
    oralSafety: answers.swallow,
    pathways: { ...noPathways, ...caseData.context.pathways },
    modifiers: { ...noModifiers, ...caseData.context.modifiers }
  };
  const tool = caseData.expected.tool;
  const toolAnswers = { ...caseData.toolAnswers };
  if (toolAnswers.confirmed) toolAnswers.completedDate = getLocalDateString(now);
  const toolAssessments = updateToolAssessment(createInitialToolAssessments(), tool, toolAnswers, context, now.toISOString());

  let swallowingAssessments = createInitialSwallowingAssessments();
  if (caseData.swallowing) {
    const { assessorRole, ...records } = caseData.swallowing;
    swallowingAssessments = { ...swallowingAssessments, assessorRole, selectedTools: Object.keys(records) };
    Object.entries(records).forEach(([toolId, patch]) => {
      swallowingAssessments = updateSwallowingAssessment(swallowingAssessments, toolId, patch, now);
    });
  }

  return { context, answers: { ...answers }, toolAssessments, swallowingAssessments };
}

export function evaluateCase(caseData, baseContext, now = new Date()) {
  const state = buildCaseState(caseData, baseContext, now);
  const recommendation = getRecommendation(state.context);
  const native = evaluateToolAssessment(recommendation.primaryTool, state.toolAssessments[recommendation.primaryTool], state.context);
  const result = normalizeResult(state.context, state.answers, recommendation, '', native, state.swallowingAssessments);
  const route = getRoute(state.context, state.answers, result, state.swallowingAssessments);
  return { ...state, recommendation, native, result, route, validation: getContextValidation(state.context) };
}

export const quizQuestions = [
  {
    id: 'q1', level: '一般', answer: 'C',
    stem: '76 歲血液透析病人合併心衰竭，住一般病房。本工具的首選評估工具是？',
    options: {
      A: 'MNA-SF（年齡 ≥65 優先）',
      B: 'NRS-2002（一般住院病人的篩檢）',
      C: '7-point SGA（透析路徑）',
      D: 'mNUTRIC（病情複雜者）'
    },
    explain: '路徑優先序為 ICU > 肝硬化 > 透析 > 癌症 > 高齡 > 一般。年齡與心衰竭保留為修飾因子，不改變首選工具。',
    refs: ['kdoqi']
  },
  {
    id: 'q2', level: '一般', answer: 'B',
    stem: '71 歲病人，NRS-2002 營養狀態 1 分、疾病嚴重度 1 分。正確解讀是？',
    options: {
      A: '2 分，每週重新篩檢',
      B: '3 分，有營養風險，啟動照護計畫',
      C: '3 分，已可直接診斷為營養不良',
      D: '2 分，不需要再篩檢'
    },
    explain: '≥70 歲總分加 1，合計 3 分，達風險門檻。<3 分才是每週重篩。NRS-2002 是篩檢，不是診斷。另外 SCCM／ASPEN 文字寫 risk 為 >3、high risk 為 ≥5，與 Kondrup 原表的 ≥3 不同，本工具採原表。',
    refs: ['kondrup', 'sccm']
  },
  {
    id: 'q3', level: '一般', answer: 'A',
    stem: '共同臨床資料都已填，攝取 ≥75%、無體重下降與肌肉流失、吞嚥安全、腸道可用，但原始量表尚未完成。處置優先度顯示？',
    options: {
      A: '灰色：資料不足，不硬算結果',
      B: '綠色：共同資料皆正常',
      C: '琥珀色：一律先安排專業評估與介入',
      D: '紅色：未完成即視為高風險'
    },
    explain: '共同臨床資料不能用來推測量表分數。沒有紅色訊號時，原始評估未完成就維持灰色；完成量表且無警訊才是綠色。',
    refs: []
  },
  {
    id: 'q4', level: '一般', answer: 'D',
    stem: '60 歲 ICU 病人，APACHE II 16、SOFA 7、共病 2 項、住院 2 天後入 ICU，無 IL-6。mNUTRIC 結果是？',
    options: {
      A: '4 分，低分',
      B: '5 分，低分',
      C: '6 分，高分',
      D: '5 分，高分'
    },
    explain: '年齡 1、APACHE II 1、SOFA 1、共病 1、入 ICU 前天數 1，共 5 分。無 IL-6 版本以 ≥5 為高分；SCCM／ASPEN 註明含 IL-6 時門檻不同。',
    refs: ['heyland', 'sccm']
  },
  {
    id: 'q5', level: '一般', answer: 'C',
    stem: '82 歲住院病人，官方 MNA-SF 總分 9。分類是？',
    options: {
      A: '營養正常',
      B: '營養不良',
      C: '有營養不良風險',
      D: '分數無效，需重做'
    },
    explain: '修訂版 MNA-SF：0–7 營養不良、8–11 有風險、12–14 正常。本站只回填官方結果，不重製題目。',
    refs: ['kaiser']
  },
  {
    id: 'q6', level: '一般', answer: 'A',
    stem: '透析病人的 7-point SGA 七個欄位都勾選中度，營養師整體評定 4 分。本工具如何呈現？',
    options: {
      A: '4 分，輕至中度營養不良',
      B: '先把七個欄位加總後再做分類',
      C: '4 分，嚴重營養不良',
      D: '4 分，營養良好'
    },
    explain: '分數來自營養師整體評定，不由欄位加總。本工具對應：1–2 嚴重、3–5 輕至中度、6–7 營養良好。',
    refs: ['kdoqi']
  },
  {
    id: 'q7', level: '一般', answer: 'D',
    stem: '肝硬化病人目前接受管灌，BMI 24，近半年體重穩定。RFH-NPT 結果是？',
    options: {
      A: '低風險，BMI 正常',
      B: '中度風險，需下週再評',
      C: '要先算完 BMI 與體重分支',
      D: '高風險，不必再走後續分支'
    },
    explain: '酒精性肝炎或管灌任一為「是」就直接高風險，本工具記為 6 分。低 0、中 1、高 2–7。',
    refs: ['rfh']
  },
  {
    id: 'q8', level: '一般', answer: 'B',
    stem: '癌症病人官方 PG-SGA SF 總分 7。本工具的營養風險欄位顯示？',
    options: {
      A: '低風險（2–3 分區間）',
      B: '有風險（4–8 分區間）',
      C: '高風險（≥9 分區間）',
      D: '本站依症狀重新計分後才會顯示'
    },
    explain: 'PG-SGA SF 由官方工具完成後回填，本站不重新計分。4–8 分對應有風險，≥9 分對應高風險。',
    refs: ['pgsga']
  },
  {
    id: 'q9', level: '一般', answer: 'A',
    stem: '心衰竭合併水腫，測量體重 67.2 kg，乾體重 63.5 kg。需求計算的參考體重應如何處理？',
    options: {
      A: '用 63.5 kg，並保留 67.2 kg',
      B: '用 67.2 kg，因為是實測值',
      C: '取兩者平均 65.35 kg',
      D: '改用理想體重，並刪除實測值紀錄'
    },
    explain: '體液影響體重時優先使用乾體重，但測量值要保留不覆蓋。沒有乾體重時，工具標示「測量體重（需檢視）」。',
    refs: []
  },
  {
    id: 'q10', level: '一般', answer: 'C',
    stem: 'GUSS-T 間接測試 5 分、半固體 5 分、液體階段只得 2 分。下一步與結果是？',
    options: {
      A: '繼續測固體，總分未定',
      B: '20 分，可給正常飲食',
      C: '停止測試，12 分，中度吞嚥障礙',
      D: '停止測試，7 分，重度吞嚥障礙伴高吸入風險'
    },
    explain: '任一階段 1–4 分就停止。5＋5＋2＝12 分，落在 10–14 中度吞嚥障礙伴吸入風險。篩檢結果不等同診斷。',
    refs: ['guss']
  },
  {
    id: 'q11', level: '高階', answer: 'D',
    stem: '敗血症病人 NRS-2002 4 分，BMI 26、無體重下降、肌肉量正常，攝取 ≤50% 需求已 8 天。依 GLIM 能診斷營養不良嗎？',
    options: {
      A: '能，NRS ≥3 即為營養不良',
      B: '能，已有兩項病因準則',
      C: '不能，BMI ≥25 排除 GLIM',
      D: '不能，缺外表型準則'
    },
    explain: 'GLIM 先篩檢，再評估；診斷需至少 1 項外表型（體重下降、低 BMI、肌肉量減少）加 1 項病因（攝取或吸收下降、發炎或疾病負荷）。此例只有病因準則。應持續追蹤，因營養風險仍在。',
    refs: ['glim']
  },
  {
    id: 'q12', level: '高階', answer: 'B',
    stem: '72 歲病人 BMI 19.5，5 個月內體重下降 6%，攝取明顯減少。依 GLIM 表 4 的分級是？',
    options: {
      A: 'Stage 1，因體重下降 5–10%',
      B: 'Stage 2，因 BMI <20 且 ≥70 歲',
      C: '未達診斷，因兩項必須都達到同一級',
      D: '需再量肌肉量才可分級'
    },
    explain: '分級只需一項外表型達到該級。體重下降屬 Stage 1，但 ≥70 歲 BMI <20 已達 Stage 2，以較重者為準。GLIM 註明亞洲參考 BMI 仍需研究，實務應搭配肌肉量與臨床判斷。',
    refs: ['glim']
  },
  {
    id: 'q13', level: '高階', answer: 'C',
    stem: '人工判定口服安全，RSST 3 次／30 秒（陰性），GUSS-T 12 分。本工具的有效吞嚥安全是？',
    options: {
      A: '安全，兩項都不算嚴重',
      B: '不安全，只要任一篩檢異常就應禁食',
      C: '疑似吞嚥障礙，依據 GUSS-T',
      D: '結果矛盾，改列尚未評估'
    },
    explain: '複選時採最高風險優先。正常 RSST 或人工判定都不覆蓋異常 GUSS-T。GUSS-T ≤9 分才對應不安全，10–19 分為疑似吞嚥障礙。',
    refs: ['guss', 'rsst']
  },
  {
    id: 'q14', level: '高階', answer: 'A',
    stem: '肝硬化病人因嚴重感染住進 ICU，改用 NRS-2002 做專業調整。疾病嚴重度應給幾分？',
    options: {
      A: '3 分，依實際嚴重度',
      B: '1 分，肝硬化固定 1 分',
      C: '2 分，取兩類的中間值',
      D: '不給分，肝硬化不可用'
    },
    explain: 'Kondrup 明示同一診斷不一定同一分：肝硬化住 ICU 且嚴重感染應給 3 分，而不是 1 分。臨床判斷要看當下的代謝壓力。',
    refs: ['kondrup']
  },
  {
    id: 'q15', level: '高階', answer: 'D',
    stem: '依 ASPEN 成人標準，下列哪一項單獨存在就達「明顯（significant）」再餵食風險？',
    options: {
      A: 'BMI 17.5',
      B: '1 個月體重下降 5%',
      C: '無進食 5 天',
      D: 'BMI 15.5'
    },
    explain: '明顯風險只需 1 項，例如 BMI <16、3 個月體重下降 7.5%、無進食 >7 天。A、B、C 都是中度條件，需 2 項才成立。血中電解質正常也不能排除全身缺乏。',
    refs: ['aspenRs']
  },
  {
    id: 'q16', level: '高階', answer: 'B',
    stem: '再餵食高風險病人準備開始營養支持，電解質目前正常。哪一項符合 ASPEN 共識？',
    options: {
      A: '直接給足目標熱量，避免 underfeeding',
      B: '先給 thiamin 100 mg，首日 10–20 kcal/kg',
      C: '先測 thiamin 血中濃度，再決定補充',
      D: '不論血中數值，一律常規給預防性鉀、磷、鎂'
    },
    explain: '餵食或含糖點滴前給 thiamin 100 mg；首 24 小時 100–150 g 葡萄糖或 10–20 kcal/kg，每 1–2 天增加目標的 33%。常規 thiamin 濃度價值不高；電解質正常時是否預防性補充，共識未給建議。高風險者前 3 天每 12 小時監測。',
    refs: ['aspenRs']
  },
  {
    id: 'q17', level: '高階', answer: 'C',
    stem: '開始管灌第 2 天，血磷急速下降且不易矯正，尚未危及生命。ASPEN 建議的調整是？',
    options: {
      A: '維持速率，只加強補充電解質',
      B: '立即永久停止所有營養支持，等待恢復正常',
      C: '熱量減 50%，再每 1–2 天增加約 33%',
      D: '加速到目標，縮短低熱量期'
    },
    explain: '電解質難矯正或急降時，熱量或葡萄糖量減半，再依臨床每 1–2 天增加目標的約 33%。只有嚴重或危及生命時才考慮暫停。',
    refs: ['aspenRs']
  },
  {
    id: 'q18', level: '高階', answer: 'A',
    stem: '病人因手術 NPO，腸道可用，攝取 <25%，再餵食篩檢未做。本工具的營養途徑提示是？',
    options: {
      A: '先確認 NPO 原因與解除條件',
      B: '優化口服並立即加上 ONS',
      C: '直接評估 PN，因為目前完全無法由口進食',
      D: '維持治療飲食，追蹤攝取量'
    },
    explain: 'NPO 期間不可直接建議口服；腸道可用也不跳到 PN。工具列為待完成評估，並加註任何營養供應增加前先完成再餵食安全流程。',
    refs: []
  },
  {
    id: 'q19', level: '高階', answer: 'D',
    stem: 'ICU 病人 mNUTRIC 3 分，入院前營養良好，暫時無法使用 EN。依 SCCM／ASPEN 2016，第一週 PN 應如何考量？',
    options: {
      A: '入 ICU 24 小時內就開始 exclusive PN',
      B: '48 小時內開始 exclusive PN',
      C: '72 小時內開始 full PN',
      D: '前 7 天先不給 exclusive PN'
    },
    explain: 'G1：低營養風險者若無法自主進食且 EN 不可行，前 7 天不給 exclusive PN（證據品質很低）。高風險或嚴重營養不良者則應儘早開始。',
    refs: ['sccm', 'heyland']
  },
  {
    id: 'q20', level: '高階', answer: 'B',
    stem: '肝硬化合併腹水與食道靜脈曲張，口服無法達標，需要 EN。ESPEN 2019 的立場是？',
    options: {
      A: 'PEG 為首選，避免經過靜脈曲張',
      B: '可放鼻胃管，靜脈曲張非絕對禁忌',
      C: '靜脈曲張者一律改用 PN',
      D: '先限蛋白到 0.8 g/kg 再評估'
    },
    explain: 'Rec 63：食道靜脈曲張不是鼻胃管的絕對禁忌。Rec 64：PEG 因腹水或靜脈曲張併發症較高，僅例外使用。Rec 53：營養不良或肌少者蛋白質 1.5 g/kg/d。',
    refs: ['espenLiver']
  }
];

export const mindMap = {
  root: '成人住院營養評估',
  note: '風險、營養不良、處置優先度三者分開；工具提示評估，不開立醫囑。',
  branches: [
    {
      title: '1. 選工具', tone: 'teal',
      items: [
        { head: '路徑優先序', leaves: ['ICU → mNUTRIC', '肝硬化 → RFH-NPT', 'CKD5D／HD／PD → 7-point SGA', '活動性癌症 → PG-SGA SF', '≥65 歲 → MNA-SF', '一般成人 → NRS-2002'] },
        { head: '專業調整', leaves: ['可改選工具，必填原因', '<18 歲停止成人流程'] }
      ]
    },
    {
      title: '2. 原始結果', tone: 'blue',
      items: [
        { head: '站內計分', leaves: ['NRS-2002 ≥3 有風險；<3 每週重篩', 'mNUTRIC（無 IL-6）≥5 高分', 'RFH-NPT 0 低、1 中、2–7 高'] },
        { head: '整體評定', leaves: ['7-point SGA：1–2 嚴重、3–5 輕中度、6–7 良好', '不由欄位加總'] },
        { head: '官方回填', leaves: ['MNA-SF：0–7 不良、8–11 風險、12–14 正常', 'PG-SGA SF：4–8 有風險、≥9 高風險'] }
      ]
    },
    {
      title: '3. 三軸結果', tone: 'amber',
      items: [
        { head: '營養風險', leaves: ['篩檢工具的輸出', '不等於營養不良'] },
        { head: '營養不良', leaves: ['GLIM：1 外表型＋1 病因', 'Stage 2 只需一項外表型達標', '本工具僅由 SGA、MNA-SF 回寫'] },
        { head: '處置優先度', leaves: ['紅：高風險、嚴重營養不良、再餵食', '灰：原始評估未完成或關鍵資料不足', '琥珀：有風險或警訊', '綠：全部完成且無警訊'] }
      ]
    },
    {
      title: '4. 安全閘門', tone: 'red',
      items: [
        { head: '吞嚥', leaves: ['GUSS-T 20 輕微或無、10–19 疑似、≤9 不安全', 'RSST ≤2 次／30 秒為陽性', '最高風險優先，陰性不覆蓋'] },
        { head: '再餵食', leaves: ['攝取 <25%、25–49% 超過 5 天、體重明顯下降、嚴重肌肉流失或營養不良自動提示', 'BMI 與合併症需人工判斷', '先查鉀鎂磷、補 thiamin、漸進供應'] },
        { head: '資料可靠度', leaves: ['水腫腹水：用乾體重，保留實測', '腸道不確定：先確認再談 EN／PN'] }
      ]
    },
    {
      title: '5. 營養途徑', tone: 'green',
      items: [
        { head: '口服安全', leaves: ['R0 攝取足夠：治療飲食', 'R1 攝取不足：優化口服', 'R2 紅色或持續不足：ONS'] },
        { head: '口服不安全', leaves: ['R3 腸道可用：評估 EN', 'R4 腸道不可用：評估 PN'] },
        { head: '先處理', leaves: ['NPO：確認原因與解除條件', '再餵食風險：途徑改為有條件'] }
      ]
    },
    {
      title: '6. 疾病重點與追蹤', tone: 'gray',
      items: [
        { head: '透析', leaves: ['代謝穩定：蛋白 1.0–1.2 g/kg、熱量 25–35 kcal/kg', '協調水分、鈉、鉀、磷'] },
        { head: '肝硬化', leaves: ['營養不良或肌少：蛋白 1.5 g/kg', '靜脈曲張非鼻胃管絕對禁忌'] },
        { head: 'ICU', leaves: ['EN 24–48 小時內開始', '低風險：前 7 天不給 exclusive PN'] },
        { head: '重新評估', leaves: ['攝取、體重、電解質、實際供應量', '路徑或體液變化時提早重評'] }
      ]
    }
  ]
};
