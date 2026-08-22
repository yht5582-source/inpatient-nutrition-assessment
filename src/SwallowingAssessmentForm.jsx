import { useEffect, useState } from 'react';
import { Clock3, ExternalLink, ShieldAlert } from 'lucide-react';
import {
  GUSS_SOURCE_URL,
  RSST_SOURCE_URL,
  evaluateSwallowingAssessments,
  updateSwallowingAssessment
} from './swallowingAssessments.js';

const toolOptions = [
  { id: 'GUSS-T', title: '臺灣版古金吞嚥篩檢量表（GUSS-T）', note: '0–20 分，多質地、逐階停止' },
  { id: 'RSST', title: '30 秒反覆唾液吞嚥測試（RSST）', note: '30 秒內計算吞嚥次數' }
];

const indirectQuestions = [
  { field: 'alertness', label: '警醒度：可保持清醒至少 15 分鐘', yes: '是（1 分）', no: '否（0 分）' },
  { field: 'voluntaryCough', label: '自主咳嗽／清喉嚨：可有力完成兩次', yes: '是（1 分）', no: '否（0 分）' },
  { field: 'salivaSwallow', label: '吞口水成功，過程中及之後未咳嗽', yes: '是（1 分）', no: '否（0 分）' },
  { field: 'drooling', label: '長期嚴重流口水', yes: '有（0 分）', no: '無（1 分）' },
  { field: 'voiceChange', label: '吞嚥後嗓音改變／濕濡聲', yes: '有（0 分）', no: '無（1 分）' }
];

const stageMeta = {
  semisolid: {
    title: '半固體分測驗',
    preparation: '依序給予 2.5 mL，再給予 3–5 茶匙 IDDSI Level 3 增稠水；任何吸入指標出現即停止。',
    delay: '超過 2 秒'
  },
  liquid: {
    title: '液體分測驗',
    preparation: '液體 3、5、10、20、50 mL 依序測試；任何吸入指標出現即停止。',
    delay: '超過 2 秒'
  },
  solid: {
    title: '固體分測驗',
    preparation: '確認牙齒與咀嚼能力後，使用不超過 1.5 × 1.5 cm 的去邊吐司、去皮饅頭或餅乾。',
    delay: '超過 10 秒'
  }
};

