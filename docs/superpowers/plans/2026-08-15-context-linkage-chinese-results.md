# 病人背景連動與中文結果頁 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將病房與入院診斷改成下拉選單，連動臨床路徑／特殊因子，並將結果頁完整中文化及讓 `RED` 處置優先度顯示紅字。

**Architecture:** 在 `clinicalLogic.js` 集中保存下拉選項、背景選擇更新與不一致警示等純邏輯，`App.jsx` 僅負責呼叫並呈現。內部臨床代碼維持不變，結果頁透過顯示層字典轉成中文，避免改動正規化與安全閘門判斷。

**Tech Stack:** React 19、Vite 6、Node.js built-in test runner、CSS

## Global Constraints

- 保留成人限定、Safety Gate、native result、risk、malnutrition、priority 與 data-quality 分離規則。
- 診斷連動只自動啟用對應路徑或特殊因子，不清除其他既有選擇。
- 手動取消背景直接對應項目時只顯示 warning，不阻擋後續流程。
- 結果頁內部代碼維持不變；所有使用者可見內容使用中文。
- `RED` 處置優先度主要數值必須使用紅字，不可只以背景或邊框表示。
- 不新增套件、HIS 串接、疾病編碼或正式量表計分。

---

### Task 1: 背景下拉選項與臨床連動邏輯

**Files:**
- Modify: `src/clinicalLogic.js`
- Test: `src/clinicalLogic.test.js`

**Interfaces:**
- Produces: `wardOptions: string[]`
- Produces: `diagnosisOptions: string[]`
- Produces: `applyWardSelection(context: object, ward: string): object`
- Produces: `applyDiagnosisSelection(context: object, diagnosis: string): object`
- Extends: `getContextValidation(context).warnings: string[]`

- [ ] **Step 1: Write failing tests for ward selection and ICU mismatch**

```js
test('selecting ICU ward activates the ICU pathway without clearing other pathways', () => {
  const context = applyWardSelection({
    ...baseContext,
    pathways: { ...baseContext.pathways, GENERAL: true }
  }, '加護病房 ICU');

  assert.equal(context.ward, '加護病房 ICU');
  assert.equal(context.pathways.ICU, true);
  assert.equal(context.pathways.GENERAL, true);
});

test('warns when ICU ward and ICU pathway are inconsistent', () => {
  const validation = getContextValidation({
    ...baseContext,
    ward: '加護病房 ICU',
    pathways: { ...baseContext.pathways, ICU: false, GENERAL: true }
  });

  assert.match(validation.warnings.join(' '), /ICU/);
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `pnpm test -- --test-name-pattern="ICU ward"`

Expected: FAIL because `applyWardSelection` is not exported and no mismatch warning exists.

- [ ] **Step 3: Implement ward options, selection update, and warning**

```js
export const wardOptions = ['一般病房', '加護病房 ICU', '透析病房', '其他'];

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
```

Add a warning in `getContextValidation` when `context.ward === '加護病房 ICU' && !context.pathways.ICU`.

- [ ] **Step 4: Write failing parameterized tests for diagnosis linkage**

```js
for (const [diagnosis, group, key] of [
  ['重症／敗血症', 'pathways', 'ICU'],
  ['腎臟病／透析', 'pathways', 'RENAL'],
  ['肝硬化／肝病', 'pathways', 'LIVER'],
  ['活動性癌症', 'pathways', 'ONCOLOGY'],
  ['高齡衰弱', 'pathways', 'GERIATRIC'],
  ['心衰竭', 'modifiers', 'heartFailure'],
  ['吞嚥障礙', 'modifiers', 'dysphagia']
]) {
  test(`${diagnosis} activates ${key}`, () => {
    const context = applyDiagnosisSelection(baseContext, diagnosis);
    assert.equal(context.diagnosis, diagnosis);
    assert.equal(context[group][key], true);
  });
}
```

- [ ] **Step 5: Run the diagnosis tests and verify failure**

Run: `pnpm test -- --test-name-pattern="activates"`

Expected: FAIL because `applyDiagnosisSelection` is not exported.

- [ ] **Step 6: Implement diagnosis options, linkage map, and mismatch warnings**

```js
export const diagnosisOptions = [
  '一般內科／營養評估', '重症／敗血症', '腎臟病／透析', '肝硬化／肝病',
  '活動性癌症', '高齡衰弱', '心衰竭', '吞嚥障礙', '手術／術後', '其他'
];

