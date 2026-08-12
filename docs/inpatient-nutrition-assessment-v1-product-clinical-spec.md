# 住院病人營養評估互動網站 V1 Product / Clinical Specification

文件狀態：V1 draft for clinical and product review  
適用範圍：成人住院病人營養篩檢、營養評估、結果標準化、初步 nutrition care bundle 與追蹤建議  
不適用範圍：兒科、孕產婦專屬營養評估、門診長期營養管理、自動醫囑開立、自動取代營養師或醫師臨床判斷  
核心原則：Clinical decision support, not autonomous prescribing

---

## 1. V1 產品定位

本網站 V1 是一套給住院照護團隊使用的成人營養評估互動工具。它的任務不是只算出某個量表分數，而是將病人臨床情境、最適合的評估工具、原始量表結果、標準化風險資料、安全警示、feeding route feasibility、特殊疾病 modifiers 與 monitoring plan 整合成可解釋、可稽核、可由專業人員修正的 nutrition care bundle。

V1 的決策架構如下：

```text
Patient Context
      ↓
Tool Selection Engine
      ↓
Tool Recommendation + Professional Override
      ↓
Interactive Assessment Engine
      ↓
Native Tool Result
      ↓
Normalization Engine
      ↓
Safety Gate
      ↓
Feeding Route Engine
      ↓
Nutrition Requirement / Specialty Rule Engine
      ↓
Nutrition Care Bundle
      ↓
Monitoring + Reassessment
      ↓
Documentation / Audit
```

V1 明確排除兒科。若病人年齡小於 18 歲，系統應顯示「此版本不適用於兒科病人」，並停止進入成人 pathway。

---

## 2. 使用者與角色

### 2.1 主要使用者

| 角色 | V1 權限與任務 |
|---|---|
| 護理師 | 可由首頁進入護理篩檢流程、輸入基本 patient context、完成院內指定初篩資料 |
| 營養師 | 可從首頁直接進入營養專業評估、選用或 override 評估工具、完成 assessment、修改 care bundle |
| 醫師 | 可檢視結果、啟動專業評估、override 工具建議、確認臨床處置方向 |
| 專科護理師 / 個管師 | 可依院內授權建立 context、檢視結果、協助追蹤 reassessment |
| 管理者 | 維護 tool registry、rule version、院內核准工具、稽核與報表 |

### 2.2 關鍵權限原則

護理師篩檢不是營養師評估的前置條件。

系統首頁必須支援雙入口：

1. 護理師營養篩檢入口
2. 營養師 / 醫師專業評估入口

營養師或醫師可直接建立 patient context 並進入 tool selection，不需要等待護理師先完成篩檢。

---

## 3. V1 臨床邊界

### 3.1 成人 V1 included population

| 條件 | V1 行為 |
|---|---|
| 年齡 >= 18 歲 | 可進入成人 pathway |
| 一般成人住院病人 | General adult pathway |
| ICU | ICU pathway |
| 肝硬化 | Cirrhosis / liver pathway |
| CKD5D / HD / PD | Renal pathway |
| Active cancer | Oncology pathway |
| 年齡 >= 65 歲 | Geriatric pathway 或 modifier，視優先序而定 |
| 合併 HF、dysphagia、edema、ascites、refeeding risk | Specialty modifiers / safety modules |

### 3.2 V1 excluded or limited scope

| 項目 | V1 設計 |
|---|---|
| 兒科 | 排除，需另建 pediatric pathway |
| 自動醫囑 | 不做；只產生 decision support recommendation |
| 自動取代院內吞嚥評估 | 不做；只標記 swallowing safety gate 與 referral need |
| 自動開立 EN / PN | 不做；顯示「建議評估 appropriateness」 |
| 未授權量表全文數位化 | 不做；tool registry 必須記錄 license status |
| 單一紅黃綠結果 | 不做；risk、malnutrition、priority 必須分開 |

---

## 4. Clinical Architecture Baseline

### 4.1 Primary Pathways

Primary pathway 決定首選評估工具與主要臨床規則。V1 primary pathways 如下：

| Primary pathway | 觸發條件 | 首選工具 | 工具角色 |
|---|---|---|---|
| ICU | ICU admission / critical care | mNUTRIC | 重症營養風險 / treatment priority |
| Liver / Cirrhosis | Cirrhosis | RFH-NPT | 肝硬化營養風險 |
| Renal | CKD5D, HD, PD | 7-point SGA | 透析 / 腎臟病營養狀態評估 |
| Oncology | Active cancer | PG-SGA SF | 癌症營養風險與症狀 triage |
| Geriatric | Age >= 65 and no higher-priority disease pathway | MNA-SF | 老年營養篩檢 |
| General Adult | 成人住院且不符合以上 pathway | NRS-2002 | 一般住院營養風險篩檢 |

### 4.2 Pathway priority

若同時符合多個 primary pathway，V1 建議優先序：

```text
ICU
  > Cirrhosis
  > CKD5D / HD / PD
  > Active cancer
  > Geriatric
  > General adult
```

說明：

