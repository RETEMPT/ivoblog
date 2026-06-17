export interface Photo { url: string; caption?: string; }
export interface Album { id: string; title: string; description: string; cover: string; date: string; photos: Photo[]; }

export const albums: Album[] = [
  {
    id: "recent-light-gallery",
    title: "最近上传",
    description: "从本地上传图片中挑选的近期照片集，优先使用本地资源以保证加载稳定。",
    cover: "/uploads/images/_20251225232527_213_2-0d4cd615c3.jpg",
    date: "2026.06",
    photos: [
      {
        url: "/uploads/images/_20251225232527_213_2-0d4cd615c3.jpg",
        caption: "蓝色光影",
      },
      {
        url: "/uploads/images/mmexport1766655840334-e8d92d0c35.jpg",
        caption: "静默瞬间",
      },
    ],
  },
  {
    id: "recent-portrait-set",
    title: "个人影像",
    description: "头像与本地素材组成的轻量图册，用作首页和照片墙的稳定展示。",
    cover: "/uploads/images/IMG_20251123_160113-b59a780ebe.png",
    date: "2026.06",
    photos: [
      {
        url: "/uploads/images/IMG_20251123_160113-b59a780ebe.png",
        caption: "个人头像",
      },
      {
        url: "/uploads/images/Image_1766505805627-30e87d0c37.jpg",
        caption: "备用影像",
      },
    ],
  },
];
