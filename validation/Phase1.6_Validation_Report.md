# AI Fitness OS — Phase 1.6 Validation Report

- **日期**：2026-09-02（周三）
- **阶段**：Phase 1.6 · 日常训练体验与数据逻辑修正
- **方式**：全新浏览器（Puppeteer-core + 系统 Edge headless）从零走完整 15 步验收链路，真实点击 / 键入 / 刷新 / 重启浏览器
- **构建**：`dist/`（`tsc -b && vite build`，`npm run build` 通过；`tsc -b` 含 noUnusedLocals 等严格检查）
- **验收脚本**：`validation/validate16.mjs`（15 步 + 37 项断言 + 截图）
- **结果**：**37 / 37 项断言全部 PASS，0 FAIL**；截图见 `validation/shots/p16_*.png`
- **部署**：GitHub Pages（`gh-pages` 分支），线上 `https://huangyufei1012-alt.github.io/ai-fitness-os/`

---

## 一、已通过功能（按规范分区逐项）

| 规范分区 | 功能点 | 结果 |
|---|---|---|
| (一) 训练组输入 | 直接键入重量/次数/RIR + 正负步进按钮 + 移动端数字键盘（`inputMode`） | ✅ |
| (一) 训练组输入 | 「复制上一组」把上一组值带入下一组 | ✅ |
| (一) 训练组输入 | 「应用到剩余组」一次覆盖后续全部组 | ✅ |
| (一) 训练组输入 | 基于最近表现的预填（仅 0 值回填，`previousPerformance`） | ✅ |
| (一) 器械步进 | 重量步进按器械配置取整：杠铃 2.5kg / 哑铃 2kg / 机器 5kg / 缆绳 2.5kg / 徒手 1 | ✅ |
| (二) 提前结束确认 | 确认弹窗显示：完成动作 1/4 · 完成组数 1/14 · 完成率 7% | ✅ |
| (二) 提前结束确认 | 三按钮：继续训练 / 结束并保存为未完成 / 放弃本次训练 | ✅ |
| (二) 提前结束确认 | 放弃需二次确认；`discard` 清空 activeWorkout 且不落库 | ✅ |
| (二) 四状态模型 | Workout 状态 in_progress / completed / partial / discarded 全链路 | ✅ |
| (三) Workout Summary | 同时展示计划/实际动作数、计划/实际组数、完成率、状态、时长、容量、肌群 | ✅ |
| (三) Workout Summary | 「本地规则总结」替换真实 LLM 前的「AI 教练总结」 | ✅ |
| (三) Workout Summary | 仅完成 1 个动作时不显示「表现最好的动作」（`perf.length>=2` 保护） | ✅ |
| (四) 渐进超负荷 | 按器械增量取整，**不出现 2.6kg / 71.8kg** 碎重量 | ✅ |
| (四) 渐进超负荷 | 仅全部组完成 + 达次数上限 + RIR 达标 + ≥2 次记录才加重；部分组完成 → 保持 | ✅ |
| (五) 直接/间接组 | 统一 `MuscleVolumeService`：主肌群权重 1.0、辅肌群 0.5、加权和 | ✅ |
| (五) 直接/间接组 | 肌群数据中心分开展示直接组 / 间接组 / 综合训练量 | ✅ |
| (六) Today 联动 | 休息日手动完成训练后不再显示「今天是休息日」，改显示「已额外完成训练」 | ✅ |
| (六) Today 联动 | 展示原计划（休息）+ 额外完成训练名称/肌群/动作/组数/容量/时长 + 查看训练总结 | ✅ |
| (六) Today 联动 | 本地教练建议读取本次额外训练 | ✅ |
| (七) 训练历史 | 侧边栏新增「训练历史」入口；列表含日期/名称/状态/动作/组数/容量/时长/肌群 | ✅ |
| (七) 训练历史 | 点击进入对应 Workout Summary 详情 | ✅ |
| (八) 休息计时持久化 | `activeWorkout.rest` 存 `{startedAt, duration, endsAt}`；刷新按当前时间重算剩余 | ✅ |
| (九) Fitness Profile | 目标体重默认留空（`undefined`），非阻塞 | ✅ |
| (九) Fitness Profile | 冲突警示（增肌/减脂方向、日期早于今天、周期不足）为琥珀色提醒，不阻断保存 | ✅ |
| (十) AI/DEMO 文案 | Nutrition 空状态明确「本地 DEMO 规则估算；照片 AI 识别尚未接入」 | ✅ |
| (十) AI/DEMO 文案 | Body Scan 保留「AI Service Not Configured」，不产出虚假分析（`analysis:null, aiGenerated:false`） | ✅ |
| (十一) 验收流程 | 15 步全链路验收全部通过（37/37） | ✅ |