年齡 >= 65 歲常見，但不應覆蓋 ICU、肝硬化、透析或 active cancer 等更具疾病特異性的 primary pathway。若病人為 76 歲且正在 HD，primary pathway 應為 Renal，年齡作為 AGE_65_PLUS modifier 保存。

### 4.3 Specialty Modifiers

Specialty modifiers 不一定改變 primary tool，但會影響資料可靠度、安全規則、nutrition requirement、feeding route 與 monitoring plan。

| Modifier | 類型 | V1 影響 |
|---|---|---|
| HEART_FAILURE | Specialty modifier | 標記 congestion / edema、體重可靠度、dry/euvolemic weight、fluid/sodium coordination |
| DYSPHAGIA | Safety modifier | 啟動 swallowing safety gate；oral route recommendation 變成 conditional |
| ASCITES | Data quality / liver modifier | 體重與 BMI 可靠度下降；肝硬化規則使用 ascites-aware interpretation |
| EDEMA / CONGESTION | Data quality modifier | current weight 不可直接作為唯一 reference weight |
| REFEEDING_RISK | Safety modifier | 啟動 refeeding safety gate；feeding advancement 需 conditional |
| POOR_INTAKE | Treatment modifier | 影響 feeding route escalation |
| GI_DYSFUNCTION | Feeding modifier | 影響 EN feasibility |
| CKD_NON_DIALYSIS | Specialty modifier | 腎臟營養規則，但不等同 CKD5D pathway |
| HEMODIALYSIS | Primary / modifier | Renal pathway；dry weight、electrolytes、dialysis-specific protein rule |
| PERITONEAL_DIALYSIS | Primary / modifier | Renal pathway；PD-specific considerations |
| ACTIVE_CANCER | Primary / modifier | Oncology pathway；nutrition-impact symptoms |

---

## 5. Patient Context Specification

Patient Context 是 tool selection 與後續 engines 的共同輸入。V1 不應要求使用者一次填完所有資料，而應分區、可儲存、可回補。

### 5.1 Required context fields

| Domain | 欄位 |
|---|---|
| Demographics | age, sex |
| Location | ward, ICU status |
| Admission context | diagnosis / reason for admission, surgical status if relevant |
| Disease flags | ICU, cirrhosis, CKD5D, HD, PD, active cancer, heart failure |
| Intake | current oral intake category, NPO status, recent intake decline |
| Anthropometrics | measured weight, height, BMI, usual weight if available |
| Fluid status | edema, ascites, congestion, dry weight availability |
| Safety | dysphagia suspected, aspiration risk concern, refeeding concern |
| GI tract | functional, partially functional, unavailable, uncertain |
| Data provenance | manual, EHR, patient-reported, estimated |

### 5.2 Context object

```text
patient_context
├── patient_context_id
├── patient_id
├── age
├── sex
├── care_location
│   ├── ward_type
│   └── is_icu
├── disease_flags[]
├── dialysis_status
│   ├── has_ckd5d
│   ├── modality: NONE | HD | PD
│   └── dry_weight_kg
├── anthropometrics
│   ├── height_cm
│   ├── measured_weight_kg
│   ├── usual_weight_kg
│   ├── reference_weight_kg
│   └── reference_weight_type
├── intake_status
│   ├── current_intake_category
│   ├── intake_percent_estimated
│   └── npo_status
├── fluid_status
│   ├── edema
│   ├── ascites
│   ├── congestion
│   └── weight_reliability
├── safety_screen
│   ├── dysphagia_suspected
│   ├── aspiration_concern
│   └── refeeding_screen_required
├── gi_status
│   └── gi_tract_function
├── source_metadata[]
└── created_by / updated_by / timestamps
```

### 5.3 Data quality rules for context

| 規則 | 系統行為 |
|---|---|
| 年齡 < 18 | 停止成人流程 |
| height 或 measured weight 缺失 | BMI 不可計算；標示 missing data |
| edema / ascites / congestion = true | weight_reliability 不可自動標為 RELIABLE |
| dry weight available | reference_weight 可優先使用 dry weight，但不得覆蓋 measured weight |
| unknown 不可等於 no | UNKNOWN 需獨立保存 |
| patient-reported weight | 可使用，但 data reliability 需標記 |

---

## 6. Tool Selection Engine

### 6.1 Engine goal

Tool Selection Engine 根據 patient context 推薦 primary assessment tool，並將推薦原因、被保留的 modifiers、替代工具與下一步一起傳給 UI。

Engine 不應只輸出：

```text
tool = "7-point SGA"
```

應輸出完整 recommendation object。

### 6.2 Recommendation object

```text
tool_recommendation
├── recommendation_id
├── primary_tool
├── primary_pathway
├── reasons[]
├── modifiers[]
├── alternative_tools[]
│   ├── tool_id
│   ├── intended_use
│   ├── system_judgment
│   └── reason
├── professional_override_allowed
├── override_options[]
├── safety_modules_required[]
├── next_step
├── rule_version
└── generated_at
```

### 6.3 Recommendation examples

76 歲，一般病房，HD，heart failure：

```text
primary_pathway = RENAL
primary_tool = 7_POINT_SGA

reasons:
- HEMODIALYSIS
- CKD5D

modifiers:
- AGE_65_PLUS
- HEART_FAILURE
- EDEMA_OR_CONGESTION

alternative_tools:
- MIS: Renal adjunct assessment, 可追加
- GLIM: Malnutrition diagnosis, 後續使用
- MNA-SF: Geriatric screening, 非目前首選
```

