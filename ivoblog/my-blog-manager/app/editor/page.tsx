"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowLeft, LogOut, Save } from "lucide-react";

import Navbar from "../../components/Navbar";
import PageTransition from "../../components/PageTransition";
import FloatingImageTool from "../../components/editor/FloatingImageTool";
import MetaMatrix from "../../components/editor/MetaMatrix";
import RichTextEditor, { RichTextEditorHandle } from "../../components/editor/RichTextEditor";
import { useToast } from "../../components/ToastProvider";
import { useOperations } from "../../context/OperationContext";
import { fetchBackendJson } from "../../lib/backendClient";
import { normalizeLocalAssetPath, sanitizeLocalAssetInput } from "../../lib/localMedia";

type DocType = "post" | "chatter" | "about";

function normalizeDocType(value: string | null): DocType {
  return value === "chatter" || value === "about" ? value : "post";
}

function EditorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();
  const { addOperation } = useOperations();

  const routeDocType = normalizeDocType(searchParams.get("type"));
  const routeDocTypeRef = useRef<DocType>(routeDocType);
  const [docType, setDocType] = useState<DocType>(routeDocType);
  const [currentDocId] = useState(routeDocType === "about" ? "about" : searchParams.get("id") || "new");

  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [cover, setCover] = useState("");
  const [summary, setSummary] = useState("");
  const [mood, setMood] = useState("");
  const [content, setContent] = useState("");
  const [date, setDate] = useState("");

  const [historyPostTags, setHistoryPostTags] = useState<string[]>([]);
  const [historyChatterTags, setHistoryChatterTags] = useState<string[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(true);
  const historyMoods = ["Happy", "Tired", "Calm", "Inspired", "Emo"];

  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [isImgToolOpen, setIsImgToolOpen] = useState(false);
  const [imgToolTarget, setImgToolTarget] = useState<"editor" | "cover">("editor");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [exitModalOpen, setExitModalOpen] = useState(false);

  const editorRef = useRef<RichTextEditorHandle>(null);
  const hasUnsavedChangesRef = useRef(false);
  const loadRequestRef = useRef(0);
  const editVersionRef = useRef(0);

  const setClean = useCallback(() => {
    hasUnsavedChangesRef.current = false;
    setHasUnsavedChanges(false);
  }, []);

  const markUnsavedChanges = useCallback(() => {
    editVersionRef.current += 1;
    hasUnsavedChangesRef.current = true;
    setHasUnsavedChanges(true);
  }, []);

  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  const applyLoadedDraft = useCallback((draft: any) => {
    const loadedType = normalizeDocType(typeof draft?.type === "string" ? draft.type : routeDocTypeRef.current);
    setDocType(loadedType);
    setDate(typeof draft?.date === "string" ? draft.date : "");
    setTitle(loadedType === "about" ? "About me" : typeof draft?.title === "string" ? draft.title : "");
    setTags(Array.isArray(draft?.tags) ? draft.tags.map(String) : []);
    setCover(normalizeLocalAssetPath(draft?.cover || "", ""));
    setSummary(typeof draft?.description === "string" ? draft.description : "");
    setMood(typeof draft?.mood === "string" ? draft.mood : "");
    setContent(typeof draft?.content === "string" ? draft.content : "");
    setClean();
  }, [setClean]);

  const updateTitle = useCallback((value: string) => {
    setTitle(value);
    markUnsavedChanges();
  }, [markUnsavedChanges]);

  const updateTags = useCallback<React.Dispatch<React.SetStateAction<string[]>>>((value) => {
    setTags((previous) => (typeof value === "function" ? value(previous) : value));
    markUnsavedChanges();
  }, [markUnsavedChanges]);

  const updateCover = useCallback((value: string) => {
    setCover(sanitizeLocalAssetInput(value));
    markUnsavedChanges();
  }, [markUnsavedChanges]);

  const updateSummary = useCallback((value: string) => {
    setSummary(value);
    markUnsavedChanges();
  }, [markUnsavedChanges]);

  const updateMood = useCallback((value: string) => {
    setMood(value);
    markUnsavedChanges();
  }, [markUnsavedChanges]);

  useEffect(() => {
    let cancelled = false;

    const fetchTags = async () => {
      setIsLoadingTags(true);
      try {
        const data = await fetchBackendJson<{ success: boolean; postTags?: string[]; chatterTags?: string[] }>(
          "/api/drafts/all_tags",
        );
        if (!cancelled && data?.success) {
          setHistoryPostTags(data.postTags || []);
          setHistoryChatterTags(data.chatterTags || []);
        }
      } catch {
        if (!cancelled) {
          setHistoryPostTags([]);
          setHistoryChatterTags([]);
        }
      } finally {
        if (!cancelled) setIsLoadingTags(false);
      }
    };

    void fetchTags();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (currentDocId === "new") return;

    const requestId = ++loadRequestRef.current;
    const editVersionAtStart = editVersionRef.current;

    const loadDraft = async () => {
      try {
        const data = await fetchBackendJson<{ success: boolean; draft?: any; message?: string }>(
          "/api/drafts/get",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: currentDocId, type: routeDocTypeRef.current }),
          },
        );

        if (requestId !== loadRequestRef.current) return;
        if (editVersionRef.current !== editVersionAtStart || hasUnsavedChangesRef.current) {
          showToast("Local source loaded; current unsaved changes were kept.", "info");
          return;
        }

        if (data?.success && data.draft) {
          applyLoadedDraft(data.draft);
          showToast("Loaded local source data.", "success");
        } else {
          showToast(data?.message || "Draft or source file was not found.", "error");
        }
      } catch {
        showToast("Failed to read local source. Start the Python backend and try again.", "error");
      }
    };

    void loadDraft();
    return () => {
      loadRequestRef.current += 1;
    };
  }, [applyLoadedDraft, currentDocId, showToast]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleBackClick = () => {
    if (hasUnsavedChanges) {
      setExitModalOpen(true);
    } else {
      router.back();
    }
  };

  const buildPayload = (isPublish: boolean) => ({
    id: docType === "about" ? "about" : currentDocId === "new" ? null : currentDocId,
    type: docType,
    title,
    tags,
    cover: normalizeLocalAssetPath(cover, ""),
    mood,
    description: summary,
    content: editorRef.current?.getContent() || "",
    date: date || new Date().toISOString().split("T")[0],
    published: isPublish,
  });

  const handleSave = async (isPublish: boolean, shouldExitAfterSave = false) => {
    if (!title.trim() && docType !== "about") {
      showToast("Please enter a title.", "warning");
      return;
    }

    const payload = buildPayload(isPublish);

    if (isPublish) {
      addOperation({
        id: `publish_${Date.now()}`,
        type: "publish_article",
        label: `Publish: ${title || "Untitled"}`,
        value: payload,
      });
      setClean();
      showToast("Publish task added to the queue.", "info");
      if (shouldExitAfterSave) router.back();
      return;
    }

    setIsSaving(true);
    try {
      const data = await fetchBackendJson<{ success: boolean; message?: string }>("/api/drafts/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (data?.success) {
        setLastSaved(new Date().toLocaleTimeString());
        setClean();
        showToast("Draft saved locally.", "success");
        if (shouldExitAfterSave) {
          setExitModalOpen(false);
          router.back();
        }
      } else {
        showToast(data?.message || "Save failed. Start the Python backend and try again.", "error");
      }
    } catch {
      showToast("Save failed. Start the Python backend and try again.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const discardAndLeave = () => {
    setExitModalOpen(false);
    setClean();
    router.back();
  };

  return (
    <div className="h-screen w-full overflow-hidden relative">
      <AnimatePresence>
        {exitModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setExitModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-[40px] shadow-2xl border border-white/50 dark:border-white/10 p-10 text-center overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-yellow-500 to-transparent opacity-50" />
              <div className="w-20 h-20 bg-yellow-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-10 h-10 text-yellow-500" />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">Unsaved changes</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-8 leading-relaxed">
                Save this draft before leaving, or discard the current edits.
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => handleSave(false, true)}
                  className="w-full py-4 bg-indigo-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-500/30 hover:bg-indigo-600 transition-all flex items-center justify-center gap-2"
                >
                  <Save size={16} /> Save draft and leave
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => setExitModalOpen(false)}
                    className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={discardAndLeave}
                    className="flex-1 py-4 bg-red-500/10 text-red-500 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2"
                  >
                    <LogOut size={16} /> Discard
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className={hasUnsavedChanges ? "relative z-50 [&_a]:pointer-events-none" : "relative z-50"}>
        {hasUnsavedChanges && (
          <div className="absolute inset-0 z-50 cursor-pointer" onClick={() => setExitModalOpen(true)} />
        )}
        <Navbar />
      </div>

      <PageTransition>
        <main
          className="mx-auto w-[96%] max-w-[1750px] flex flex-row gap-6 relative"
          style={{ marginTop: "144px", height: "calc(100vh - 144px - 32px)", marginBottom: "32px" }}
        >
          <button
            onClick={handleBackClick}
            className="absolute -top-14 left-2 px-5 py-2.5 bg-white/40 dark:bg-slate-800/60 backdrop-blur-md border border-white/50 dark:border-white/10 rounded-2xl shadow-lg flex items-center gap-2 text-slate-700 dark:text-slate-200 font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all group z-50"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform text-indigo-500" />
            Back
          </button>

          <section className="flex-1 bg-white/30 dark:bg-slate-800/40 backdrop-blur-[60px] rounded-[50px] shadow-2xl border border-white/30 dark:border-white/10 flex flex-col overflow-hidden">
            <RichTextEditor
              ref={editorRef}
              title={title}
              setTitle={updateTitle}
              initialContent={content}
              isTitleLocked={docType === "about"}
              onOpenImageTool={() => {
                setImgToolTarget("editor");
                setIsImgToolOpen(true);
              }}
              onChange={markUnsavedChanges}
            />
          </section>

          <aside className="w-[360px] shrink-0 bg-white/30 dark:bg-slate-800/40 backdrop-blur-[60px] rounded-[50px] shadow-2xl border border-white/30 dark:border-white/10 flex flex-col overflow-hidden">
            <MetaMatrix
              type={docType}
              tags={tags}
              setTags={updateTags}
              cover={cover}
              setCover={updateCover}
              summary={summary}
              setSummary={updateSummary}
              mood={mood}
              setMood={updateMood}
              allHistoryPostTags={historyPostTags}
              allHistoryChatterTags={historyChatterTags}
              isLoadingTags={isLoadingTags}
              allHistoryMoods={historyMoods}
              onSave={(publish) => handleSave(publish, false)}
              isSaving={isSaving}
              lastSaved={lastSaved}
              onOpenImageTool={() => {
                setImgToolTarget("cover");
                setIsImgToolOpen(true);
              }}
            />
          </aside>
        </main>
      </PageTransition>

      <FloatingImageTool
        isOpen={isImgToolOpen}
        onClose={() => setIsImgToolOpen(false)}
        autoInsertOnUpload={imgToolTarget === "cover"}
        onInsert={(url) => {
          const nextUrl = normalizeLocalAssetPath(url, "");
          if (!nextUrl) {
            showToast("Only local uploaded image paths are allowed.", "warning");
            return;
          }

          if (imgToolTarget === "editor") {
            editorRef.current?.insertImage(nextUrl);
            markUnsavedChanges();
          } else {
            updateCover(nextUrl);
            setIsImgToolOpen(false);
            showToast("Cover replaced. Save or publish to apply it.", "success");
          }
        }}
      />
    </div>
  );
}

export default function EditorPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-900">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-slate-500 font-bold tracking-widest text-sm uppercase">Loading editor...</p>
          </div>
        </div>
      }
    >
      <EditorContent />
    </Suspense>
  );
}
