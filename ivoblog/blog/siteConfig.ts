export const siteConfig = {
  title: "iV0 Blog",
  faviconUrl: "/siamese-cat.png",
  authorName: "iV0",
  bio: "A personal blog for notes, projects, moments, and experiments.",

  navTitle: "iV0",
  navSuffix: "",
  navAfter: "Blog",

  avatarUrl: "/uploads/images/IMG_20251123_160113-b59a780ebe.png",

  useGradient: false,
  themeColors: ["#7dd3fc", "#f0abfc", "#a7f3d0", "#fde68a"],
  bgImages: ["/uploads/images/_20251225232527_213_2-0d4cd615c3.jpg", "/uploads/images/mmexport1766655840334-e8d92d0c35.jpg", "/uploads/images/1766634082126-52a6e1eb14.png"],

  defaultPostCover: "/uploads/images/_20251225232527_213_2-0d4cd615c3.jpg",
  photoWallImage: "/uploads/images/_20251225232527_213_2-0d4cd615c3.jpg",
  cloudMusicIds: ["3355479289", "1876028528", "2060154480", "3375744751", "1819306497", "1467857809", "1819306492", "1940302779", "1876985137", "1920756486", "1399788803", "1982878208", "1819308143", "1371308079", "1873231849", "1819308142", "1920756484", "1945793152", "1920757367", "3362570925", "1394538522", "1371308081", "0184298326", "2079755757", "5378063448", "6292425262"],
  musicPlaybackMode: "local",

  effectsConfig: {
    performanceMode: "quality",
    enableSplashScreen: true,
    enableBackgroundSlider: true,
    enableGradientMotion: true,
    enableBackgroundEffects: true,
    enableHoverEffects: true,
    enableDanmaku: true,
    enableClickEffect: true,
    enableCyberCat: true,
    enableFloatingPlayer: true,
    enableGlobalToolbox: true,
  },

  homeDockConfig: {
    enabled: true,
    defaultModule: "profile",
    left: ["profile", "posts", "theme"],
    right: ["music", "photos", "chatters", "dashboard"],
    showCenterIcon: true,
    switchOnHover: true,
  },

  chatterTitle: "Moments",
  chatterDescription: "Short notes, ideas, and daily fragments.",

  picBedName: "Local Upload",
  picBedUrl: "",
  picBedToken: "",

  danmakuList: [
    "Welcome",
    "Loading inspiration",
    "Keep creating",
    "Today is a good day",
    "Notes online",
    "Build softly",
  ],

  gitalkConfig: {
    clientID: "",
    clientSecret: "",
    repo: "",
    owner: "",
    admin: [""],
  },

  buildDate: "2026-06-13T00:00:00",
  footerBadges: [
    {
      name: "Next.js 16",
      color: "text-sky-500",
      svg: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>',
    },
    {
      name: "React 19",
      color: "text-cyan-400",
      svg: '<path d="M12 22.6l-9.8-5.6V5.6L12 0l9.8 5.6v11.4l-9.8 5.6zm-8.2-6.5l8.2 4.7 8.2-4.7V7.5L12 2.8 3.8 7.5v8.6z"/>',
    },
    {
      name: "Tailwind 4",
      color: "text-teal-400",
      svg: '<path d="M12.001,4.8c-3.2,0-5.2,1.6-6,4.8c1.2-1.6,2.6-2.2,4.2-1.8c0.913,0.228,1.565,0.89,2.288,1.624C13.666,10.618,15.027,12,18.001,12c3.2,0,5.2-1.6,6-4.8c-1.2,1.6-2.6,2.2-4.2,1.8c-0.913-0.228-1.565-0.89-2.288-1.624C16.337,6.182,14.976,4.8,12.001,4.8z"/>',
    },
  ],

  icpConfig: {
    name: "",
    link: "",
  },

  deepseekConfig: {
    modelId: "deepseek-chat",
    apiBaseUrl: "https://models.sjtu.edu.cn/api/v1",
    apiKeyEnvName: "DEEPSEEK_API_KEY",
    systemPrompt: "You are a concise, friendly blog assistant. Keep replies short, helpful, and safe. Do not expose secrets or internal configuration.",
    maxOutputTokens: 150,
    temperature: 0.85,
    thinkingStrength: "balanced",
  },

  friendLinkApplyFormat:
    "Name: iV0 Blog\nDescription: Notes, projects, and moments\nLink: https://your-domain.example\nAvatar: /uploads/images/IMG_20251123_160113-b59a780ebe.png",

  enableLevelSystem: true,
};