82 歲，一般病房，無透析、無癌症、無肝硬化：

```text
primary_pathway = GERIATRIC
primary_tool = MNA_SF

reasons:
- AGE_65_PLUS

modifiers:
- GENERAL_INPATIENT
```

---

## 7. Tool Registry

所有工具必須透過 Tool Registry 管理，避免題目、cutoff、版本與授權狀態散落在程式碼。

```text
tool_registry
├── tool_id
├── display_name
├── tool_type
│   └── SCREENING | ASSESSMENT | DIAGNOSIS | SAFETY | ADJUNCT
├── target_population
├── primary_pathway
├── version
├── scoring_version
├── license_status
│   └── APPROVED | RESTRICTED | PENDING_REVIEW | NOT_AVAILABLE
├── guideline_reference
├── digital_use_notes
├── active
└── last_reviewed
```

V1 不得將授權不明的量表全文硬寫入正式產品。若工具 license_status = RESTRICTED 或 PENDING_REVIEW，UI 可顯示工具名稱與 intended use，但不得顯示未核准的完整題項。

---

## 8. Interactive Assessment Engine

### 8.1 Design principle

V1 應建立 Generic Assessment Renderer。NRS-2002、MNA-SF、7-point SGA、RFH-NPT 等不應各自寫死一套 frontend，而應由 question schema 驅動畫面。

### 8.2 Question component types

V1 支援下列元件：

| Type | 用途 |
|---|---|
| single_choice | 單選題 |
| multiple_choice | 多選症狀或條件 |
| number | 體重、身高、分數 |
| date | 日期 |
| percentage | 攝取百分比 |
| yes_no_unknown | 是 / 否 / 不知道 |
| scale | 等級量表 |
| clinical_observation | 肌肉流失、脂肪流失、水腫等觀察 |
| computed | BMI、體重下降百分比等不可直接修改欄位 |
| professional_judgment | 營養師或醫師綜合判斷欄位 |

### 8.3 Question schema

```text
question
├── question_id
├── section_id
├── type
├── label
├── help_text
├── required
├── options[]
├── unit
├── visibility_rule
├── validation_rule
├── calculation_rule
├── score_rule
├── clinical_flag_rule
└── role_visibility
```

### 8.4 Conditional logic

不相關題目不應出現。例如「近期體重下降 = 否」時，不顯示過去體重與時間區間。所有條件顯示應由 visibility_rule 控制，不寫死在畫面中。

### 8.5 Calculation engine

集中計算：

- BMI
- weight change percentage
- weight-loss interval
- subtotal / total score
- age adjustment
- native classification
- generated clinical flags

計算結果分為：

| 類型 | 顯示規則 |
|---|---|
| Clinical visible | BMI、體重下降比例等可顯示 |
| Internal scoring | 題目分數預設不逐題顯示，避免 anchoring |

### 8.6 Fluid-affected weight component

若 weight_reliability != RELIABLE，體重欄位需顯示警示並要求 reference weight 判斷。

```text
measured_weight = 67.2 kg
reference_weight = 63.5 kg
reference_weight_type = DRY_WEIGHT
weight_reliability = FLUID_AFFECTED
```

原始 measured weight 必須保留，不可被 dry weight 覆蓋。

### 8.7 Assessment data object

```text
assessment
├── assessment_id
├── patient_id
├── patient_context_id
├── tool_id
├── tool_version
├── scoring_version
├── entry_route
│   └── NURSING_SCREEN | PROFESSIONAL_ASSESSMENT | FOLLOW_UP
├── started_at
├── completed_at
├── status
│   └── DRAFT | COMPLETED | INVALIDATED | SUPERSEDED
├── responses[]
│   ├── question_id
│   ├── value
│   ├── source
│   └── timestamp
├── calculated_values[]
├── native_score
├── native_category
├── generated_flags[]
├── missing_required_fields[]
└── evaluator
    ├── role
    └── user_id
```

---

## 9. Unified Normalization Data Model

### 9.1 Why normalization is needed

V1 必須避免把不同性質的工具混成同一個「高風險」標籤。營養風險、營養不良診斷、處置優先度、安全狀態與資料可靠度是不同概念。

### 9.2 Normalized result object

```text
normalized_result
├── normalized_result_id
├── assessment_id
├── assessment_domain
│   └── SCREENING | ASSESSMENT | DIAGNOSIS | SAFETY
├── native_result
│   ├── tool_id
│   ├── native_score
│   ├── native_category
│   └── native_interpretation
├── nutrition_risk
│   └── LOW | AT_RISK | HIGH | NOT_APPLICABLE | UNKNOWN
├── malnutrition_status
│   └── NOT_ASSESSED | NO_MALNUTRITION | SUSPECTED | MODERATE | SEVERE | UNKNOWN
├── clinical_priority
│   └── GREEN | AMBER | RED | GRAY
├── safety_flags[]
├── data_quality_flags[]
├── modifiers[]
├── explanation[]
├── mapping_rule_version
└── generated_at
```

