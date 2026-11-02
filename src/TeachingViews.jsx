import { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, ExternalLink, FileText, RotateCcw, XCircle } from 'lucide-react';
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
  const [picks, setPicks] = useState({});
  const answered = Object.keys(picks).length;
  const score = quizQuestions.filter((question) => picks[question.id] === question.answer).length;
  const onPick = (id, letter) => setPicks((current) => (current[id] ? current : { ...current, [id]: letter }));
  const groups = ['基礎', '高階'].map((level) => ({
    level,
    items: quizQuestions.filter((question) => question.level === level)
  }));

  return (
    <section className="screen teach-screen">
      <header className="teach-head">
        <h1>考題</h1>
        <p>選擇後立即顯示答案與依據。不儲存作答，重新整理即清除。</p>
      </header>
      <div className="quiz-score" role="status">
        <strong>答對 {score}／已答 {answered}／共 {quizQuestions.length}</strong>
        <button type="button" className="outline-button" disabled={answered === 0} onClick={() => setPicks({})}>
          <RotateCcw size={15} aria-hidden="true" />
          重新作答
        </button>
      </div>
      {groups.map((group) => (
        <div className="quiz-group" key={group.level}>
          <h2>{group.level}（{group.items.length} 題）</h2>
          {group.items.map((question) => (
            <QuizCard
              key={question.id}
              question={question}
              number={quizQuestions.indexOf(question) + 1}
              picked={picks[question.id]}
              onPick={onPick}
            />
          ))}
        </div>
      ))}
    </section>
  );
}

export function MindMapView() {
  return (
    <section className="screen teach-screen">
      <header className="teach-head">
        <h1>心智圖</h1>
        <p>{mindMap.note}</p>
      </header>
      <div className="mindmap">
        <div className="mindmap-root">{mindMap.root}</div>
        <div className="mindmap-branches">
          {mindMap.branches.map((branch) => (
            <section className={`mindmap-branch tone-${branch.tone}`} key={branch.title}>
              <h2>{branch.title}</h2>
              {branch.items.map((item) => (
                <div className="mindmap-item" key={item.head}>
                  <h3>{item.head}</h3>
                  <ul>{item.leaves.map((leaf) => <li key={leaf}>{leaf}</li>)}</ul>
                </div>
              ))}
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