const diagnosisLinkage = {
  '重症／敗血症': ['pathways', 'ICU'],
  '腎臟病／透析': ['pathways', 'RENAL'],
  '肝硬化／肝病': ['pathways', 'LIVER'],
  '活動性癌症': ['pathways', 'ONCOLOGY'],
  '高齡衰弱': ['pathways', 'GERIATRIC'],
  '心衰竭': ['modifiers', 'heartFailure'],
  '吞嚥障礙': ['modifiers', 'dysphagia']
};
```

`applyDiagnosisSelection` clones the linked group and sets only the mapped key to `true`. `getContextValidation` adds a warning when the current diagnosis has a mapping but the mapped key is false.

- [ ] **Step 7: Run all clinical logic tests**

Run: `pnpm test`

Expected: all tests pass.

- [ ] **Step 8: Commit the clinical linkage logic**

```bash
git add src/clinicalLogic.js src/clinicalLogic.test.js
git commit -m "Add patient context pathway linkage"
```

---

### Task 2: 病房與診斷下拉選單 UI

**Files:**
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `wardOptions`, `diagnosisOptions`, `applyWardSelection`, `applyDiagnosisSelection` from `src/clinicalLogic.js`
- Produces: controlled `Select` elements for `context.ward` and `context.diagnosis`

- [ ] **Step 1: Import the new clinical logic interfaces**

Add `wardOptions`, `diagnosisOptions`, `applyWardSelection`, and `applyDiagnosisSelection` to the existing `clinicalLogic.js` import list.

- [ ] **Step 2: Replace free-text ward and diagnosis fields with controlled selects**

```jsx
<Select
  label="病房"
  value={context.ward}
  options={wardOptions}
  onChange={(ward) => setContext((current) => applyWardSelection(current, ward))}
/>
<Select
  label="入院原因 / 診斷"
  value={context.diagnosis}
  options={['', ...diagnosisOptions]}
  onChange={(diagnosis) => setContext((current) => applyDiagnosisSelection(current, diagnosis))}
/>
```

- [ ] **Step 3: Run tests and production build**

Run: `pnpm test`

Expected: all tests pass.

Run: `pnpm build`

Expected: Vite production build succeeds.

- [ ] **Step 4: Commit the dropdown UI**

```bash
git add src/App.jsx
git commit -m "Use linked ward and diagnosis selectors"
```

---

### Task 3: 臨床結果與營養照護組合中文化

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/clinicalLogic.js`
- Test: `src/clinicalLogic.test.js`

**Interfaces:**
- Produces: `getChineseStatus(value: string): string`
- Produces: Chinese route titles and explanations from `getRoute`
- Consumes: unchanged internal result codes from `normalizeResult`

- [ ] **Step 1: Write failing tests for Chinese status display**

```js
test('translates result and workflow codes for display', () => {
  assert.equal(getChineseStatus('RED'), '紅色');
  assert.equal(getChineseStatus('UNKNOWN'), '未知');
  assert.equal(getChineseStatus('TOOL_SCORE_PENDING'), '量表計分待完成');
  assert.equal(getChineseStatus('RECOMMENDED'), '建議執行');
});
```

- [ ] **Step 2: Run the translation test and verify failure**

Run: `pnpm test -- --test-name-pattern="translates result"`

Expected: FAIL because `getChineseStatus` is not exported.

- [ ] **Step 3: Implement a stable display dictionary**

