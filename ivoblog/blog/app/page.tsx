import fs from "fs";
import path from "path";
import matter from "gray-matter";
import Link from "next/link";
import { cache, Suspense } from "react";

import Navbar from "../components/Navbar";
import PageTransition from "../components/PageTransition";
import SearchBar from "../components/SearchBar";
import { siteConfig } from "../siteConfig";

export const dynamic = 'force-dynamic';
import CloudPlayer from "../components/CloudPlayer";
import ThemeToggleBlock from "../components/ThemeToggleBlock";
import ProfileCard from "../components/ProfileCard";
import SiteDashboard from "../components/SiteDashboard";
import { albums } from "../data/albums";
import LyricBar from "../components/LyricBar";
import { ToastProvider } from "../components/ToastProvider";
import LatestPostsCarousel from "../components/LatestPostsCarousel";
import LatestChatterCarousel from "../components/LatestChatterCarousel";
import HomeFocusDock from "../components/HomeFocusDock";
import SafeImage from "../components/SafeImage";
import { Search } from "lucide-react";

const DEFAULT_HOME_DOCK_CONFIG = {
  enabled: true,
  defaultModule: "profile",
  left: ["profile", "posts", "theme"],
  right: ["music", "photos", "chatters", "dashboard"],
  showCenterIcon: true,
  switchOnHover: true,
};

type HomePost = {
  slug: string;
  title: string;
  description: string;
  content?: string;
  cover?: string;
  date: string;
  formattedDate: string;
  tags?: string[];
  [key: string]: unknown;
};

type HomeChatter = {
  slug: string;
  title: string;
  description: string;
  cover: string;
  date: string;
  formattedDate: string;
};

function localImageOrFallback(value: unknown, fallback = siteConfig.defaultPostCover) {
  const src = typeof value === "string" ? value.trim() : "";
  if (!src || src.startsWith("//") || /^[a-z][a-z0-9+.-]*:\/\//i.test(src)) return fallback;
  return src.startsWith("/") ? src : fallback;
}

function HomeCardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`uupm-card h-full w-full rounded-3xl p-6 ${className}`} aria-hidden="true">
      <div className="space-y-4">
        <div className="h-4 w-2/3 animate-pulse rounded-full bg-slate-200/80 dark:bg-slate-700/80" />
        <div className="h-3 w-full animate-pulse rounded-full bg-slate-100/80 dark:bg-slate-800/80" />
        <div className="h-3 w-4/5 animate-pulse rounded-full bg-slate-100/80 dark:bg-slate-800/80" />
      </div>
      <div className="mt-8 h-28 animate-pulse rounded-2xl bg-slate-100/70 dark:bg-slate-800/70" />
    </div>
  );
}

function formatUpdateTime(dateString: string) {
  if (!dateString || dateString === "1970-01-01") return "Just updated";

  try {
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return dateString;

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");

    if (hours === "00" && mins === "00") return `${year}.${month}.${day}`;
    return `${year}.${month}.${day} ${hours}:${mins}`;
  } catch {
    return dateString;
  }
}

const getHomePosts = cache(() => {
  const postsDirectory = path.join(/*turbopackIgnore: true*/ process.cwd(), "posts");
  let allPosts: HomePost[] = [];

  try {
    if (fs.existsSync(postsDirectory)) {
      const fileNames = fs.readdirSync(postsDirectory).filter((file) => file.endsWith(".md"));

      allPosts = fileNames
        .map((fileName) => {
          const fullPath = path.join(postsDirectory, fileName);
          const { data, content } = matter(fs.readFileSync(fullPath, "utf8"));
          const rawDate = String(data.date || "1970-01-01");
          const cover = localImageOrFallback(data.cover);

          return {
            slug: fileName.replace(/\.md$/, ""),
            ...data,
            title: String(data.title || ""),
            description: String(data.description || ""),
            content: content || "",
            cover,
            date: rawDate,
            formattedDate: formatUpdateTime(rawDate),
          } as HomePost;
        })
        .sort((a, b) => {
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          if (dateB !== dateA) return dateB - dateA;
          return b.slug.localeCompare(a.slug);
        });
    }
  } catch (error) {
    console.error("Failed to read posts directory:", error);
  }

  return allPosts;
});