### 9.3 Nutrition risk values

| Value | 意義 |
|---|---|
| LOW | 目前未發現營養風險 |
| AT_RISK | 有營養風險 |
| HIGH | 高營養風險 |
| NOT_APPLICABLE | 此工具不是營養風險篩檢 |
| UNKNOWN | 資料不足，無法判斷 |

### 9.4 Malnutrition status values

| Value | 意義 |
|---|---|
| NOT_ASSESSED | 尚未完成診斷性評估 |
| NO_MALNUTRITION | 評估後未達營養不良 |
| SUSPECTED | 篩檢高度懷疑，但未完成診斷 |
| MODERATE | 中度營養不良 |
| SEVERE | 嚴重營養不良 |
| UNKNOWN | 資料不足，無法判斷 |

### 9.5 Clinical priority values

| Value | 顯示 | 定義 |
|---|---|---|
| GREEN | Routine | 例行營養照護與定期 rescreen |
| AMBER | Nutrition review needed | 需要營養師或專業評估 |
| RED | High clinical priority | 高優先度處理、需安全檢查與 nutrition care plan |
| GRAY | Incomplete / unreliable | 資料不足或關鍵資料不可靠，不應硬算結果 |

### 9.6 Tool-to-normalization mapping

| 工具 | Domain | Native result | Nutrition risk | Malnutrition status |
|---|---|---|---|---|
| NRS-2002 | SCREENING | 原始分數與分類 | LOW / AT_RISK | NOT_ASSESSED |
| MNA-SF | SCREENING | Normal / At risk / Malnourished | LOW / AT_RISK / HIGH | NOT_ASSESSED 或 SUSPECTED |
| PG-SGA SF | SCREENING / TRIAGE | 原始分數與症狀 | 依核准版本 mapping | NOT_ASSESSED |
| mNUTRIC | SCREENING / PROGNOSTIC | 原始分數與分類 | LOW / HIGH | NOT_ASSESSED |
| RFH-NPT | SCREENING | Low / Moderate / High | LOW / AT_RISK / HIGH | NOT_ASSESSED |
| 7-point SGA | ASSESSMENT | Normal / Moderate / Severe | NOT_APPLICABLE | NO_MALNUTRITION / MODERATE / SEVERE |
| GLIM | DIAGNOSIS | No / Moderate / Severe | NOT_APPLICABLE | NO_MALNUTRITION / MODERATE / SEVERE |
| Dysphagia screen | SAFETY | Negative / Positive / Unable | NOT_APPLICABLE | NOT_ASSESSED |

---

## 10. Safety Gate

### 10.1 Safety Gate principle

所有 treatment recommendation 必須先經過 Safety Gate。風險分數不可直接導出 ONS、EN 或 PN。

Safety Gate 包含：

```text
Swallowing safety
Refeeding risk
GI availability
Hemodynamic / clinical stability
Fluid-status reliability
Critical missing data
```

### 10.2 Safety gate object

```text
safety_gate
├── safety_gate_id
├── patient_id
├── assessment_id
├── swallowing_safety
│   └── SAFE | SUSPECTED_DYSPHAGIA | UNSAFE | UNKNOWN | NOT_ASSESSED
├── refeeding_risk
│   └── LOW | POSSIBLE | HIGH | NOT_ASSESSED
├── gi_availability
│   └── FUNCTIONAL | PARTIAL | UNAVAILABLE | UNCERTAIN
├── clinical_stability
│   └── STABLE | UNSTABLE | UNKNOWN
├── fluid_weight_reliability
│   └── RELIABLE | FLUID_AFFECTED | UNKNOWN
├── blocking_alerts[]
├── conditional_alerts[]
├── required_next_assessments[]
└── generated_at
```

### 10.3 Swallowing safety rules

若 dysphagia suspected、aspiration concern、吞嚥篩檢陽性或 unable to assess：

- Oral recommendation 必須標示 conditional
- 不可直接建議 regular oral diet
- 顯示院內吞嚥篩檢 / SLP / 吞嚥團隊評估建議
- 若 oral route 不安全且 GI tract functional，可建議「評估 EN appropriateness」

依 ASHA 成人吞嚥篩檢資料，bedside screening 的目的在於辨識 dysphagia 可能性與是否需要進一步評估；目前沒有單一 bedside screening protocol 能可靠排除 aspiration，因此 V1 不應宣稱網站可自行排除 aspiration。

### 10.4 Refeeding rules

若嚴重營養不良、長期攝取不足、極低攝取、顯著體重下降或臨床團隊標記 refeeding concern：

- refeeding_screen_required = true
- nutrition advancement 必須 conditional
- 顯示 electrolyte review、thiamine assessment、feeding advancement plan、monitoring plan
- 不在 V1 自行創造新 refeeding 分數；使用院內核准 protocol 或正式 guideline rule set

ASPEN refeeding syndrome consensus recommendations 支持將 refeeding 作為獨立安全風險處理，並要求在開始或增加營養供應時注意 phosphorus、potassium、magnesium、thiamine 與監測。

### 10.5 Data safety rules

