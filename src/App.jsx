import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  ClipboardCheck,
  FileText,
  HeartPulse,
  Home,
  Info,
  ListChecks,
  RefreshCw,
  Save,
  ShieldAlert,
  Stethoscope,
  Syringe,
  UserRound,
  Utensils,
  Waves
} from 'lucide-react';

const steps = [
  { id: 'home', title: '首頁', subtitle: 'Home', icon: Home },
  { id: 'context', title: '病人背景', subtitle: 'Patient Context', icon: UserRound },
  { id: 'tool', title: '工具選擇', subtitle: 'Tool Selection', icon: Stethoscope },
  { id: 'assessment', title: '評估執行', subtitle: 'Assessment', icon: ClipboardCheck },
  { id: 'result', title: '臨床結果與營養照護組合', subtitle: 'Clinical Result + Nutrition Care Bundle', icon: FileText }
];

const pathwayMeta = {
  ICU: { label: 'ICU', tool: 'mNUTRIC', reason: '重症照護路徑', priority: 1 },
  LIVER: { label: 'cirrhosis', tool: 'RFH-NPT', reason: '肝硬化專屬營養風險', priority: 2 },
  RENAL: { label: 'CKD5D / HD / PD', tool: '7-point SGA', reason: '腎臟病 / 透析營養狀態評估', priority: 3 },
  ONCOLOGY: { label: 'active cancer', tool: 'PG-SGA SF', reason: '癌症營養風險與症狀 triage', priority: 4 },
  GERIATRIC: { label: 'geriatric', tool: 'MNA-SF', reason: '老年住院營養篩檢', priority: 5 },
  GENERAL: { label: 'general adult', tool: 'NRS-2002', reason: '一般成人住院營養風險篩檢', priority: 6 }
};

const modifierLabels = {
  heartFailure: 'heart failure',
  dysphagia: 'dysphagia',
  edemaAscites: 'edema / ascites',
  refeeding: 'refeeding risk',
  age65: 'age >=65',
  poorIntake: 'poor intake'
};

const toolRegistry = {
  'NRS-2002': { type: 'Nutrition screening', population: 'General adult inpatient', version: 'V1 hospital-approved' },
  'MNA-SF': { type: 'Geriatric screening', population: 'Age >=65', version: 'License review required' },
  '7-point SGA': { type: 'Nutrition assessment', population: 'CKD5D / dialysis', version: 'V1 hospital-approved' },
  'RFH-NPT': { type: 'Liver nutrition risk', population: 'Cirrhosis', version: 'License review required' },
  'PG-SGA SF': { type: 'Oncology triage', population: 'Active cancer', version: 'License review required' },
  mNUTRIC: { type: 'ICU nutrition risk', population: 'Critical care', version: 'V1 hospital-approved' }
};

const questions = [
  {
    id: 'intake',
    label: '目前攝取量約為估計需求的多少？',
    type: 'choice',
    options: ['>=75%', '50-74%', '25-49%', '<25% 或幾乎無攝取']
  },
  {
    id: 'weightLoss',
    label: '近期是否有非預期體重下降？',
    type: 'choice',
    options: ['否', '不確定', '是，輕度', '是，明顯']
  },
  {
    id: 'muscleLoss',
    label: '臨床觀察是否有肌肉流失？',
    type: 'choice',
    options: ['無', '輕度', '中度', '嚴重']
  },
  {
    id: 'gi',
    label: '目前 GI tract 是否可使用？',
    type: 'choice',
    options: ['functional', 'partially functional', 'uncertain', 'unavailable']
  },
  {
    id: 'swallow',
    label: 'Oral feeding safety',
    type: 'choice',
    options: ['safe', 'suspected dysphagia', 'unsafe', 'not assessed']
  }
];

