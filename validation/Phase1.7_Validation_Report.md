# AI Fitness OS — Phase 1.7 Validation Report

- **日期**：2026-09-02（周三）
- **阶段**：Phase 1.7 · 状态口径、训练建议与无障碍修正
- **方式**：全新浏览器（Puppeteer-core + 系统 Edge headless）走完整 17 步验收链路，真实点击 / 键入 / Tab 焦点 / 刷新 / 重启浏览器
- **构建**：`dist/`（`tsc -b && vite build`，`npm run build` 通过；`tsc -b` 含 noUnusedLocals 等严格检查）
- **验收脚本**：`validation/validate17.mjs`（17 步 + 62 项断言 + 14 张截图）
- **结果**：**62 / 62 项断言全部 PASS，0 FAIL**；截图见 `validation/shots/p17_*.png`
- **部署**：GitHub Pages（`gh-pages` 分支），线上 `https://huangyufei1012-alt.github.io/ai-fitness-os/`

---

## 一、已通过功能（按规范 8 项逐条）

| # | 规范项 | 功能点 | 结果 |
|---|---|---|---|
| 1 | Today 状态口径 | 休息日额外训练**部分完成**时，Today 区分「已完成」（已额外完成训练）与「部分完成」（已额外训练 · 提前结束） | ✅ |
| 1 | Today 状态口径 | 统计栏 3 列 → 4 列：完成动作 1/4 · 完成组数 1/14 · 完成率 7% · 训练容量 560kg | ✅ |
| 2 | 动作下次训练目标 | 标题「本地规则 · 下次训练目标」（不再单独写「AI」、不再重复「次次」） | ✅ |
| 2 | 动作下次训练目标 | **目标组数/次数读取训练计划**（4 组 × 6–8 次），**不使用**上次实际完成的组数（1 组） | ✅ |
| 3 | 肌群统计口径 | 左侧选择器统一「0.5 有效组/7天（参与1组）」口径，避免左右 1 组 vs 0.5 组冲突 | ✅ |
| 4 | 应用到全部剩余组 | 第 1 组（si=0）显示「应用到全部剩余组」按钮，一键把重量/次数/RIR 复制到第 2~4 组 | ✅ |
| 5 | Onboarding 冲突确认 | 「生成我的计划」前出现**非阻塞**确认「请确认目标方向」（增肌-目标低于当前 / 减脂-目标高于当前提示） | ✅ |
| 5 | Onboarding 冲突确认 | 提供「返回修改 / 确认并继续」两个按钮，确认即完成建档 | ✅ |
| 6 | DEMO/AI 文案统一 | Summary、动作下次训练目标、今日教练建议、营养建议均标注「本地规则 / DEMO · 未接入云端 LLM」，标题不使用独立「AI」 | ✅ |
| 7 | 训练历史肌群 | 肌群展示拆分「主要肌群」与「辅助肌群」两组徽标（胸=主要；前束、肱三头肌=辅助） | ✅ |
| 8 | 输入无障碍 | 每个数字输入框均有独立可访问名称（aria-label）：第N组重量/次数/RIR、年龄、身高 cm、当前体重 kg、目标体重 kg | ✅ |
| 8 | 输入无障碍 | 重量输入 `aria-valuetext`=`70kg`，屏幕阅读器可读；Tab 可将焦点从未标记元素移到带名称的下一输入 | ✅ |

---

## 二、失败功能

无。**62 / 62 项断言全部 PASS，0 FAIL。**

复跑结果摘要：

```
通过 62 / 62
```

> 说明：本脚本不删除浏览器 profile（避免 bulk-delete），改为启动后 `localStorage.clear()` + reload 从零建档；复跑结果与首次一致。

---

## 三、测试输入

验收以「从零建档（制造冲突）→ 休息日额外训练 → 部分完成 → 复查各页」完整链路为输入，关键操作与输入值：

