"use client";

import { useEffect, useMemo, useState, type SyntheticEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  CloudUpload,
  Edit3,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Navbar from "../../components/Navbar";
import PageTransition from "../../components/PageTransition";
import FloatingImageTool from "../../components/editor/FloatingImageTool";
import { useToast } from "../../components/ToastProvider";
import { useOperations } from "../../context/OperationContext";
import { albums as initialAlbums, type Album } from "../../data/albums";
import { siteConfig } from "../../siteConfig";
import { normalizeLocalAssetPath, sanitizeLocalAssetInput } from "../../lib/localMedia";

const FALLBACK_PHOTOWALL_IMAGE = siteConfig.photoWallImage || siteConfig.defaultPostCover;

function applyImageFallback(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === "true") return;
  image.dataset.fallbackApplied = "true";
  image.src = FALLBACK_PHOTOWALL_IMAGE;
}

type PhotoLike = {
  url?: string;
  caption?: string;
};

function normalizePhoto(photo: PhotoLike) {
  return {
    ...photo,
    url: normalizeLocalAssetPath(photo?.url, FALLBACK_PHOTOWALL_IMAGE),
  };
}

function normalizeAlbum(album: Album): Album {
  const photos = Array.isArray(album.photos) ? album.photos.map(normalizePhoto) : [];

  return {
    ...album,
    title: album.title || "Untitled Album",
    description: album.description || "",
    cover: normalizeLocalAssetPath(album.cover, photos[0]?.url || FALLBACK_PHOTOWALL_IMAGE),
    photos,
  };
}

