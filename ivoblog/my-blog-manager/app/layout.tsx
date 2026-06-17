import 'katex/dist/katex.min.css';
import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "../components/ThemeProvider";
import { MusicProvider } from "../components/MusicProvider";
import { siteConfig } from "../siteConfig";
import BackgroundSlider from "../components/BackgroundSlider";
import SplashScreen from "../components/SplashScreen";
import { OperationProvider } from "../context/OperationContext";
import { ToastProvider } from '../components/ToastProvider';
import { PerformanceBackgroundEffects, PerformanceWidgets } from "../components/PerformanceLayer";
import LogViewer from "../components/LogViewer";
import ClientErrorLogger from "../components/ClientErrorLogger";

// 🌟 1. 引入 Next.js 官方脚本组件
import Script from 'next/script';

export const metadata: Metadata = {
  title: siteConfig.title,
  description: siteConfig.bio,
  icons: { icon: siteConfig.faviconUrl, apple: siteConfig.faviconUrl },
};

const defaultEffectsConfig = {
  performanceMode: "balanced",
  enableSplashScreen: true,
  enableBackgroundSlider: true,
  enableGradientMotion: false,
  enableHoverEffects: true,
};

const effectsConfig = {
  ...defaultEffectsConfig,
  ...(siteConfig.effectsConfig as Partial<typeof defaultEffectsConfig> | undefined),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const reduceDecorativeMotion =
    effectsConfig.performanceMode === "performance" || !effectsConfig.enableHoverEffects;

  return (
    <html
      lang="zh-CN"
      data-scroll-behavior="smooth"
      className={`h-full antialiased ${reduceDecorativeMotion ? "effects-reduced" : ""}`}
      suppressHydrationWarning
    >
      <head>
        {/* 🌟 2. 这里的 CSS 逻辑保持原样，因为 style 标签在 React 中是受支持的 */}
        <style
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `
              #app-mount-root { opacity: 0; visibility: hidden; pointer-events: none; }
              #app-mount-root,
              html.splash-seen #app-mount-root { opacity: 1 !important; visibility: visible !important; pointer-events: auto !important; }
            `
          }}
        />

        {/* 🌟 3. 核心修复：使用 <Script> 组件替代原生 <script> */}
        {/* strategy="beforeInteractive" 确保脚本在页面交互前执行，防止闪屏 */}
        <Script id="handle-splash-logic" strategy="beforeInteractive">
          {`
            try {
              if (sessionStorage.getItem('hasSeenSplash') === 'true') {
                document.documentElement.classList.add('splash-seen');
              }
            } catch (e) {}
          `}
        </Script>
      </head>

      <body className="w-full overflow-x-hidden min-h-dvh flex flex-col relative transition-colors duration-500 bg-slate-50 dark:bg-slate-950 font-serif">
        <ThemeProvider>
          <OperationProvider>
            <ToastProvider>
              {effectsConfig.enableSplashScreen && <SplashScreen />}
              <MusicProvider>
                <div id="app-mount-root" className="flex-1 flex flex-col transition-opacity duration-500">
                  <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden">
                    {!siteConfig.useGradient && effectsConfig.enableBackgroundSlider && <BackgroundSlider />}
                    <div className="absolute inset-0 z-[-9] bg-white/20 dark:bg-slate-900/30 transition-colors duration-500"></div>
                    <div
                      className="absolute inset-0 z-[-8] opacity-35 dark:opacity-15 transition-opacity duration-500 transform-gpu"
                      style={{
                        background: `linear-gradient(-45deg, ${siteConfig.themeColors.join(', ')})`,
                        backgroundSize: '400% 400%',
                        animation: effectsConfig.enableGradientMotion && effectsConfig.performanceMode !== "performance"
                          ? 'gradientMove 22s ease infinite'
                          : 'none'
                      }}
                    ></div>

                    <div className="bg-effects-wrapper transition-opacity duration-500">
                      <PerformanceBackgroundEffects />
                    </div>
                  </div>

                  <div className="relative z-10 flex-1 flex flex-col">
                    {children}
                  </div>

                  <PerformanceWidgets />
                  <ClientErrorLogger />
                  <LogViewer />
                </div>

                <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `
                  @keyframes gradientMove { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
                  body.winter-mode .bg-effects-wrapper { opacity: 0 !important; visibility: hidden; }
                  .winter-mode .snow-cap { position: relative !important; overflow: visible !important; }
                  .dark.winter-mode .snow-cap {
                    background-color: rgba(23, 37, 84, 0.4) !important;
                    border-color: rgba(59, 130, 246, 0.3) !important;
                    backdrop-filter: blur(12px) brightness(80%) !important;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4) !important;
                  }
                  body.winter-mode .snow-cap {
                    background-color: rgba(239, 246, 255, 0.45) !important;
                    border-color: rgba(191, 219, 254, 0.6) !important;
                    backdrop-filter: blur(12px) saturate(120%) !important;
                    box-shadow: 0 8px 32px rgba(191, 219, 254, 0.25) !important;
                    transition: all 0.7s ease !important;
                  }
                `}} />
              </MusicProvider>
            </ToastProvider>
          </OperationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