const getHomeChatters = cache(() => {
  const chattersDirectory = path.join(/*turbopackIgnore: true*/ process.cwd(), "chatters");
  let allChatters: HomeChatter[] = [];

  try {
    if (fs.existsSync(chattersDirectory)) {
      const chatterFiles = fs.readdirSync(chattersDirectory).filter((file) => file.endsWith(".md"));

      allChatters = chatterFiles
        .map((fileName) => {
          const fullPath = path.join(chattersDirectory, fileName);
          const { data, content } = matter(fs.readFileSync(fullPath, "utf8"));
          const rawDate = String(data.date || "1970-01-01");
          const cover = localImageOrFallback(data.cover);

          return {
            slug: fileName.replace(/\.md$/, ""),
            title: String(data.title || "New note"),
            description: String(data.description || content.substring(0, 60)),
            cover,
            date: rawDate,
            formattedDate: formatUpdateTime(rawDate),
          };
        })
        .sort((a, b) => {
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          if (dateB !== dateA) return dateB - dateA;
          return b.slug.localeCompare(a.slug);
        });
    }
  } catch (error) {
    console.error("Failed to read chatters directory:", error);
  }

  return allChatters;
});

export default function Home() {
  const allPosts = getHomePosts();
  const top5Posts =
    allPosts.length > 0
      ? allPosts.slice(0, 5)
      : [
          {
            slug: "none",
            title: "No posts yet",
            description: "Start writing your first article.",
            cover: siteConfig.defaultPostCover,
            date: "",
            formattedDate: "",
          },
        ];

  const allChatters = getHomeChatters();
  const top5Chatters =
    allChatters.length > 0
      ? allChatters.slice(0, 5)
      : [
          {
            slug: "none",
            title: "No notes yet",
            description: "Record a small thought here.",
            cover: siteConfig.defaultPostCover,
            date: "",
            formattedDate: "",
          },
        ];

  const chatterCount = allChatters.length;
  const realPhotoCount = albums.reduce((total, album) => total + album.photos.length, 0);
  const previewAlbums = albums.slice(0, 3);

  const photoWallCard = (
    <div className="uupm-card uupm-anime-frame h-full min-h-[360px] w-full overflow-hidden rounded-3xl p-5 sm:p-8 lg:p-10">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h3 className="text-4xl font-black leading-none tracking-widest text-slate-950 drop-shadow-sm dark:text-white sm:text-5xl">
            光影画廊
          </h3>
          <p className="mt-3 max-w-xl text-sm font-bold tracking-wider text-slate-600 dark:text-slate-300 sm:text-base">
            定格时间，封存泰拉与现实的每一次心跳
          </p>
        </div>

        <Link
          href="/photowall"
          className="group relative h-12 w-full shrink-0 rounded-full border border-white/60 bg-white/45 shadow-sm backdrop-blur-md transition hover:bg-white/65 dark:border-white/10 dark:bg-slate-900/45 md:w-80"
        >
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500 transition-colors group-hover:text-indigo-500 dark:text-slate-400" />
          <span className="flex h-full items-center truncate pl-12 pr-4 text-sm font-bold text-slate-500 dark:text-slate-300">
            搜索相册或描述...
          </span>
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {previewAlbums.map((album) => (
          <Link key={album.id} href="/photowall" className="group flex min-w-0 flex-col items-center">
            <div className="relative mb-6 aspect-[4/3] w-[85%]">
              <div className="absolute inset-0 rotate-6 translate-x-4 translate-y-2 overflow-hidden rounded-[4px] border-[6px] border-white bg-slate-300 opacity-60 shadow-md transition-all duration-500 group-hover:rotate-12 dark:border-slate-200 dark:bg-slate-700">
                {album.photos[2] && (
                  <SafeImage
                    src={album.photos[2].url}
                    fallbackSrc={album.cover || siteConfig.photoWallImage || siteConfig.defaultPostCover}
                    alt=""
                    className="h-full w-full object-cover grayscale blur-[2px]"
                  />
                )}
              </div>
              <div className="absolute inset-0 z-10 -rotate-3 -translate-x-2 -translate-y-1 overflow-hidden rounded-[4px] border-[6px] border-white bg-slate-200 opacity-80 shadow-lg transition-all duration-500 group-hover:-rotate-6 dark:border-slate-200 dark:bg-slate-600">
                {album.photos[1] && (
                  <SafeImage
                    src={album.photos[1].url}
                    fallbackSrc={album.cover || siteConfig.photoWallImage || siteConfig.defaultPostCover}
                    alt=""
                    className="h-full w-full object-cover grayscale-[50%]"
                  />
                )}
              </div>
              <div className="absolute inset-0 z-20 overflow-hidden rounded-[4px] border-[6px] border-white bg-white shadow-2xl transition-all duration-500 group-hover:-translate-y-2 group-hover:scale-105 dark:border-slate-200 dark:bg-slate-200">
                <SafeImage
                  src={album.cover}
                  fallbackSrc={siteConfig.photoWallImage || siteConfig.defaultPostCover}
                  alt={album.title}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
            </div>

            <div className="w-full max-w-[min(22rem,100%)] px-4 text-center">
              <h4 className="line-clamp-2 text-xl font-bold leading-tight text-slate-950 transition-colors group-hover:text-indigo-600 dark:text-white">
                {album.title}
              </h4>
              <p className="mt-2 line-clamp-1 text-sm text-slate-600 dark:text-slate-400">{album.description}</p>
            </div>
          </Link>
        ))}

        {previewAlbums.length === 0 && (
          <Link
            href="/photowall"
            className="col-span-full flex min-h-[240px] items-center justify-center rounded-[32px] border border-dashed border-slate-300/80 bg-white/20 text-sm font-bold text-slate-500 dark:border-white/10 dark:bg-slate-900/20 dark:text-slate-300"
          >
            暂无相册，前往照片墙查看
          </Link>
        )}
      </div>
    </div>
  );
  const homeDockConfig = { ...DEFAULT_HOME_DOCK_CONFIG, ...(siteConfig.homeDockConfig || {}) };
  const profileCard = <ProfileCard postCount={allPosts.length} chatterCount={chatterCount} photoCount={realPhotoCount} />;
  const musicCard = (
    <Suspense fallback={<HomeCardSkeleton className="min-h-[260px]" />}>
      <CloudPlayer />
    </Suspense>
  );
  const postsCard = <LatestPostsCarousel posts={top5Posts} />;
  const chattersCard = <LatestChatterCarousel chatters={top5Chatters} />;
  const themeCard = <ThemeToggleBlock />;
  const dashboardCard = (
    <Suspense fallback={<HomeCardSkeleton className="min-h-[180px]" />}>
      <SiteDashboard />
    </Suspense>
  );

  return (
    <ToastProvider>
      <div className="uupm-stage min-h-screen relative pb-12 sm:pb-16">
        <Navbar />
        <PageTransition>
          <div className="w-full max-w-6xl 2xl:max-w-7xl mx-auto mt-24 sm:mt-28 px-4 sm:px-6 lg:px-8 2xl:px-12 relative z-10">
            <div className="uupm-enter">
              <SearchBar posts={allPosts} />
            </div>

            <main className="uupm-story-flow flex flex-col gap-6 sm:gap-7 w-full mt-6 sm:mt-7">
              {homeDockConfig.enabled ? (
                <div className="uupm-flow-section">
                  <HomeFocusDock
                    config={homeDockConfig}
                    profile={profileCard}
                    music={musicCard}
                    posts={postsCard}
                    photos={photoWallCard}
                    chatters={chattersCard}
                    theme={themeCard}
                    dashboard={dashboardCard}
                  />
                </div>
              ) : (
                <div className="uupm-enter uupm-enter-delay-1 uupm-flow-section grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-7 w-full">
                  <div className="col-span-1 lg:col-span-7 flex flex-col">{profileCard}</div>
                  <div className="col-span-1 lg:col-span-5 flex flex-col">{musicCard}</div>
                  <div className="col-span-1 lg:col-span-4 flex flex-col min-h-[420px]">{postsCard}</div>
                  <div className="col-span-1 lg:col-span-8 flex flex-col gap-6 sm:gap-7">
                    <div className="min-h-[260px]">{photoWallCard}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-7">
                      <div className="sm:col-span-2 min-h-[240px]">{chattersCard}</div>
                      <div className="sm:col-span-1 min-h-[180px]">{themeCard}</div>
                    </div>
                  </div>
                  <div className="col-span-1 lg:col-span-12">{dashboardCard}</div>
                </div>
              )}

              <div className="uupm-enter uupm-enter-delay-2 uupm-flow-section w-full">
                <LyricBar />
              </div>
            </main>
          </div>
        </PageTransition>
      </div>
    </ToastProvider>
  );
}
