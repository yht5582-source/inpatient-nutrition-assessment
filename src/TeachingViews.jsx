import { useMemo, useState } from 'react';
import { CheckCircle2, ChevronRight, ChevronsDownUp, ChevronsUpDown, ClipboardCheck, ExternalLink, FileText, RotateCcw, XCircle } from 'lucide-react';
import { getChineseStatus, getPriorityLabel } from './clinicalLogic.js';
import { demoCases, evaluateCase, mindMap, quizQuestions, sources } from './teaching.js';

function SourceList({ refs }) {
  if (!refs?.length) return null;
  return (
    <ul className="teach-sources">
      {refs.map((key) => (
        <li key={key}>
          <a href={sources[key].url} target="_blank" rel="noreferrer">
            <ExternalLink size={13} aria-hidden="true" />
            {sources[key].label}
          </a>
        </li>
      ))}
    </ul>
  );
}

function CaseResult({ caseData, baseContext }) {
  const { result, route, native, recommendation } = useMemo(
    () => evaluateCase(caseData, baseContext),
    [caseData, baseContext]
  );
  const flags = [...result.safetyFlags, ...result.dataQualityFlags];
  return (
    <div className="case-result">
      <div><span>首選工具</span><strong>{recommendation.primaryTool}</strong></div>
      <div><span>原始結果</span><strong>{native.nativeScore} 分｜{native.nativeCategory}</strong></div>
      <div><span>營養風險</span><strong>{getChineseStatus(result.nutritionRisk)}</strong></div>
      <div><span>營養不良</span><strong>{getChineseStatus(result.malnutrition)}</strong></div>
      <div className="wide"><span>處置優先度</span><strong>{getPriorityLabel(result.priority)}</strong></div>
      <div className="wide"><span>營養途徑（{route.level}）</span><strong>{route.title}</strong></div>
      {flags.length > 0 && <div className="wide"><span>警示與資料提醒</span><strong>{flags.map(getChineseStatus).join('、')}</strong></div>}
    </div>
  );
}

export function CasesView({ baseContext, onLoadCase }) {
  return (
    <section className="screen teach-screen">
      <header className="teach-head">
        <h1>示範病例</h1>
        <p>六例皆為虛構，涵蓋六項工具。先自行判讀，再展開討論；也可帶入工具逐步操作。</p>
      </header>
      <div className="case-list">
        {demoCases.map((caseData, index) => (
          <article className="panel case-card" key={caseData.id} id={`case-${caseData.id}`}>
            <div className="case-card-head">
              <span className="case-number">{index + 1}</span>
              <div>
                <small>{caseData.tag}</small>
                <h2>{caseData.title}</h2>
              </div>
            </div>
            <p className="case-vignette">{caseData.vignette}</p>
            <div className="case-actions">
              <button type="button" className="outline-button" onClick={() => onLoadCase(caseData, 'context')}>
                <ClipboardCheck size={16} aria-hidden="true" />
                帶入工具逐步操作
              </button>
              <button type="button" className="outline-button" onClick={() => onLoadCase(caseData, 'result')}>
                <FileText size={16} aria-hidden="true" />
                帶入並看結果
              </button>
            </div>
            <details className="case-details">
              <summary>展開判讀與討論</summary>
              <CaseResult caseData={caseData} baseContext={baseContext} />
              <h3>判讀步驟</h3>
              <ol>{caseData.reasoning.map((text) => <li key={text}>{text}</li>)}</ol>
              <h3>臨床重點</h3>
              <ul>{caseData.points.map((text) => <li key={text}>{text}</li>)}</ul>
              <SourceList refs={caseData.refs} />
            </details>
          </article>
        ))}
      </div>
    </section>
  );
}

const quizLevels = [
  { id: '一般', note: '工具選擇與計分判讀，10 題' },
  { id: '高階', note: 'GLIM、再餵食與途徑決策，10 題' }
];

function QuizCard({ question, number, picked, onPick }) {
  const answered = picked != null;
  const correct = picked === question.answer;
  return (
    <article className="panel quiz-card" id={question.id}>
      <p className="quiz-stem"><span>{number}.</span>{question.stem}</p>
      <div className="quiz-options">
        {Object.entries(question.options).map(([letter, text]) => {
          const state = !answered
            ? ''
            : letter === question.answer ? ' correct' : letter === picked ? ' wrong' : ' muted';
          return (
            <button
              key={letter}
              type="button"
              className={`quiz-option${state}`}
              disabled={answered}
              aria-pressed={picked === letter}
              onClick={() => onPick(question.id, letter)}
            >
              <b>{letter}</b>
              <span>{text}</span>
            </button>
          );
        })}
      </div>
      {answered && (
        <div className={`quiz-feedback ${correct ? 'correct' : 'wrong'}`} role="status">
          <strong>
            {correct ? <CheckCircle2 size={17} aria-hidden="true" /> : <XCircle size={17} aria-hidden="true" />}
            {correct ? '答對' : `正確答案 ${question.answer}`}
          </strong>
          <p>{question.explain}</p>
          <SourceList refs={question.refs} />
        </div>
      )}
    </article>
  );
}

