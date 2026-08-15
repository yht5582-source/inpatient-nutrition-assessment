import { ExternalLink } from 'lucide-react';
import { calculateBmi, toolRegistry } from './clinicalLogic.js';

const yesNoOptions = [
  { value: 'yes', label: '是' },
  { value: 'no', label: '否' }
];

const nrsNutritionOptions = [
  { value: '0', label: '0 — 正常營養狀態' },
  { value: '1', label: '1 — 3 個月體重下降 >5%，或前一週攝取需求量的 50–75%' },
  { value: '2', label: '2 — 2 個月體重下降 >5%，或 BMI 18.5–20.5 且一般狀況差，或前一週攝取需求量的 25–60%' },
  { value: '3', label: '3 — 1 個月體重下降 >5%（3 個月 >15%），或 BMI <18.5 且一般狀況差，或前一週攝取需求量的 0–25%' }
];

const nrsDiseaseOptions = [
  { value: '0', label: '0 分：正常營養需求' },
  { value: '1', label: '1 分：髖部骨折；慢性病急性併發症（肝硬化、COPD、慢性血液透析、糖尿病、腫瘤）' },
  { value: '2', label: '2 分：重大腹部手術、中風、嚴重肺炎、血液惡性腫瘤' },
  { value: '3', label: '3 分：頭部外傷、骨髓移植、加護病房病人（APACHE II >10）' }
];

const sevenPointFields = [
  {
    name: 'weightChange',
    label: '體重變化',
    options: [
      { value: 'loss', label: '持續下降' },
      { value: 'stable', label: '穩定' },
      { value: 'gain', label: '回升' }
    ]
  },
  {
    name: 'intakeChange',
    label: '飲食攝取變化',
    options: [
      { value: 'marked_reduction', label: '明顯減少' },
      { value: 'moderate_reduction', label: '輕至中度減少' },
      { value: 'none', label: '無明顯改變' }
    ]
  },
  {
    name: 'giSymptoms',
    label: '腸胃道症狀',
    options: [
      { value: 'severe', label: '嚴重或持續' },
      { value: 'mild', label: '輕至中度' },
      { value: 'none', label: '無' }
    ]
  },
  {
    name: 'functionalCapacity',
    label: '功能活動能力',
    options: [
      { value: 'bedridden', label: '臥床或功能明顯受限' },
      { value: 'reduced', label: '活動減少' },
      { value: 'normal', label: '正常' }
    ]
  },
  {
    name: 'diseaseBurden',
    label: '疾病與代謝負荷',
    options: [
      { value: 'high', label: '高' },
      { value: 'moderate', label: '中' },
      { value: 'low', label: '低' }
    ]
  },
  {
    name: 'subcutaneousFat',
    label: '皮下脂肪',
    options: [
      { value: 'severe', label: '嚴重流失' },
      { value: 'moderate', label: '中度流失' },
      { value: 'mild', label: '輕度流失' },
      { value: 'preserved', label: '保留' }
    ]
  },
  {
    name: 'muscleWasting',
    label: '肌肉量',
    options: [
      { value: 'severe', label: '嚴重流失' },
      { value: 'moderate', label: '中度流失' },
      { value: 'mild', label: '輕度流失' },
      { value: 'preserved', label: '保留' }
    ]
  }
];

const officialToolOptions = {
  'MNA-SF': {
    maximumScore: 14,
    categories: ['營養不良', '有營養不良風險', '營養正常']
  },
  'PG-SGA SF': {
    maximumScore: 36,
    categories: ['0–1 分', '2–3 分', '4–8 分', '9 分以上']
  }
};

function getFieldError(assessment, name, invalidMessage = '輸入值不在有效範圍內。') {
  if (assessment.invalid?.includes(name)) return invalidMessage;
  if (assessment.nativeStatus !== 'NOT_STARTED' && assessment.missing?.includes(name)) {
    return '此欄位尚未完成。';
  }
  return '';
}

