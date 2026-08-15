import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  ClipboardCheck,
  FileText,
  Home,
  Info,
  ShieldAlert,
  Stethoscope,
  UserRound,
  Utensils,
  Waves
} from 'lucide-react';
import {
  applyDiagnosisSelection,
  applyWardSelection,
  calculateBmi,
  diagnosisOptions,
  getAssessmentStatus,
  getChineseStatus,
  getContextValidation,
  getRecommendation,
  getReferenceWeight,
  getResultTone,
  getRoute,
  modifierLabels,
  normalizeResult,
  pathwayMeta,
  questions,
  toolRegistry,
  wardOptions
} from './clinicalLogic.js';
import ToolAssessmentForm from './ToolAssessmentForm.jsx';
import {
  createInitialToolAssessments,
  evaluateToolAssessment,
  updateToolAssessment
} from './toolAssessments.js';

const steps = [
  { id: 'home', title: '首頁', mobileTitle: '首頁', subtitle: 'Home', icon: Home },
  { id: 'context', title: '病人背景', mobileTitle: '背景', subtitle: 'Patient Context', icon: UserRound },
  { id: 'tool', title: '工具選擇', mobileTitle: '工具', subtitle: 'Tool Selection', icon: Stethoscope },
  { id: 'assessment', title: '評估執行', mobileTitle: '評估', subtitle: 'Assessment', icon: ClipboardCheck },
  { id: 'result', title: '臨床結果與營養照護組合', mobileTitle: '結果', subtitle: 'Clinical Result + Nutrition Care Bundle', icon: FileText }
];

const initialContext = {
  role: '營養師',
  patientName: '',
  age: '',
  sex: '未填',
  ward: '一般病房',
  bed: '',
  admissionDay: '',
  height: '',
  weight: '',
  dryWeight: '',
  diagnosis: '',
  dietStatus: '',
  npoReason: '',
  intake: '',
  giFunction: '',
  oralSafety: '',
  renalModality: 'not assessed',
  pathways: {
    ICU: false,
    LIVER: false,
    RENAL: false,
    ONCOLOGY: false,
    GERIATRIC: false,
    GENERAL: false
  },
  modifiers: {
    heartFailure: false,
    dysphagia: false,
    edemaAscites: false,
    refeeding: false,
    poorIntake: false
  }
};

function createInitialContext() {
  return {
    ...initialContext,
    pathways: { ...initialContext.pathways },
    modifiers: { ...initialContext.modifiers }
  };
}

function createInitialAnswers() {
  return {
    intake: '',
    weightLoss: '',
    muscleLoss: '',
    gi: '',
    swallow: ''
  };
}

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

