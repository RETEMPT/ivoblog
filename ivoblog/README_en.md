# iV0 Blog

A personal blog project built with Next.js 16, React 19, and Tailwind CSS 4. It includes a public blog frontend and a local manager app.

The current site mode is an individual personal blog. Social-account widgets and the matching manager profile settings have been removed, while posts, notes, photos, friends, music, comments, and the AI assistant remain available.

The manager now includes `AI/API Config` for model and key settings, plus `Performance & Effects` for switching between performance, balanced, and quality modes.

Legacy updater scripts, old domain references, and old template examples have been removed from this repository.

## Structure

```text
ivoblog/
  blog/              # Public blog frontend
  my-blog-manager/   # Local manager app
  picture/           # Documentation images
  LICENSE
```

## Requirements

- Node.js 18 or newer, LTS recommended
- npm
- Python 3.10 or newer, required by the local manager backend
- Git, required for sync and deployment

## Run The Blog Locally

```powershell
cd ivoblog\blog
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:3000
```

Production check:

```powershell
npm run build
npm run start
```

## Run The Manager

```powershell
cd ivoblog\my-blog-manager
npm install
python run_me.py
```

Common entry:

```text
http://127.0.0.1:3001/settings
```

## Quick Start Scripts

The project root includes two double-click helpers:

```text
start-blog.bat     # Start the blog frontend, close window to stop
start-manager.bat  # Start the manager app, close window to stop
```

Runtime logs are saved to `logs/` directory.

For performance mode switching, use the manager's `Settings → Performance & Effects` page.

## AI Configuration

The manager settings page supports:

- API Key
- Prompt
- Model name, such as `deepseek-chat` or `deepseek-reasoner`
- Thinking strength
- Max output tokens
- Temperature

Use local environment files for secrets:

```text
ivoblog/blog/.env.local
ivoblog/my-blog-manager/.env.local
```

Example:

```env
DEEPSEEK_API_KEY=your_api_key
QWEATHER_KEY=your_weather_key
```

Do not place real API keys in `siteConfig.ts`.

## Deploy To Vercel

1. Push the repository to your Git provider.
2. Create a Vercel project and import the repository.
3. Set Root Directory to `ivoblog/blog`.
4. Use `npm run build` as the Build Command.
5. Add required environment variables, such as `DEEPSEEK_API_KEY` and `QWEATHER_KEY`.
6. Test the home page, post pages, music page, AI route, and weather route after deployment.

The old `public/CNAME` file has been removed. Bind your own domain in your deployment platform when needed.

## Stability Notes

- Removed legacy maintenance scripts and the broken config checker script.
- Manager config saves now use a whitelist and scoped payloads, so profile, effects, AI, and footer pages only submit the fields they own.
- Added manager-controlled effect switches for splash, background motion, heavy background effects, danmaku, click particles, assistant widget, and floating music controls.
- Global effects now load after idle time and degrade on mobile or reduced-motion environments.
- Background images have a fallback so an empty config does not crash the home page.
- This README no longer includes old repository, old domain, or old template links.

## If The Page Feels Slow

Open `Settings -> Performance & Effects` in the manager:

1. Switch to `Performance`.
2. Turn off danmaku, click particles, heavy background effects, gradient motion, and winter snow.
3. Sync the config and reload the public blog.

These switches do not disable core blog features such as posts, photos, friends, music, comments, or AI settings.

## License

See the root `LICENSE` file. Before deployment, make sure you have the rights to use your content, images, music, and third-party service configuration.
