# 原始評估工具與未完成續填設計

## 目標

所有 Tool Registry 工具均可被選取並進入評估，不再以 `PENDING_REVIEW` 停用按鈕。共同臨床資料與工具原始量表必須分開保存；工具原始量表未完成時，結果頁清楚顯示未完成並提供返回該工具評估表的按鈕。

本設計採官方合規混合模式：有足夠公開原始規則的工具在站內評估；需要機構授權或官方數位工具的量表使用官方入口與結果回填，不在 GitHub Pages 公開站重新發布受限制題目。

## 工具模式

| 工具 | 模式 | 原始結果來源 |
| --- | --- | --- |
| NRS-2002 | `IN_APP_AUTOSCORE` | 站內題目與自動計分 |
| mNUTRIC | `IN_APP_AUTOSCORE` | 站內臨床數值與自動計分 |
| RFH-NPT | `IN_APP_AUTOSCORE` | 站內題目與自動計分 |
| 7-point SGA | `CLINICIAN_RATED` | 結構化評估後由營養師選擇整體 1–7 分 |
| MNA-SF | `OFFICIAL_EXTERNAL` | 官方量表完成後回填總分與分類 |
| PG-SGA SF | `OFFICIAL_EXTERNAL` | 官方紙本或 Pt-Global 工具完成後回填總分與分類 |

所有工具在工具選擇頁皆可選取。Registry 顯示「站內自動計分」、「營養師整體評定」或「官方工具結果回填」，不再顯示會阻擋操作的授權狀態。

## 來源與版本

- NRS-2002：ESPEN 公開的 Nutritional Risk Screening 2002。最終分數為營養狀態 0–3 分、疾病嚴重度 0–3 分，加上年齡 70 歲以上 1 分；總分 3 分以上為有營養風險。來源：https://www.espen.org/documents/Screening.pdf
- mNUTRIC：不含 IL-6 的 0–9 分版本。輸入年齡、APACHE II、SOFA、共病數與住院至 ICU 天數；0–4 為低分、5–9 為高分。來源：https://pmc.ncbi.nlm.nih.gov/articles/PMC5842932/
- 7-point SGA：採腎臟營養評估架構，呈現體重／攝取變化、GI 症狀、功能、疾病負荷、皮下脂肪與肌肉等結構化觀察；整體 1–2 分為嚴重營養不良、3–5 分為輕至中度營養不良、6–7 分為營養良好。整體分數由營養師判定，不由各欄位機械加總。來源：https://www.kidney.org/sites/default/files/12-85-0946_ica_crn-pocket-guide_v6_chp_1.pdf
- RFH-NPT：使用酒精性肝炎／管灌、體液超載及其對攝取影響、BMI、非預期體重下降等公開構成。原始總分 0 為低風險、1 為中度風險、2–7 為高風險。來源：https://www.frontiersin.org/journals/nutrition/articles/10.3389/fnut.2021.766350/full 與 https://pdfs.semanticscholar.org/fb8d/73f7d3d2985a4d6cae8bb07a95347e78466a.pdf
- MNA-SF：醫療機構須依 MNA 官方要求取得使用授權。公開站只提供官方入口與總分／分類回填，不重製六項題目。來源：https://www.mna-elderly.com/mna-forms
- PG-SGA SF：使用官方紙本或 Pt-Global web tool 完成後回填；公開站不重製 Boxes 1–4。來源：https://pt-global.org/faq/ 與 https://pt-global.org/pt-global-app/

## 資料模型

新增 `toolAssessments`，依工具名稱分開保存，切換工具時不得清除其他工具已填內容。

```text
toolAssessments
└── [toolId]
    ├── answers
    ├── nativeStatus
    │   └── NOT_STARTED | IN_PROGRESS | COMPLETE
    ├── nativeScore
    ├── nativeCategory
    ├── completedAt
    └── sourceMode
```

共同五題 `answers` 繼續只服務 Safety Gate、資料品質、feeding route 與 care bundle，不可產生任何工具原始分數。

## 原始量表完成規則

### NRS-2002

表單先顯示四題初篩。四題皆否時，原始結果記錄為「初篩陰性，建議每週重篩」，但仍視為完成。任一題為是時，必須完成營養狀態分數與疾病嚴重度分數；年齡由 Patient Context 自動帶入並套用年齡分。完整結果保存各分項、總分及 `<3` 或 `>=3` 分類。

### mNUTRIC

年齡由 Patient Context 帶入；APACHE II、SOFA、共病數、住院至 ICU 時間皆為必填且有非負數值檢核。完成後保存五項分數、0–9 總分與低分／高分分類。

