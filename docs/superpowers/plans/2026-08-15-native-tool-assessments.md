# 原始評估工具與未完成續填 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓六項營養評估工具都可選取，完成工具專屬原始評估或官方結果回填，並在結果未完成時返回第四步續填且保留既有資料。

**Architecture:** 新增 `toolAssessments.js` 集中保存工具模式、欄位完成規則、原始計分與正規化映射；新增 `ToolAssessmentForm.jsx` 呈現各工具專屬表單。`App.jsx` 只管理共同五題、每項工具的獨立作答狀態與頁面導向，`clinicalLogic.js` 繼續負責 Safety Gate、資料品質、臨床優先度及 feeding route，並接收已評估的工具原始結果。

**Tech Stack:** React 18、Vite 6、Node.js built-in test runner、lucide-react、CSS、GitHub Pages

## Global Constraints

- 所有 Tool Registry 工具均可被選取，不得再因 `PENDING_REVIEW` 停用操作。
- 共同五題只服務 Safety Gate、資料品質、feeding route 與 care bundle，不可產生任何工具原始分數。
- NRS-2002、mNUTRIC、RFH-NPT 在站內自動計分；7-point SGA 由營養師給予整體 1–7 分。
- MNA-SF 與 PG-SGA SF 只提供官方入口、完成確認與官方結果回填，不在公開網站重製受限制題目。
- 原始工具未完成不阻擋查看結果；nutrition risk 與 malnutrition 必須維持 `UNKNOWN`，結果頁提供返回第四步的續填按鈕。
- 切換工具不得清除其他工具的作答內容；建立新評估時才清除全部 `toolAssessments`。
- Safety Gate、clinical priority、feeding route 與 data-quality flags 保持獨立，不得被工具分數覆蓋。
- 外部官方連結以新分頁開啟，不得夾帶姓名、年齡、病房或任何 Patient Context。
- 靜態網站不得把病人資料送到遠端服務或保存到瀏覽器永久儲存。
- 不新增第三方套件，不自行計算 APACHE II 或 SOFA，不自動開立醫囑。

---

### Task 1: 工具模式與原始評估資料模型

**Files:**
- Create: `src/toolAssessments.js`
- Create: `src/toolAssessments.test.js`
- Modify: `src/clinicalLogic.js:135-166`
- Modify: `src/clinicalLogic.js:291-312`
- Test: `src/clinicalLogic.test.js:197-270`

**Interfaces:**
- Produces: `ASSESSMENT_MODES: Readonly<Record<string, string>>`
- Produces: `createEmptyToolAssessment(toolId: string): ToolAssessment`
- Produces: `createInitialToolAssessments(): Record<string, ToolAssessment>`
- Produces: `updateToolAssessment(store: object, toolId: string, patch: object): object`
- Extends: each `toolRegistry[toolId]` with `assessmentMode`, `modeLabel`, `sourceUrl`
- Removes: all `licenseStatus` checks from recommendation and navigation logic

- [ ] **Step 1: Write failing tests for independent per-tool state**

```js
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  ASSESSMENT_MODES,
  createEmptyToolAssessment,
  createInitialToolAssessments,
  updateToolAssessment
} from './toolAssessments.js';

test('creates one isolated assessment record for every tool', () => {
  const store = createInitialToolAssessments();

  assert.deepEqual(Object.keys(store), [
    'NRS-2002', 'MNA-SF', '7-point SGA', 'RFH-NPT', 'PG-SGA SF', 'mNUTRIC'
  ]);
  assert.equal(store['NRS-2002'].nativeStatus, 'NOT_STARTED');
  assert.equal(store['MNA-SF'].sourceMode, ASSESSMENT_MODES.OFFICIAL_EXTERNAL);
});

test('updating one tool does not clear another tool', () => {
  const first = updateToolAssessment(
    createInitialToolAssessments(),
    'NRS-2002',
    { initialBmiLow: 'yes' },
    { age: 60 }
  );
  const second = updateToolAssessment(
    first,
    'mNUTRIC',
    { apacheIi: '20' },
    { age: 60 }
  );

  assert.equal(second['NRS-2002'].answers.initialBmiLow, 'yes');
  assert.equal(second.mNUTRIC.answers.apacheIi, '20');
});
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run:

```bash
PATH=/Users/YHTseng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/YHTseng/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH pnpm test -- --test-name-pattern="isolated assessment|does not clear"
```

Expected: FAIL because `src/toolAssessments.js` does not exist.

- [ ] **Step 3: Implement assessment modes, record factories, and immutable updates**

```js
export const ASSESSMENT_MODES = Object.freeze({
  IN_APP_AUTOSCORE: 'IN_APP_AUTOSCORE',
  CLINICIAN_RATED: 'CLINICIAN_RATED',
  OFFICIAL_EXTERNAL: 'OFFICIAL_EXTERNAL'
});

