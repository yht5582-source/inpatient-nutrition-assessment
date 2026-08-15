# 住院病人營養評估互動網站 V1

成人住院病人營養評估互動網站原型，依據 `docs/inpatient-nutrition-assessment-v1-product-clinical-spec.md` 建立。

## V1 功能

- 首頁雙入口：護理師營養篩檢、營養師 / 醫師專業評估
- Patient Context 驅動 primary pathway 與 specialty modifiers
- Tool Selection Engine：ICU、cirrhosis、CKD5D / HD / PD、active cancer、geriatric、general adult
- Professional override 與工具 registry metadata
- 六項工具皆可選取：NRS-2002、MNA-SF、7-point SGA、RFH-NPT、PG-SGA SF、mNUTRIC
- 三種原始評估方式：站內自動計分、營養師整體評定、官方工具結果回填
- NRS-2002、RFH-NPT、mNUTRIC 使用站內工具專屬表單自動計分；7-point SGA 由營養師完成結構化觀察後給予整體評分
- MNA-SF、PG-SGA SF 僅開啟未夾帶病人資料的官方網址，並回填完成日期、官方總分與分類；本站不重製受限制題目
- 原始評估未完成時，營養風險與營養不良結果維持未知，不由共同臨床資料推測；結果頁可返回第四步續填並保留既有答案
- 工具選取與評估不受介面授權狀態閘門阻擋；工具來源版本與評估方式仍於 registry 顯示
- Unified normalization：Nutrition Risk、Malnutrition Status、Action Priority 分開呈現
- Safety Gate：dysphagia、refeeding risk、fluid-affected weight、GI tract status
- Feeding Route Engine 與 Nutrition Care Bundle
- Monitoring / Reassessment 與 structured documentation summary

## 本機執行

```bash
pnpm install
pnpm run dev
```

## 建置

```bash
pnpm run build
```

## 注意

此版本為 clinical decision support prototype，不會自動開立醫囑，也不取代營養師或醫師判斷。本站不具 EMR 整合或遠端資料保存功能。正式臨床使用前，仍需完成院內 tool registry、rule registry、guideline version、適用族群、來源版本、法規／版權政策及臨床流程審查。
