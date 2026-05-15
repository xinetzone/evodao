# Plan: User Usage Dashboard Panel

## Context

Add a side-drawer panel (consistent with HistoryPanel/TaskManagerPanel patterns) that gives
each user a clear picture of their own token consumption, quota (积分余量), and estimated
USD spending. Data sources:
- `usage_logs` table: model_id, total_tokens, cost_usd, output_mode, created_at
- `profiles` table: daily_run_limit, daily_image_limit, monthly_run_limit

---

## New Files

### `src/hooks/useUserUsage.ts`
Fetches the current user's usage stats from `usage_logs`. Returns:
```typescript
interface UserUsageStats {
  // Today
  todayRuns: number;
  todayTokens: number;
  todayCostUsd: number;
  todayImageRuns: number;
  // This month
  monthRuns: number;
  monthTokens: number;
  monthCostUsd: number;
  // Recent rows (last 30 records)
  recentLogs: UsageLogRow[];
  loading: boolean;
}
```
Single query: `select * from usage_logs where user_id = auth.uid() order by created_at desc limit 200`.  
Then compute today / month aggregates **client-side** from those 200 rows (avoids 3 round trips).

### `src/components/agent/UsagePanel.tsx`
A right-side drawer (same animation/positioning as HistoryPanel).

**Layout (top → bottom):**

1. **Header** — Title "我的用量 / MY USAGE" + close button + refresh button

2. **Today Overview** — 3 stat cards:
   - 今日运行 `todayRuns / profile.daily_run_limit` (shows "无限制" when null)
   - 今日 Token `todayTokens` (formatted as K/M)
   - 今日费用 `$todayCostUsd`

3. **Monthly Overview** — 2 stat cards:
   - 本月运行 `monthRuns / profile.monthly_run_limit`
   - 本月费用 `$monthCostUsd`

4. **Quota Progress Bars** — only shown when profile limits exist:
   - 今日运行配额 `todayRuns / daily_run_limit` (progress bar)
   - 今日图片配额 `todayImageRuns / daily_image_limit`
   - 本月运行配额 `monthRuns / monthly_run_limit`

5. **Recent Runs** — scrollable table (last 30 rows):
   - 时间 | 模式 | 模型 | Tokens | 费用

---

## Modified Files

### `src/components/agent/AgentHeader.tsx`
- Add `onUsageOpen: () => void` prop
- Add "用量" button (BarChart2 icon) next to History button (desktop-visible)
- Also add entry in user dropdown menu

### `src/pages/Index.tsx`
- Add `const [usageOpen, setUsageOpen] = useState(false)`
- Pass `onUsageOpen={() => setUsageOpen(true)}` to `<AgentHeader>`
- Render `<UsagePanel open={usageOpen} onClose={() => setUsageOpen(false)} />`

### `src/i18n/locales/zh.json` + `en.json`
Add `usage` section with keys:
```json
"usage": {
  "title": "我的用量",
  "todayRuns": "今日运行",
  "todayTokens": "今日 Tokens",
  "todayCost": "今日费用",
  "monthRuns": "本月运行",
  "monthCost": "本月费用",
  "quotaSection": "配额状态",
  "recentRuns": "最近运行",
  "unlimited": "无限制",
  "noData": "暂无运行记录",
  "refresh": "刷新",
  "mode": "模式",
  "model": "模型",
  "tokens": "Tokens",
  "cost": "费用",
  "time": "时间"
}
```

---

## Verification

1. Click "用量" button in header → drawer slides in from right
2. Stats cards show today's run count, tokens, and cost
3. Progress bars show when profile has limits set
4. Recent runs table lists last 30 logs with model names
5. All labels switch between zh/en with language toggle