function ChoiceButtons({ label, value, options, onChange }) {
  return (
    <fieldset className="swallow-choice">
      <legend>{label}</legend>
      <div className="option-row">
        {options.map((option) => (
          <button
            type="button"
            key={option.value}
            className={value === option.value ? 'option active' : 'option'}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function ScreeningStatus({ evaluation, label }) {
  const complete = evaluation.nativeStatus === 'COMPLETE';
  const statusLabel = complete
    ? evaluation.nativeCategory
    : evaluation.nativeStatus === 'IN_PROGRESS' ? '評估進行中' : '尚未開始';
  return (
    <div className={`swallow-result ${complete ? 'complete' : ''}`}>
      <div>
        <strong>{label}</strong>
        <span>{statusLabel}</span>
      </div>
      <b>{complete && evaluation.nativeScore != null ? `${evaluation.nativeScore} 分` : `${evaluation.percent || 0}%`}</b>
    </div>
  );
}

function DirectStage({ stage, answers, onUpdate }) {
  const meta = stageMeta[stage];
  return (
    <section className="guss-stage">
      <div className="guss-stage-head">
        <strong>{meta.title}</strong>
        <span>滿 5 分才可進入下一階段</span>
      </div>
      <p>{meta.preparation}</p>
      <ChoiceButtons
        label={`吞嚥（延遲定義：${meta.delay}）`}
        value={answers.swallow || ''}
        options={[
          { value: 'none', label: '無法吞嚥（0 分）' },
          { value: 'delayed', label: '延遲吞嚥（1 分）' },
          { value: 'successful', label: '成功吞嚥（2 分）' }
        ]}
        onChange={(value) => onUpdate('swallow', value)}
      />
      {[
        ['involuntaryCough', '非自主性咳嗽（吞嚥前、中、後，觀察至 3 分鐘）'],
        ['drooling', '流口水'],
        ['voiceChange', '嗓音改變／濕濡聲']
      ].map(([field, label]) => (
        <ChoiceButtons
          key={field}
          label={label}
          value={answers[field] || ''}
          options={[
            { value: 'yes', label: '有（0 分，停止）' },
            { value: 'no', label: '無（1 分）' }
          ]}
          onChange={(value) => onUpdate(field, value)}
        />
      ))}
    </section>
  );
}

function GussForm({ store, evaluation, onChange }) {
  const record = store['GUSS-T'];
  const updateStage = (stage, field, value) => {
    const stageAnswers = record.answers?.[stage] || {};
    onChange(updateSwallowingAssessment(store, 'GUSS-T', {
      [stage]: { ...stageAnswers, [field]: value }
    }));
  };

  return (
    <div className="swallow-tool-form">
      <div className="tool-source-row">
        <p>僅在病人坐直且可依正式指引安全施測時執行。任何停止條件出現，不可再給下一口。</p>
        <a href={GUSS_SOURCE_URL} target="_blank" rel="noreferrer">正式 GUSS-T 表單與指導手冊 <ExternalLink size={14} /></a>
      </div>
      <ScreeningStatus evaluation={evaluation} label="GUSS-T 評估" />
      <section className="guss-stage">
        <div className="guss-stage-head"><strong>一、間接吞嚥測試</strong><span>需滿 5 分才可進行直接測試</span></div>
        {indirectQuestions.map((question) => (
          <ChoiceButtons
            key={question.field}
            label={question.label}
            value={record.answers?.indirect?.[question.field] || ''}
            options={[
              { value: 'yes', label: question.yes },
              { value: 'no', label: question.no }
            ]}
            onChange={(value) => updateStage('indirect', question.field, value)}
          />
        ))}
      </section>
      {['semisolid', 'liquid', 'solid'].map((stage) => evaluation.stageAccess?.[stage]
        ? <DirectStage key={stage} stage={stage} answers={record.answers?.[stage] || {}} onUpdate={(field, value) => updateStage(stage, field, value)} />
        : (
          <div className="guss-stage locked" key={stage}>
            <strong>{stageMeta[stage].title}</strong>
            <span>尚未開放：前一階段須完成且滿 5 分。</span>
          </div>
        ))}
      {evaluation.stopAfter && (
        <div className="swallow-stop"><ShieldAlert size={18} /><span>已達停止條件：不得進入下一階段；請依總分與臨床狀況處置。</span></div>
      )}
      {evaluation.nativeStatus === 'COMPLETE' && (
        <div className="swallow-recommendation">
          <strong>GUSS-T：{evaluation.nativeScore} 分</strong>
          <span>{evaluation.nativeCategory}</span>
          <small>此為吞嚥篩檢與飲食質地參考；實際飲食、給藥途徑及是否 NPO 仍須依院內流程與專業判斷確認。</small>
        </div>
      )}
    </div>
  );
}

function RsstForm({ store, evaluation, onChange }) {
  const [seconds, setSeconds] = useState(30);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return undefined;
    if (seconds <= 0) {
      setRunning(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setSeconds((current) => current - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [running, seconds]);

  const answers = store.RSST.answers || {};
  const update = (patch) => onChange(updateSwallowingAssessment(store, 'RSST', patch));
  const startTimer = () => {
    setSeconds(30);
    setRunning(true);
  };

  return (
    <div className="swallow-tool-form">
      <div className="tool-source-row">
        <p>請病人在 30 秒內反覆吞嚥口水，以喉部觸診計數；口乾會影響表現，結果須合併病史判讀。</p>
        <a href={RSST_SOURCE_URL} target="_blank" rel="noreferrer">RSST 原始效度研究 <ExternalLink size={14} /></a>
      </div>
      <ScreeningStatus evaluation={evaluation} label="RSST 評估" />
      <div className="rsst-grid">
        <div className="rsst-timer" aria-live="polite">
          <Clock3 size={24} />
          <strong>{seconds}</strong>
          <span>秒</span>
          <button type="button" className="outline-button" onClick={startTimer}>{running ? '重新開始 30 秒倒數' : '開始 30 秒倒數'}</button>
        </div>
        <label className="field">
          <span>30 秒內完成吞嚥次數</span>
          <input
            type="number"
            min="0"
            step="1"
            disabled={answers.unableToAssess === true}
            value={answers.swallowCount ?? ''}
            onChange={(event) => update({ swallowCount: event.target.value, unableToAssess: false })}
          />
          <small>0–2 次：篩檢陽性；≥3 次：篩檢陰性</small>
        </label>
      </div>
      <button
        type="button"
        className={answers.unableToAssess ? 'toggle active' : 'toggle'}
        onClick={() => update({ unableToAssess: !answers.unableToAssess, swallowCount: '' })}
      >
        <span className="checkbox">{answers.unableToAssess ? '✓' : ''}</span>
        無法評估（保持為未知，不視為陰性）
      </button>
      {evaluation.nativeStatus === 'COMPLETE' && (
        <div className="swallow-recommendation">
          <strong>{evaluation.nativeCategory}</strong>
          {evaluation.nativeScore != null && <span>{evaluation.nativeScore} 次／30 秒</span>}
          <small>RSST 是篩檢工具，不能取代臨床吞嚥評估、FEES 或 VFSS；篩檢陰性也不會覆蓋其他高風險判定。</small>
        </div>
      )}
    </div>
  );
}

export default function SwallowingAssessmentForm({ store, defaultRole, onChange }) {
  const evaluation = evaluateSwallowingAssessments(store);
  const toggleTool = (toolId) => {
    const selected = store.selectedTools.includes(toolId);
    onChange({
      ...store,
      selectedTools: selected
        ? store.selectedTools.filter((item) => item !== toolId)
        : [...store.selectedTools, toolId],
      assessorRole: store.assessorRole || defaultRole || ''
    });
  };

  return (
    <div className="swallowing-assessment">
      <div className="swallowing-intro">
        <div>
          <strong>由醫師、護理師或營養師自行選擇，可複選</strong>
          <span>本區為選填；若已選擇但尚未完成，口服安全仍維持待確認。</span>
        </div>
        <label className="field assessor-role">
          <span>施測者角色</span>
          <select value={store.assessorRole} onChange={(event) => onChange({ ...store, assessorRole: event.target.value })}>
            <option value="">請選擇</option>
            {['醫師', '護理師', '營養師'].map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
        </label>
      </div>
      <div className="swallow-tool-options">
        {toolOptions.map((tool) => {
          const active = store.selectedTools.includes(tool.id);
          return (
            <button type="button" key={tool.id} className={active ? 'swallow-tool-option active' : 'swallow-tool-option'} onClick={() => toggleTool(tool.id)}>
              <span className="checkbox">{active ? '✓' : ''}</span>
              <span><strong>{tool.title}</strong><small>{tool.note}</small></span>
            </button>
          );
        })}
      </div>
      {store.selectedTools.length > 0 && !store.assessorRole && <div className="field-error">請選擇施測者角色。</div>}
      {store.selectedTools.includes('GUSS-T') && <GussForm store={store} evaluation={evaluation.GUSS} onChange={onChange} />}
      {store.selectedTools.includes('RSST') && <RsstForm store={store} evaluation={evaluation.RSST} onChange={onChange} />}
    </div>
  );
}
