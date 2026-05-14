# 项目复盘报告导出 + Git 推送

## Context

用户希望对 EVODAO 项目进行全面复盘，导出报告，并推送到远程 Git 仓库。

**重要限制（框架约束）：**
- `git commit` / `git push` / `git add` 命令被框架拒绝，无法手动执行
- 框架在每个有代码变更的 turn 后自动生成一次 commit
- 当前 remote `origin` 指向 `/workspace/center`（Enter.pro 内部路径，非 GitHub）
- 若需推送到真正的远程仓库（GitHub），需要用户提供 GitHub 仓库 URL，框架侧通过 Enter.pro 的 GitHub 连接功能实现

**可执行部分：**
1. 编写全面的项目复盘报告（写入文件 → 框架自动 commit）
2. 可拆分为多个独立文件变更以产生多次 commit

---

## 报告内容规划

### 目标文件：`docs/project-report.md`

报告结构（约 500 行）：

```
# EVODAO 项目复盘报告

## 1. 项目概述
## 2. 开发时间线（全量 commit 分类梳理）
## 3. 系统架构
   - 前端架构
   - 后端架构（Supabase + Edge Functions）
   - 数据库 Schema（全部表字段）
## 4. 已实现功能清单
   - Agent 核心（并行任务、自我进化、QA模式、构建模式）
   - 多模型选择（LLM + 图像模型）
   - 多模态输出（文本/代码/图像）
   - 任务管理器
   - 长期记忆
   - 国际化（中/英）
   - 用户认证与管理
   - 配额系统（运行次数 + Token 计量）
   - 套餐订阅架构（预留支付接入点）
## 5. 关键技术决策
## 6. 发现并修复的 Bug
## 7. 当前状态与已知问题
## 8. 未来路线图（支付接入、功能扩展）
```

---

## 实现步骤

### Step 1：写入主报告
- 创建 `docs/project-report.md`（全量复盘，~500 行）
- 框架自动产生 commit: `docs(report): add comprehensive project retrospective`

### Step 2：更新 README
- 在 `README.md` 顶部添加项目当前功能摘要，同步最新状态
- 框架自动产生 commit: `docs: sync README with current feature set`

### Step 3：在报告中补充 DB Schema 截面
- 根据 `src/integrations/supabase/types.ts` 提取所有自定义表的完整字段
- 追加 `docs/db-schema.md`（数据库专项文档）
- 框架自动产生 commit: `docs(db): add database schema documentation`

---

## Git Push 说明

当前远程 (`origin /workspace/center`) 为 Enter.pro 内部同步路径，不是外部 GitHub。

**要推送到 GitHub，有两个路径：**

**路径 A（推荐）：** 通过 Enter.pro 连接 GitHub
- Enter.pro 设置页 → GitHub Integration → 连接后自动同步到您的 GitHub 仓库

**路径 B：** 手动配置
- 用户在本地克隆 Enter.pro 项目代码
- 添加 GitHub remote：`git remote add github https://github.com/yourname/yourrepo.git`
- 执行：`git push github main`

这两步都需要用户主动操作，代理无法代替执行（`git push` 被框架拒绝）。

---

## 验证
- `docs/project-report.md` 存在，内容覆盖所有功能模块
- `docs/db-schema.md` 存在，字段与 types.ts 一致
- `README.md` 顶部有最新功能概览
- `git log --oneline` 可见 3 条新 docs 类型 commit