| 狀況 | 系統行為 |
|---|---|
| swallowing safety unknown | oral feeding route = conditional |
| GI tract uncertain | EN recommendation = assess appropriateness, not direct recommendation |
| weight fluid affected | kcal/protein reference weight must be reviewed |
| severe missing data | clinical_priority 可為 GRAY |
| refeeding high risk | feeding advancement plan required |

---

## 11. Feeding Route Engine

### 11.1 Route levels

| Level | Route |
|---|---|
| R0 | Regular / therapeutic oral diet |
| R1 | Optimized oral nutrition |
| R2 | ONS |
| R3 | Enteral Nutrition assessment |
| R4 | Parenteral Nutrition assessment |

### 11.2 Route logic

```text
Is oral intake safe?
│
├── YES
│   └── Is intake adequate?
│       ├── YES → R0 / continue oral diet
│       └── NO → R1 optimize oral nutrition
│                 → R2 consider ONS
│                 → if persistently inadequate, assess EN
│
└── NO / UNKNOWN
    └── Is GI tract usable?
        ├── YES → assess EN appropriateness
        └── NO / cannot meet needs → assess PN appropriateness
```

### 11.3 Recommendation language rules

V1 不使用「系統應開立 PN」這種語句。

應使用：

- 建議評估 EN appropriateness
- 建議評估 PN appropriateness
- Oral nutrition recommendation pending swallowing safety confirmation
- Consider ONS if oral intake remains inadequate and oral route is safe

### 11.4 Feeding route object

```text
feeding_route_recommendation
├── current_route
├── oral_safety_status
├── gi_tract_status
├── intake_adequacy
├── recommended_route_level
├── route_sequence[]
├── conditional_status
│   └── FINAL | CONDITIONAL | PENDING_ASSESSMENT
├── reasons[]
├── why_not_higher_route[]
├── required_assessments_before_escalation[]
└── rule_version
```

---

## 12. Nutrition Requirement / Specialty Rule Engine

### 12.1 Requirement principles

V1 不將 kcal/kg、protein g/kg、fluid 或 electrolyte 規則硬寫死在 UI。需求計算由 Rule Registry 管理，並記錄 guideline source、院內版本與適用條件。

### 12.2 Requirement profile

```text
nutrition_requirement_profile
├── reference_weight
│   ├── value_kg
│   ├── type: MEASURED | DRY_WEIGHT | EUVOLEMIC | ADJUSTED | ESTIMATED
│   └── reliability
├── energy_target
│   ├── display_value
│   ├── rule_id
│   └── confidence
├── protein_target
│   ├── display_value
│   ├── rule_id
│   └── confidence
├── fluid_consideration
├── electrolyte_considerations[]
├── micronutrient_considerations[]
├── specialty_notes[]
└── calculation_metadata
```

### 12.3 Rule registry

```text
requirement_rule_registry
├── rule_id
├── pathway
├── modifier_scope[]
├── source_guideline
├── hospital_approved_version
├── calculation_method
├── contraindications
├── data_requirements[]
├── active
└── last_reviewed
```

### 12.4 Specialty recommendations

#### Renal / HD / PD

Renal module 應加入：

- dialysis-specific nutrition target
- dry weight review
- potassium / phosphorus / sodium considerations
- fluid plan coordination
- dialysis-related factors
- oral supplement / EN / PN decisions must consider renal rule set

KDOQI 2020 CKD nutrition guideline 包含 nutrition assessment、medical nutrition therapy、protein and energy intake、nutritional supplementation、micronutrients 與 electrolytes，因此 renal rules 應獨立管理。

#### Heart failure

Heart failure 不作為 V1 primary nutrition tool，但作為 modifier：

- current weight may be affected by congestion
- use dry/euvolemic weight if appropriate
- coordinate fluid/sodium plan with treating team
- reassess weight after decongestion if needed

#### Cirrhosis

Cirrhosis 可作為 primary pathway，並加入：

- ascites / edema weight reliability
- sarcopenia concern
- encephalopathy status
- liver-specific nutrition rule set
- late evening snack / meal pattern 等內容可於後續版本細化

ESPEN guidelines 列有 clinical nutrition in liver disease，支持 liver-specific rule set 的設計方向。

#### Oncology

Oncology module 應記錄 nutrition-impact symptoms：

- nausea
- vomiting
- early satiety
- dysphagia
- taste change
- mucositis
- pain affecting intake

輸出應強調 symptom-directed nutrition care，而非只看分數。

#### Geriatric

Geriatric module 應加入：

- frailty / function considerations
- cognition / dependency affecting intake
- social feeding support
- pressure injury risk if available
- reassessment trigger

#### ICU

ICU module 應加入：

- route feasibility
- hemodynamic / clinical stability
- EN tolerance monitoring
- refeeding risk
- transition plan out of ICU

---

## 13. Nutrition Care Bundle

### 13.1 Care Bundle principle

Care Bundle 是 decision support output，不是 locked order。營養師與醫師可 accept、modify 或 reject 系統建議，並保存 rationale。

### 13.2 Bundle components

V1 Nutrition Care Bundle 固定包含：

1. Nutrition professional review
2. Feeding route recommendation
3. Nutrition requirement profile
4. Specialty modifier recommendations
5. Safety actions
6. Monitoring plan
7. Reassessment plan
8. Documentation summary

