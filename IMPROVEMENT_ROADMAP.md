# iV0 Blog 视觉与动效升级清单

> 设计系统：Motion-Driven + Spatial UI · 技能数据库交叉验证
> 最后更新：2026-06-14

---

## 设计系统基准

| 维度 | 当前值 | 目标值 | 技能出处 |
|------|--------|--------|----------|
| 风格 | uupm-* 日式アニメ | Motion-Driven + Glassmorphism | styles.csv #1 |
| 字体 | 思源宋体 | Archivo (标题) + Space Grotesk (正文) | design-system typography |
| 强调色 | `#2563EB` blue | `#2563EB` blue（与推荐一致） | design-system colors |
| 卡片质感 | uupm-card 毛玻璃 | Spatial UI 深度玻璃 + 海拔阴影 | styles: Spatial UI |
| 背景动效 | gradientMove 条纹 | Ambient Light Blobs 有机光斑 | styles: Cinematic Dark |
| 动效曲线 | `cubic-bezier` | Expo.out `(0.16,1,0.3,1)` + Spring | SKILL.md §7 |

---

## 一、动效体系升级

### 1.1 全局缓动 → Expo.out

```css
/* globals.css — 所有 transition 统一缓动 */
:root {
  --ease-expo-out: cubic-bezier(0.16, 1, 0.3, 1);    /* iOS 原生缓动 */
  --ease-spring-sm: cubic-bezier(0.22, 1, 0.36, 1);   /* 微弹性 */
}

/* 全局应用 */
.uupm-lift { transition: transform 300ms var(--ease-spring-sm); }
.uupm-sheen::after { transition: transform 480ms var(--ease-expo-out); }
```
> 技能出处：styles: Cinematic Dark `Expo.out Bezier(0.16,1,0.3,1)`

### 1.2 Spring Physics 弹簧动画表

```tsx
// Framer Motion 组件根据场景选择参数
const SPRING = {
  instant:  { stiffness: 400, damping: 25, mass: 0.5 },  // 按钮/tap
  smooth:   { stiffness: 200, damping: 25, mass: 0.8 },  // 卡片/Modal
  dramatic: { stiffness: 150, damping: 20, mass: 1.2 },  // Hero/全屏
};
<motion.div transition={{ type: "spring", ...SPRING.smooth }} />
```
> 技能出处：SKILL.md §7 `spring-physics`

### 1.3 Ambient Light Blobs 背景

```tsx
// 替换现有 gradientMove — 3 个有机漂移光斑
<AmbientGlow
  blobs={[
    { color: "#6366F1", size: 600, opacity: 0.06, speed: 20 },
    { color: "#EC4899", size: 500, opacity: 0.04, speed: 25 },
    { color: "#22D3EE", size: 400, opacity: 0.03, speed: 15 },
  ]}
/>
```
> 技能出处：styles: Cinematic Dark `animated ambient light blobs, slow oscillation`

### 1.4 Magnetic Tilt 3D 卡片

```tsx
// 鼠标位置驱动 rotateX/Y + perspective(800px)
<TiltCard maxAngle={12}>
  <ProfileCard />
</TiltCard>
// 适用：ProfileCard、照片墙封面、音乐播放器封面
```
> 技能出处：styles: Dimensional Layering

### 1.5 Stagger 错落入场

```tsx
// 卡片列表每项延迟 40ms 逐一浮现
const list = { show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0 } };
```
> 技能出处：SKILL.md §7 `stagger-sequence` — "30–50ms per item"

### 1.6 Shared Element 封面飞行

```tsx
// 列表 → 详情页封面图流体过渡
<motion.img layoutId={`cover-${slug}`} />
// 适用：LatestPostsCarousel → /posts/[slug]
```
> 技能出处：SKILL.md §7 `shared-element-transition`

### 1.7 Scale Feedback 触感

```tsx
<motion.button whileTap={{ scale: 0.96 }} whileHover={{ scale: 1.03 }}>
// 纯 CSS: button:active { transform: scale(0.96); }
```
> 技能出处：SKILL.md §7 `scale-feedback` — "0.95–1.05 on press"

### 1.8 Exit Faster Than Enter

```tsx
<motion.div
  animate={{ opacity: 1, scale: 1 }}  exit={{ opacity: 0, scale: 0.95 }}
  transition={{ duration: 0.25, exit: { duration: 0.16 } }}
/>
```
> 技能出处：SKILL.md §7 `exit-faster-than-enter` — "退场 = 入场 × 65%"

---

## 二、UI 质感升级

### 2.1 Spatial Glass 深度玻璃卡片