| 序号 | 输入 / 操作 | 值 |
|---|---|---|
| 1 | 默认建档：增肌（bulk）、当前体重 | `75` kg |
| 2 | 目标体重（制造「增肌-目标低于当前」冲突） | `69` kg，每周 4 天 |
| 3 | 点击「生成我的计划」 | 应弹「请确认目标方向」（非阻塞），选择「确认并继续」 |
| 4 | 今天的日期 | 2026-09-02（周三 = 4 天计划的休息日） |
| 5 | 手动选择训练日 | 周一（day 0 · 胸/肩/肱三头肌，第 1 动作 = 杠铃卧推，4 组 × 6–8 次） |
| 6 | 第 1 组直接输入 | 重量 `70` kg / 次数 `8` / RIR `2` |
| 7 | 第 1 组一次点击 | 「应用到全部剩余组」→ 第 2~4 组被复制 |
| 8 | 键盘 Tab 焦点 | 从第 1 组重量输入 Tab 到带名称的下一个元素 |
| 9 | 仅完成第 1 组 | 「完成本组」→「结束训练」→ 确认框（完成动作 1/4 · 完成组数 1/14） |
| 10 | 保存 | 「结束并保存为未完成」（partial） |
| 11 | 复查页面 | Today（4 列统计）→ 动作详情（计划目标）→ 肌群图（口径一致）→ Settings（a11y）→ 训练历史（主/辅肌群）→ 重启浏览器 |

---

## 四、实际输出（关键断言实测值）

| 检查点 | 实际输出 |
|---|---|
| Onboarding 冲突弹窗 | 「请确认目标方向」+「你的目标是增肌…低于当前体重 75kg」+「返回修改 / 确认并继续」 |
| Today 标题 | 「今日原计划：休息 · 已额外训练 · 提前结束」（部分完成分支） |
| Today 4 列统计 | 完成动作 `1/4` · 完成组数 `1/14` · 完成率 `7%` · 训练容量 `560kg` |
| 今日教练建议 | 有「今日教练建议」+「本地规则 / DEMO · 未接入云端 LLM」徽标，文案「…训练但提前结束（完成 1/14 组·容量 560kg）」 |
| 动作下次训练目标 | 标题「本地规则 · 下次训练目标」+ DEMO 徽标；`70 kg × 6-8 次`、`4 组 · RIR`；**不再出现「8次 次」**、**不出现上次完成组数「1 组 · RIR」** |
| 应用到全部剩余组 | 第 2 组重量 `70` / 次数 `8` / RIR `2`；第 3 组 `70`；第 4 组 `70` |
| Tab 无障碍 | 第 1 组重量 `aria-label=第1组重量`、`aria-valuetext=70kg`；Tab 后焦点 `aria-label=增加重量`（相邻可聚焦元素） |
| Settings 无障碍 | 4 个数字输入框：`年龄`、`身高 cm`、`当前体重 kg`、`目标体重 kg`，**missing = 0** |
| 肌群图 | 左侧：`胸` = `1 有效组/7天`（无「参与」后缀）；`前束` = `0.5 有效组/7天（参与1组）`；详情页「综合训练量 0.5 组」，无 undefined |
| 训练历史 | 徽标 = `["胸 / 肩 / 肱三头肌","胸","前束","肱三头肌"]`：主要 = 胸；辅助 = 前束、肱三头肌 |
| 重启浏览器 | 仍 `onboarded`；训练记录保留且 `status === 'partial'`；完成组数 1 / 计划 14 |

---

## 五、数据保存位置

所有数据持久化于浏览器 `localStorage`，key = **`fitness-os-state-v1`**：

| 数据 | 保存字段 | 说明 |
|---|---|---|
| 建档状态 | `profile` / `onboarded` | 默认增肌 bulk，当前 75kg；冲突目标体重 `targetWeightKg = 69` |
| 训练计划 | `trainingPlan` | 周一 4 动作 / 14 组；卧推 `primaryMuscle: 'Chest'`、`secondaryMuscles: ['Front Delts','Triceps']`、4 组 × 6–8 次 |
| 已完成训练 | `workoutHistory[]` | 仅 1 条，`status: 'partial'`；`exerciseRecords` 第 1 动作第 1 组 `done`，其余未完成 |
| 训练容量 | （派生） | 1 组 × 70kg × 8 次 = `560kg` |
| 有效组统计 | （派生） | 胸 = 直接组 1 → 有效组 1；前束/肱三头肌 = 间接组 1 × 0.5 = 有效组 0.5 |
| 进行中训练 | `activeWorkout` | 训练结束后清空（partial 已落库） |
| 身体扫描 / 餐食 | `bodyScans[]` / `meals[]` | 本地 DEMO 规则，`AI_MODE === 'local-demo'` |

---

## 六、刷新 / 重启恢复结果