export default function PhotoWallPage() {
  const [currentAlbum, setCurrentAlbum] = useState<Album | null>(null);
  const [selectedImage, setSelectedImage] = useState<{ url: string; caption?: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [editableAlbums, setEditableAlbums] = useState<Album[]>(() => initialAlbums.map(normalizeAlbum));

  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: "album" | "photo";
    id?: string;
    photoIndex?: number;
    title: string;
  }>({ isOpen: false, type: "album", title: "" });
  const [albumModal, setAlbumModal] = useState<{ isOpen: boolean; mode: "add" | "edit"; data: any }>({
    isOpen: false,
    mode: "add",
    data: {},
  });
  const [photoModal, setPhotoModal] = useState<{
    isOpen: boolean;
    mode: "add" | "edit";
    index?: number;
    data: any;
  }>({ isOpen: false, mode: "add", data: {} });

  const [isImgToolOpen, setIsImgToolOpen] = useState(false);
  const [imgToolTarget, setImgToolTarget] = useState<"album" | "photo">("album");

  const { addOperation } = useOperations();
  const { showToast } = useToast();

  useEffect(() => {
    setIsTransitioning(true);
    const timer = window.setTimeout(() => {
      setActiveQuery(searchQuery.toLowerCase());
      setIsTransitioning(false);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const syncToQueue = (newAlbums: Album[]) => {
    addOperation({
      id: `photowall_sync_${Date.now()}`,
      type: "sync_photowall",
      label: "Sync photowall data",
      value: newAlbums,
    });
    showToast("Photowall changes queued. Apply local sync from the navbar when ready.", "info");
  };

  const { matchedAlbums, matchedPhotos } = useMemo(() => {
    if (!activeQuery) return { matchedAlbums: editableAlbums, matchedPhotos: [] as Array<PhotoLike & { albumName: string }> };

    const matchedAlbumList = editableAlbums.filter((album) => {
      const title = (album.title || "").toLowerCase();
      const description = (album.description || "").toLowerCase();
      return title.includes(activeQuery) || description.includes(activeQuery);
    });

    const matchedPhotoList = editableAlbums
      .flatMap((album) => album.photos.map((photo) => ({ ...photo, albumName: album.title })))
      .filter((photo) => (photo.caption || "").toLowerCase().includes(activeQuery));

    return { matchedAlbums: matchedAlbumList, matchedPhotos: matchedPhotoList };
  }, [activeQuery, editableAlbums]);

  const buildAlbumFromModal = () => {
    const now = new Date().toISOString().split("T")[0];
    return normalizeAlbum({
      id: albumModal.data.id || `album_${Date.now()}`,
      title: albumModal.data.title || "",
      description: albumModal.data.description || "",
      cover: albumModal.data.cover || "",
      date: albumModal.data.date || now,
      photos: albumModal.mode === "add" ? [] : albumModal.data.photos || [],
    });
  };

  const handleSaveAlbum = () => {
    const normalizedAlbum = buildAlbumFromModal();
    const next =
      albumModal.mode === "add"
        ? [normalizedAlbum, ...editableAlbums]
        : editableAlbums.map((album) => (album.id === normalizedAlbum.id ? normalizedAlbum : album));

    setEditableAlbums(next);
    if (currentAlbum?.id === normalizedAlbum.id) setCurrentAlbum(normalizedAlbum);
    syncToQueue(next);
    setAlbumModal({ ...albumModal, isOpen: false });
  };

  const handleSavePhoto = () => {
    if (!currentAlbum) return;

    const album = editableAlbums.find((item) => item.id === currentAlbum.id);
    if (!album) return;

    if (photoModal.mode === "add") {
      const normalizedUrl = normalizeLocalAssetPath(photoModal.data.url, "");
      if (!normalizedUrl) {
        showToast("Use local upload or a /uploads/... image path.", "warning");
        return;
      }
      album.photos = [normalizePhoto({ ...photoModal.data, url: normalizedUrl }), ...album.photos];
    } else if (typeof photoModal.index === "number" && album.photos[photoModal.index]) {
      album.photos[photoModal.index] = {
        ...album.photos[photoModal.index],
        caption: photoModal.data.caption,
      };
    }

    const normalizedAlbum = normalizeAlbum({ ...album });
    const next = editableAlbums.map((item) => (item.id === normalizedAlbum.id ? normalizedAlbum : item));
    setEditableAlbums(next);
    setCurrentAlbum(normalizedAlbum);
    syncToQueue(next);
    setPhotoModal({ ...photoModal, isOpen: false });
  };

  const confirmDelete = () => {
    if (deleteModal.type === "album") {
      const next = editableAlbums.filter((album) => album.id !== deleteModal.id);
      setEditableAlbums(next);
      if (currentAlbum?.id === deleteModal.id) setCurrentAlbum(null);
      syncToQueue(next);
      setDeleteModal({ ...deleteModal, isOpen: false });
      return;
    }

    if (!currentAlbum || typeof deleteModal.photoIndex !== "number") {
      setDeleteModal({ ...deleteModal, isOpen: false });
      return;
    }

    const album = editableAlbums.find((item) => item.id === currentAlbum.id);
    if (!album) {
      setDeleteModal({ ...deleteModal, isOpen: false });
      return;
    }

    const normalizedAlbum = normalizeAlbum({
      ...album,
      photos: album.photos.filter((_, index) => index !== deleteModal.photoIndex),
    });
    const next = editableAlbums.map((item) => (item.id === normalizedAlbum.id ? normalizedAlbum : item));
    setEditableAlbums(next);
    setCurrentAlbum(normalizedAlbum);
    syncToQueue(next);
    setDeleteModal({ ...deleteModal, isOpen: false });
  };

  return (
    <div className="min-h-screen relative pb-32">
      <Navbar />

      <FloatingImageTool
        key={isImgToolOpen ? "tool-open" : "tool-closed"}
        isOpen={isImgToolOpen}
        onClose={() => setIsImgToolOpen(false)}
        onInsert={(url) => {
          if (imgToolTarget === "album") {
            setAlbumModal((prev) => ({
              ...prev,
              data: { ...prev.data, cover: normalizeLocalAssetPath(url, FALLBACK_PHOTOWALL_IMAGE) },
            }));
          } else {
            setPhotoModal((prev) => ({
              ...prev,
              data: { ...prev.data, url: normalizeLocalAssetPath(url, "") },
            }));
          }
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
              onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative w-full max-w-sm rounded-[40px] border border-white/50 bg-white/80 p-10 text-center shadow-2xl dark:bg-slate-900/80"
            >
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-red-500/10">
                <AlertTriangle className="text-red-500" />
              </div>
              <h3 className="mb-2 text-xl font-black text-slate-900 dark:text-white">Remove item?</h3>
              <p className="mb-8 text-sm leading-relaxed text-slate-500">
                This will queue the selected album or photo for removal.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })}
                  className="flex-1 rounded-2xl bg-slate-100 py-4 text-xs font-black uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 rounded-2xl bg-red-500 py-4 text-xs font-black uppercase text-white"
                >
                  Remove
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {albumModal.isOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="relative w-full max-w-md rounded-[40px] border border-white/20 bg-white/90 p-8 shadow-2xl dark:bg-slate-900/90"
            >
              <h2 className="mb-6 text-2xl font-black dark:text-white">
                {albumModal.mode === "add" ? "Create album" : "Edit album"}
              </h2>
              <div className="space-y-5">
                <input
                  type="text"
                  value={albumModal.data.title || ""}
                  onChange={(e) => setAlbumModal({ ...albumModal, data: { ...albumModal.data, title: e.target.value } })}
                  className="w-full rounded-2xl border border-transparent bg-slate-100 px-5 py-3.5 outline-none focus:border-indigo-500 dark:bg-black/20 dark:text-white"
                  placeholder="Album title"
                />
                <textarea
                  value={albumModal.data.description || ""}
                  onChange={(e) => setAlbumModal({ ...albumModal, data: { ...albumModal.data, description: e.target.value } })}
                  className="h-24 w-full resize-none rounded-2xl border border-transparent bg-slate-100 px-5 py-3.5 outline-none focus:border-indigo-500 dark:bg-black/20 dark:text-white"
                  placeholder="Album description"
                />

                <div className="relative group">
                  <input
                    type="text"
                    value={albumModal.data.cover || ""}
                    onChange={(e) =>
                      setAlbumModal({
                        ...albumModal,
                        data: { ...albumModal.data, cover: sanitizeLocalAssetInput(e.target.value) },
                      })
                    }
                    className="w-full rounded-2xl border border-transparent bg-slate-100 px-5 py-3.5 pr-14 outline-none focus:border-indigo-500 dark:bg-black/20 dark:text-white"
                    placeholder="Local cover path /uploads/..."
                  />
                  <button
                    onClick={() => {
                      setImgToolTarget("album");
                      setIsImgToolOpen(true);
                    }}
                    className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl bg-indigo-500 text-white shadow-md transition-colors hover:bg-indigo-600"
                    title="Open image tool"
                  >
                    <CloudUpload size={18} />
                  </button>
                </div>
              </div>
              <div className="mt-8 flex gap-3">
                <button
                  onClick={() => setAlbumModal({ ...albumModal, isOpen: false })}
                  className="flex-1 py-3 text-xs font-bold uppercase text-slate-500 transition-colors hover:text-slate-800 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAlbum}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-indigo-500 py-4 font-black text-white shadow-lg shadow-indigo-500/30 transition-colors hover:bg-indigo-600"
                >
                  <Save size={18} /> Save draft
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {photoModal.isOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="relative w-full max-w-md rounded-[40px] border border-white/20 bg-white/90 p-8 shadow-2xl dark:bg-slate-900/90"
            >
              <h2 className="mb-6 text-2xl font-black dark:text-white">
                {photoModal.mode === "add" ? "Add photo" : "Edit caption"}
              </h2>
              <div className="space-y-5">
                {photoModal.mode === "add" && (
                  <div className="relative group">
                    <input
                      type="text"
                      value={photoModal.data.url || ""}
                      onChange={(e) =>
                        setPhotoModal({
                          ...photoModal,
                          data: { ...photoModal.data, url: sanitizeLocalAssetInput(e.target.value) },
                        })
                      }
                      className="w-full rounded-2xl border border-transparent bg-slate-100 px-5 py-3.5 pr-14 outline-none focus:border-indigo-500 dark:bg-black/20 dark:text-white"
                      placeholder="Local photo path /uploads/..."
                    />
                    <button
                      onClick={() => {
                        setImgToolTarget("photo");
                        setIsImgToolOpen(true);
                      }}
                      className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl bg-indigo-500 text-white shadow-md transition-colors hover:bg-indigo-600"
                    >
                      <CloudUpload size={18} />
                    </button>
                  </div>
                )}
                <textarea
                  value={photoModal.data.caption || ""}
                  onChange={(e) => setPhotoModal({ ...photoModal, data: { ...photoModal.data, caption: e.target.value } })}
                  className="h-24 w-full resize-none rounded-2xl border border-transparent bg-slate-100 px-5 py-3.5 outline-none focus:border-indigo-500 dark:bg-black/20 dark:text-white"
                  placeholder="Caption"
                />
              </div>
              <div className="mt-8 flex gap-3">
                <button
                  onClick={() => setPhotoModal({ ...photoModal, isOpen: false })}
                  className="flex-1 py-3 text-xs font-bold uppercase text-slate-500 transition-colors hover:text-slate-800 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePhoto}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-indigo-500 py-4 font-black text-white shadow-lg shadow-indigo-500/30 transition-colors hover:bg-indigo-600"
                >
                  <Save size={18} /> Save draft
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <PageTransition>
        <div className="relative z-10 mx-auto mt-28 w-full max-w-7xl px-4 sm:px-10">
          {!currentAlbum && (
            <div className="animate-fade-in-up">
              <div className="mb-16 flex flex-col items-center justify-between gap-6 md:flex-row">
                <div>
                  <h1 className="mb-2 text-4xl font-black tracking-widest text-slate-900 transition-colors duration-700 dark:text-white md:text-5xl">
                    Photo Wall
                  </h1>
                  <p className="font-medium tracking-wider text-slate-600 transition-colors duration-700 dark:text-slate-400">
                    Albums are grouped collections. Photos stay local and load from this site.
                  </p>
                </div>

                <div className="group relative w-full md:w-80">
                  <Search className="absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-indigo-500" />
                  <input
                    type="text"
                    placeholder="Search albums or captions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-12 w-full rounded-full border border-white/50 bg-white/40 pl-12 pr-4 text-sm text-slate-800 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:border-white/10 dark:bg-slate-800/40 dark:text-white"
                  />
                </div>
              </div>

              <div className={`transition-opacity duration-300 ${isTransitioning ? "scale-95 opacity-0" : "scale-100 opacity-100"}`}>
                {activeQuery && matchedPhotos.length > 0 && (
                  <div className="mb-16">
                    <h3 className="mb-6 flex items-center gap-2 text-xl font-bold text-slate-800 dark:text-slate-200">
                      Matched Photos ({matchedPhotos.length})
                    </h3>
                    <div className="columns-1 space-y-6 gap-6 sm:columns-2 md:columns-4">
                      {matchedPhotos.map((photo, index) => (
                        <div
                          key={`${photo.url}-${index}`}
                          onClick={() => setSelectedImage({ url: photo.url || FALLBACK_PHOTOWALL_IMAGE, caption: photo.caption })}
                          className="group relative break-inside-avoid overflow-hidden rounded-2xl shadow-lg transition-transform hover:scale-[1.02]"
                        >
                          <img src={photo.url} alt={photo.caption || "Photo"} className="h-auto w-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-10 grid grid-cols-1 gap-x-8 gap-y-20 sm:grid-cols-2 lg:grid-cols-3">
                  {!activeQuery && (
                    <div
                      onClick={() => setAlbumModal({ isOpen: true, mode: "add", data: {} })}
                      className="group flex cursor-pointer flex-col items-center"
                    >
                      <div className="relative mb-8 flex aspect-[4/3] w-[85%] flex-col items-center justify-center rounded-[32px] border-4 border-dashed border-slate-300 bg-white/10 transition-all duration-500 hover:border-indigo-500 dark:border-slate-700 dark:bg-white/5">
                        <Plus size={48} className="text-slate-400 transition-all duration-500 group-hover:rotate-90 group-hover:text-indigo-500" />
                        <span className="mt-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Create Album</span>
                      </div>
                    </div>
                  )}

                  {matchedAlbums.map((album) => (
                    <div key={album.id} className="group relative flex cursor-pointer flex-col items-center">
                      <div className="absolute right-0 top-0 z-50 flex -translate-x-4 flex-col gap-2 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAlbumModal({ isOpen: true, mode: "edit", data: album });
                          }}
                          className="rounded-xl bg-indigo-500 p-2.5 text-white shadow-lg transition-transform hover:scale-110"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteModal({ isOpen: true, type: "album", id: album.id, title: album.title });
                          }}
                          className="rounded-xl bg-red-500 p-2.5 text-white shadow-lg transition-transform hover:scale-110"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div
                        onClick={() => {
                          setSearchQuery("");
                          setCurrentAlbum(album);
                        }}
                        className="relative mb-8 aspect-[4/3] w-[85%]"
                      >
                        <div className="absolute inset-0 translate-x-4 translate-y-2 rotate-6 overflow-hidden rounded-[4px] border-[6px] border-white bg-slate-300 opacity-60 shadow-md transition-all duration-500 group-hover:rotate-12 dark:border-slate-200 dark:bg-slate-700">
                          {album.photos[2] && <img src={album.photos[2].url} onError={applyImageFallback} className="h-full w-full object-cover grayscale blur-[2px]" alt="" />}
                        </div>
                        <div className="absolute inset-0 -translate-x-2 -translate-y-1 -rotate-3 overflow-hidden rounded-[4px] border-[6px] border-white bg-slate-200 opacity-80 shadow-lg transition-all duration-500 group-hover:-rotate-6 dark:border-slate-200 dark:bg-slate-600">
                          {album.photos[1] && <img src={album.photos[1].url} onError={applyImageFallback} className="h-full w-full object-cover grayscale-[50%]" alt="" />}
                        </div>
                        <div className="absolute inset-0 z-20 overflow-hidden rounded-[4px] border-[6px] border-white bg-white shadow-2xl transition-all duration-500 group-hover:-translate-y-2 group-hover:scale-105 dark:border-slate-200 dark:bg-slate-200">
                          <img src={album.cover} onError={applyImageFallback} alt={album.title} className="h-full w-full object-cover" />
                        </div>
                      </div>

                      <div className="w-full px-4 text-center" onClick={() => setCurrentAlbum(album)}>
                        <div className="mb-1 flex items-center justify-center gap-2">
                          <h2 className="text-xl font-bold text-slate-900 transition-colors group-hover:text-indigo-600 dark:text-white">
                            {album.title}
                          </h2>
                        </div>
                        <p className="line-clamp-1 text-sm text-slate-600 dark:text-slate-400">{album.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {currentAlbum && (
            <div className="animate-fade-in-up">
              <div className="mb-12 flex flex-col items-start justify-between gap-4 border-b border-slate-300/50 pb-6 dark:border-slate-700/50 md:flex-row md:items-end">
                <div>
                  <button
                    onClick={() => setCurrentAlbum(null)}
                    className="group mb-4 flex items-center gap-1.5 text-sm font-bold text-slate-500 transition-colors hover:text-indigo-500 dark:text-slate-400"
                  >
                    <div className="rounded-lg border border-white/50 bg-white/40 p-1.5 shadow-sm dark:bg-slate-800/50">
                      <X size={16} />
                    </div>
                    Back to albums
                  </button>
                  <h1 className="mb-2 text-4xl font-black tracking-wider text-slate-900 dark:text-white md:text-5xl">
                    {currentAlbum.title}
                  </h1>
                </div>
                <button
                  onClick={() => setAlbumModal({ isOpen: true, mode: "edit", data: currentAlbum })}
                  className="rounded-2xl border border-white/50 bg-white/40 px-5 py-2.5 text-xs font-black uppercase text-indigo-500 shadow-sm transition-all hover:bg-white dark:bg-slate-800/40"
                >
                  Edit album
                </button>
              </div>

              <div className="columns-1 space-y-6 gap-6 sm:columns-2 md:columns-3 lg:columns-4">
                <div
                  onClick={() => setPhotoModal({ isOpen: true, mode: "add", data: {} })}
                  className="group flex min-h-[200px] cursor-pointer break-inside-avoid flex-col items-center justify-center rounded-[32px] border-2 border-dashed border-slate-300 bg-white/10 transition-all duration-500 hover:border-indigo-500 dark:border-slate-700 dark:bg-slate-800/10"
                >
                  <Plus size={32} className="text-slate-400 transition-all group-hover:text-indigo-500" />
                  <span className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Add Photo</span>
                </div>

                {currentAlbum.photos.map((photo, index) => (
                  <div
                    key={`${photo.url}-${index}`}
                    className="group relative cursor-pointer break-inside-avoid overflow-hidden rounded-2xl border border-white/30 bg-white/20 shadow-lg transition-all duration-500 hover:scale-[1.02] dark:border-white/10 dark:bg-slate-800/20"
                  >
                    <div className="absolute left-3 top-3 z-30 flex translate-y-2 gap-1.5 opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPhotoModal({ isOpen: true, mode: "edit", index, data: photo });
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/80 text-slate-700 shadow-sm backdrop-blur-md transition-all hover:bg-indigo-500 hover:text-white"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteModal({ isOpen: true, type: "photo", photoIndex: index, title: "This photo" });
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/80 text-red-500 shadow-sm backdrop-blur-md transition-all hover:bg-red-500 hover:text-white"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    <img
                      onClick={() => setSelectedImage(photo)}
                      src={photo.url}
                      alt={photo.caption || "Photo"}
                      className="h-auto w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    {photo.caption && (
                      <div className="bg-white/30 p-4 text-xs font-bold backdrop-blur-sm dark:bg-black/20 dark:text-slate-200">
                        {photo.caption}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </PageTransition>

      {selectedImage && (
        <div
          className="fixed inset-0 z-[300] flex cursor-zoom-out flex-col items-center justify-center bg-black/95 p-4 backdrop-blur-2xl sm:p-10"
          onClick={() => setSelectedImage(null)}
        >
          <button className="absolute right-6 top-6 rounded-full bg-white/10 p-2 text-white/50 transition-colors hover:bg-white/20 hover:text-white">
            <X size={24} />
          </button>
          <img
            src={selectedImage.url}
            alt={selectedImage.caption || "Fullscreen photo"}
            className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          {selectedImage.caption && (
            <div className="absolute bottom-10 rounded-full border border-white/10 bg-white/10 px-6 py-3 text-sm font-medium tracking-wide text-white shadow-2xl backdrop-blur-md">
              {selectedImage.caption}
            </div>
          )}
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in-up {
          animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .animate-fade-in {
          animation: fadeIn 0.4s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