export const TOOL_ASSESSMENT_MODES = Object.freeze({
  'NRS-2002': ASSESSMENT_MODES.IN_APP_AUTOSCORE,
  'MNA-SF': ASSESSMENT_MODES.OFFICIAL_EXTERNAL,
  '7-point SGA': ASSESSMENT_MODES.CLINICIAN_RATED,
  'RFH-NPT': ASSESSMENT_MODES.IN_APP_AUTOSCORE,
  'PG-SGA SF': ASSESSMENT_MODES.OFFICIAL_EXTERNAL,
  mNUTRIC: ASSESSMENT_MODES.IN_APP_AUTOSCORE
});

export function createEmptyToolAssessment(toolId) {
  return {
    answers: {},
    nativeStatus: 'NOT_STARTED',
    nativeScore: null,
    nativeCategory: '',
    completedAt: '',
    sourceMode: TOOL_ASSESSMENT_MODES[toolId]
  };
}

export function createInitialToolAssessments() {
  return Object.fromEntries(
    Object.keys(TOOL_ASSESSMENT_MODES).map((toolId) => [toolId, createEmptyToolAssessment(toolId)])
  );
}
```

Implement the initial `updateToolAssessment` without depending on later scoring functions:

```js
export function updateToolAssessment(store, toolId, patch) {
  const current = store[toolId] || createEmptyToolAssessment(toolId);
  const answers = { ...current.answers, ...patch };
  const hasRecordedAnswer = Object.values(answers).some((value) => value !== '' && value != null && value !== false);
  return {
    ...store,
    [toolId]: {
      ...current,
      answers,
      nativeStatus: hasRecordedAnswer ? 'IN_PROGRESS' : 'NOT_STARTED'
    }
  };
}
```

Task 5 will extend this function to store completed scoring output. Do not mutate the previous record or any other tool record.

- [ ] **Step 4: Replace license metadata with assessment-mode metadata**

Use these exact Tool Registry values:

```js
'NRS-2002': { assessmentMode: 'IN_APP_AUTOSCORE', modeLabel: '站內自動計分', sourceUrl: 'https://www.espen.org/documents/Screening.pdf' }
'MNA-SF': { assessmentMode: 'OFFICIAL_EXTERNAL', modeLabel: '官方工具結果回填', sourceUrl: 'https://www.mna-elderly.com/mna-forms' }
'7-point SGA': { assessmentMode: 'CLINICIAN_RATED', modeLabel: '營養師整體評定', sourceUrl: 'https://www.kidney.org/sites/default/files/12-85-0946_ica_crn-pocket-guide_v6_chp_1.pdf' }
'RFH-NPT': { assessmentMode: 'IN_APP_AUTOSCORE', modeLabel: '站內自動計分', sourceUrl: 'https://www.frontiersin.org/journals/nutrition/articles/10.3389/fnut.2021.766350/full' }
'PG-SGA SF': { assessmentMode: 'OFFICIAL_EXTERNAL', modeLabel: '官方工具結果回填', sourceUrl: 'https://pt-global.org/pt-global-app/' }
mNUTRIC: { assessmentMode: 'IN_APP_AUTOSCORE', modeLabel: '站內自動計分', sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5842932/' }
```

Preserve each existing `type` and `population`; use these exact versions: `NRS-2002 (ESPEN)`, `MNA-SF official form`, `7-point SGA (NKF)`, `RFH-NPT`, `PG-SGA SF / Pt-Global`, and `mNUTRIC without IL-6 (0-9)`.

- [ ] **Step 5: Make every recommended and override tool selectable**

Change `getRecommendation` so every alternative receives `judgment: toolRegistry[value.tool].modeLabel` and `nextStep: '完成共同與原始評估'`. Delete the test named `does not generate a native result for a tool pending license review`; Task 5 replaces it with native-status tests.

- [ ] **Step 6: Run model tests**

Run the focused command from Step 2.

Expected: both new tests PASS.

- [ ] **Step 7: Commit the shared assessment model**

```bash
git add src/toolAssessments.js src/toolAssessments.test.js src/clinicalLogic.js src/clinicalLogic.test.js
git commit -m "Add native assessment state model"
```

---

### Task 2: NRS-2002 與 mNUTRIC 原始計分

**Files:**
- Modify: `src/toolAssessments.js`
- Test: `src/toolAssessments.test.js`

**Interfaces:**
- Produces: `scoreNrs2002(answers: object, context: object): NativeEvaluation`
- Produces: `scoreMNutric(answers: object, context: object): NativeEvaluation`
- `NativeEvaluation`: `{ nativeStatus, nativeScore, nativeCategory, missing, normalizedNutritionRisk, normalizedMalnutrition }`

- [ ] **Step 1: Write failing NRS-2002 tests**

```js
describe('NRS-2002', () => {
  test('completes a negative four-question initial screen without final scoring', () => {
    const result = scoreNrs2002({
      initialBmiLow: 'no', initialWeightLoss: 'no', initialReducedIntake: 'no', initialSevereIllness: 'no'
    }, { age: 69 });

    assert.equal(result.nativeStatus, 'COMPLETE');
    assert.equal(result.nativeScore, 0);
    assert.equal(result.nativeCategory, '初篩陰性；建議每週重篩');
    assert.equal(result.normalizedNutritionRisk, 'LOW');
  });

  test('adds one point for age 70 or older after a positive initial screen', () => {
    const result = scoreNrs2002({
      initialBmiLow: 'yes', initialWeightLoss: 'no', initialReducedIntake: 'no', initialSevereIllness: 'no',
      nutritionScore: '1', diseaseScore: '1'
    }, { age: 70 });

    assert.equal(result.nativeScore, 3);
    assert.equal(result.nativeCategory, '有營養風險');
    assert.equal(result.normalizedNutritionRisk, 'AT_RISK');
  });

  test('does not score a positive screen until both final domains are recorded', () => {
    const result = scoreNrs2002({
      initialBmiLow: 'yes', initialWeightLoss: 'no', initialReducedIntake: 'no', initialSevereIllness: 'no',
      nutritionScore: '2'
    }, { age: 55 });

    assert.equal(result.nativeStatus, 'IN_PROGRESS');
    assert.equal(result.nativeScore, null);
    assert.deepEqual(result.missing, ['diseaseScore']);
  });
});
```

- [ ] **Step 2: Run NRS tests and verify failure**

Run:

```bash
PATH=/Users/YHTseng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/YHTseng/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH pnpm test -- --test-name-pattern="NRS-2002"
```

Expected: FAIL because `scoreNrs2002` is not exported.

- [ ] **Step 3: Implement the NRS-2002 branch and boundaries**

Require all four initial fields. If all four equal `no`, return complete score `0`. If any equals `yes`, require integer `nutritionScore` and `diseaseScore` within `0..3`; add `1` only when `Number(context.age) >= 70`. Total `<3` maps to `LOW`; total `>=3` maps to `AT_RISK`. NRS-2002 never maps the malnutrition domain, so return `normalizedMalnutrition: 'NOT_APPLICABLE'`.

- [ ] **Step 4: Write failing mNUTRIC boundary tests**

```js
describe('mNUTRIC', () => {
  test('scores all lower boundaries as zero', () => {
    const result = scoreMNutric({ apacheIi: '14', sofa: '5', comorbidities: '1', preIcuDays: '0' }, { age: 49 });
    assert.equal(result.nativeScore, 0);
    assert.equal(result.normalizedNutritionRisk, 'LOW');
  });

  test('scores the validated upper categories to nine', () => {
    const result = scoreMNutric({ apacheIi: '29', sofa: '10', comorbidities: '2', preIcuDays: '1' }, { age: 75 });
    assert.equal(result.nativeScore, 9);
    assert.equal(result.nativeCategory, '高分');
    assert.equal(result.normalizedNutritionRisk, 'HIGH');
  });

  test('uses the five-point high-risk threshold', () => {
    const result = scoreMNutric({ apacheIi: '20', sofa: '6', comorbidities: '2', preIcuDays: '0' }, { age: 50 });
    assert.equal(result.nativeScore, 5);
    assert.equal(result.normalizedNutritionRisk, 'HIGH');
  });

  test('rejects out-of-range and non-integer clinical scores', () => {
    const result = scoreMNutric({ apacheIi: '72', sofa: '4.5', comorbidities: '-1', preIcuDays: '0' }, { age: 60 });
    assert.equal(result.nativeStatus, 'IN_PROGRESS');
    assert.deepEqual(result.invalid, ['apacheIi', 'sofa', 'comorbidities']);
  });
});
```

- [ ] **Step 5: Implement exact mNUTRIC point tables**

Use integer input ranges `APACHE II 0..71`, `SOFA 0..24`, `comorbidities >=0`, and numeric `preIcuDays >=0`. Score:

```js
const agePoints = age < 50 ? 0 : age < 75 ? 1 : 2;
const apachePoints = apache < 15 ? 0 : apache < 20 ? 1 : apache <= 28 ? 2 : 3;
const sofaPoints = sofa < 6 ? 0 : sofa < 10 ? 1 : 2;
const comorbidityPoints = comorbidities < 2 ? 0 : 1;
const preIcuPoints = preIcuDays < 1 ? 0 : 1;
```

Totals `0..4` map to native category `低分` and normalized risk `LOW`; `5..9` map to `高分` and `HIGH`. Return `normalizedMalnutrition: 'NOT_APPLICABLE'`.

- [ ] **Step 6: Run all tool scoring tests**

Run:

```bash
PATH=/Users/YHTseng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/YHTseng/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH pnpm test src/toolAssessments.test.js
```

Expected: all NRS-2002 and mNUTRIC tests PASS.

- [ ] **Step 7: Commit NRS-2002 and mNUTRIC scoring**

```bash
git add src/toolAssessments.js src/toolAssessments.test.js
git commit -m "Implement NRS and mNUTRIC scoring"
```

---

### Task 3: RFH-NPT 分支式原始計分

**Files:**
- Modify: `src/toolAssessments.js`
- Test: `src/toolAssessments.test.js`

**Interfaces:**
- Produces: `scoreRfhNpt(answers: object, context: object): NativeEvaluation`
- Calculates: BMI as `weightKg / (heightCm / 100) ** 2` inside `toolAssessments.js`, returning invalid when either value is missing or non-positive

- [ ] **Step 1: Write failing tests for the three RFH-NPT paths**

```js
describe('RFH-NPT', () => {
  test('classifies alcoholic hepatitis or tube feeding directly as high risk', () => {
    const result = scoreRfhNpt({ alcoholicHepatitis: 'yes', tubeFeeding: 'no' }, { height: 170, weight: 70 });
    assert.equal(result.nativeScore, 6);
    assert.equal(result.nativeCategory, '高風險');
    assert.equal(result.normalizedNutritionRisk, 'HIGH');
  });

  test('scores the no-fluid-overload BMI path', () => {
    const result = scoreRfhNpt({
      alcoholicHepatitis: 'no', tubeFeeding: 'no', fluidOverload: 'no',
      weightLossPercent: '7', acuteNoIntakeFiveDays: 'no'
    }, { height: 170, weight: 53.5 });

    assert.equal(result.nativeScore, 2);
    assert.equal(result.nativeCategory, '高風險');
  });

  test('scores only the fluid-overload branch fields', () => {
    const result = scoreRfhNpt({
      alcoholicHepatitis: 'no', tubeFeeding: 'no', fluidOverload: 'yes',
      incompleteMealsFromFluid: 'sometimes', intakeReducedFifty: 'yes', fluidWeightLoss: 'uncertain'
    }, { height: 170, weight: 90 });

    assert.equal(result.nativeScore, 5);
    assert.equal(result.nativeCategory, '高風險');
  });

  test('does not require hidden fields from the other RFH branch', () => {
    const result = scoreRfhNpt({
      alcoholicHepatitis: 'no', tubeFeeding: 'no', fluidOverload: 'yes',
      incompleteMealsFromFluid: 'no', intakeReducedFifty: 'no', fluidWeightLoss: 'no'
    }, { height: 170, weight: 70 });

    assert.equal(result.nativeStatus, 'COMPLETE');
    assert.equal(result.nativeScore, 1);
    assert.equal(result.nativeCategory, '中度風險');
  });
});
```

- [ ] **Step 2: Run RFH tests and verify failure**

Run:

```bash
PATH=/Users/YHTseng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/YHTseng/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH pnpm test -- --test-name-pattern="RFH-NPT"
```

Expected: FAIL because `scoreRfhNpt` is not exported.

- [ ] **Step 3: Implement RFH-NPT branching without cross-branch addition**

Use this exact decision order:

```js
function classifyRfhScore(score) {
  if (score === 0) return { nativeScore: score, nativeCategory: '低風險', normalizedNutritionRisk: 'LOW' };
  if (score === 1) return { nativeScore: score, nativeCategory: '中度風險', normalizedNutritionRisk: 'AT_RISK' };
  return { nativeScore: score, nativeCategory: '高風險', normalizedNutritionRisk: 'HIGH' };
}

if (answers.alcoholicHepatitis === 'yes' || answers.tubeFeeding === 'yes') {
  return { nativeStatus: 'COMPLETE', ...classifyRfhScore(6), normalizedMalnutrition: 'NOT_APPLICABLE' };
}

if (answers.fluidOverload === 'no') {
  const bmiPoints = bmi > 20 ? 0 : bmi >= 18.5 ? 1 : 2;
  const weightLossPoints = weightLossPercent < 5 ? 0 : weightLossPercent <= 10 ? 1 : 2;
  const acutePoints = answers.acuteNoIntakeFiveDays === 'yes' ? 2 : 0;
  return { nativeStatus: 'COMPLETE', ...classifyRfhScore(bmiPoints + weightLossPoints + acutePoints), normalizedMalnutrition: 'NOT_APPLICABLE' };
}

const fluidPoints = 1;
const mealPoints = { no: 0, sometimes: 1, yes: 2 }[answers.incompleteMealsFromFluid];
const intakePoints = answers.intakeReducedFifty === 'yes' ? 2 : 0;
const weightPoints = { no: 0, uncertain: 1, yes: 2 }[answers.fluidWeightLoss];
return { nativeStatus: 'COMPLETE', ...classifyRfhScore(fluidPoints + mealPoints + intakePoints + weightPoints), normalizedMalnutrition: 'NOT_APPLICABLE' };
```

Require positive height and weight only for the no-fluid-overload BMI path. Classify score `0` as `低風險`/`LOW`, score `1` as `中度風險`/`AT_RISK`, and score `2..7` as `高風險`/`HIGH`. Return `normalizedMalnutrition: 'NOT_APPLICABLE'`.

- [ ] **Step 4: Add edge tests for BMI and weight-loss boundaries**

Test BMI `20.1`, `20`, and `18.4`; test weight loss `4.9`, `5`, `10`, and `10.1`; test a missing branch field returns `IN_PROGRESS` with only the visible branch field in `missing`.

- [ ] **Step 5: Run scoring tests and commit**

Run:

```bash
PATH=/Users/YHTseng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/YHTseng/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH pnpm test src/toolAssessments.test.js
```

Expected: all RFH-NPT tests PASS.

```bash
git add src/toolAssessments.js src/toolAssessments.test.js
git commit -m "Implement RFH NPT branch scoring"
```

---

### Task 4: 7-point SGA 與官方外部工具回填

**Files:**
- Modify: `src/toolAssessments.js`
- Test: `src/toolAssessments.test.js`

**Interfaces:**
- Produces: `scoreSevenPointSga(answers: object): NativeEvaluation`
- Produces: `scoreOfficialExternal(toolId: 'MNA-SF' | 'PG-SGA SF', answers: object): NativeEvaluation`
- Produces: official link metadata through `toolRegistry[toolId].sourceUrl`

- [ ] **Step 1: Write failing 7-point SGA tests**

```js
const completeSgaObservations = {
  weightChange: 'stable', intakeChange: 'none', giSymptoms: 'none', functionalCapacity: 'normal',
  diseaseBurden: 'low', subcutaneousFat: 'normal', muscleWasting: 'normal'
};

test('requires every structured observation and the clinician overall rating', () => {
  const result = scoreSevenPointSga({ ...completeSgaObservations, overallScore: '' });
  assert.equal(result.nativeStatus, 'IN_PROGRESS');
  assert.deepEqual(result.missing, ['overallScore']);
});

for (const [score, category, normalized] of [
  [1, '嚴重營養不良', 'SEVERE'],
  [2, '嚴重營養不良', 'SEVERE'],
  [3, '輕至中度營養不良', 'MODERATE'],
  [5, '輕至中度營養不良', 'MODERATE'],
  [6, '營養良好', 'NO_MALNUTRITION'],
  [7, '營養良好', 'NO_MALNUTRITION']
]) {
  test(`maps 7-point SGA score ${score} without mechanically summing observations`, () => {
    const result = scoreSevenPointSga({ ...completeSgaObservations, overallScore: String(score) });
    assert.equal(result.nativeScore, score);
    assert.equal(result.nativeCategory, category);
    assert.equal(result.normalizedMalnutrition, normalized);
    assert.equal(result.normalizedNutritionRisk, 'NOT_APPLICABLE');
  });
}
```

- [ ] **Step 2: Implement clinician-rated SGA completion**

Require these exact fields: `weightChange`, `intakeChange`, `giSymptoms`, `functionalCapacity`, `diseaseBurden`, `subcutaneousFat`, `muscleWasting`, `overallScore`. Validate `overallScore` as an integer `1..7`. Do not assign points to the seven observation fields and do not derive `overallScore` from them.

- [ ] **Step 3: Write failing MNA-SF and PG-SGA SF result tests**

```js
test('keeps an external score in progress until official completion is confirmed', () => {
  const result = scoreOfficialExternal('MNA-SF', { officialScore: '10', officialCategory: '有營養不良風險', confirmed: false });
  assert.equal(result.nativeStatus, 'IN_PROGRESS');
  assert.equal(result.nativeScore, null);
});

for (const [score, category] of [[14, '營養正常'], [10, '有營養不良風險'], [6, '營養不良']]) {
  test(`validates MNA-SF score ${score} against its official category`, () => {
    const result = scoreOfficialExternal('MNA-SF', {
      officialScore: String(score), officialCategory: category, confirmed: true, completedDate: '2026-08-15'
    });
    assert.equal(result.nativeStatus, 'COMPLETE');
    assert.equal(result.nativeCategory, category);
  });
}

for (const [score, category] of [[1, '0–1 分'], [3, '2–3 分'], [8, '4–8 分'], [9, '9 分以上']]) {
  test(`validates PG-SGA SF triage band for score ${score}`, () => {
    const result = scoreOfficialExternal('PG-SGA SF', {
      officialScore: String(score), officialCategory: category, confirmed: true, completedDate: '2026-08-15'
    });
    assert.equal(result.nativeStatus, 'COMPLETE');
  });
}
```

- [ ] **Step 4: Implement official external completion and consistency checks**

MNA-SF accepts integer score `0..14` and enforces: `12..14 = 營養正常`, `8..11 = 有營養不良風險`, `0..7 = 營養不良`. Normalize to `LOW/NO_MALNUTRITION`, `AT_RISK/UNKNOWN`, and `AT_RISK/MALNOURISHED` respectively.

PG-SGA SF accepts integer score `0..36` and enforces the selected triage band: `0..1`, `2..3`, `4..8`, `9+`. Normalize `0..3` to `LOW`, `4..8` to `AT_RISK`, and `>=9` to `HIGH`; malnutrition remains `NOT_APPLICABLE` because the short form triage score is not a malnutrition diagnosis.

Both tools require `completedDate`, a matching `officialCategory`, and `confirmed === true`. A score/category mismatch returns `IN_PROGRESS`, leaves `nativeScore` null, and includes `officialCategory` in `invalid`.

- [ ] **Step 5: Run all tool-assessment tests and commit**

Run:

```bash
PATH=/Users/YHTseng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/YHTseng/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH pnpm test src/toolAssessments.test.js
```

Expected: all 7-point SGA, MNA-SF, and PG-SGA SF tests PASS.

```bash
git add src/toolAssessments.js src/toolAssessments.test.js
git commit -m "Add clinician and official result workflows"
```

---

### Task 5: 原始結果正規化與 Safety Gate 分離

**Files:**
- Modify: `src/clinicalLogic.js:315-416`
- Modify: `src/clinicalLogic.test.js:153-270`
- Test: `src/toolAssessments.test.js`

**Interfaces:**
- Produces: `evaluateToolAssessment(toolId, record, context): ToolAssessment`
- Changes: `updateToolAssessment(store, toolId, patch)` to `updateToolAssessment(store, toolId, patch, context, now?: string)`
- Changes: `normalizeResult(context, answers, recommendation, overrideTool, toolAssessment)`
- Preserves: `getRoute(context, answers, result)` signature and safety behavior

- [ ] **Step 1: Write failing normalization tests for unfinished native assessments**

```js
test('returns common clinical results while keeping an unfinished native tool unknown', () => {
  const result = normalizeResult(
    baseContext,
    completeAnswers,
    getRecommendation(baseContext),
    'NRS-2002',
    createEmptyToolAssessment('NRS-2002')
  );

  assert.equal(result.nativeStatus, 'NOT_STARTED');
  assert.equal(result.native, '原始評估未完成');
  assert.equal(result.nutritionRisk, 'UNKNOWN');
  assert.equal(result.malnutrition, 'UNKNOWN');
  assert.equal(result.assessmentStatus, 'TOOL_SCORE_PENDING');
});
```

- [ ] **Step 2: Write failing normalization tests for completed risk and assessment tools**

```js
test('normalizes a completed NRS-2002 result only into the nutrition-risk domain', () => {
  const native = evaluateToolAssessment('NRS-2002', {
    ...createEmptyToolAssessment('NRS-2002'),
    answers: {
      initialBmiLow: 'yes', initialWeightLoss: 'no', initialReducedIntake: 'no', initialSevereIllness: 'no',
      nutritionScore: '2', diseaseScore: '1'
    }
  }, { ...baseContext, age: 70 });
  const result = normalizeResult(baseContext, completeAnswers, getRecommendation(baseContext), 'NRS-2002', native);

  assert.equal(result.nutritionRisk, 'AT_RISK');
  assert.equal(result.malnutrition, 'NOT_APPLICABLE');
  assert.equal(result.nativeScore, 4);
});

test('normalizes a completed 7-point SGA result only into the malnutrition domain', () => {
  const native = evaluateToolAssessment('7-point SGA', {
    ...createEmptyToolAssessment('7-point SGA'),
    answers: {
      weightChange: 'stable', intakeChange: 'none', giSymptoms: 'none', functionalCapacity: 'normal',
      diseaseBurden: 'low', subcutaneousFat: 'normal', muscleWasting: 'normal', overallScore: '3'
    }
  }, baseContext);
  const result = normalizeResult(baseContext, completeAnswers, getRecommendation(baseContext), '7-point SGA', native);

  assert.equal(result.nutritionRisk, 'NOT_APPLICABLE');
  assert.equal(result.malnutrition, 'MODERATE');
});
```

- [ ] **Step 3: Extract the existing common-data priority calculation**

Move the current severe/moderate signal and safety logic into:

```js
function getClinicalPriority(answers, intake, safetyFlags, dataQualityFlags) {
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
  const red = severeSignals >= 2 || safetyFlags.includes('Refeeding risk');
  const amber = severeSignals === 1 || moderateSignals >= 1 || safetyFlags.length > 0 || dataQualityFlags.length > 0;
  const criticalUnknown = dataQualityFlags.includes('GI tract uncertain') || dataQualityFlags.includes('Intake not assessed');
  return red ? 'RED' : criticalUnknown ? 'GRAY' : amber ? 'AMBER' : 'GRAY';
}
```

Call this function whether the native tool is complete or not. Do not promote or lower priority from a native score.

- [ ] **Step 4: Integrate native results into `normalizeResult`**

After common five-question completeness is confirmed, evaluate the selected record. Every evaluation returns `answered`, `total`, `percent`, `missing`, and `invalid`; conditional tools count only currently visible fields. For `NOT_STARTED` or `IN_PROGRESS`, return `TOOL_SCORE_PENDING`, `UNKNOWN` risk/malnutrition, and the native missing list. For `COMPLETE`, return `nativeScore`, `nativeCategory`, `nativeStatus`, `sourceMode`, `completedAt`, and its two explicit normalized domains. Preserve `safetyFlags`, `dataQualityFlags`, and the priority from Step 3 in both branches.

Extend `updateToolAssessment(store, toolId, patch, context, now = new Date().toISOString())` to evaluate the merged record. When a record first becomes `COMPLETE`, set `completedAt` to the external `completedDate` or `now`; preserve an existing completion time on later edits that remain complete, and clear it if required answers become incomplete.

- [ ] **Step 5: Extend Chinese status labels**

Add exact labels for `LOW`, `NO_MALNUTRITION`, `MALNOURISHED`, `NOT_STARTED`, `IN_PROGRESS`, `COMPLETE`, `IN_APP_AUTOSCORE`, `CLINICIAN_RATED`, `OFFICIAL_EXTERNAL`, and `原始評估未完成`. Ensure `getResultTone('risk', 'LOW')` and `getResultTone('malnutrition', 'NO_MALNUTRITION')` are green, while `getResultTone('malnutrition', 'MALNOURISHED')` is red.

- [ ] **Step 6: Run all pure-logic tests**

Run:

```bash
PATH=/Users/YHTseng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/YHTseng/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH pnpm test
```

Expected: all existing Safety Gate tests and all new native normalization tests PASS.

- [ ] **Step 7: Commit normalization integration**

```bash
git add src/clinicalLogic.js src/clinicalLogic.test.js src/toolAssessments.js src/toolAssessments.test.js
git commit -m "Normalize completed native assessments"
```

---

### Task 6: 第四步工具專屬評估表與狀態保存

**Files:**
- Create: `src/ToolAssessmentForm.jsx`
- Modify: `src/App.jsx:1-32`
- Modify: `src/App.jsx:312-448`
- Modify: `src/App.jsx:721-799`
- Modify: `src/styles.css:770-882`

**Interfaces:**
- Produces: `ToolAssessmentForm({ toolId, context, assessment, onChange })`
- Consumes: `toolRegistry[toolId]`, `evaluateToolAssessment`, and the tool-specific score functions
- Changes: `AssessmentScreen` receives `toolAssessments`, `setToolAssessments`, and `focusNativeAssessment`
- Adds state: `const [toolAssessments, setToolAssessments] = useState(createInitialToolAssessments)`

- [ ] **Step 1: Remove every UI-level license gate**

In `ToolScreen`, calculate:

```js
const canStart = !overrideTool || overrideReason.trim().length > 0;
```

Remove both tool-button `disabled` expressions. Display `registry.modeLabel` instead of `licenseStatus`, change the main command to `開始評估`, and show Tool Registry metadata labels `評估方式` and `來源版本`.

- [ ] **Step 2: Add app-level independent tool state**

```jsx
const [toolAssessments, setToolAssessments] = useState(createInitialToolAssessments);
const [focusNativeAssessment, setFocusNativeAssessment] = useState(false);

const updateSelectedToolAssessment = (patch) => {
  if (!selectedTool) return;
  setToolAssessments((current) => updateToolAssessment(current, selectedTool, patch, context));
};
```

Remove `selectedRegistry?.licenseStatus === 'APPROVED'` from `canStartAssessment`. In `finishAssessment`, call `setToolAssessments(createInitialToolAssessments())` and reset `focusNativeAssessment` to `false`.

- [ ] **Step 3: Build reusable field controls in `ToolAssessmentForm.jsx`**

Implement local `ChoiceField`, `NumberField`, `SelectField`, and `ExternalToolFields` components. Every control is controlled by `assessment.answers`; buttons use `.option`, numerical fields use `<input type="number">`, categories use `<select>`, and unfamiliar external-link commands use the lucide `ExternalLink` icon with `title="開啟官方評估工具"`.

- [ ] **Step 4: Render exact NRS-2002 and mNUTRIC fields**

NRS-2002 renders four yes/no initial questions. Only when any answer is `yes`, render selects for nutrition status `0..3` and disease severity `0..3`, with the official descriptor shown inside each option. Display age and the automatic `>=70` age point read-only.

mNUTRIC displays age read-only and numerical fields for APACHE II, SOFA, number of comorbidities, and hospital-to-ICU days. Show field-level ranges and `assessment.invalid`; do not calculate APACHE II or SOFA from other data.

- [ ] **Step 5: Render the two RFH-NPT conditional branches**

Always render alcoholic hepatitis and current tube feeding. If either is `yes`, display the completed high-risk result and hide later branches. Otherwise show fluid overload. `no` renders the computed BMI, weight-loss percentage, and acute illness/no intake question; `yes` renders fluid-effect on meals, intake reduction over 50%, and weight-loss certainty. Hidden branch values may remain stored but must not participate in scoring.

- [ ] **Step 6: Render 7-point SGA and external result forms**

7-point SGA renders seven structured observation selects and one overall score `1..7`; label the score as `營養師整體評定，不由前述欄位加總`.

MNA-SF and PG-SGA SF render only: official source link, completed date, official total score, official category select, and checkbox `已使用官方版本完成評估`. Set `target="_blank"` and `rel="noreferrer"`; build `href` directly from `registry.sourceUrl` with no query string.

- [ ] **Step 7: Add the original-assessment panel to Step 4**

After the common five-question panel, render:

```jsx
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
```

Use an effect to call `nativeAssessmentRef.current?.scrollIntoView({ block: 'start' })` when `focusNativeAssessment` is true, then reset the flag. The `查看臨床結果` button remains gated only by completion of the common five questions.

- [ ] **Step 8: Add responsive form styling and build**

Add `.native-assessment`, `.native-status`, `.native-field-grid`, `.field-error`, `.official-tool-row`, and `.completion-check` rules. Use two columns above 760px and one column below 760px; ensure long option labels wrap and no fixed width can create horizontal overflow.

Run:

```bash
PATH=/Users/YHTseng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/YHTseng/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH pnpm test
PATH=/Users/YHTseng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/YHTseng/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH pnpm build
```

Expected: all tests PASS and Vite production build succeeds.

- [ ] **Step 9: Commit the native assessment UI**

```bash
git add src/App.jsx src/ToolAssessmentForm.jsx src/styles.css
git commit -m "Add tool specific assessment forms"
```

---

### Task 7: 結果頁未完成續填與完整原始結果

**Files:**
- Modify: `src/App.jsx:452-565`
- Modify: `src/App.jsx:721-799`
- Modify: `src/styles.css:883-1035`

**Interfaces:**
- Changes: `ResultScreen` receives `toolAssessment` and `onContinueNativeAssessment`
- Produces: result action `繼續完成 [工具名稱] 評估`
- Produces: completed metadata for score, category, mode, and completion time

- [ ] **Step 1: Pass the selected assessment into result normalization**

```jsx
const selectedTool = overrideTool || recommendation.primaryTool;
const nativeEvaluation = evaluateToolAssessment(selectedTool, toolAssessment, context);
const result = normalizeResult(
  context, answers, recommendation, overrideTool, nativeEvaluation
);
```

- [ ] **Step 2: Render the unfinished action in the original-result panel**

When `result.nativeStatus !== 'COMPLETE'`, render status, completed percentage, missing count, and:

```jsx
<button className="primary-button native-continue" onClick={onContinueNativeAssessment}>
  <ClipboardCheck size={17} />
  繼續完成 {result.tool} 評估
</button>
```

`onContinueNativeAssessment` sets `focusNativeAssessment` to `true` and navigates to `assessment`. It must not reset `answers`, `toolAssessments`, `overrideTool`, or `overrideReason`.

- [ ] **Step 3: Render completed original metadata**

For completed assessments, replace the fixed `尚未完成經驗證量表的原始計分` text with `原始分數`, `原始分類`, `評估方式`, `完成日期／時間`, and `正規化領域`. For external tools explicitly show `官方結果回填；本站未重新計分`.

- [ ] **Step 4: Update documentation summary**

Include native status, native score, native category, and source mode. When unfinished, write `原始量表尚未完成；不得以共同臨床資料推測量表分數`. Preserve Safety Gate, data quality, route, selected tool, and override reason lines.

- [ ] **Step 5: Verify navigation and build**

Run all tests and build with the bundled PATH commands from Task 6.

Expected: common questions alone produce a result page with unknown normalized domains and a continuation button; completing the native form replaces the button with its original score and category.

- [ ] **Step 6: Commit result continuation**

```bash
git add src/App.jsx src/styles.css
git commit -m "Add unfinished assessment continuation"
```

---

### Task 8: 瀏覽器驗證、文件與 GitHub Pages

**Files:**
- Modify: `README.md`
- Modify: implementation files only if browser verification finds a reproducible defect

**Interfaces:**
- Verifies: six selectable tools, four completion modes, retained state, incomplete continuation, no patient-data URL leakage
- Delivers: production build and verified public GitHub Pages URL

- [ ] **Step 1: Update README with implemented behavior only**

Document that all six tools are selectable, identify the three assessment modes, state that MNA-SF/PG-SGA SF use official result entry, and explain that incomplete original results remain unknown with a continuation action. Do not claim EMR integration, remote persistence, or validated local copies of restricted forms.

- [ ] **Step 2: Start the Vite development server**

Run:

```bash
PATH=/Users/YHTseng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/YHTseng/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH pnpm dev -- --host 127.0.0.1
```

Expected: Vite prints an available localhost URL; keep the session running until browser checks finish.

- [ ] **Step 3: Verify the six-tool workflow in a desktop browser**

At `1440x1000`, complete a valid adult context and check every tool can be selected. Verify:

- NRS-2002 initial-negative and positive-final-score paths.
- mNUTRIC score `5` at its high-risk boundary.
- RFH-NPT direct-high, no-fluid, and fluid-overload paths.
- 7-point SGA requires all observations and preserves the clinician overall score.
- MNA-SF and PG-SGA SF links open an unparameterized official URL and completion requires confirmation.
- Switching tools preserves each tool's answers.
- Common five questions alone allow the result page; the continuation button returns to the correct native form with prior answers intact.

- [ ] **Step 4: Verify responsive layout and runtime health**

Repeat at `390x844`. Confirm no horizontal overflow, clipped controls, overlapping text, console errors, or failed network requests for local assets. Save desktop and mobile screenshots under `/tmp` for inspection; do not commit them.

- [ ] **Step 5: Run final automated verification**

```bash
PATH=/Users/YHTseng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/YHTseng/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH pnpm test
PATH=/Users/YHTseng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/YHTseng/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH pnpm build
git diff --check
git status --short
```

Expected: all tests pass, Vite build succeeds, no whitespace errors, and only intended files are modified.

- [ ] **Step 6: Commit documentation and any verified fixes**

```bash
git add README.md src
git commit -m "Document native assessment workflows"
```

If browser verification required no code fixes and README was already committed with an earlier task, skip this commit rather than creating an empty commit.

- [ ] **Step 7: Push and verify GitHub Pages**

Push `main`, monitor the repository's existing GitHub Pages workflow until success, then request `https://yht5582-source.github.io/inpatient-nutrition-assessment/` and verify HTTP 200 plus the new result-continuation text in the deployed asset. Do not report deployment complete until both workflow completion and public URL verification succeed.
