import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let appModule;
let vite;

const context = {
  role: '營養師',
  patientName: '',
  age: '60',
  sex: '未填',
  ward: '一般病房',
  bed: '',
  admissionDay: '',
  height: '170',
  weight: '65',
  dryWeight: '',
  diagnosis: '',
  dietStatus: '一般飲食',
  npoReason: '',
  intake: '>=75%',
  giFunction: 'available',
  oralSafety: 'safe',
  renalModality: 'not assessed',
  pathways: {
    ICU: false,
    LIVER: false,
    RENAL: false,
    ONCOLOGY: false,
    GERIATRIC: false,
    GENERAL: true
  },
  modifiers: {
    heartFailure: false,
    dysphagia: false,
    edemaAscites: false,
    refeeding: false,
    poorIntake: false
  }
};

const answers = {
  intake: '>=75%',
  weightLoss: '否',
  muscleLoss: '無',
  gi: 'available',
  swallow: 'safe'
};

const recommendation = {
  primaryTool: 'NRS-2002',
  primaryPathway: 'general adult',
  modifiers: [],
  reasons: []
};

function renderResult(toolAssessment, overrides = {}) {
  const ResultScreen = appModule.ResultScreen;
  assert.equal(typeof ResultScreen, 'function', 'ResultScreen must be exported for focused rendering tests');

  return renderToStaticMarkup(React.createElement(ResultScreen, {
    context,
    recommendation,
    overrideTool: '',
    overrideReason: '',
    answers,
    toolAssessment,
    onContinueNativeAssessment: () => {},
    setActiveStep: () => {},
    onFinish: () => {},
    ...overrides
  }));
}

before(async () => {
  vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  appModule = await vite.ssrLoadModule('/src/App.jsx');
});

after(async () => {
  await vite?.close();
});

describe('ResultScreen native assessment presentation', () => {
  test('shows continuation progress and action for an unfinished native assessment', () => {
    const html = renderResult({
      answers: {},
      nativeStatus: 'NOT_STARTED',
      nativeScore: null,
      nativeCategory: '',
      completedAt: '',
      sourceMode: 'IN_APP_AUTOSCORE'
    });

    assert.match(html, /原始評估完成度/);
    assert.match(html, /20%/);
    assert.match(html, /待完成項目/);
    assert.match(html, /4 項/);
    assert.match(html, /原始量表尚未完成；不得以共同臨床資料推測量表分數/);
    assert.match(html, /繼續完成 NRS-2002 評估/);
    assert.match(html, /<button class="primary-button" disabled="">原始評估未完成<\/button>/);
  });

  test('shows score, category, mode, completion time, and normalized domains when complete', () => {
    const html = renderResult({
      answers: {
        initialBmiLow: 'no',
        initialWeightLoss: 'no',
        initialReducedIntake: 'no',
        initialSevereIllness: 'no'
      },
      nativeStatus: 'COMPLETE',
      nativeScore: 0,
      nativeCategory: '初篩陰性；建議每週重篩',
      completedAt: '2026-08-15T08:30:00.000Z',
      sourceMode: 'IN_APP_AUTOSCORE'
    });

    assert.match(html, /原始分數/);
    assert.match(html, /原始分類/);
    assert.match(html, /初篩陰性；建議每週重篩/);
    assert.match(html, /評估方式/);
    assert.match(html, /站內自動計分/);
    assert.match(html, /完成日期／時間/);
    assert.match(html, /正規化領域/);
    assert.match(html, /來源模式：站內自動計分/);
    assert.doesNotMatch(html, /繼續完成 NRS-2002 評估/);
    assert.match(html, /<button class="primary-button">完成並建立新評估<\/button>/);
  });

  test('explicitly identifies official result entry without local rescoring', () => {
    const html = renderResult({
      answers: {
        officialScore: '10',
        officialCategory: '有營養不良風險',
        completedDate: '2026-08-15',
        confirmed: true
      },
      nativeStatus: 'COMPLETE',
      nativeScore: 10,
      nativeCategory: '有營養不良風險',
      completedAt: '2026-08-15T08:30:00.000Z',
      sourceMode: 'OFFICIAL_EXTERNAL'
    }, {
      overrideTool: 'MNA-SF',
      overrideReason: '年長病人'
    });

    assert.match(html, /官方結果回填；本站未重新計分/);
    assert.match(html, /<span>完成日期<\/span><strong>2026-08-15<\/strong>/);
    assert.match(html, /完成日期：2026-08-15/);
    assert.doesNotMatch(html, /完成日期／時間/);
    assert.doesNotMatch(html, /完成日期(?:<\/span><strong>|：)[^<\n]*\d{1,2}:\d{2}/);
  });
});

test('continuation handler preserves assessment state and only changes focus and navigation', () => {
  assert.equal(
    typeof appModule.createContinueNativeAssessmentHandler,
    'function',
    'continuation handler factory must be exported for state-preservation tests'
  );

  const answersState = { ...answers };
  const toolAssessmentsState = { 'NRS-2002': { answers: { initialBmiLow: 'yes' } } };
  const assessmentState = {
    activeStep: 'result',
    focusNativeAssessment: false,
    answers: answersState,
    toolAssessments: toolAssessmentsState,
    overrideTool: 'NRS-2002',
    overrideReason: '臨床判斷'
  };
  const calls = [];
  const handler = appModule.createContinueNativeAssessmentHandler(
    (value) => {
      assessmentState.focusNativeAssessment = value;
      calls.push(['focus', value]);
    },
    (step) => {
      assessmentState.activeStep = step;
      calls.push(['navigate', step]);
    }
  );

  handler();

  assert.deepEqual(calls, [['focus', true], ['navigate', 'assessment']]);
  assert.equal(assessmentState.activeStep, 'assessment');
  assert.equal(assessmentState.focusNativeAssessment, true);
  assert.strictEqual(assessmentState.answers, answersState);
  assert.strictEqual(assessmentState.toolAssessments, toolAssessmentsState);
  assert.equal(assessmentState.overrideTool, 'NRS-2002');
  assert.equal(assessmentState.overrideReason, '臨床判斷');
});

test('native assessment focus helper focuses before scrolling the continuation destination', () => {
  assert.equal(
    typeof appModule.focusNativeAssessmentElement,
    'function',
    'focus helper must be exported for continuation accessibility tests'
  );

  const calls = [];
  const target = {
    focus: (options) => calls.push(['focus', options]),
    scrollIntoView: (options) => calls.push(['scroll', options])
  };

  appModule.focusNativeAssessmentElement(target);

  assert.deepEqual(calls, [
    ['focus', { preventScroll: true }],
    ['scroll', { block: 'start' }]
  ]);
});
