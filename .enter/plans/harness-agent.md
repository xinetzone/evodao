# Fix: Last Suggestion Chip Text Being "Swallowed"

## Root Cause
`GoalInput.tsx` line 373 renders an **absolutely-positioned right-fade gradient**
(`w-8 bg-gradient-to-l from-background to-transparent`) on top of the horizontally
scrollable chip row. Because the scrollable flex container has no right padding,
the gradient permanently overlaps the last chip's visible text — making characters
look "swallowed."

## Fix (1 file, 1 line)

**`src/components/agent/GoalInput.tsx` — line 340**

Add `pr-10` to the scrollable flex container so there is always clearance between
the last chip and the gradient overlay:

```diff
- <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
+ <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none pr-10">
```

No other changes needed — the gradient, `max-w`, `truncate`, and `slice(0,42)`
logic all stay as-is.

## Verification
After the fix the last chip ("制定抖音/小红书30天短视频内容日历…") should display
its full (truncated) text without any pixel overlap from the gradient.
