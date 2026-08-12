# 住院病人營養評估互動網站 V1

成人住院病人營養評估互動網站原型，依據 `docs/inpatient-nutrition-assessment-v1-product-clinical-spec.md` 建立。

## V1 功能

- 首頁雙入口：護理師營養篩檢、營養師 / 醫師專業評估
- Patient Context 驅動 primary pathway 與 specialty modifiers
- Tool Selection Engine：ICU、cirrhosis、CKD5D / HD / PD、active cancer、geriatric、general adult
- Professional override 與工具 registry metadata
- Generic interactive assessment renderer
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

此版本為 clinical decision support prototype，不會自動開立醫囑，也不取代營養師或醫師判斷。正式臨床使用前需完成院內 tool registry、rule registry、量表授權與 guideline version 審查。