```js
const chineseStatusLabels = {
  RED: '紅色', AMBER: '琥珀色', GREEN: '綠色', GRAY: '灰色',
  UNKNOWN: '未知', TOOL_SCORE_PENDING: '量表計分待完成',
  RECOMMENDED: '建議執行', CONSIDER: '考慮執行', CONDITIONAL: '有條件執行',
  PENDING_ASSESSMENT: '待完成評估', ASSESS_APPROPRIATENESS: '評估適用性',
  CONTINUE_AND_REVIEW: '持續並重新評估'
};

export function getChineseStatus(value) {
  return chineseStatusLabels[value] || value;
}
```

- [ ] **Step 4: Convert route titles and explanations to Chinese**

Replace mixed English route copy in `getRoute` with Chinese clinical wording while preserving `route.level` and `route.status` codes. Examples: `Oral feeding` becomes `口服進食`, `feeding advancement` becomes `營養供應增加`, and `EN/PN appropriateness` becomes `腸道／靜脈營養適用性`.

- [ ] **Step 5: Convert all result-page visible labels and copy to Chinese**

In `ResultScreen`, translate:

- `Clinical Summary` to `臨床摘要`
- Result cards to `營養風險`, `營養不良狀態`, `處置優先度`
- `Native Result` to `原始評估結果`
- `Why this result?` to `結果判斷依據`
- `Safety Alerts` to `安全警示`
- `Data Quality Alerts` to `資料品質提醒`
- `Nutrition Care Bundle` to `營養照護組合`
- `Monitoring & Reassessment` to `監測與重新評估`
- `Documentation Summary` to `病歷紀錄摘要`

Use `getChineseStatus` for visible risk, malnutrition, priority, assessment and bundle status values. Rewrite the summary, safety empty state, monitoring list, bundle titles/text, and documentation preview in Chinese.

- [ ] **Step 6: Run all tests and production build**

Run: `pnpm test`

Expected: all tests pass.

Run: `pnpm build`

Expected: Vite production build succeeds.

- [ ] **Step 7: Commit Chinese result display**

```bash
git add src/App.jsx src/clinicalLogic.js src/clinicalLogic.test.js
git commit -m "Localize clinical results in Chinese"
```

---

### Task 4: RED 優先度紅字與完整驗證

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `tone="red"` from `getResultTone('priority', 'RED')`
- Produces: `.result-card.red .result-value` red text styling

- [ ] **Step 1: Give the result value an explicit styling hook**

```jsx
<strong className="result-value">{getChineseStatus(value)}</strong>
```

- [ ] **Step 2: Add high-contrast red value styling**

```css
.result-card.red .result-value {
  color: var(--red);
}
```

- [ ] **Step 3: Run automated verification**

Run: `pnpm test`

Expected: all tests pass.

Run: `pnpm build`

Expected: Vite production build succeeds.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 4: Verify desktop behavior in the browser**

At 1440 x 900:

- Confirm ward and diagnosis render as select controls.
- Select `加護病房 ICU` and confirm the ICU path button becomes active.
- Select each linked diagnosis and confirm the corresponding path/modifier becomes active without clearing another active item.
- Manually deactivate the directly linked item and confirm a data warning appears.
- Complete an assessment that yields `RED`, open the result page, and confirm the visible result sections are Chinese and the computed color of the priority value is `rgb(207, 61, 50)`.
- Confirm `document.documentElement.scrollWidth <= window.innerWidth` and no console errors.

- [ ] **Step 5: Verify mobile behavior in the browser**

At 390 x 844, confirm selects and result cards fit without overlap or horizontal overflow, then reset the temporary viewport override.

- [ ] **Step 6: Commit final styling**

```bash
git add src/App.jsx src/styles.css
git commit -m "Highlight red clinical priority"
```

- [ ] **Step 7: Push and verify GitHub Pages**

Run: `git push origin main`

Wait for `.github/workflows/deploy.yml` to succeed, then confirm `https://yht5582-source.github.io/inpatient-nutrition-assessment/` returns HTTP 200 and loads the new ward/diagnosis selectors without browser console errors.