function ChoiceField({ name, label, options, assessment, onChange }) {
  const value = assessment.answers[name] ?? '';
  const error = getFieldError(assessment, name, '請選擇有效選項。');
  const errorId = `${name}-error`;

  return (
    <fieldset className="question native-choice-field" aria-describedby={error ? errorId : undefined}>
      <legend>{label}</legend>
      <div className="option-row">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`option${value === option.value ? ' active' : ''}`}
            aria-pressed={value === option.value}
            onClick={() => onChange({ [name]: option.value })}
          >
            {option.label}
          </button>
        ))}
      </div>
      {error && <span id={errorId} className="field-error" role="alert">{error}</span>}
    </fieldset>
  );
}

function NumberField({ name, label, assessment, onChange, min, max, step = 1, hint, invalidMessage }) {
  const value = assessment.answers[name] ?? '';
  const error = getFieldError(assessment, name, invalidMessage);
  const hintId = `${name}-hint`;
  const errorId = `${name}-error`;
  const describedBy = [hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined;

  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        onChange={(event) => onChange({ [name]: event.target.value })}
      />
      {hint && <small id={hintId} className="field-note">{hint}</small>}
      {error && <small id={errorId} className="field-error" role="alert">{error}</small>}
    </label>
  );
}

function SelectField({ name, label, options, assessment, onChange, invalidMessage }) {
  const value = assessment.answers[name] ?? '';
  const error = getFieldError(assessment, name, invalidMessage);
  const errorId = `${name}-error`;

  return (
    <label className="field">
      <span>{label}</span>
      <select
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange({ [name]: event.target.value })}
      >
        <option value="">請選擇</option>
        {options.map((option) => {
          const normalized = typeof option === 'string' ? { value: option, label: option } : option;
          return <option key={normalized.value} value={normalized.value}>{normalized.label}</option>;
        })}
      </select>
      {error && <small id={errorId} className="field-error" role="alert">{error}</small>}
    </label>
  );
}

function ReadOnlyField({ label, value, note }) {
  return (
    <div className="field readonly-field">
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small className="field-note">{note}</small>}
    </div>
  );
}

function AssessmentStatus({ assessment }) {
  const complete = assessment.nativeStatus === 'COMPLETE';
  const statusLabel = complete
    ? assessment.nativeCategory
    : assessment.nativeStatus === 'IN_PROGRESS' ? '評估進行中' : '尚未開始';
  const detail = complete
    ? `原始分數：${assessment.nativeScore}`
    : `已完成 ${assessment.answered}/${assessment.total} 項`;

  return (
    <div className={`native-status${complete ? ' complete' : ''}`} role="status" aria-live="polite">
      <strong>{statusLabel}</strong>
      <span>{detail}</span>
    </div>
  );
}

function ExternalToolFields({ toolId, assessment, onChange }) {
  const registry = toolRegistry[toolId];
  const config = officialToolOptions[toolId];
  const dateError = getFieldError(assessment, 'completedDate');
  const confirmationError = getFieldError(assessment, 'confirmed', '請確認已使用官方版本完成評估。');

  return (
    <>
      <div className="official-tool-row">
        <a
          className="outline-button"
          href={registry.sourceUrl}
          target="_blank"
          rel="noreferrer"
          title="開啟官方評估工具"
        >
          <ExternalLink size={17} aria-hidden="true" />
          開啟官方評估工具
        </a>
        <span>{registry.version}</span>
      </div>
      <div className="native-field-grid">
        <label className="field">
          <span>完成日期</span>
          <input
            type="date"
            value={assessment.answers.completedDate ?? ''}
            aria-invalid={Boolean(dateError)}
            aria-describedby={dateError ? 'completedDate-error' : undefined}
            onChange={(event) => onChange({ completedDate: event.target.value })}
          />
          {dateError && <small id="completedDate-error" className="field-error" role="alert">{dateError}</small>}
        </label>
        <NumberField
          name="officialScore"
          label="官方總分"
          assessment={assessment}
          onChange={onChange}
          min={0}
          max={config.maximumScore}
          hint={`整數 0–${config.maximumScore}`}
          invalidMessage={`請輸入 0–${config.maximumScore} 的整數。`}
        />
        <SelectField
          name="officialCategory"
          label="官方分類"
          options={config.categories}
          assessment={assessment}
          onChange={onChange}
          invalidMessage="分類與官方總分不一致，請確認。"
        />
      </div>
      <label className={`completion-check${confirmationError ? ' invalid' : ''}`}>
        <input
          type="checkbox"
          checked={assessment.answers.confirmed === true}
          aria-invalid={Boolean(confirmationError)}
          aria-describedby={confirmationError ? 'confirmed-error' : undefined}
          onChange={(event) => onChange({ confirmed: event.target.checked })}
        />
        <span>已使用官方版本完成評估</span>
      </label>
      {confirmationError && <span id="confirmed-error" className="field-error" role="alert">{confirmationError}</span>}
    </>
  );
}