function StepRail({ activeStep, setActiveStep, canNavigate }) {
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
          const disabled = canNavigate[step.id] === false;
          return (
            <button key={step.id} className={cx('step-item', active && 'active')} onClick={() => setActiveStep(step.id)} disabled={disabled}>
              <span className="step-number">{index + 1}</span>
              <Icon size={19} />
              <span>
                <strong><span className="desktop-step-title">{step.title}</span><span className="mobile-step-title">{step.mobileTitle}</span></strong>
                <small>{step.subtitle}</small>
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function TopBar({ context, setContext }) {
  const bmi = calculateBmi(context.weight, context.height);
  return (
    <header className="topbar">
      <div className="patient-strip">
        <span>病人：{context.patientName || '未填'}</span>
        <span>{context.age === '' ? '年齡未填' : `${context.age} 歲`}</span>
        <span>{context.sex}</span>
        <span>床號：{context.bed || '未填'}</span>
        <span>住院日：{context.admissionDay === '' ? '未填' : `第 ${context.admissionDay} 天`}</span>
        <span>BMI：{bmi ?? '—'}{bmi != null ? ' kg/m²' : ''}</span>
      </div>
      <div className="role-switch" aria-label="角色切換">
        {['醫師', '營養師', '護理師'].map((role) => (
          <button key={role} className={context.role === role ? 'selected' : ''} onClick={() => setContext((current) => ({ ...current, role }))}>
            {role}
          </button>
        ))}
      </div>
    </header>
  );
}

function HomeScreen({ setActiveStep, setContext }) {
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
            setContext((current) => ({ ...current, role: '護理師' }));
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
            setContext((current) => ({ ...current, role: '營養師' }));
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

function ContextScreen({ context, setContext, recommendation, contextValidation, setActiveStep, syncAssessmentField }) {
  const updatePathway = (key) => {
    setContext((current) => ({ ...current, pathways: { ...current.pathways, [key]: !current.pathways[key] } }));
  };
  const updateModifier = (key) => {
    setContext((current) => ({ ...current, modifiers: { ...current.modifiers, [key]: !current.modifiers[key] } }));
  };
  const updateNumber = (key, value) => setContext((current) => ({ ...current, [key]: value === '' ? '' : Number(value) }));

  return (
    <section className="screen grid-screen">
      <main className="main-stack">
        <Panel title="Patient Context 病人背景資訊" action="V1.0.0">
          <div className="form-grid">
            <Field label="病人姓名" value={context.patientName} onChange={(value) => setContext((current) => ({ ...current, patientName: value }))} />
            <Field label="年齡" value={context.age} type="number" onChange={(value) => updateNumber('age', value)} />
            <Select label="生理性別" value={context.sex} options={['未填', '男', '女', '其他']} onChange={(value) => setContext((current) => ({ ...current, sex: value }))} />
            <Select label="病房" value={context.ward} options={wardOptions} onChange={(value) => setContext((current) => applyWardSelection(current, value))} />
            <Field label="床號" value={context.bed} onChange={(value) => setContext((current) => ({ ...current, bed: value }))} />
            <Field label="住院日" value={context.admissionDay} type="number" onChange={(value) => updateNumber('admissionDay', value)} />
            <Field label="身高 cm" value={context.height} type="number" onChange={(value) => updateNumber('height', value)} />
            <Field label="目前體重 kg" value={context.weight} type="number" onChange={(value) => updateNumber('weight', value)} />
            <Field label="Dry weight kg" value={context.dryWeight} type="number" onChange={(value) => updateNumber('dryWeight', value)} />
            <Select label="入院原因 / 診斷" value={context.diagnosis} options={['', ...diagnosisOptions]} onChange={(value) => setContext((current) => applyDiagnosisSelection(current, value))} />
          </div>
          <div className="select-row">
            <Select label="飲食狀態" value={context.dietStatus} options={['', '一般飲食', '軟質飲食', 'NPO', '管灌']} onChange={(value) => setContext((current) => ({ ...current, dietStatus: value, npoReason: value === 'NPO' ? current.npoReason : '' }))} />
            <Select label="進食情形" value={context.intake} options={['', ...questions.find((question) => question.id === 'intake').options]} onChange={(value) => syncAssessmentField('intake', value)} />
            <Select label="GI tract" value={context.giFunction} options={['', 'functional', 'partially functional', 'uncertain', 'unavailable']} onChange={(value) => syncAssessmentField('gi', value)} />
            <Select label="Oral safety" value={context.oralSafety} options={['', 'safe', 'suspected dysphagia', 'unsafe', 'not assessed']} onChange={(value) => syncAssessmentField('swallow', value)} />
          </div>
          {context.dietStatus === 'NPO' && (
            <div className="select-row pathway-details">
              <Select label="NPO 原因" value={context.npoReason} options={['', '醫療處置 / 手術', '吞嚥 / 吸入風險', 'GI contraindication', '其他 / 尚待確認']} onChange={(value) => setContext((current) => ({ ...current, npoReason: value }))} />
            </div>
          )}
        </Panel>

        {(contextValidation.blockers.length > 0 || contextValidation.warnings.length > 0) && (
          <Panel title="資料檢核">
            <div className="alert-list">
              {contextValidation.blockers.map((message) => (
                <div key={message} className="safety-alert red">
                  <AlertTriangle size={18} />
                  <div><strong>無法進入成人評估流程</strong><span>{message}</span></div>
                </div>
              ))}
              {contextValidation.warnings.map((message) => (
                <div key={message} className="safety-alert amber">
                  <Info size={18} />
                  <div><strong>資料可靠度提醒</strong><span>{message}</span></div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        <Panel title="臨床路徑與特殊因子">
          {context.pathways.RENAL && (
            <div className="select-row pathway-details">
              <Select label="腎臟治療型態" value={context.renalModality} options={['not assessed', 'CKD5D non-dialysis', 'HD', 'PD']} onChange={(value) => setContext((current) => ({ ...current, renalModality: value }))} />
            </div>
          )}
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
              <strong>{recommendation?.primaryTool || '—'}</strong>
              <span>{recommendation?.primaryPathway || '請先完成成人適用性資料'}</span>
            </div>
            <div className="arrow-line" />
            <div>
              <small>下一步</small>
              <strong>{recommendation?.nextStep || '暫停分流'}</strong>
              <span>可於下一頁 professional override</span>
            </div>
          </div>
          <div className="reason-list">
            {(recommendation?.reasons || []).slice(0, 5).map((reason) => (
              <span key={reason}>
                <BadgeCheck size={14} />
                {reason}
              </span>
            ))}
          </div>
        </Panel>
      </main>
      <SafetyPanel context={context} recommendation={recommendation} />
      <FooterActions back="回首頁" next="前往工具選擇" onBack={() => setActiveStep('home')} onNext={() => setActiveStep('tool')} nextDisabled={!contextValidation.isValid} />
    </section>
  );
}

function ToolScreen({ recommendation, overrideTool, setOverrideTool, overrideReason, setOverrideReason, setActiveStep }) {
  const selectedTool = overrideTool || recommendation.primaryTool;
  const registry = toolRegistry[selectedTool];
  const canStart = !overrideTool || overrideReason.trim().length > 0;
  const selectTool = (tool) => {
    if (tool === recommendation.primaryTool) {
      setOverrideTool('');
      setOverrideReason('');
      return;
    }
    setOverrideTool(tool);
    setOverrideReason('');
  };
  return (
    <section className="screen grid-screen">
      <main className="main-stack">
        <Panel title="系統建議">
          <div className="primary-rec">
            <div>
              <span className="eyeless">首選評估</span>
              <h2>{selectedTool}</h2>
              <p>{registry.population} · {registry.type}</p>
            </div>
            <StatusChip tone="blue">{registry.modeLabel}</StatusChip>
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
          <button className="primary-button" onClick={() => setActiveStep('assessment')} disabled={!canStart}>
            開始評估
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
              <button key={tool.tool} className="table-row" onClick={() => selectTool(tool.tool)}>
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
              <button key={tool} className={cx('choice-button', selectedTool === tool && 'active')} onClick={() => selectTool(tool)}>
                {tool}
              </button>
            ))}
          </div>
          {overrideTool && (
            <label className="text-area">
              <span>變更原因（必填）</span>
              <textarea value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} placeholder="請記錄 clinical judgment / institutional protocol..." />
            </label>
          )}
        </Panel>
      </main>
      <aside className="side-panel">
        <Panel title="Tool Registry">
          <Meta label="評估領域" value={registry.type} />
          <Meta label="適用族群" value={registry.population} />
          <Meta label="評估方式" value={registry.modeLabel} />
          <Meta label="來源版本" value={registry.version} />
          <Meta label="Override" value={overrideTool ? (overrideReason.trim() ? 'Reason recorded in this assessment' : 'Reason required') : 'System recommendation'} />
        </Panel>
      </aside>
      <FooterActions back="回病人背景" next="開始評估" onBack={() => setActiveStep('context')} onNext={() => setActiveStep('assessment')} nextDisabled={!canStart} />
    </section>
  );
}

function AssessmentScreen({
  context,
  recommendation,
  overrideTool,
  answers,
  setAnswers,
  setActiveStep,
  syncAssessmentField,
  toolAssessments,
  setToolAssessments,
  focusNativeAssessment,
  setFocusNativeAssessment
}) {
  const assessmentStatus = getAssessmentStatus(answers);
  const bmi = calculateBmi(context.weight, context.height);
  const referenceWeight = getReferenceWeight(context);
  const fluidAffected = context.modifiers.edemaAscites || context.modifiers.heartFailure;
  const selectedTool = overrideTool || recommendation.primaryTool;
  const nativeAssessmentRef = useRef(null);
  const nativeEvaluation = useMemo(
    () => evaluateToolAssessment(selectedTool, toolAssessments[selectedTool], context),
    [context, selectedTool, toolAssessments]
  );
  const updateAnswer = (questionId, value) => {
    if (['intake', 'gi', 'swallow'].includes(questionId)) {
      syncAssessmentField(questionId, value);
      return;
    }

    setAnswers((current) => ({ ...current, [questionId]: value }));
  };
  const updateSelectedToolAssessment = (patch) => {
    if (!selectedTool) return;
    setToolAssessments((current) => updateToolAssessment(current, selectedTool, patch, context));
  };

  useEffect(() => {
    if (!focusNativeAssessment) return;
    nativeAssessmentRef.current?.scrollIntoView({ block: 'start' });
    setFocusNativeAssessment(false);
  }, [focusNativeAssessment, setFocusNativeAssessment]);

  return (
    <section className="screen grid-screen">
      <main className="main-stack">
        <Panel title="共同臨床評估資料" action={`${assessmentStatus.percent}%`}>
          <div className="progress"><span style={{ width: `${assessmentStatus.percent}%` }} /></div>
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
        <div id="native-tool-assessment" ref={nativeAssessmentRef}>
          <Panel title={`工具原始評估：${selectedTool}`} action={`${nativeEvaluation.percent}%`}>
            <ToolAssessmentForm
              toolId={selectedTool}
              context={context}
              assessment={nativeEvaluation}
              onChange={updateSelectedToolAssessment}
            />
          </Panel>
        </div>
        <Panel title="Computed values">
          <div className="metric-grid">
            <Metric label="BMI" value={bmi ?? '—'} />
            <Metric label="Reference weight" value={referenceWeight.value == null ? '—' : `${referenceWeight.value} kg`} note={referenceWeight.type} />
            <Metric label="Weight reliability" value={fluidAffected ? 'Fluid affected' : 'Reliable'} />
            <Metric label="Selected tool" value={overrideTool || recommendation.primaryTool} note="Native scoring pending" />
            <Metric label="Entry route" value={context.role === '護理師' ? 'NURSING_SCREEN' : 'PROFESSIONAL_ASSESSMENT'} />
          </div>
        </Panel>
      </main>
      <SafetyPanel context={context} recommendation={recommendation} answers={answers} />
      <FooterActions back="回工具選擇" next="查看臨床結果" onBack={() => setActiveStep('tool')} onNext={() => setActiveStep('result')} nextDisabled={!assessmentStatus.isComplete} />
    </section>
  );
}

function formatCompletedAt(value) {
  if (!value) return '未記錄';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

export function createContinueNativeAssessmentHandler(setFocusNativeAssessment, navigateTo) {
  return () => {
    setFocusNativeAssessment(true);
    navigateTo('assessment');
  };
}

export function ResultScreen({
  context,
  recommendation,
  overrideTool,
  overrideReason,
  answers,
  toolAssessment,
  onContinueNativeAssessment,
  setActiveStep,
  onFinish
}) {
  const selectedTool = overrideTool || recommendation.primaryTool;
  const nativeEvaluation = evaluateToolAssessment(selectedTool, toolAssessment, context);
  const result = normalizeResult(context, answers, recommendation, overrideTool, nativeEvaluation);
  const route = getRoute(context, answers, result);
  const referenceWeight = getReferenceWeight(context);
  const nativeComplete = result.nativeStatus === 'COMPLETE';
  const pendingNativeItems = new Set([...(result.missing || []), ...(result.invalid || [])]).size;
  return (
    <section className="screen result-screen">
      <Panel title="臨床摘要">
        <div className="summary-line">
          <span>{context.age} 歲 {context.sex === '未填' ? '性別未填' : `${context.sex}性`}</span>
          <span>病房：{context.ward}</span>
          <span>主要臨床路徑：{getChineseStatus(recommendation.primaryPathway)}</span>
          <span>評估工具：{result.tool}</span>
          <span>評估狀態：{getChineseStatus(result.assessmentStatus)}</span>
          {overrideTool && <span>專業調整原因：{overrideReason}</span>}
        </div>
      </Panel>

      <div className="result-grid">
        <ResultCard label="營養風險" value={result.nutritionRisk} tone={getResultTone('risk', result.nutritionRisk)} />
        <ResultCard label="營養不良狀態" value={result.malnutrition} tone={getResultTone('malnutrition', result.malnutrition)} />
        <ResultCard label="處置優先度" value={result.priority} tone={getResultTone('priority', result.priority)} />
      </div>

      <div className="wide-grid">
        <Panel title="原始評估結果">
          <Meta label="評估工具" value={result.tool} />
          <Meta label="評估領域" value={getChineseStatus(toolRegistry[result.tool].type)} />
          {!nativeComplete && (
            <div className="native-result-pending">
              <Meta label="原始評估狀態" value={getChineseStatus(result.nativeStatus)} />
              <Meta label="原始評估完成度" value={`${result.percent}%`} />
              <Meta label="待完成項目" value={`${pendingNativeItems} 項`} />
              <div className="progress native-result-progress">
                <span style={{ width: `${result.percent}%` }} />
              </div>
              <p className="native-result-warning">原始量表尚未完成；不得以共同臨床資料推測量表分數</p>
              <button
                type="button"
                className="primary-button native-continue"
                onClick={onContinueNativeAssessment}
              >
                <ClipboardCheck size={17} />
                繼續完成 {result.tool} 評估
              </button>
            </div>
          )}
          {nativeComplete && (
            <div className="native-result-complete">
              <Meta label="原始分數" value={result.nativeScore ?? '—'} />
              <Meta label="原始分類" value={result.nativeCategory || '—'} />
              <Meta label="評估方式" value={getChineseStatus(result.sourceMode)} />
              <Meta label="完成日期／時間" value={formatCompletedAt(result.completedAt)} />
              <Meta
                label="正規化領域"
                value={`營養風險：${getChineseStatus(result.nutritionRisk)}；營養不良：${getChineseStatus(result.malnutrition)}`}
              />
              {result.sourceMode === 'OFFICIAL_EXTERNAL' && (
                <p className="native-result-note">官方結果回填；本站未重新計分</p>
              )}
            </div>
          )}
        </Panel>
        <Panel title="結果判斷依據">
          <div className="reason-list vertical">
            {result.reasons.slice(0, 8).map((reason) => (
              <span key={reason}>
                <Info size={14} />
                {getChineseStatus(reason)}
              </span>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="安全警示">
        <div className="alert-list">
          {result.safetyFlags.length === 0 && (
            <div className="empty-state"><BadgeCheck size={18} /><span>目前無安全警示</span></div>
          )}
          {result.safetyFlags.map((flag) => (
            <div key={flag} className="alert-row">
              <ShieldAlert size={18} />
              <div>
                <strong>{getChineseStatus(flag)}</strong>
                <span>{flag === 'Refeeding risk' ? '營養供應增加前需完成電解質、硫胺素與漸進供應計畫。' : '此條件會影響營養供應途徑，需先完成安全確認。'}</span>
              </div>
              <StatusChip tone={flag === 'Refeeding risk' || flag === 'Oral feeding unsafe' ? 'red' : 'amber'}>{getChineseStatus(flag === 'Oral feeding unsafe' ? 'BLOCKING' : 'PENDING')}</StatusChip>
            </div>
          ))}
        </div>
      </Panel>

      {result.dataQualityFlags.length > 0 && (
        <Panel title="資料品質提醒">
          <div className="alert-list">
            {result.dataQualityFlags.map((flag) => (
              <div key={flag} className="alert-row">
                <Info size={18} />
                <div><strong>{getChineseStatus(flag)}</strong><span>此項目影響資料可靠度或後續路徑判斷。</span></div>
                <StatusChip tone="gray">{getChineseStatus('REVIEW')}</StatusChip>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel title="營養照護組合">
        <div className="bundle-grid">
          <BundleItem icon={Stethoscope} title="專業營養評估" status={result.priority === 'GREEN' ? 'CONSIDER' : 'RECOMMENDED'} text="由營養師完成個別化營養照護計畫。" />
          <BundleItem icon={Utensils} title="營養供應途徑" status={route.status} text={route.title} />
          <BundleItem icon={Activity} title="營養需求設定" status="RECOMMENDED" text={`參考體重：${referenceWeight.value ?? '無可用資料'} kg（${getChineseStatus(referenceWeight.type)}）；需套用腎臟病與特殊因子規則。`} />
          <BundleItem icon={Waves} title="體液與電解質" status="CONSIDER" text="心衰竭、腎臟病或水腫情境，需與治療團隊協調體液、鈉、鉀與磷管理。" />
        </div>
      </Panel>

      <Panel title="監測與重新評估">
        <div className="check-grid">
          {['口服攝取百分比', '目前體重／乾體重', '體液平衡', '電解質', '胃腸耐受性', '吞嚥狀態', '營養介入實際供應量', '48–72 小時或依臨床路徑重新評估'].map((item) => (
            <div key={item}>
              <BadgeCheck size={16} />
              {item}
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="病歷紀錄摘要">
        <pre className="note-preview">{`營養評估摘要
主要臨床路徑：${getChineseStatus(recommendation.primaryPathway)}
評估工具：${result.tool}
原始評估狀態：${getChineseStatus(result.nativeStatus)}
原始分數：${nativeComplete ? result.nativeScore : '未完成'}
原始分類：${nativeComplete ? result.nativeCategory : '未完成'}
來源模式：${getChineseStatus(result.sourceMode)}
${nativeComplete ? `完成日期／時間：${formatCompletedAt(result.completedAt)}
正規化領域：營養風險 ${getChineseStatus(result.nutritionRisk)}；營養不良 ${getChineseStatus(result.malnutrition)}` : '原始量表尚未完成；不得以共同臨床資料推測量表分數'}
營養風險：${getChineseStatus(result.nutritionRisk)}
營養不良狀態：${getChineseStatus(result.malnutrition)}
處置優先度：${getChineseStatus(result.priority)}
評估狀態：${getChineseStatus(result.assessmentStatus)}
相關特殊因子：${recommendation.modifiers.map((item) => getChineseStatus(modifierLabels[item])).filter(Boolean).join('、') || '無'}
${overrideTool ? `專業調整：${overrideTool}；原因：${overrideReason}\n` : ''}資料品質：${result.dataQualityFlags.map(getChineseStatus).join('、') || '目前無資料品質提醒'}
營養照護：${route.title}
安全警示：${result.safetyFlags.map(getChineseStatus).join('、') || '目前無安全警示'}`}</pre>
      </Panel>

      <FooterActions back="回評估" next="完成並建立新評估" onBack={() => setActiveStep('assessment')} onNext={onFinish} />
    </section>
  );
}

function SafetyPanel({ context, recommendation, answers = {} }) {
  const swallow = answers.swallow || context.oralSafety;
  const gi = answers.gi || context.giFunction;
  const referenceWeight = getReferenceWeight(context);
  const alerts = [
    context.modifiers.refeeding && { tone: 'red', icon: AlertTriangle, title: 'High refeeding risk', text: '需完成院內 refeeding safety workflow' },
    swallow === 'unsafe' && { tone: 'red', icon: ShieldAlert, title: 'Oral feeding unsafe', text: '不可直接建議 regular oral feeding' },
    swallow !== 'safe' && swallow !== 'unsafe' && { tone: 'amber', icon: ShieldAlert, title: 'Swallowing safety pending', text: 'Oral feeding recommendation remains conditional' },
    context.modifiers.dysphagia && swallow === 'safe' && { tone: 'gray', icon: Info, title: 'Swallowing data conflict', text: '請確認 dysphagia modifier 與 oral safety 狀態' },
    (context.modifiers.edemaAscites || context.modifiers.heartFailure) && { tone: 'blue', icon: Waves, title: 'Fluid-affected weight', text: `Reference weight: ${referenceWeight.value ?? 'unavailable'} kg (${referenceWeight.type})` },
    (!gi || gi === 'uncertain') && { tone: 'gray', icon: Info, title: 'GI tract uncertain', text: 'EN escalation pending assessment' }
  ].filter(Boolean);

  return (
    <aside className="side-panel">
      <Panel title="Safety Gate 安全閘門" action={`需關注 ${alerts.length}`}>
        <div className="alert-list">
          {alerts.length === 0 && (
            <div className="empty-state"><BadgeCheck size={18} /><span>No active safety alerts</span></div>
          )}
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
          {(recommendation?.modifiers || []).length === 0 && <div className="empty-state"><BadgeCheck size={16} /><span>No active modifiers</span></div>}
          {(recommendation?.modifiers || []).map((item) => (
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
          <option key={option} value={option}>{option === '' ? '請選擇' : option}</option>
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
      <strong className="result-value">{getChineseStatus(value)}</strong>
      <small>{label === '處置優先度' ? '臨床處置層級' : '正規化結果'}</small>
    </section>
  );
}

function BundleItem({ icon: Icon, title, status, text }) {
  const tone = status.includes('PENDING') || status === 'CONDITIONAL' ? 'amber' : status === 'RECOMMENDED' ? 'green' : 'default';
  return (
    <div className="bundle-item">
      <Icon size={18} />
      <div>
        <div className="bundle-title">
          <strong>{title}</strong>
          <StatusChip tone={tone}>{getChineseStatus(status)}</StatusChip>
        </div>
        <span>{text}</span>
      </div>
    </div>
  );
}

function FooterActions({ back, next, onBack, onNext, nextDisabled = false }) {
  return (
    <footer className="footer-actions">
      <button className="outline-button" onClick={onBack}>
        {back}
      </button>
      <button className="primary-button" onClick={onNext} disabled={nextDisabled}>
        {next}
      </button>
    </footer>
  );
}

export default function App() {
  const requestedStep = new URLSearchParams(window.location.search).get('screen');
  const initialStep = steps.some((step) => step.id === requestedStep) ? requestedStep : 'home';
  const [activeStep, setActiveStep] = useState(['home', 'context'].includes(initialStep) ? initialStep : 'context');
  const [context, setContext] = useState(createInitialContext);
  const [overrideTool, setOverrideTool] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [answers, setAnswers] = useState(createInitialAnswers);
  const [toolAssessments, setToolAssessments] = useState(createInitialToolAssessments);
  const [focusNativeAssessment, setFocusNativeAssessment] = useState(false);
  const recommendation = useMemo(() => getRecommendation(context), [context]);
  const contextValidation = useMemo(() => getContextValidation(context), [context]);
  const assessmentStatus = useMemo(() => getAssessmentStatus(answers), [answers]);
  const canStartAssessment = contextValidation.isValid
    && (!overrideTool || overrideReason.trim().length > 0);
  const canNavigate = {
    home: true,
    context: true,
    tool: contextValidation.isValid,
    assessment: canStartAssessment,
    result: canStartAssessment && assessmentStatus.isComplete
  };

  useEffect(() => {
    setOverrideTool('');
    setOverrideReason('');
  }, [recommendation?.primaryTool]);

  const navigateTo = (step) => {
    if (step === 'tool' && !contextValidation.isValid) return setActiveStep('context');
    if ((step === 'assessment' || step === 'result') && !canStartAssessment) return setActiveStep('tool');
    if (step === 'result' && !assessmentStatus.isComplete) return setActiveStep('assessment');
    setActiveStep(step);
  };

  const finishAssessment = () => {
    setContext(createInitialContext());
    setAnswers(createInitialAnswers());
    setToolAssessments(createInitialToolAssessments());
    setFocusNativeAssessment(false);
    setOverrideTool('');
    setOverrideReason('');
    setActiveStep('home');
  };

  const syncAssessmentField = (field, value) => {
    const contextKey = {
      intake: 'intake',
      gi: 'giFunction',
      swallow: 'oralSafety'
    }[field];

    if (!contextKey) return;
    setContext((currentContext) => ({ ...currentContext, [contextKey]: value }));
    setAnswers((currentAnswers) => ({ ...currentAnswers, [field]: value }));
  };

  const continueNativeAssessment = createContinueNativeAssessmentHandler(
    setFocusNativeAssessment,
    navigateTo
  );

  return (
    <div className="app-shell">
      <StepRail activeStep={activeStep} setActiveStep={navigateTo} canNavigate={canNavigate} />
      <div className="workspace">
        <TopBar context={context} setContext={setContext} />
        {activeStep === 'home' && <HomeScreen setActiveStep={navigateTo} setContext={setContext} />}
        {activeStep === 'context' && <ContextScreen context={context} setContext={setContext} recommendation={recommendation} contextValidation={contextValidation} setActiveStep={navigateTo} syncAssessmentField={syncAssessmentField} />}
        {activeStep === 'tool' && recommendation && <ToolScreen recommendation={recommendation} overrideTool={overrideTool} setOverrideTool={setOverrideTool} overrideReason={overrideReason} setOverrideReason={setOverrideReason} setActiveStep={navigateTo} />}
        {activeStep === 'assessment' && (
          <AssessmentScreen
            context={context}
            recommendation={recommendation}
            overrideTool={overrideTool}
            answers={answers}
            setAnswers={setAnswers}
            setActiveStep={navigateTo}
            syncAssessmentField={syncAssessmentField}
            toolAssessments={toolAssessments}
            setToolAssessments={setToolAssessments}
            focusNativeAssessment={focusNativeAssessment}
            setFocusNativeAssessment={setFocusNativeAssessment}
          />
        )}
        {activeStep === 'result' && recommendation && (
          <ResultScreen
            context={context}
            recommendation={recommendation}
            overrideTool={overrideTool}
            overrideReason={overrideReason}
            answers={answers}
            toolAssessment={toolAssessments[overrideTool || recommendation.primaryTool]}
            onContinueNativeAssessment={continueNativeAssessment}
            setActiveStep={navigateTo}
            onFinish={finishAssessment}
          />
        )}
      </div>
    </div>
  );
}