### 7-point SGA

結構化觀察項目必須全部選擇，最後的整體 1–7 分必填。程式只依營養師輸入的整體分數產生分類，不自行加總觀察項目。結果需標示「營養師整體評定」。

### RFH-NPT

RFH-NPT 依原始流程分支顯示，不能把不同路徑的題目混合加分：

- 已診斷酒精性肝炎或目前接受管灌者記錄 6 分並直接完成為高風險。
- 無上述情況且無體液超載者，評估 BMI（0–2 分）、過去 3–6 個月非預期體重下降比例（0–2 分），以及急性疾病且預期超過 5 天無法進食（0 或 2 分）。
- 無上述情況但有體液超載者，先計體液超載 1 分，再評估是否因體液超載無法吃完整餐（0–2 分）、最近 5 天攝取是否減少超過 50%（0 或 2 分），以及過去 3–6 個月是否體重下降（否 0 分、因利尿劑難判斷 1 分、是 2 分）。

BMI 可由 Patient Context 帶入並顯示給使用者確認。只有目前分支的必要欄位全部完成後，才產生 0–7 分及低／中／高風險分類。

### MNA-SF 與 PG-SGA SF

表單顯示官方來源按鈕、工具名稱、完成日期、官方總分與官方分類回填欄位。使用者必須確認「已使用官方版本完成評估」後才可標記完成。程式不重新計算官方原始分數，但會保存回填值與來源模式。

## 評估頁

第四步保留「共同臨床評估資料」，並新增「工具原始評估」區塊。區塊標題包含所選工具與完成百分比。切換工具後載入對應 schema 及該工具既有答案。

站內評估工具使用既有 option button、number input 與 select 元件。官方外部工具使用清楚的官方入口按鈕及精簡結果回填表。不得在畫面中宣稱 MNA-SF 或 PG-SGA SF 已在站內自動計分。

只有共同資料完成時即可查看結果，以便使用者看見原始量表尚未完成的狀態；工具量表未完成不阻擋結果頁。

## 結果頁與續填

原始量表未完成時：

- 原始結果顯示「原始評估未完成」。
- `nativeStatus` 顯示 `IN_PROGRESS` 或 `NOT_STARTED`。
- nutrition risk、malnutrition status 不得由共同五題推測，維持 `UNKNOWN`。
- 顯示主要按鈕「繼續完成 [工具名稱] 評估」。
- 按下後回到第四步，直接顯示所選工具的原始評估區塊並保留先前答案。

原始量表完成時：

- 顯示工具原始分數、原始分類、版本／來源模式及完成狀態。
- normalization 只依各工具明確的 domain mapping 產生 nutrition risk 或 malnutrition status。
- Safety Gate、臨床 priority、feeding route 與 data-quality flags 保持獨立，不能被原始量表結果覆蓋。

## 工具切換與 Professional Override

所有工具皆可被 professional override 選取。選擇非系統推薦工具時仍要求記錄原因。切回系統推薦工具不清除其他工具評估資料。結果頁顯示目前實際使用的工具與 override reason。

## 檢核與錯誤處理

- 數值欄位拒絕負數、非數字及超出工具有效範圍的值。
- 缺少必填值時不得產生 native score；顯示逐項未完成提示。
- 外部官方工具未勾選完成確認時，即使已輸入分數也維持 `IN_PROGRESS`。
- 工具來源連結以新分頁開啟，不傳送 Patient Context 或其他病人資料。
- 靜態網站不保存病人資料至遠端服務或瀏覽器永久儲存。

## 驗證

- 單元測試涵蓋 NRS-2002 與 mNUTRIC 全部分數邊界、RFH-NPT 風險分界、7-point SGA 類別、外部工具完成條件及未完成狀態。
- 測試確認共同五題永遠不會產生工具原始分數。
- 瀏覽器測試六項工具皆可選取，原始評估可填寫、切換後資料保留。
- 結果頁未完成按鈕可返回正確工具表單；完成後原始分數與分類正確顯示。
- MNA-SF／PG-SGA SF 官方入口不得在 URL 或表單中附帶病人資料。
- 桌面與手機不得有水平溢位、文字重疊或 console error。

## 非本次範圍

- 不申請或代表醫院簽署 MNA-SF、PG-SGA SF 授權。
- 不把公開網站作為電子病歷或病人資料儲存系統。
- 不由程式自動計算 APACHE II 或 SOFA；mNUTRIC 使用者輸入已確認的 APACHE II 與 SOFA 分數。
- 不以原始營養風險工具自動開立醫囑。
