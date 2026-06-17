import 'katex/dist/katex.min.css';
import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "../components/ThemeProvider";
import { MusicProvider } from "../components/MusicProvider";
import { siteConfig } from "../siteConfig";
import BackgroundSlider from "../components/BackgroundSlider";
import SplashScreen from "../components/SplashScreen";
import { PerformanceBackgroundEffects, PerformanceWidgets } from "../components/PerformanceLayer";
import Script from "next/script";

import MobileBackButton from '../components/MobileBackButton';

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

export const metadata: Metadata = {
  title: siteConfig.title,
  description: siteConfig.bio,
  icons: {
    icon: siteConfig.faviconUrl,
    apple: siteConfig.faviconUrl,
  },
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
        <style
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `
              #app-mount-root { opacity: 1; visibility: visible; pointer-events: auto; }
            `
          }}
        />
        <Script id="restore-splash-state" strategy="beforeInteractive">
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

          {effectsConfig.enableSplashScreen && <SplashScreen />}

          <MusicProvider>
            <div id="app-mount-root" className="flex-1 flex flex-col transition-opacity duration-500">
              <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden">
                {!siteConfig.useGradient && effectsConfig.enableBackgroundSlider && <BackgroundSlider />}
                <div className="absolute inset-0 z-[-9] bg-white/20 dark:bg-slate-900/30 transition-colors duration-700"></div>

                <div
                  className="absolute inset-0 z-[-8] opacity-35 dark:opacity-15 transition-opacity duration-700 transform-gpu"
                  style={{
                    background: `linear-gradient(-45deg, ${siteConfig.themeColors.join(', ')})`,
                    backgroundSize: '400% 400%',
                    animation: effectsConfig.enableGradientMotion && effectsConfig.performanceMode !== "performance"
                      ? 'gradientMove 22s ease infinite'
                      : 'none'
                  }}
                ></div>

                <PerformanceBackgroundEffects />
              </div>

              <div className="relative z-10 flex-1 flex flex-col">
                {children}
              </div>

              <div className="md:hidden block">
                <MobileBackButton />
              </div>

              <PerformanceWidgets />
            </div>

            <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `
              @keyframes gradientMove { 
                0% { background-position: 0% 50%; } 
                50% { background-position: 100% 50%; } 
                100% { background-position: 0% 50%; } 
              }
            `}} />
          </MusicProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