---

## 二、失败功能

无。**37 / 37 项断言全部 PASS，0 FAIL。**

复跑结果摘要：

```
通过 37 / 37
```

---

## 三、测试输入

验收以「从零建档 → 训练 → 结束 → 复查」完整链路为输入，关键操作与输入值：

| 序号 | 输入 / 操作 | 值 |
|---|---|---|
| 1 | 全新建档（清空浏览器 profile） | — |
| 2 | 目标体重输入框初始值（应默认空） | `''`（待用户填写） |
| 3 | 目标体重（用于走通建档） | `70`，每周 4 天 |
| 4 | 今天的日期 | 2026-09-02（周三 = 黄金分化的休息日） |
| 5 | 手动选择训练日 | 周一（day 0 · 胸/肩/肱三头肌，4 动作 = 14 组） |
| 6 | 直接输入第 1 组 | 重量 `70` kg / 次数 `8` / RIR `2` |
| 7 | 完成第 1 组 | 「完成本组」→ 触发休息计时（restSec=120） |
| 8 | 复制上一组 / 应用到剩余组 | 验证第 2 组重量被带入为 `70` |
| 9 | 刷新页面 | 验证组次保留 + 休息倒计时恢复 |
| 10 | 结束训练 | 只完成 1/14 组 → 确认弹窗 |
| 11 | 确认弹窗分支 | 「结束并保存为未完成」（partial） |
| 12 | 复查页面 | Today / 肌群图 / 动作详情 / 训练历史 / 重启浏览器 |

---

## 四、实际输出（关键断言实测值）

| 检查点 | 实际输出 |
|---|---|
| 目标体重默认值 | `''`（空，符合规范默认留空） |
| 直接输入后第 1 组 | `70` kg × `8` 次 × RIR `2` |
| 复制+应用后第 2 组重量 | `70` |
| 刷新后休息计时 | `117s`（自 120s 起点按当前时间重算，未设 0） |
| 已完成第 1 组标记 | 「第 1 组 · 已记录」 |
| 确认弹窗完成度 | 「完成动作 1/4 · 完成组数 1/14」（计划 14 组 / 完成 1 组 / 完成率 7%） |
| Summary 组数 | `1/14` |
| Summary 完成率 | `7%` |
| Summary 状态 | 提前结束 / 训练已保存 · 未完成 |
| Summary 教练区 | 「本地规则总结」（DEMO 徽标），非真实 LLM |
| Today 休息日卡片 | 「今日原计划：休息 · 已额外完成训练」 + 完成动作/组数/容量 + 查看训练总结 |
| 肌群数据 | 直接组 / 间接组 / 综合训练量 分开展示，无 undefined |
| 动作建议 | 「保持当前重量」（卧推 1/4 组 < 目标，不加重）；**无 2.6 / 71.8 / 72.5** |
| 训练历史 | 列表含「提前结束」徽章；详情可打开，呈现「训练已保存 · 未完成」 |

---

## 五、数据保存位置

所有数据持久化于浏览器 `localStorage`，key = **`fitness-os-state-v1`**：

| 数据 | 保存字段 | 说明 |
|---|---|---|
| 建档状态 | `profile` / `onboarded` | 目标体重 `targetWeightKg` 可为 `undefined`（默认空） |
| 训练计划 | `trainingPlan` | 周一 = 4 动作 / 14 组 / restSec 120 |
| 已完成训练 | `workoutHistory[]` | 每条含 `status: 'completed' | 'partial'`、`exerciseRecords`、`durationMin`、`prs` 等 |
| 进行中训练 | `activeWorkout` | `session` + `activeIdx` + `rest`（in_progress 态） |
| 休息计时 | `activeWorkout.rest` | `{ startedAt, duration, endsAt }` |
| 放弃的训练 | —（不落库） | `discard()` 清空 `activeWorkout`，不写入 `workoutHistory` |
| 餐食 | `meals[]` | 本地 DEMO 规则营养估算 |
| 身体扫描 | `bodyScans[]` | `analysis: null, aiGenerated: false`（无假分析） |

> 对应「Workout 四状态」：
> - `in_progress` → 顶层 `activeWorkout` 存在
> - `completed` / `partial` → `workoutHistory[].status`
> - `discarded` → 清空 `activeWorkout` 且不持久化