const initialContext = {
  role: '營養師',
  patientName: '王大明',
  age: 76,
  sex: '男',
  ward: '一般病房',
  bed: '12A-03',
  admissionDay: 5,
  height: 168,
  weight: 67.2,
  dryWeight: 63.5,
  diagnosis: '肺炎合併食慾下降',
  intake: '25-49%',
  giFunction: 'functional',
  oralSafety: 'not assessed',
  pathways: {
    ICU: false,
    LIVER: false,
    RENAL: true,
    ONCOLOGY: false,
    GERIATRIC: true,
    GENERAL: false
  },
  modifiers: {
    heartFailure: true,
    dysphagia: true,
    edemaAscites: true,
    refeeding: true,
    poorIntake: true
  }
};

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

function getPathway(context) {
  const selected = Object.entries(context.pathways)
    .filter(([, value]) => value)
    .map(([key]) => key);

  if (context.age >= 65 && !selected.includes('GERIATRIC')) selected.push('GERIATRIC');
  if (!selected.length) selected.push('GENERAL');

  return selected.sort((a, b) => pathwayMeta[a].priority - pathwayMeta[b].priority)[0];
}

function getRecommendation(context) {
  const primary = getPathway(context);
  const meta = pathwayMeta[primary];
  const modifiers = [];
  if (context.age >= 65) modifiers.push('age65');
  Object.entries(context.modifiers).forEach(([key, value]) => {
    if (value) modifiers.push(key);
  });

  const alternatives = Object.entries(pathwayMeta)
    .filter(([key]) => key !== primary)
    .slice(0, 4)
    .map(([key, value]) => ({
      tool: value.tool,
      use: value.reason,
      judgment: key === 'GENERAL' ? '後續使用' : '可追加'
    }));

  return {
    primary,
    primaryTool: meta.tool,
    primaryPathway: meta.label,
    reasons: [meta.reason, ...modifiers.map((item) => modifierLabels[item]).filter(Boolean)],
    modifiers,
    alternatives,
    nextStep: `開始 ${meta.tool}`
  };
}

function normalizeResult(context, answers, recommendation, overrideTool) {
  const tool = overrideTool || recommendation.primaryTool;
  const intake = answers.intake || context.intake;
  const severeSignals = [
    answers.muscleLoss === '嚴重',
    answers.weightLoss === '是，明顯',
    intake === '<25% 或幾乎無攝取',
    context.modifiers.refeeding
  ].filter(Boolean).length;
  const moderateSignals = [
    answers.muscleLoss === '中度',
    answers.weightLoss === '是，輕度',
    intake === '25-49%',
    context.modifiers.poorIntake
  ].filter(Boolean).length;

  let nutritionRisk = 'AT_RISK';
  let malnutrition = 'SUSPECTED';
  let native = 'At risk';

  if (tool === '7-point SGA') {
    nutritionRisk = 'NOT_APPLICABLE';
    malnutrition = severeSignals >= 2 ? 'SEVERE' : moderateSignals >= 2 ? 'MODERATE' : 'NO_MALNUTRITION';
    native = malnutrition === 'SEVERE' ? 'Severely malnourished' : malnutrition === 'MODERATE' ? 'Mild / moderate malnutrition' : 'Well nourished';
  } else if (tool === 'mNUTRIC') {
    nutritionRisk = severeSignals >= 1 ? 'HIGH' : 'LOW';
    malnutrition = 'NOT_ASSESSED';
    native = nutritionRisk === 'HIGH' ? 'High nutrition risk' : 'Lower nutrition risk';
  } else {
    nutritionRisk = severeSignals >= 1 ? 'HIGH' : moderateSignals >= 1 ? 'AT_RISK' : 'LOW';
    malnutrition = nutritionRisk === 'HIGH' ? 'SUSPECTED' : 'NOT_ASSESSED';
    native = nutritionRisk === 'HIGH' ? 'Positive / high concern' : nutritionRisk === 'AT_RISK' ? 'Positive' : 'Negative';
  }

  const safetyFlags = [];
  if (context.modifiers.dysphagia || answers.swallow === 'suspected dysphagia' || answers.swallow === 'unsafe') {
    safetyFlags.push('Swallowing safety pending');
  }
  if (context.modifiers.refeeding) safetyFlags.push('Refeeding risk');
  if (context.modifiers.edemaAscites || context.modifiers.heartFailure) safetyFlags.push('Fluid-affected weight');

  const gray = !answers.gi || answers.gi === 'uncertain' || answers.swallow === 'not assessed';
  const red = nutritionRisk === 'HIGH' || malnutrition === 'SEVERE' || safetyFlags.includes('Refeeding risk');
  const amber = nutritionRisk === 'AT_RISK' || malnutrition === 'MODERATE' || safetyFlags.length > 0;
  const priority = gray && safetyFlags.includes('Swallowing safety pending') ? 'GRAY' : red ? 'RED' : amber ? 'AMBER' : 'GREEN';

  return {
    tool,
    native,
    nutritionRisk,
    malnutrition,
    priority,
    safetyFlags,
    reasons: [
      native,
      intake,
      ...safetyFlags,
      ...recommendation.modifiers.map((item) => modifierLabels[item]).filter(Boolean)
    ]
  };
}

