# 修复模型下拉无法选中（Portal 方案）

## 根因

`Index.tsx` 的 `<main className="flex-1 overflow-y-auto">` 创建了滚动容器。
CSS 规范：绝对定位子元素超出滚动容器边界后：
- ✅ 视觉上仍然渲染（所以下拉项看得见）
- ❌ 指针事件被裁剪（所以点不了）

ModelSelector 下拉用的是 `position: absolute`，从触发按钮向下展开，共10项（~440px）。
触发按钮距 main 顶约 50px，前5项（AUTO + 4个模型）在容器内 → 可点。
第6项起（Gemini 3.1 Pro 往下）超出 main 边界 → 不可点。

## 修复方案

在 `ModelSelector.tsx` 中用 `ReactDOM.createPortal` 把下拉菜单渲染到 `document.body`，
使用 `position: fixed` + `getBoundingClientRect()` 计算精确位置，彻底绕开 overflow 裁剪。

---

## 改动：`src/components/agent/ModelSelector.tsx`（唯一改动文件）

### 新增 imports
```typescript
import { createPortal } from "react-dom";
```

### 新增 refs 和 state
```typescript
const triggerRef = useRef<HTMLButtonElement>(null);
const portalRef = useRef<HTMLDivElement>(null);
const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);
```

### 修改外部点击 handler
同时检查 `dropdownRef`（包裹 div）和 `portalRef`（portal 内容）：
```typescript
useEffect(() => {
  const handler = (e: MouseEvent) => {
    const target = e.target as Node;
    const insideTrigger = dropdownRef.current?.contains(target);
    const insidePortal = portalRef.current?.contains(target);
    if (!insideTrigger && !insidePortal) setOpen(false);
  };
  document.addEventListener("mousedown", handler);
  return () => document.removeEventListener("mousedown", handler);
}, []);
```

### open 时计算位置（useEffect 监听 open）
```typescript
useEffect(() => {
  if (open && triggerRef.current) {
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + 6,               // mt-1.5 = 6px
      right: window.innerWidth - rect.right,
    });
  }
}, [open]);
```

### 给触发按钮加 triggerRef
```tsx
<button ref={triggerRef} onClick={...} ...>
```

### 下拉菜单改为 portal 渲染（position: fixed）
```tsx
{open && dropdownPos && createPortal(
  <div
    ref={portalRef}
    style={{ position: "fixed", top: dropdownPos.top, right: dropdownPos.right }}
    className="z-[200] w-[220px] rounded border border-border bg-card shadow-xl shadow-black/50 overflow-y-auto max-h-[70vh] animate-fade-in"
  >
    {/* AUTO + model list 内容不变 */}
  </div>,
  document.body
)}
```

注意：
- z-index 从 `z-50` 提升为 `z-[200]`，确保在所有 Modal/Header 之上
- 添加 `overflow-y-auto max-h-[70vh]` 防止在小屏幕上再次溢出
- 去掉原来 wrapper div 上的 `overflow-hidden`（改为 portal div 上加 `overflow-y-auto`）

---

## 验证

1. 打开模型下拉 → 点击 Gemini 3.1 Pro / Kimi K2.6 / GLM 5.1 / MiniMax M2.7 / Qwen 3.6 Plus → 全部可选中
2. 点击下拉外部 → 正常关闭
3. 窗口滚动时下拉位置跟随（fixed 定位保证不偏移）
4. 移动端/小屏：下拉不超出视口高度（max-h-[70vh]）