export function QuizView() {
  const [level, setLevel] = useState('一般');
  const [picks, setPicks] = useState({});
  const items = quizQuestions.filter((question) => question.level === level);
  const answered = items.filter((question) => picks[question.id]).length;
  const score = items.filter((question) => picks[question.id] === question.answer).length;
  const onPick = (id, letter) => setPicks((current) => (current[id] ? current : { ...current, [id]: letter }));
  const chooseLevel = (next) => {
    setLevel(next);
    window.scrollTo({ top: 0 });
  };
  const resetLevel = () => {
    setPicks((current) => Object.fromEntries(
      Object.entries(current).filter(([id]) => !items.some((question) => question.id === id))
    ));
    window.scrollTo({ top: 0 });
  };

  return (
    <section className="screen teach-screen">
      <header className="teach-head">
        <h1>考題</h1>
        <p>選擇程度後作答，選完立即顯示答案與依據。不儲存作答，重新整理即清除。</p>
      </header>
      <div className="quiz-levels" role="group" aria-label="考題程度">
        {quizLevels.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`quiz-level${level === option.id ? ' active' : ''}`}
            aria-pressed={level === option.id}
            onClick={() => chooseLevel(option.id)}
          >
            <strong>{option.id}</strong>
            <small>{option.note}</small>
          </button>
        ))}
      </div>
      <div className="quiz-score" role="status">
        <strong>{level}：答對 {score}／已答 {answered}／共 {items.length}</strong>
        <button type="button" className="outline-button" disabled={answered === 0} onClick={resetLevel}>
          <RotateCcw size={15} aria-hidden="true" />
          重新作答
        </button>
      </div>
      <div className="quiz-group">
        {items.map((question, index) => (
          <QuizCard
            key={question.id}
            question={question}
            number={index + 1}
            picked={picks[question.id]}
            onPick={onPick}
          />
        ))}
      </div>
    </section>
  );
}

function MapToggle({ open, onClick, children }) {
  return (
    <button type="button" className="mindmap-toggle" aria-expanded={open} onClick={onClick}>
      <ChevronRight size={16} className={open ? 'open' : ''} aria-hidden="true" />
      <span>{children}</span>
    </button>
  );
}

export function MindMapView() {
  const [closed, setClosed] = useState(() => new Set());
  const toggle = (key) => setClosed((current) => {
    const next = new Set(current);
    if (!next.delete(key)) next.add(key);
    return next;
  });
  const allClosed = mindMap.branches.every((branch) => closed.has(branch.title));

  return (
    <section className="screen teach-screen">
      <header className="teach-head">
        <h1>心智圖</h1>
        <p>{mindMap.note}</p>
      </header>
      <div className="mindmap">
        <div className="mindmap-bar">
          <div className="mindmap-root">{mindMap.root}</div>
          <div className="mindmap-actions">
            <button type="button" className="outline-button" disabled={closed.size === 0} onClick={() => setClosed(new Set())}>
              <ChevronsUpDown size={15} aria-hidden="true" />
              全部展開
            </button>
            <button type="button" className="outline-button" disabled={allClosed} onClick={() => setClosed(new Set(mindMap.branches.map((branch) => branch.title)))}>
              <ChevronsDownUp size={15} aria-hidden="true" />
              全部收合
            </button>
          </div>
        </div>
        <div className="mindmap-branches">
          {mindMap.branches.map((branch) => (
            <section className={`mindmap-branch tone-${branch.tone}`} key={branch.title}>
              <h2>
                <MapToggle open={!closed.has(branch.title)} onClick={() => toggle(branch.title)}>{branch.title}</MapToggle>
              </h2>
              {!closed.has(branch.title) && branch.items.map((item) => {
                const key = `${branch.title}/${item.head}`;
                return (
                  <div className="mindmap-item" key={item.head}>
                    <h3>
                      <MapToggle open={!closed.has(key)} onClick={() => toggle(key)}>{item.head}</MapToggle>
                    </h3>
                    {!closed.has(key) && <ul>{item.leaves.map((leaf) => <li key={leaf}>{leaf}</li>)}</ul>}
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      </div>
      <details className="panel teach-all-sources">
        <summary>全部參考來源</summary>
        <SourceList refs={Object.keys(sources)} />
      </details>
    </section>
  );
}