function getRoute(context, answers, result) {
  const oralSafety = answers.swallow || context.oralSafety;
  const gi = answers.gi || context.giFunction;
  const intake = answers.intake || context.intake;

  if (oralSafety !== 'safe') {
    return {
      level: gi === 'functional' || gi === 'partially functional' ? 'R3' : 'Pending',
      title: gi === 'unavailable' ? '評估 PN appropriateness' : '先完成吞嚥安全評估，必要時評估 EN appropriateness',
      status: 'PENDING_ASSESSMENT',
      why: ['Oral feeding safety 尚未確認', 'Dysphagia flag 會覆蓋一般 oral recommendation']
    };
  }

  if (gi === 'unavailable') {
    return {
      level: 'R4',
      title: '評估 PN appropriateness',
      status: 'CONSIDER',
      why: ['GI tract unavailable', '無法以 oral / enteral route 滿足需求']
    };
  }

  if (intake === '>=75%') {
    return {
      level: 'R0',
      title: '維持 therapeutic oral diet 並追蹤攝取',
      status: 'RECOMMENDED',
      why: ['Oral route safe', 'Intake currently adequate']
    };
  }

  return {
    level: result.priority === 'RED' ? 'R2' : 'R1',
    title: 'Optimize oral nutrition，並 consider ONS',
    status: 'RECOMMENDED',
    why: ['Oral route safe', '目前攝取不足', '若持續不足再評估 EN']
  };
}

function StepRail({ activeStep, setActiveStep }) {
  return (
    <aside className="step-rail">
      <div className="brand">
        <div className="brand-mark">
          <Utensils size={18} />
        </div>
        <div>
          <strong>住院病人營養評估</strong>
          <span>V1.0 Clinical Tool</span>
        </div>
      </div>
      <nav>
        {steps.map((step, index) => {
          const Icon = step.icon;
          const active = activeStep === step.id;
          return (
            <button key={step.id} className={cx('step-item', active && 'active')} onClick={() => setActiveStep(step.id)}>
              <span className="step-number">{index + 1}</span>
              <Icon size={19} />
              <span>
                <strong>{step.title}</strong>
                <small>{step.subtitle}</small>
              </span>
            </button>
          );
        })}
      </nav>
      <button className="outline-button full">
        <RefreshCw size={16} />
        評估歷史紀錄
      </button>
    </aside>
  );
}

function TopBar({ context, setContext }) {
  const bmi = (context.weight / Math.pow(context.height / 100, 2)).toFixed(1);
  return (
    <header className="topbar">
      <div className="patient-strip">
        <span>病人：{context.patientName}</span>
        <span>{context.age} 歲</span>
        <span>{context.sex}</span>
        <span>床號：{context.bed}</span>
        <span>住院日：第 {context.admissionDay} 天</span>
        <span>BMI：{bmi} kg/m²</span>
      </div>
      <div className="role-switch" aria-label="角色切換">
        {['醫師', '營養師', '護理師'].map((role) => (
          <button key={role} className={context.role === role ? 'selected' : ''} onClick={() => setContext({ ...context, role })}>
            {role}
          </button>
        ))}
      </div>
    </header>
  );
}