```css
.uupm-card-premium {
  background: linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.06));
  backdrop-filter: blur(40px) saturate(180%);
  border: 1px solid rgba(255,255,255,0.22);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.3),
    0 8px 32px rgba(0,0,0,0.08);
}
```
> 技能出处：styles: Spatial UI (VisionOS) — `blur(40px) saturate(180%), depth via shadows`

### 2.2 4 级海拔阴影系统

```css
:root {
  --elevation-1: 0 1px 3px  rgba(0,0,0,0.06);
  --elevation-2: 0 4px 6px  rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.04);
  --elevation-3: 0 10px 20px rgba(0,0,0,0.08), 0 3px 6px rgba(0,0,0,0.04);
  --elevation-4: 0 20px 40px rgba(0,0,0,0.10), 0 5px 10px rgba(0,0,0,0.04);
}
```
> 技能出处：styles: Dimensional Layering — "4 levels, z-index stacking"

### 2.3 字体升级 — Archivo + Space Grotesk

```css
/* 技能推荐的设计师级字体组合 */
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;700;900&family=Space+Grotesk:wght@400;500;600&display=swap');

h1,h2,h3,h4 { font-family: 'Archivo', sans-serif; }
body { font-family: 'Space Grotesk', sans-serif; }
/* 保留思源宋体作为中文 fallback */
```
> 技能出处：design-system typography — "minimal, portfolio, designer, creative"

### 2.4 Bento Grid 卡片差异化

```
当前: 统一尺寸 grid-cols-1 lg:grid-cols-12
目标: 1×1 / 2×1 / 2×2 混合 Bento
  ProfileCard: 2×1   CloudPlayer: 2×1
  Posts: 1×1         PhotoWall: 2×2
  Chatters: 1×1      ThemeToggle: 1×1
  Dashboard: 4×1 (全宽)
```
> 技能出处：styles: Bento Grids — "modular, asymmetric, Apple-style"

### 2.5 Cinematic Dark 第二主题

```css
[data-theme="cinematic"] {
  --bg-deep: #020203;   --bg-base: #050506;
  --surface: rgba(255,255,255,0.05);
  --accent: #5E6AD2;    --border: rgba(255,255,255,0.08);
}
```
> 技能出处：styles: Modern Dark (Cinema Mobile)

---

## 三、性能底线

| # | 项目 | 技能出处 |
|---|------|----------|
| 3.1 | `content-visibility: auto` 离屏卡片跳过渲染 | react-performance #26 |
| 3.2 | lucide-react Barrel Import 消除 | react-performance #6 |
| 3.3 | `font-display: swap` 消除 FOIT | react-performance #32 |
| 3.4 | 删除 19 个未使用依赖 | 代码审计 |
| 3.5 | 删除重复文件 (blog↔manager data/*.ts) | 代码审计 |
| 3.6 | `scroll-behavior: smooth` | ux-guidelines #1 |
| 3.7 | 动画时长 620→360ms, 760→480ms, 1000→500ms | SKILL.md §7 `duration-timing` |

---

## 四、音乐播放器

| # | 项目 | 工时 |
|---|------|------|
| 4.1 | `duration` 字段全链路 (✅ 已完成) | — |
| 4.2 | `.music-cache.json` 本地预存 (✅ 已完成) | — |
| 4.3 | 底部固定 Player Bar + 进度条 + 大封面 | 3h |
| 4.4 | 全屏歌词覆盖层 | 2h |
| 4.5 | 音量滑块 | 30min |
| 4.6 | `/music` 页歌单/队列 | 2h |

---

## 执行路线

```
🥇 动效底线 (1h)
  1.1 Expo.out 缓动 → 1.2 Spring Physics → 3.7 时长规范化 → 3.6 smooth-scroll

🥈 质感提升 (2h)
  2.1 Spatial Glass → 2.2 海拔阴影 → 2.4 Bento Grid → 1.7 Scale Feedback

🥉 高级动效 (3h)
  1.3 Ambient Blobs → 1.4 Magnetic Tilt → 1.5 Stagger → 1.6 Shared Element

🏅 深度升级 (4h)
  2.3 字体 → 2.5 Cinematic Dark → 3.2 Barrel → 3.1 content-visibility

🎵 播放器 (7h)
  4.3 Player Bar → 4.4 歌词页 → 4.6 歌单 → 4.5 音量

🧹 清理 (30min)
  3.4 删依赖 → 3.5 清重复文件
```

---

**总计 25 项**：✅ 2 已完成 · ⬜ 23 待开始 · ~17h