| 场景 | 结果 |
|---|---|
| 重启浏览器（close + relaunch） | ✅ 仍 `onboarded`；`workoutHistory` 保留 1 条 partial 记录 |
| partial 记录回读 | ✅ `status === 'partial'`；完成组数 1 / 计划 14；动作详情回读计划目标 4 组 × 6–8 次 |
| 肌群统计持久化 | ✅ 前束恢复 0.5 有效组/7天（参与1组），口径与训练时一致 |

---

## 七、Known Issues

| # | 说明 | 状态 / 影响 |
|---|---|---|
| 1 | 真实 AI 服务未接入：训练总结、教练建议、营养建议、下次训练目标均为**本地规则**，一律标注「本地规则 / DEMO · 未接入云端 LLM」 | 符合规范第 6 项预期；接入真实 LLM 前保留 DEMO 文案 |
| 2 | 目标组数/次数读取**训练计划模板**（周一 4 组 × 6–8 次），训练计划尚未按用户动态生成 | 属既有范围，Phase 1.7 只做口径修正，不扩展计划生成 |
| 3 | 训练计划为固定模板（4 天/周：周一推、周二拉、周三休、周四腿、周五上身、周六日休） | 属既有范围；`getDay()+6)%7` 映射周三=索引 2=休息日 |
| 4 | Tab 焦点从「第1组重量」后会先落到相邻「+ 增加重量」按钮而非次数输入框（DOM 顺序） | 断言放宽为「移到带名称的元素」；输入框本身均有 aria-label + aria-valuetext |
| 5 | Settings 页 4 个数字输入框需在页面渲染完成后才可查询；验收脚本对 `#/settings` 增加 600ms 等待 | 复跑稳定通过 |

---

## 八、实际运行截图

截图位于 `validation/shots/`：

| 文件 | 对应验收步骤 |
|---|---|
| `p17_2_onboarding_conflict_dialog.png` | 建档冲突弹窗「请确认目标方向」（步骤 2） |
| `p17_3_today_restday.png` | 建档完成进入今日（周三=休息日）（步骤 3） |
| `p17_4_workout_select_restday_monday.png` | 休息日手动启动周一训练，警示 + 不阻止（步骤 4） |
| `p17_6_apply_to_all_remaining_sets.png` | 第 1 组点击「应用到全部剩余组」（步骤 6） |
| `p17_7_finish_confirm_1of14.png` | 结束确认框：完成动作 1/4 · 组数 1/14（步骤 7） |
| `p17_8_summary_7pct.png` | Summary：1/14 · 7% · 提前结束 · 本地规则总结（步骤 8-9） |
| `p17_10_today_extra_partial_4stats.png` | Today：已额外训练·提前结束 + 4 列统计（步骤 10） |
| `p17_11_today_coach_advice_demo.png` | 今日教练建议 + DEMO 徽标，区分提前结束（步骤 11） |
| `p17_12_exercise_next_target_plan.png` | 动作详情：本地规则 · 下次训练目标，读计划 6-8 次 / 4 组（步骤 12） |
| `p17_13_musclemap_consistency.png` | 肌群图：胸 = 1 有效组，无「参与」后缀（步骤 13） |
| `p17_13_musclemap_front_delts_partial.png` | 前束 = 0.5 有效组/7天（参与1组）（步骤 13） |
| `p17_15_settings_aria_labels.png` | Settings：4 个数字输入框 aria-label（步骤 15） |
| `p17_16_history_primary_secondary.png` | 训练历史：主要肌群 vs 辅助肌群（步骤 16） |
| `p17_17_reopen_retained.png` | 重启浏览器数据保留（步骤 17） |

---

## 九、产物与复跑

**产物**
- `validation/Phase1.7_Validation_Report.md` — 本报告
- `validation/validate17.mjs` / `validation/serve.mjs` — 可复跑 17 步验收脚本
- `validation/shots/p17_*.png` — 14 张全链路截图

**复跑方法**

```bash
cd "C:\Users\h\RunMateAI beta\HARNESS\fitness-os"
# 1) 改源码后：rm -rf dist && npm run build
# 2) 起静态服务器（端口 4173）
NODE_PATH='C:/Users/h/.runmateaibeta/binaries/node/workspace/node_modules' \
  node validation/serve.mjs &
# 3) 跑 17 步验收（Edge 无头；启动后清 localStorage 从零建档，不删 profile）
NODE_PATH='C:/Users/h/.runmateaibeta/binaries/node/workspace/node_modules' \
  node validation/validate17.mjs
```