function HomeScreen({ setActiveStep, context, setContext }) {
  return (
    <section className="screen home-screen">
      <div className="home-intro">
        <div>
          <h1>成人住院病人營養評估</h1>
          <p>以 Patient Context 驅動工具推薦、安全閘門、feeding route 與 Nutrition Care Bundle。護理篩檢與專業評估可各自開始。</p>
        </div>
        <div className="version-box">
          <span>Scope</span>
          <strong>Adult V1</strong>
          <small>排除兒科、自動醫囑與未授權量表全文數位化</small>
        </div>
      </div>
      <div className="entry-grid">
        <button
          className="entry-panel"
          onClick={() => {
            setContext({ ...context, role: '護理師' });
            setActiveStep('context');
          }}
        >
          <ClipboardCheck size={24} />
          <strong>護理師營養篩檢</strong>
          <span>Nursing screen entry</span>
        </button>
        <button
          className="entry-panel primary"
          onClick={() => {
            setContext({ ...context, role: '營養師' });
            setActiveStep('context');
          }}
        >
          <Stethoscope size={24} />
          <strong>營養師 / 醫師專業評估</strong>
          <span>Professional assessment entry</span>
        </button>
      </div>
      <div className="workflow-band">
        {steps.slice(1).map((step) => (
          <div key={step.id} className="workflow-node">
            <span>{step.title}</span>
            <small>{step.subtitle}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function ContextScreen({ context, setContext, recommendation, setActiveStep, syncAssessmentField }) {
  const updatePathway = (key) => {
    setContext({ ...context, pathways: { ...context.pathways, [key]: !context.pathways[key] } });
  };
  const updateModifier = (key) => {
    setContext({ ...context, modifiers: { ...context.modifiers, [key]: !context.modifiers[key] } });
  };

  return (
    <section className="screen grid-screen">
      <main className="main-stack">
        <Panel title="Patient Context 病人背景資訊" action="V1.0.0">
          <div className="form-grid">
            <Field label="病人姓名" value={context.patientName} onChange={(value) => setContext({ ...context, patientName: value })} />
            <Field label="年齡" value={context.age} type="number" onChange={(value) => setContext({ ...context, age: Number(value) })} />
            <Field label="身高 cm" value={context.height} type="number" onChange={(value) => setContext({ ...context, height: Number(value) })} />
            <Field label="目前體重 kg" value={context.weight} type="number" onChange={(value) => setContext({ ...context, weight: Number(value) })} />
            <Field label="Dry weight kg" value={context.dryWeight} type="number" onChange={(value) => setContext({ ...context, dryWeight: Number(value) })} />
            <Field label="入院原因 / 診斷" value={context.diagnosis} onChange={(value) => setContext({ ...context, diagnosis: value })} />
          </div>
          <div className="select-row">
            <Select label="飲食狀態" value="軟質飲食" options={['一般飲食', '軟質飲食', 'NPO', '管灌']} />
            <Select label="進食情形" value={context.intake} options={['>=75%', '50-74%', '25-49%', '<25% 或幾乎無攝取']} onChange={(value) => syncAssessmentField('intake', value)} />
            <Select label="GI tract" value={context.giFunction} options={['functional', 'partially functional', 'uncertain', 'unavailable']} onChange={(value) => syncAssessmentField('gi', value)} />
            <Select label="Oral safety" value={context.oralSafety} options={['safe', 'suspected dysphagia', 'unsafe', 'not assessed']} onChange={(value) => syncAssessmentField('swallow', value)} />
          </div>
        </Panel>

        <Panel title="臨床路徑與特殊因子">
          <div className="toggle-grid">
            {Object.entries(pathwayMeta).map(([key, meta]) => (
              <Toggle key={key} active={context.pathways[key]} onClick={() => updatePathway(key)} label={meta.label} />
            ))}
            {Object.entries(modifierLabels)
              .filter(([key]) => key !== 'age65')
              .map(([key, label]) => (
                <Toggle key={key} active={context.modifiers[key]} onClick={() => updateModifier(key)} label={label} tone={key === 'refeeding' ? 'danger' : 'default'} />
              ))}
          </div>
        </Panel>

        <Panel title="推薦評估路徑（即時計算）">
          <div className="recommendation-row">
            <div>
              <small>主要評估工具</small>
              <strong>{recommendation.primaryTool}</strong>
              <span>{recommendation.primaryPathway}</span>
            </div>
            <div className="arrow-line" />
            <div>
              <small>下一步</small>
              <strong>{recommendation.nextStep}</strong>
              <span>可於下一頁 professional override</span>
            </div>
          </div>
          <div className="reason-list">
            {recommendation.reasons.slice(0, 5).map((reason) => (
              <span key={reason}>
                <BadgeCheck size={14} />
                {reason}
              </span>
            ))}
          </div>
        </Panel>
      </main>
      <SafetyPanel context={context} recommendation={recommendation} />
      <FooterActions back="回首頁" next="前往工具選擇" onBack={() => setActiveStep('home')} onNext={() => setActiveStep('tool')} />
    </section>
  );
}

function ToolScreen({ recommendation, overrideTool, setOverrideTool, setActiveStep }) {
  const registry = toolRegistry[overrideTool || recommendation.primaryTool];
  return (
    <section className="screen grid-screen">
      <main className="main-stack">
        <Panel title="系統建議">
          <div className="primary-rec">
            <div>
              <span className="eyeless">首選評估</span>
              <h2>{overrideTool || recommendation.primaryTool}</h2>
              <p>{registry.population} · {registry.type}</p>
            </div>
            <StatusChip tone="blue">{recommendation.primaryPathway}</StatusChip>
          </div>
          <div className="why-box">
            <strong>為什麼推薦？</strong>
            {recommendation.reasons.map((reason) => (
              <span key={reason}>
                <BadgeCheck size={15} />
                {reason}
              </span>
            ))}
          </div>
          <button className="primary-button" onClick={() => setActiveStep('assessment')}>
            開始 {overrideTool || recommendation.primaryTool}
          </button>
        </Panel>

        <Panel title="其他適用工具">
          <div className="table">
            <div className="table-head">
              <span>工具</span>
              <span>用途</span>
              <span>系統判斷</span>
            </div>
            {recommendation.alternatives.map((tool) => (
              <button key={tool.tool} className="table-row" onClick={() => setOverrideTool(tool.tool)}>
                <strong>{tool.tool}</strong>
                <span>{tool.use}</span>
                <StatusChip>{tool.judgment}</StatusChip>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Professional Override">
          <div className="override-grid">
            {Object.keys(toolRegistry).map((tool) => (
              <button key={tool} className={cx('choice-button', (overrideTool || recommendation.primaryTool) === tool && 'active')} onClick={() => setOverrideTool(tool)}>
                {tool}
              </button>
            ))}
          </div>
          <label className="text-area">
            <span>變更原因</span>
            <textarea defaultValue={overrideTool ? 'Clinical judgment / institutional protocol' : ''} placeholder="若改用其他工具，請輸入原因..." />
          </label>
        </Panel>
      </main>
      <aside className="side-panel">
        <Panel title="Tool Registry">
          <Meta label="Type" value={registry.type} />
          <Meta label="Target population" value={registry.population} />
          <Meta label="Version" value={registry.version} />
          <Meta label="Override" value="Allowed with audit trail" />
        </Panel>
      </aside>
      <FooterActions back="回病人背景" next="開始評估" onBack={() => setActiveStep('context')} onNext={() => setActiveStep('assessment')} />
    </section>
  );
}

function AssessmentScreen({ context, recommendation, overrideTool, answers, setAnswers, setActiveStep, syncAssessmentField }) {
  const updateAnswer = (questionId, value) => {
    if (['intake', 'gi', 'swallow'].includes(questionId)) {
      syncAssessmentField(questionId, value);
      return;
    }

    setAnswers({ ...answers, [questionId]: value });
  };

  return (
    <section className="screen grid-screen">
      <main className="main-stack">
        <Panel title={`${overrideTool || recommendation.primaryTool} 互動評估`} action="62%">
          <div className="progress"><span style={{ width: '62%' }} /></div>
          <div className="question-stack">
            {questions.map((question) => (
              <div className="question" key={question.id}>
                <strong>{question.label}</strong>
                <div className="option-row">
                  {question.options.map((option) => (
                    <button
                      key={option}
                      className={cx('option', answers[question.id] === option && 'active')}
                      onClick={() => updateAnswer(question.id, option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Computed values">
          <div className="metric-grid">
            <Metric label="BMI" value={(context.weight / Math.pow(context.height / 100, 2)).toFixed(1)} />
            <Metric label="Reference weight" value={`${context.dryWeight} kg`} note="Dry weight" />
            <Metric label="Weight reliability" value={context.modifiers.edemaAscites ? 'Fluid affected' : 'Reliable'} />
            <Metric label="Entry route" value={context.role === '護理師' ? 'NURSING_SCREEN' : 'PROFESSIONAL_ASSESSMENT'} />
          </div>
        </Panel>
      </main>
      <SafetyPanel context={context} recommendation={recommendation} answers={answers} />
      <FooterActions back="回工具選擇" next="查看臨床結果" onBack={() => setActiveStep('tool')} onNext={() => setActiveStep('result')} />
    </section>
  );
}

function ResultScreen({ context, recommendation, overrideTool, answers, setActiveStep }) {
  const result = normalizeResult(context, answers, recommendation, overrideTool);
  const route = getRoute(context, answers, result);
  return (
    <section className="screen result-screen">
      <Panel title="Clinical Summary">
        <div className="summary-line">
          <span>{context.age} 歲 {context.sex}性</span>
          <span>{context.ward}</span>
          <span>Primary pathway: {recommendation.primaryPathway}</span>
          <span>Assessment: {result.tool}</span>
          <span>Completed: 2026-08-13</span>
        </div>
      </Panel>

      <div className="result-grid">
        <ResultCard label="Nutrition Risk" value={result.nutritionRisk} tone={result.nutritionRisk === 'HIGH' ? 'red' : result.nutritionRisk === 'AT_RISK' ? 'amber' : 'green'} />
        <ResultCard label="Malnutrition" value={result.malnutrition} tone={result.malnutrition === 'SEVERE' ? 'red' : result.malnutrition === 'MODERATE' ? 'amber' : 'green'} />
        <ResultCard label="Action Priority" value={result.priority} tone={result.priority === 'RED' ? 'red' : result.priority === 'AMBER' ? 'amber' : result.priority === 'GRAY' ? 'gray' : 'green'} />
      </div>

      <div className="wide-grid">
        <Panel title="Native Result">
          <Meta label={result.tool} value={result.native} />
          <Meta label="Assessment domain" value={toolRegistry[result.tool].type} />
          <Meta label="Normalization" value="Native result preserved; mapped separately" />
        </Panel>
        <Panel title="Why this result?">
          <div className="reason-list vertical">
            {result.reasons.slice(0, 8).map((reason) => (
              <span key={reason}>
                <Info size={14} />
                {reason}
              </span>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Safety Alerts">
        <div className="alert-list">
          {result.safetyFlags.map((flag) => (
            <div key={flag} className="alert-row">
              <ShieldAlert size={18} />
              <div>
                <strong>{flag}</strong>
                <span>{flag === 'Refeeding risk' ? '營養供應增加前需完成 electrolyte / thiamine / advancement plan。' : '此條件會影響 feeding route 或資料可靠度。'}</span>
              </div>
              <StatusChip tone={flag === 'Refeeding risk' ? 'red' : 'amber'}>PENDING</StatusChip>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Nutrition Care Bundle">
        <div className="bundle-grid">
          <BundleItem icon={Stethoscope} title="Professional review" status={result.priority === 'RED' ? 'RECOMMENDED' : 'CONSIDER'} text="由營養師完成個別化 Nutrition Care Plan。" />
          <BundleItem icon={Utensils} title="Feeding route" status={route.status} text={route.title} />
          <BundleItem icon={Activity} title="Requirement profile" status="RECOMMENDED" text={`Reference weight: ${context.dryWeight} kg dry weight; renal / modifier rule set required.`} />
          <BundleItem icon={Waves} title="Fluid / electrolytes" status="CONSIDER" text="HF / renal / edema 情境需與治療團隊協調 fluid、Na、K、P。" />
        </div>
      </Panel>

      <Panel title="Monitoring & Reassessment">
        <div className="check-grid">
          {['Oral intake %', 'Weight / dry weight', 'Fluid balance', 'Electrolytes', 'GI tolerance', 'Swallow status', 'Nutrition intervention delivery', '48-72h or pathway-based reassessment'].map((item) => (
            <label key={item}>
              <input type="checkbox" defaultChecked />
              {item}
            </label>
          ))}
        </div>
      </Panel>

      <Panel title="Documentation Summary">
        <pre className="note-preview">{`Nutrition assessment summary
Primary pathway: ${recommendation.primaryPathway}
Assessment: ${result.tool}
Native result: ${result.native}
Nutrition risk: ${result.nutritionRisk}
Malnutrition status: ${result.malnutrition}
Clinical priority: ${result.priority}
Relevant modifiers: ${recommendation.modifiers.map((item) => modifierLabels[item]).filter(Boolean).join(', ')}
Nutrition care: ${route.title}
Safety: ${result.safetyFlags.join(', ') || 'No active safety flags'}`}</pre>
      </Panel>

      <FooterActions back="回評估" next="儲存評估" onBack={() => setActiveStep('assessment')} onNext={() => setActiveStep('home')} />
    </section>
  );
}

function SafetyPanel({ context, recommendation, answers = {} }) {
  const swallow = answers.swallow || context.oralSafety;
  const gi = answers.gi || context.giFunction;
  const alerts = [
    context.modifiers.refeeding && { tone: 'red', icon: AlertTriangle, title: 'High refeeding risk', text: '需完成院內 refeeding safety workflow' },
    (context.modifiers.dysphagia || swallow !== 'safe') && { tone: 'amber', icon: ShieldAlert, title: 'Swallowing safety pending', text: 'Oral feeding recommendation remains conditional' },
    context.modifiers.edemaAscites && { tone: 'blue', icon: Waves, title: 'Fluid-affected weight', text: `使用 dry weight ${context.dryWeight} kg 作為參考` },
    gi === 'uncertain' && { tone: 'gray', icon: Info, title: 'GI tract uncertain', text: 'EN escalation pending assessment' }
  ].filter(Boolean);

  return (
    <aside className="side-panel">
      <Panel title="Safety Gate 安全閘門" action={`需關注 ${alerts.length}`}>
        <div className="alert-list">
          {alerts.map((alert) => {
            const Icon = alert.icon;
            return (
              <div key={alert.title} className={cx('safety-alert', alert.tone)}>
                <Icon size={18} />
                <div>
                  <strong>{alert.title}</strong>
                  <span>{alert.text}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
      <Panel title="臨床修飾因子">
        <div className="modifier-list">
          {recommendation.modifiers.map((item) => (
            <div key={item}>
              <span>{modifierLabels[item]}</span>
              <StatusChip tone={item === 'refeeding' ? 'red' : item === 'dysphagia' ? 'amber' : 'green'}>{item === 'refeeding' ? '高' : '有'}</StatusChip>
            </div>
          ))}
        </div>
      </Panel>
    </aside>
  );
}

function Panel({ title, action, children }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
        {action && <span>{action}</span>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Select({ label, value, options, onChange }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange?.(event.target.value)}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function Toggle({ active, label, onClick, tone = 'default' }) {
  return (
    <button className={cx('toggle', active && 'active', tone)} onClick={onClick}>
      <span className="checkbox">{active ? '✓' : ''}</span>
      {label}
    </button>
  );
}

function StatusChip({ children, tone = 'default' }) {
  return <span className={cx('status-chip', tone)}>{children}</span>;
}

function Meta({ label, value }) {
  return (
    <div className="meta">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Metric({ label, value, note }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}

function ResultCard({ label, value, tone }) {
  return (
    <section className={cx('result-card', tone)}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{label === 'Nutrition Risk' ? '營養風險' : label === 'Malnutrition' ? '營養不良狀態' : '處置優先度'}</small>
    </section>
  );
}

function BundleItem({ icon: Icon, title, status, text }) {
  return (
    <div className="bundle-item">
      <Icon size={18} />
      <div>
        <div className="bundle-title">
          <strong>{title}</strong>
          <StatusChip tone={status.includes('PENDING') ? 'amber' : status === 'RECOMMENDED' ? 'green' : 'default'}>{status}</StatusChip>
        </div>
        <span>{text}</span>
      </div>
    </div>
  );
}

function FooterActions({ back, next, onBack, onNext }) {
  return (
    <footer className="footer-actions">
      <button className="outline-button" onClick={onBack}>
        {back}
      </button>
      <button className="outline-button">
        <Save size={16} />
        儲存草稿
      </button>
      <button className="primary-button" onClick={onNext}>
        {next}
      </button>
    </footer>
  );
}

export default function App() {
  const initialStep = new URLSearchParams(window.location.search).get('screen');
  const [activeStep, setActiveStep] = useState(steps.some((step) => step.id === initialStep) ? initialStep : 'home');
  const [context, setContext] = useState(initialContext);
  const [overrideTool, setOverrideTool] = useState('');
  const [answers, setAnswers] = useState({
    intake: initialContext.intake,
    weightLoss: '是，明顯',
    muscleLoss: '中度',
    gi: initialContext.giFunction,
    swallow: initialContext.oralSafety
  });
  const recommendation = useMemo(() => getRecommendation(context), [context]);

  const syncAssessmentField = (field, value) => {
    const contextKey = {
      intake: 'intake',
      gi: 'giFunction',
      swallow: 'oralSafety'
    }[field];

    setContext((currentContext) => ({ ...currentContext, [contextKey]: value }));
    setAnswers((currentAnswers) => ({ ...currentAnswers, [field]: value }));
  };

  return (
    <div className="app-shell">
      <StepRail activeStep={activeStep} setActiveStep={setActiveStep} />
      <div className="workspace">
        <TopBar context={context} setContext={setContext} />
        {activeStep === 'home' && <HomeScreen setActiveStep={setActiveStep} context={context} setContext={setContext} />}
        {activeStep === 'context' && <ContextScreen context={context} setContext={setContext} recommendation={recommendation} setActiveStep={setActiveStep} syncAssessmentField={syncAssessmentField} />}
        {activeStep === 'tool' && <ToolScreen recommendation={recommendation} overrideTool={overrideTool} setOverrideTool={setOverrideTool} setActiveStep={setActiveStep} />}
        {activeStep === 'assessment' && (
          <AssessmentScreen
            context={context}
            recommendation={recommendation}
            overrideTool={overrideTool}
            answers={answers}
            setAnswers={setAnswers}
            setActiveStep={setActiveStep}
            syncAssessmentField={syncAssessmentField}
          />
        )}
        {activeStep === 'result' && <ResultScreen context={context} recommendation={recommendation} overrideTool={overrideTool} answers={answers} setActiveStep={setActiveStep} />}
      </div>
    </div>
  );
}