### 13.3 Recommendation status

每一項 recommendation 需有狀態：

| Status | 意義 |
|---|---|
| RECOMMENDED | 系統建議執行 |
| CONSIDER | 可考慮，需依臨床判斷 |
| NOT_INDICATED | 目前未建議 |
| PENDING_ASSESSMENT | 需先完成安全或臨床評估 |
| COMPLETED | 已完成 |
| MODIFIED_BY_CLINICIAN | 專業人員已修改 |
| REJECTED_BY_CLINICIAN | 專業人員判斷不適用 |

### 13.4 Care bundle object

```text
nutrition_care_bundle
├── bundle_id
├── patient_id
├── assessment_id
├── normalized_result_id
├── professional_review
│   ├── priority
│   ├── recommendation
│   └── reasons[]
├── feeding_route_recommendation
├── requirement_profile
├── specialty_recommendations[]
├── safety_actions[]
├── monitoring_plan
├── reassessment_plan
├── clinician_decisions[]
│   ├── recommendation_id
│   ├── system_recommendation
│   ├── clinician_decision
│   ├── override_reason
│   └── decided_by / decided_at
├── documentation_summary
├── rule_versions[]
└── status
```

### 13.5 Explainability requirements

每個主要結果需提供「Why?」：

| UI 問題 | 系統需能回答 |
|---|---|
| 為什麼推薦這個工具？ | pathway reasons + modifiers |
| 為什麼是 RED priority？ | native result + safety flags + intake + modifiers |
| 為什麼不是 EN？ | oral route still safe / optimize oral first / reassess if inadequate |
| 為什麼出現 renal warning？ | HD / PD / CKD flag and renal rule set |
| 為什麼體重不可靠？ | edema / ascites / HF congestion |

---

## 14. Monitoring and Reassessment

### 14.1 Monitoring plan

V1 必須在結果頁自動產生 monitoring plan。建議項目：

| Monitoring item | 適用情境 |
|---|---|
| Oral intake percentage | all at-risk patients |
| Weight / dry weight trend | general, renal, HF, cirrhosis |
| Fluid balance | HF, CKD, cirrhosis, ICU |
| GI tolerance | ONS / EN / oral optimization |
| Electrolytes | renal, refeeding risk, ICU, poor intake |
| Nutrition intervention delivery | ONS / EN / PN |
| Swallow status | dysphagia suspected |
| Functional / clinical status | geriatric, ICU, severe malnutrition |
| Nutrition diagnosis reassessment | malnutrition suspected / confirmed |

### 14.2 Reassessment plan

Reassessment 不應所有病人固定 48-72 小時，而應由 pathway rule 決定。

```text
reassessment_plan
├── suggested_interval
├── interval_reason
├── trigger_based_reassessment[]
├── responsible_role
└── due_at
```

### 14.3 Trigger-based reassessment

提早 reassess 條件：

- intake deteriorates
- feeding route changes
- ICU transfer
- significant fluid shift
- new dysphagia
- major clinical deterioration
- post-dialysis dry weight revised
- post-paracentesis / decongestion weight change
- EN / PN started or stopped

---

## 15. UI Specification: Five Main Screens

### Screen 1: Home

首頁提供雙入口，不做行銷式 landing page。

主要區塊：

1. 建立新評估
2. 護理師營養篩檢
3. 營養師 / 醫師專業評估
4. 查詢草稿 / 待追蹤個案

核心訊息：

- 成人住院營養評估
- 護理篩檢與專業評估為兩個入口
- 專業評估可直接開始

### Screen 2: Patient Context

目的：收集 primary pathway、modifiers、safety gate 所需的最小資料。

版面分區：

1. Basic demographics
2. Care location
3. Major clinical pathways
4. Intake / NPO / GI tract
5. Weight / height / fluid status
6. Safety flags
7. Data source / reliability

輸出：

- patient_context object
- primary pathway candidates
- modifiers
- missing critical data

### Screen 3: Tool Recommendation

目的：告訴使用者推薦哪個工具、為什麼、哪些條件沒有被忽略，並允許 professional override。

版面：

1. Primary Recommendation Card
2. Why recommended
3. Clinical modifiers retained
4. Alternative tools accordion
5. Professional override modal

重要規則：

- 這頁不開始問量表題目
- Alternative tools 必須顯示 intended use
- Override 需保存 override_reason

### Screen 4: Interactive Assessment

目的：以 Generic Assessment Renderer 完成工具題項、計算與 flag generation。

版面：

1. Tool title and type
2. Progress indicator
3. Section title
4. Question area
5. Clinical modifiers side panel
6. Missing data / validation alerts
7. Save / previous / next

完成後先顯示 assessment completion summary：

- required fields complete or missing
- generated modifiers
- safety status
- next: view clinical result

### Screen 5: Clinical Result + Nutrition Care Bundle

目的：先回答病人營養狀態與風險，再回答安全問題，最後才回答下一步照護。

資訊層級：

1. Clinical Summary
2. Risk / Malnutrition / Priority
3. Native Result
4. Why this result?
5. Safety Alerts
6. Nutrition Care Bundle
7. Monitoring & Reassessment
8. Clinician Review
9. Documentation / Audit