function Nrs2002Fields({ context, assessment, onChange }) {
  const initialFields = [
    { name: 'initialBmiLow', label: 'BMI 是否低於 20.5？' },
    { name: 'initialWeightLoss', label: '過去 3 個月是否有體重下降？' },
    { name: 'initialReducedIntake', label: '過去一週是否有攝取量減少？' },
    { name: 'initialSevereIllness', label: '病人是否病情嚴重？（例如：接受加護治療）' }
  ];
  const positiveScreen = initialFields.some(({ name }) => assessment.answers[name] === 'yes');
  const age = context.age === '' ? '—' : `${context.age} 歲`;
  const agePoint = context.age === '' ? '—' : Number(context.age) >= 70 ? '1 分' : '0 分';

  return (
    <>
      <div className="question-stack native-question-stack">
        {initialFields.map((field) => (
          <ChoiceField key={field.name} {...field} options={yesNoOptions} assessment={assessment} onChange={onChange} />
        ))}
      </div>
      <div className="native-field-grid">
        <ReadOnlyField label="年齡（Patient Context）" value={age} />
        <ReadOnlyField label="70 歲以上自動加分" value={agePoint} />
        {positiveScreen && (
          <>
            <SelectField name="nutritionScore" label="營養狀態分數" options={nrsNutritionOptions} assessment={assessment} onChange={onChange} />
            <SelectField name="diseaseScore" label="疾病嚴重度分數" options={nrsDiseaseOptions} assessment={assessment} onChange={onChange} />
          </>
        )}
      </div>
    </>
  );
}

function MNutricFields({ context, assessment, onChange }) {
  return (
    <div className="native-field-grid">
      <ReadOnlyField label="年齡（Patient Context）" value={context.age === '' ? '—' : `${context.age} 歲`} />
      <NumberField name="apacheIi" label="APACHE II" assessment={assessment} onChange={onChange} min={0} max={71} hint="直接輸入既有分數，整數 0–71" invalidMessage="請輸入 0–71 的整數。" />
      <NumberField name="sofa" label="SOFA" assessment={assessment} onChange={onChange} min={0} max={24} hint="直接輸入既有分數，整數 0–24" invalidMessage="請輸入 0–24 的整數。" />
      <NumberField name="comorbidities" label="共病數" assessment={assessment} onChange={onChange} min={0} hint="非負整數" invalidMessage="請輸入 0 以上的整數。" />
      <NumberField name="preIcuDays" label="住院至進入 ICU 天數" assessment={assessment} onChange={onChange} min={0} step="any" hint="0 天以上" invalidMessage="請輸入 0 以上的天數。" />
    </div>
  );
}

