"use client";

import { useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import {
  AlertTriangle,
  CloudUpload,
  Edit3,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import BackButton from "../../components/BackButton";
import Comments from "../../components/Comments";
import FloatingImageTool from "../../components/editor/FloatingImageTool";
import { useToast } from "../../components/ToastProvider";
import { useOperations } from "../../context/OperationContext";
import { friendsData as initialFriends, type Friend } from "../../data/friends";
import { normalizeLocalAssetPath, sanitizeLocalAssetInput } from "../../lib/localMedia";
import { siteConfig } from "../../siteConfig";

const DEFAULT_FRIEND_AVATAR = "/uploads/images/IMG_20251123_160113-b59a780ebe.png";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 30, scale: 0.9 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 300, damping: 24 },
  },
};

function normalizeFriend(friend: Friend): Friend {
  return {
    ...friend,
    avatar: normalizeLocalAssetPath(friend.avatar, DEFAULT_FRIEND_AVATAR),
  };
}

export default function FriendsBoard() {
  const { addOperation } = useOperations();
  const { showToast } = useToast();

  const [editableFriends, setEditableFriends] = useState<Friend[]>(() => initialFriends.map(normalizeFriend));
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string | null; name: string | null }>({
    isOpen: false,
    id: null,
    name: null,
  });
  const [friendModal, setFriendModal] = useState<{
    isOpen: boolean;
    mode: "add" | "edit";
    data: Partial<Friend>;
  }>({ isOpen: false, mode: "add", data: {} });
  const [isImgToolOpen, setIsImgToolOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const applyFormat = siteConfig.friendLinkApplyFormat;

  const handleCopy = () => {
    navigator.clipboard.writeText(applyFormat);
    setIsCopied(true);
    window.setTimeout(() => setIsCopied(false), 2000);
  };

  const syncToQueue = (nextList: Friend[]) => {
    addOperation({
      id: `sync_friends_${Date.now()}`,
      type: "sync_friends",
      label: "同步友链数据变更",
      value: nextList,
    });
    showToast("📍 变更已加入待处理队列，请在 Navbar 点击更新本地", "info");
  };

  const handleSaveFriend = () => {
    const { mode, data } = friendModal;
    if (!data.name || !data.url) {
      showToast("名称和 URL 不能为空哦", "warning");
      return;
    }

    let next: Friend[];
    if (mode === "add") {
      const newFriend = normalizeFriend({
        id: `friend_${Date.now()}`,
        name: data.name,
        url: data.url,
        avatar: data.avatar || DEFAULT_FRIEND_AVATAR,
        description: data.description || "这位朋友很神秘，什么都没写。",
        themeColor: data.themeColor || "#6366f1",
      } as Friend);
      next = [newFriend, ...editableFriends];
    } else {
      next = editableFriends.map((friend) =>
        friend.id === data.id ? normalizeFriend({ ...friend, ...data } as Friend) : friend,
      );
    }

    setEditableFriends(next);
    syncToQueue(next);
    setFriendModal({ isOpen: false, mode: "add", data: {} });
  };

  const confirmDelete = () => {
    const next = editableFriends.filter((friend) => friend.id !== deleteModal.id);
    setEditableFriends(next);
    syncToQueue(next);
    setDeleteModal({ isOpen: false, id: null, name: null });
  };

  return (
    <div className="relative z-10 mx-auto w-full max-w-5xl px-4 py-10 sm:px-10">
      <FloatingImageTool
        key={isImgToolOpen ? "tool-open" : "tool-closed"}
        isOpen={isImgToolOpen}
        onClose={() => setIsImgToolOpen(false)}
        onInsert={(url) => {
          setFriendModal((prev) => ({
            ...prev,
            data: { ...prev.data, avatar: normalizeLocalAssetPath(url, DEFAULT_FRIEND_AVATAR) },
          }));
          setIsImgToolOpen(false);
        }}
      />

      <AnimatePresence>
        {deleteModal.isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm rounded-[40px] border border-white/50 bg-white/80 p-10 text-center shadow-2xl dark:bg-slate-900/80"
            >
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-red-500/10">
                <AlertTriangle className="text-red-500" />
              </div>
              <h3 className="mb-2 text-xl font-black text-slate-900 dark:text-white">切断引力？</h3>
              <p className="mb-8 text-sm text-slate-500">
                确认从列表中移除 <span className="font-bold text-red-500">"{deleteModal.name}"</span> 吗？
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })}
                  className="flex-1 rounded-2xl bg-slate-100 py-4 text-xs font-black text-slate-600 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                >
                  取消
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 rounded-2xl bg-red-500 py-4 text-xs font-black text-white shadow-lg transition-colors hover:bg-red-600"
                >
                  确认移除
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {friendModal.isOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="relative w-full max-w-md overflow-hidden rounded-[40px] border border-white/20 bg-white/90 p-8 shadow-2xl dark:bg-slate-900/90"
            >
              <h2 className="mb-6 flex items-center gap-2 text-2xl font-black dark:text-white">
                <Sparkles className="text-indigo-500" />
                {friendModal.mode === "add" ? "建立新连接" : "修改朋友信息"}
              </h2>

              <div className="space-y-4">
                <input
                  type="text"
                  value={friendModal.data.name || ""}
                  onChange={(e) => setFriendModal({ ...friendModal, data: { ...friendModal.data, name: e.target.value } })}
                  className="w-full rounded-2xl border-none bg-slate-100 px-5 py-3 outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-black/20 dark:text-white"
                  placeholder="朋友的名字"
                />
                <input
                  type="text"
                  value={friendModal.data.url || ""}
                  onChange={(e) => setFriendModal({ ...friendModal, data: { ...friendModal.data, url: e.target.value } })}
                  className="w-full rounded-2xl border-none bg-slate-100 px-5 py-3 outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-black/20 dark:text-white"
                  placeholder="博客网址 (https://...)"
                />

                <div className="relative group">
                  <input
                    type="text"
                    value={friendModal.data.avatar || ""}
                    onChange={(e) =>
                      setFriendModal({
                        ...friendModal,
                        data: { ...friendModal.data, avatar: sanitizeLocalAssetInput(e.target.value) },
                      })
                    }
                    className="w-full rounded-2xl border-none bg-slate-100 px-5 py-3 pr-14 outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-black/20 dark:text-white"
                    placeholder="本地头像路径 /uploads/..."
                  />
                  <button
                    onClick={() => setIsImgToolOpen(true)}
                    className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl bg-indigo-500 text-white shadow-md transition-colors hover:bg-indigo-600"
                  >
                    <CloudUpload size={18} />
                  </button>
                </div>

                <textarea
                  value={friendModal.data.description || ""}
                  onChange={(e) =>
                    setFriendModal({ ...friendModal, data: { ...friendModal.data, description: e.target.value } })
                  }
                  className="h-20 w-full resize-none rounded-2xl border-none bg-slate-100 px-5 py-3 outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-black/20 dark:text-white"
                  placeholder="简单描述一下..."
                />

                <div className="flex items-center gap-4 px-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">主题色：</label>
                  <input
                    type="color"
                    value={friendModal.data.themeColor || "#6366f1"}
                    onChange={(e) =>
                      setFriendModal({ ...friendModal, data: { ...friendModal.data, themeColor: e.target.value } })
                    }
                    className="h-10 w-10 cursor-pointer overflow-hidden rounded-lg border-none"
                  />
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  onClick={() => setFriendModal({ ...friendModal, isOpen: false })}
                  className="flex-1 py-3 font-bold text-slate-500 transition-colors hover:text-slate-800 dark:hover:text-white"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveFriend}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-indigo-500 py-4 font-black text-white shadow-lg shadow-indigo-500/30 transition-colors hover:bg-indigo-600"
                >
                  <Save size={18} /> 加入暂存
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="mb-12 flex flex-col items-center md:items-start">
        <div className="mb-6 flex w-full justify-start">
          <BackButton />
        </div>
        <div className="w-full text-center md:text-left">
          <h1 className="mb-4 text-4xl font-black uppercase tracking-widest text-slate-900 drop-shadow-sm dark:text-white">
            云端引力
          </h1>
          <p className="font-serif text-slate-600 dark:text-slate-400">
            那些散落在赛博宇宙各处的有趣灵魂与神经节点。
          </p>
        </div>
      </div>

      <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <motion.div
          variants={itemVariants}
          onClick={() => setFriendModal({ isOpen: true, mode: "add", data: {} })}
          className="group flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-3xl border-4 border-dashed border-slate-300 bg-white/10 transition-all duration-500 hover:border-indigo-500 hover:bg-indigo-500/5 dark:border-slate-700"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-slate-400 shadow-md transition-all group-hover:rotate-90 group-hover:bg-indigo-500 group-hover:text-white dark:bg-slate-800">
            <Plus size={32} />
          </div>
          <span className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 group-hover:text-indigo-500">
            添加新朋友
          </span>
        </motion.div>

        {editableFriends.map((friend) => (
          <motion.div key={friend.id} variants={itemVariants} className="group relative">
            <div className="absolute right-4 top-4 z-30 flex -translate-y-2 gap-2 opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
              <button
                onClick={() => setFriendModal({ isOpen: true, mode: "edit", data: friend })}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 text-white shadow-lg transition-transform hover:scale-110"
              >
                <Edit3 size={14} />
              </button>
              <button
                onClick={() => setDeleteModal({ isOpen: true, id: friend.id, name: friend.name })}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500 text-white shadow-lg transition-transform hover:scale-110"
              >
                <Trash2 size={14} />
              </button>
            </div>

            <a
              href={friend.url}
              target="_blank"
              rel="noopener noreferrer"
              className="relative block h-full overflow-hidden rounded-3xl border border-white/40 bg-white/60 p-6 shadow-xl transition-all duration-500 hover:-translate-y-2 hover:scale-[1.02] dark:border-white/10 dark:bg-slate-800/50"
            >
              <div
                className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full opacity-0 blur-2xl transition-opacity duration-700 group-hover:opacity-100"
                style={{ backgroundColor: friend.themeColor }}
              />

              <div className="relative z-10 mb-4 flex items-center gap-5">
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-500/50 to-purple-500/50 p-1 shadow-md transition-transform duration-1000 ease-in-out group-hover:rotate-[360deg]">
                  <img src={friend.avatar} alt={friend.name} className="h-full w-full rounded-full bg-white object-cover" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <h2 className="truncate text-xl font-bold text-slate-900 transition-colors group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
                    {friend.name}
                  </h2>
                  <div className="mt-1 flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-indigo-500/70 dark:text-indigo-400/70">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
                    Online
                  </div>
                </div>
              </div>
              <p className="relative z-10 line-clamp-3 font-serif text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {friend.description}
              </p>
            </a>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="relative mx-auto mt-14 max-w-3xl rounded-2xl border border-white/50 bg-white/40 p-5 text-center shadow-lg backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-800/40 md:mt-20 md:rounded-3xl md:p-8 md:shadow-xl"
      >
        <h2 className="mb-2 text-lg font-black tracking-wider text-slate-900 dark:text-white md:mb-4 md:text-2xl">
          ✨ 建立神经连接
        </h2>
        <p className="mb-4 font-serif text-xs text-slate-600 dark:text-slate-400 md:mb-6 md:text-base">
          欢迎各位大佬交换友链！请一键复制下方格式，并在底部的 Gitalk 留言板申请：
        </p>

        <div className="group relative inline-block w-full max-w-md overflow-hidden rounded-xl border border-slate-200/50 bg-slate-100/60 p-4 text-left dark:border-slate-700/50 dark:bg-slate-900/60 md:rounded-2xl md:p-5">
          <pre className="pr-8 font-mono text-[10px] whitespace-pre-wrap break-all text-slate-700 dark:text-slate-300 md:pr-10 md:text-sm">
            {applyFormat}
          </pre>

          <button
            onClick={handleCopy}
            className="absolute right-2 top-2 rounded-lg bg-white/80 p-1.5 shadow-sm backdrop-blur-sm transition-all duration-300 hover:bg-indigo-500 hover:text-white dark:bg-slate-800/80 dark:hover:bg-indigo-500 md:right-3 md:top-3 md:p-2"
            title="一键复制"
          >
            {isCopied ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5 text-green-500 md:h-4 md:w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-3.5 w-3.5 text-slate-500 hover:text-white md:h-4 md:w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
              </svg>
            )}
          </button>
        </div>

        <div className="mt-6 md:mt-8">
          <a
            href="#gitalk-container"
            className="inline-block rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 px-6 py-2.5 text-sm font-bold tracking-widest text-white shadow-lg shadow-indigo-500/30 transition-all duration-300 hover:scale-105 hover:from-indigo-600 hover:to-purple-600 active:scale-95 md:px-8 md:py-3 md:text-base"
          >
            Go to comments
          </a>
        </div>
      </motion.div>

      <motion.div
        id="gitalk-container"
        className="mt-12 scroll-mt-24 px-2 md:mt-16 md:px-0"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
      >
        <div className="mb-4 flex items-center justify-center gap-2 md:mb-6 md:gap-3">
          <span className="h-[1px] w-8 bg-slate-300 dark:bg-slate-700 md:w-12" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-800 dark:text-gray-200 md:text-xl">
            Comments
          </h3>
          <span className="h-[1px] w-8 bg-slate-300 dark:bg-slate-700 md:w-12" />
        </div>

        <Comments />
      </motion.div>
    </div>
  );
}
