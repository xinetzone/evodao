# GitHub Push Skill 计划

## 技能目标

创建 `github-push` skill，让 AI 代理在用户需要推送代码到 GitHub 时，提供**完整的引导 + 兜底脚本方案**。

## 核心约束

- `git push` 在 Enter.pro 框架中被强制拦截，AI 代理无法直接执行
- 因此技能分两路：①重连 Enter.pro GitHub Integration（自动同步）②生成本地推送脚本（兜底）

---

## Skill 内容设计

### 触发场景
- 用户说"推送到 GitHub"、"push to GitHub"、"代码同步到 github"
- 用户遇到 git push 失败或无法连接
- 用户第一次配置 GitHub 推送

### 执行流程

**Step 1：检查当前 git 状态**
```bash
git remote -v          # 查看 remote 是否已指向 GitHub
git log --oneline -5   # 查看最近待推送的 commits
```

**Step 2A：优先引导 Enter.pro GitHub Integration**
- 检测 `origin` 是否为 `/workspace/center`（未连接 GitHub）
- 如果是，引导用户：项目设置 → GitHub → Connect
- 常见问题：弹窗被拦截（提供 Chrome/Edge 解除方法）
- 成功后：每次对话代码变更自动同步到 GitHub

**Step 2B：兜底 — 生成本地推送脚本**
- 询问用户的 GitHub 仓库 URL（HTTPS 或 SSH）
- 根据用户选择生成对应脚本：

  **SSH 版本**（`push-github-ssh.sh`）：
  - 检查本地是否有 SSH key，没有则生成
  - 显示公钥，提示用户添加到 GitHub
  - 配置 SSH remote，执行 push

  **HTTPS/PAT 版本**（`push-github-https.sh`）：
  - 配置 credential 使用 token
  - 设置 remote URL 含 PAT
  - 执行 push

- 脚本写入项目根目录，用户下载后一键执行

---

## Skill 文件位置

`/workspace/skill-drafts/custom/github-push@1/SKILL.md`

---

## 执行步骤

1. 写入 SKILL.md 草稿到 `/workspace/skill-drafts/custom/github-push@1/`
2. 调用 `confirm_skill` 提交

---

## 注意事项

- skill 中需明确告知 AI：不能执行 `git push`，只能生成脚本或引导
- 生成脚本时包含 `--force` 选项说明（适用于历史冲突场景）
- SSH key 生成使用 `ed25519` 算法（更现代、更安全）