核心結果三欄必須分開：

```text
Nutrition Risk
Malnutrition Status
Action Priority
```

範例：

```text
Nutrition Risk: NOT_APPLICABLE
Malnutrition: SEVERE
Action Priority: RED
Native tool: 7-point SGA
```

這可避免「營養風險 = 營養不良診斷 = 處置優先度」的錯誤混用。

---

## 16. Professional Override

### 16.1 Override scope

可 override：

- primary tool
- alternative tool selection
- recommendation status
- feeding route recommendation
- monitoring interval
- care bundle items

不可 override 而不留紀錄：

- tool version
- native result
- original responses
- safety flags
- data provenance

### 16.2 Override object

```text
professional_override
├── override_id
├── target_type
│   └── TOOL_SELECTION | RECOMMENDATION | ROUTE | MONITORING | BUNDLE_ITEM
├── original_value
├── new_value
├── reason_category
│   └── CLINICAL_JUDGMENT | EXISTING_ASSESSMENT | INSTITUTIONAL_PROTOCOL | FOLLOW_UP_COMPARISON | OTHER
├── reason_text
├── overridden_by
├── role
└── timestamp
```

Override 的目的不是限制專業自主，而是建立 decision support + professional autonomy + auditability。

---

## 17. Audit, Versioning, and Governance

### 17.1 Versioned entities

下列資料必須 versioned：

- tool registry
- question schema
- scoring rule
- normalization mapping
- tool selection rule
- safety gate rule
- requirement rule
- feeding route rule
- care bundle template
- documentation template

### 17.2 Audit log

```text
audit_log
├── audit_id
├── patient_id
├── entity_type
├── entity_id
├── action
│   └── CREATE | UPDATE | COMPLETE | SUPERSEDE | OVERRIDE | EXPORT | VIEW
├── previous_value
├── new_value
├── user_id
├── role
├── timestamp
├── rule_versions[]
└── reason
```

### 17.3 Assessment lifecycle

| Status | 意義 |
|---|---|
| DRAFT | 尚未完成 |
| COMPLETED | 評估完成 |
| INVALIDATED | 因資料錯誤或流程問題作廢 |
| SUPERSEDED | 被較新評估取代，但保留紀錄 |

若修改 patient context 導致 primary pathway 改變，既有 completed assessment 不刪除，標記為 SUPERSEDED，並建立新評估。

---

## 18. Data Quality Rules

### 18.1 Missing and unknown

V1 明確區分：

- YES
- NO
- UNKNOWN
- NOT_APPLICABLE
- NOT_ASKED

UNKNOWN 不得自動等於 NO。NOT_ASKED 不得自動等於 negative。

### 18.2 Critical data validation

| Data issue | 系統行為 |
|---|---|
| age missing | 不可選 pathway |
| age < 18 | 成人 V1 不適用 |
| ICU status unknown | 要求確認或標示 uncertainty |
| dialysis modality missing but CKD5D true | 要求補 HD / PD |
| dysphagia suspected but no swallow status | Safety Gate pending |
| intake unknown | feeding route recommendation pending |
| GI function unknown | EN / PN escalation pending |
| current weight fluid affected | reference weight required or reliability warning |
| required tool fields missing | 不產生 valid native result |

### 18.3 Data provenance

每個關鍵資料欄位需保存來源：

```text
data_source = EHR | MANUAL | PATIENT_REPORTED | CAREGIVER_REPORTED | ESTIMATED | IMPORTED
```

若 source = ESTIMATED 或 PATIENT_REPORTED，顯示 reliability note。

### 18.4 No forced completion

系統不得為了讓百分比、分數或結果完整而自動補值。若資料不足，應輸出 GRAY 或 INCOMPLETE，而不是推測結果。

---

## 19. Documentation Summary

結果頁需產生 structured clinical note preview，可複製至 HIS 或後續串接。

範例：

```text
Nutrition assessment summary

Primary pathway:
Renal / Hemodialysis

Assessment:
7-point SGA, hospital-approved version

Native result:
Severely malnourished

Normalized result:
Nutrition risk: Not applicable for this assessment tool
Malnutrition status: Severe malnutrition
Clinical priority: High

Relevant modifiers:
Heart failure, edema / congestion, age >=65

Current intake:
25-49% estimated requirements

Safety:
Refeeding risk assessment required.
Swallowing safety not flagged / or pending if applicable.

Nutrition care:
Optimize oral intake, consider ONS if oral route remains safe, monitor intake adequacy, evaluate EN if intake remains inadequate.

Monitoring:
Intake, weight / dry weight, fluid balance, electrolytes, GI tolerance, nutrition intervention delivery.

Follow-up:
Nutrition reassessment planned according to pathway rule.
```

---

## 20. Nonfunctional Clinical Product Requirements

### 20.1 Usability

- 臨床人員在 1-2 分鐘內應能理解系統為何推薦某工具
- 結果頁應先顯示狀態與安全，不先顯示熱量 / 蛋白質
- Alternative tools 顯示用途，不只顯示名稱
- 每個 recommendation 都應提供原因

### 20.2 Safety