---

## 六、刷新 / 重启恢复结果

| 场景 | 结果 |
|---|---|
| 训练中刷新页面（完成第 1 组后） | ✅ 已完成组保留（「第 1 组 · 已记录」），休息计时按 `endsAt` 重算恢复（实测 117s） |
| 刷新后回到进行中 | ✅ `activeWorkout` 保留，可继续（「进行中的训练」） |
| 关闭并重启浏览器 | ✅ 仍 `onboarded`；训练记录保留；记录 `status === 'partial'` |
| 部分组（partial）保存后 | ✅ 落库为 `workoutHistory` 记录，可在历史/Summary 反复查看 |

---

## 七、Known Issues

| # | 说明 | 状态 / 影响 |
|---|---|---|
| 1 | 真实 AI 服务未接入：营养估算、训练总结、身体扫描均为本地 DEMO 规则 / 显式「未配置」，不伪造 AI 结论 | 符合规范预期，属 Phase 1.6 边界；接真实 LLM 前保留 DEMO 文案 |
| 2 | 视觉识别未配置：Body Scan 与 Meals 的照片不进行 AI 分析，仅本地保存 | 符合规范第十条；接入 `AI_MODE === 'cloud-vision'` 后自动切换文案 |
| 3 | 训练计划为固定模板（周一推力 14 组等），未按用户动态生成 | 属既有范围，Phase 1.6 不扩展新大功能 |
| 4 | 类型层 `WorkoutStatus` 已声明四状态，但 `WorkoutSession.status` 仅声明 `'completed'|'partial'`（in_progress/discarded 为生命周期态，分别由 `activeWorkout` 有无表示，不落库） | 与运行时完全一致；如需把四态全部并入单个字段需改数据模型，本次不做 |
| 5 | 渐进超负荷加重需连续 1-2 次训练全达标（≥2 次历史记录门槛）；单次达标不加重，属预期保守策略 | 符合规范第四条 |

---

## 八、实际运行截图

截图位于 `validation/shots/`：

| 文件 | 对应验收步骤 |
|---|---|
| `p16_1_onboarding_targetWeight_empty.png` | 建档：目标体重默认空（步骤 1） |
| `p16_2_workout_select_restday_monday.png` | 休息日手动启动周一训练，警示 + 未阻止（步骤 2） |
| `p16_3_workout_direct_input.png` | 直接输入 70kg / 8次 / RIR2（步骤 3） |
| `p16_4_workout_copy_apply.png` | 复制上一组 + 应用到剩余组（步骤 4） |
| `p16_5_workout_rest_resume_after_reload.png` | 完成一组后刷新：组次保留 + 休息计时恢复（步骤 5、6） |
| `p16_6_workout_finish_confirm.png` | 只完成 1/14 组点结束 → 确认弹窗（步骤 7） |
| `p16_7_summary_partial.png` | 保存为 partial（步骤 8） |
| `p16_8_summary_counts.png` | Summary：1/14 · 7% · 提前结束 · 本地规则总结（步骤 9） |
| `p16_9_today_extra_training.png` | Today：休息日已额外完成训练（步骤 10） |
| `p16_10_musclemap_direct_indirect.png` | 肌群图：直接组 / 间接组 / 综合训练量（步骤 11） |
| `p16_11_exercise_next_target.png` | 动作建议保持重量，无 2.6kg（步骤 12） |
| `p16_12_history_list.png` | 训练历史列表（含提前结束徽章）（步骤 13、14） |
| `p16_12_history_detail_partial.png` | 训练历史详情（partial）（步骤 14） |
| `p16_13_reopen_retained.png` | 重启浏览器数据保留（步骤 15） |

---

## 九、产物与复跑

**产物**
- `validation/Phase1.6_Validation_Report.md` — 本报告
- `validation/validate16.mjs` / `validation/serve.mjs` — 可复跑 15 步验收脚本
- `validation/shots/p16_*.png` — 14 张全链路截图

**复跑方法**

```bash
cd "C:\Users\h\RunMateAI beta\HARNESS\fitness-os"
# 1) 改源码后：rm -rf dist && npm run build
# 2) 起静态服务器（端口 4173）
NODE_PATH='C:/Users/h/.runmateaibeta/binaries/node/workspace/node_modules' \
  node validation/serve.mjs &
# 3) 跑 15 步验收（Edge 无头，自动清 profile 从零走）
NODE_PATH='C:/Users/h/.runmateaibeta/binaries/node/workspace/node_modules' \
  node validation/validate16.mjs
```
