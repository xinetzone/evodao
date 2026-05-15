# 配色方案迁移：Cream 暖黄 → 深色 橙紫渐变主题

## Context

参考 Enter.pro 模板的视觉特征：
- 极深黑背景（接近纯黑，带轻微蓝调）
- 右侧装饰球：橙色/珊瑚色（底部）→ 薰衣草紫（顶部）渐变
- 白色文字在深色表面上
- 卡片：深灰背景，轻微边框

当前项目使用"奶油黄"浅色主题。需要迁移到深色暗主题，保留所有语义 token 名称不变（组件代码无需改动）。

## 新配色参数

### 主色板
| Token         | 新值（HSL）         | 视觉效果          |
|---------------|--------------------|--------------------|
| background    | `222 20% 7%`       | 深蓝黑 #0c0e17    |
| foreground    | `220 12% 90%`      | 柔和白             |
| card          | `222 16% 11%`      | 略亮深卡片背景     |
| primary       | `20 88% 58%`       | 橙珊瑚 #f0723e    |
| accent        | `268 48% 68%`      | 薰衣草紫 #a07fd8  |
| secondary     | `265 18% 18%`      | 深紫面            |
| muted         | `220 14% 14%`      | 静默面             |
| border        | `220 10% 18%`      | 深边框             |
| destructive   | `0 72% 52%`        | 标准红色           |

### 自定义 token（保留名称、更新值）
- `--neon-amber` → 改为主橙色 `20 88% 58%`（与 primary 一致）
- `--neon-amber-dim` → 柔和橙 `20 60% 48%`
- `--neon-surface` → 深卡片面 `222 16% 11%`
- `--neon-surface-hover` → 略亮 `222 16% 14%`
- `--shadow-glow` → 橙色发光
- `--shadow-glow-strong` → 橙色强发光
- `--shadow-card` → 深色投影
- `--gradient-terminal` → 深色渐变
- `--gradient-card` → 卡片深渐变
- `--gradient-hero` → 橙/紫 hero 渐变

### body 背景纹理
用两个径向渐变替换当前的斜格纹，模拟参考模板的橙紫光球效果：
```css
background-image:
  radial-gradient(ellipse at 85% 95%, hsl(20 88% 58% / 0.10) 0%, transparent 45%),
  radial-gradient(ellipse at 15% 5%,  hsl(268 48% 68% / 0.07) 0%, transparent 40%);
```

## Files to Modify

### `src/index.css`
完整替换 `:root {}` 块的所有 CSS 变量值（不改变变量名）。
更新 body 背景纹理为径向渐变。
更新 keyframe 动画颜色（`pulse-glow`, `pulse-text-glow`）使用新 primary 颜色。

### `tailwind.config.ts`
更新 `pulse-glow` keyframe 中硬编码的 `hsl(36 92% 40% / ...)` 为新 primary 颜色 `hsl(20 88% 58% / ...)`。

## Verification

1. 主页背景应为深蓝黑色，底部右角有淡橙色光晕，左上角有淡紫色光晕
2. 按钮（执行/确认）应为橙色背景 
3. 标题 EVODAO 文字应有橙色发光效果
4. 卡片/面板背景为深色，轻微发亮
5. 边框为微弱深色线条