function RfhNptFields({ context, assessment, onChange }) {
  const directHighRisk = assessment.answers.alcoholicHepatitis === 'yes'
    || assessment.answers.tubeFeeding === 'yes';
  const fluidOverload = assessment.answers.fluidOverload;
  const bmi = calculateBmi(context.weight, context.height);

  return (
    <>
      <div className="question-stack native-question-stack">
        <ChoiceField name="alcoholicHepatitis" label="已診斷酒精性肝炎？" options={yesNoOptions} assessment={assessment} onChange={onChange} />
        <ChoiceField name="tubeFeeding" label="目前接受管灌？" options={yesNoOptions} assessment={assessment} onChange={onChange} />
      </div>
      {!directHighRisk && (
        <>
          <div className="question-stack native-question-stack">
            <ChoiceField name="fluidOverload" label="目前有體液超載（如水腫或腹水）？" options={yesNoOptions} assessment={assessment} onChange={onChange} />
          </div>
          {fluidOverload === 'no' && (
            <div className="native-field-grid">
              <ReadOnlyField label="BMI（Patient Context）" value={bmi ?? '—'} note="由目前體重與身高計算" />
              <NumberField name="weightLossPercent" label="過去 3–6 個月非預期體重下降 (%)" assessment={assessment} onChange={onChange} min={0} max={100} step="any" hint="0–100%" invalidMessage="請輸入 0–100 的數值。" />
              <ChoiceField name="acuteNoIntakeFiveDays" label="急性疾病且預期超過 5 天無法進食？" options={yesNoOptions} assessment={assessment} onChange={onChange} />
            </div>
          )}
          {fluidOverload === 'yes' && (
            <div className="native-field-grid">
              <ChoiceField
                name="incompleteMealsFromFluid"
                label="是否因體液超載無法吃完整餐？"
                options={[
                  { value: 'no', label: '否' },
                  { value: 'sometimes', label: '有時' },
                  { value: 'yes', label: '是' }
                ]}
                assessment={assessment}
                onChange={onChange}
              />
              <ChoiceField name="intakeReducedFifty" label="最近 5 天攝取是否減少超過 50%？" options={yesNoOptions} assessment={assessment} onChange={onChange} />
              <ChoiceField
                name="fluidWeightLoss"
                label="過去 3–6 個月是否有體重下降？"
                options={[
                  { value: 'no', label: '否' },
                  { value: 'uncertain', label: '因利尿劑或體液變化難以判斷' },
                  { value: 'yes', label: '是' }
                ]}
                assessment={assessment}
                onChange={onChange}
              />
            </div>
          )}
        </>
      )}
    </>
  );
}

function SevenPointSgaFields({ assessment, onChange }) {
  return (
    <div className="native-field-grid">
      {sevenPointFields.map((field) => (
        <SelectField key={field.name} {...field} assessment={assessment} onChange={onChange} />
      ))}
      <SelectField
        name="overallScore"
        label="營養師整體評定，不由前述欄位加總"
        options={[1, 2, 3, 4, 5, 6, 7].map((score) => ({ value: String(score), label: String(score) }))}
        assessment={assessment}
        onChange={onChange}
        invalidMessage="請選擇 1–7 的整體評定。"
      />
    </div>
  );
}

export function ToolAssessmentForm({ toolId, context, assessment, onChange }) {
  return (
    <div className="native-assessment">
      <AssessmentStatus assessment={assessment} />
      {toolId === 'NRS-2002' && <Nrs2002Fields context={context} assessment={assessment} onChange={onChange} />}
      {toolId === 'mNUTRIC' && <MNutricFields context={context} assessment={assessment} onChange={onChange} />}
      {toolId === 'RFH-NPT' && <RfhNptFields context={context} assessment={assessment} onChange={onChange} />}
      {toolId === '7-point SGA' && <SevenPointSgaFields assessment={assessment} onChange={onChange} />}
      {(toolId === 'MNA-SF' || toolId === 'PG-SGA SF') && (
        <ExternalToolFields toolId={toolId} assessment={assessment} onChange={onChange} />
      )}
    </div>
  );
}

export default ToolAssessmentForm;