- Safety Gate before treatment
- Oral route conditional if dysphagia unresolved
- Refeeding risk conditional before advancement
- Weight reliability warning for edema / ascites / congestion
- No hidden substitution of unknown as no

### 20.3 Maintainability

- Tools are schema-driven
- Rules are versioned
- Requirement targets are registry-driven
- UI does not hardcode clinical cutoffs where registry is available

### 20.4 Auditability

- All overrides recorded
- Native result preserved
- Normalized result reproducible by mapping rule version
- Assessment lifecycle preserved
- Export action logged

---

## 21. External Clinical Reference Anchors for V1 Review

V1 的正式臨床內容需由院內營養委員會或相關專責小組核准。以下作為 rule registry 與審查時的 reference anchors：

- ESPEN Guidelines and Consensus Papers：涵蓋 ICU、liver disease、geriatrics、home EN/PN 等 guideline categories。
- KDOQI Clinical Practice Guideline for Nutrition in CKD: 2020 Update：腎臟病營養評估、protein / energy intake、supplementation、micronutrients、electrolytes。
- ASPEN Consensus Recommendations for Refeeding Syndrome：refeeding risk identification、electrolyte / thiamine / monitoring concepts。
- ASPEN enteral nutrition resources：EN 為經 feeding tube 直接進入 GI tract 的 nutrition support route。
- ASHA Adult Dysphagia / Swallowing Screening：吞嚥篩檢用於辨識 dysphagia 可能性與進一步評估需求，不應用 bedside screen 宣稱可靠排除 aspiration。
- MNA / PG-SGA 等工具：正式數位化前需確認授權、版本與不可任意改寫題項的限制。

---

## 22. V1 Consistency Self-Check

### 22.1 Scope consistency

| 檢查項目 | 結論 |
|---|---|
| 是否明確排除兒科 | 通過 |
| 是否保留成人 primary pathways | 通過 |
| 是否避免自動醫囑 | 通過 |
| 是否允許營養師不經護理篩檢直接評估 | 通過 |

### 22.2 Clinical logic consistency

| 檢查項目 | 結論 |
|---|---|
| Primary pathway 與 modifiers 分開 | 通過 |
| Heart failure 不作為 primary tool | 通過 |
| Dysphagia 作為 safety gate 而不是營養風險分數 | 通過 |
| Refeeding 作為 safety gate 而不是藏在備註 | 通過 |
| Risk、malnutrition、priority 分開 | 通過 |
| 7-point SGA 不硬轉成 nutrition risk | 通過 |

### 22.3 Data model consistency

| 檢查項目 | 結論 |
|---|---|
| Native result preserved | 通過 |
| Normalized result versioned | 通過 |
| Tool registry 包含 license status | 通過 |
| Unknown / not asked 不等於 negative | 通過 |
| Fluid-affected weight 保留 measured 與 reference weight | 通過 |

### 22.4 UI consistency

| 檢查項目 | 結論 |
|---|---|
| 五個主要 screens 完整 | 通過 |
| Screen 3 不開始問量表題目 | 通過 |
| Screen 5 先結果與安全，再治療建議 | 通過 |
| Professional override 有理由紀錄 | 通過 |
| Alternative tools 顯示用途 | 通過 |

### 22.5 Safety consistency

| 檢查項目 | 結論 |
|---|---|
| Treatment 前先 Safety Gate | 通過 |
| Dysphagia pending 時 oral recommendation conditional | 通過 |
| GI uncertain 時 EN escalation pending | 通過 |
| Refeeding risk 時 nutrition advancement conditional | 通過 |
| Data insufficient 時可輸出 GRAY，不強迫結果 | 通過 |

### 22.6 Remaining V1 decisions before implementation

正式進入網站程式前仍需定稿：

1. 院內核准使用哪些工具與版本
2. MNA-SF、PG-SGA SF、RFH-NPT 等工具的數位授權狀態
3. 各 pathway 的 exact cutoff / mapping table
4. 院內 refeeding protocol 是否採 ASPEN-based、NICE-based 或本院版本
5. 吞嚥篩檢採用何種院內 protocol 與轉介流程
6. CKD5D / HD / PD requirement rule 的院內版本
7. Documentation summary 要輸出至 HIS 的格式
8. 角色權限與電子簽章需求

---

## 23. V1 Implementation Readiness Statement

本規格已將目前確認的臨床與產品原則整合為 V1 baseline：

- 成人 V1，排除兒科
- 首頁雙入口
- 護理篩檢不是營養師專業評估前置條件
- Patient Context 驅動 pathway 與 modifiers
- Tool Selection Engine 可解釋、可 override
- Primary pathways 包含 ICU、cirrhosis、CKD5D / HD / PD、active cancer、geriatric、general adult
- Specialty modifiers 包含 HF、dysphagia、ascites / edema、refeeding risk 等
- 統一 normalization data model
- Safety Gate before treatment
- Feeding Route Engine
- Nutrition Care Bundle
- Monitoring / Reassessment
- 五個主要 UI screens
- Professional override
- Audit / versioning
- Data quality rules

下一階段可進入 V1 implementation planning，但在開發前應先完成院內 tool registry、rule registry 與量表授權確認。
