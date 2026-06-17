import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import Navbar from '../../components/Navbar';
import PageTransition from '../../components/PageTransition';
import MomentList from './MomentList';
import { siteConfig } from '../../siteConfig';

export const metadata = {
  title: "说说 | " + siteConfig.title,
  description: "生活动态与瞬间记录",
};

export default function MomentsPage() {
  let allMoments: any[] = [];

  try {
    const postsMomentsDirectory = path.join(/*turbopackIgnore: true*/ process.cwd(), 'posts', 'moments');
    const momentsDirectory = path.join(/*turbopackIgnore: true*/ process.cwd(), 'moments');

    if (fs.existsSync(postsMomentsDirectory)) {
      const fileNames = fs.readdirSync(postsMomentsDirectory).filter(f => f.endsWith('.md'));
      fileNames.forEach(fileName => {
        const fullPath = path.join(postsMomentsDirectory, fileName);
        const { data, content } = matter(fs.readFileSync(fullPath, 'utf8'));

        allMoments.push({
          id: fileName.replace(/\.md$/, ''),
          date: data.date || '1970-01-01',
          location: data.location || '',
          images: data.images || [],
          content: content.trim()
        });
      });
    }

    if (fs.existsSync(momentsDirectory)) {
      const fileNames = fs.readdirSync(momentsDirectory).filter(f => f.endsWith('.md'));
      fileNames.forEach(fileName => {
        const fullPath = path.join(momentsDirectory, fileName);
        const { data, content } = matter(fs.readFileSync(fullPath, 'utf8'));

        allMoments.push({
          id: fileName.replace(/\.md$/, ''),
          date: data.date || '1970-01-01',
          location: data.location || '',
          images: data.images || [],
          content: content.trim()
        });
      });
    }

    // 去重，防止你在两个文件夹放了同名文件
    allMoments = Array.from(new Map(allMoments.map(item => [item.id, item])).values());

  } catch (e) {
    console.error("读取说说数据失败:", e);
  }

  return (
    <div className="min-h-screen relative pb-10 flex flex-col">
      <Navbar />
      <PageTransition className="flex-1 flex flex-col">
        <MomentList
          moments={allMoments}
          authorName={siteConfig.authorName}
          avatarUrl={siteConfig.avatarUrl}
        />
      </PageTransition>
    </div>
  );
}
