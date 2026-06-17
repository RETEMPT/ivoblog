# Blog Frontend

This is the public Next.js frontend for `iV0 Blog`.

It is configured as an individual personal blog. Social-account widgets are not part of the public UI, so deployment does not require social profile fields.

Performance-heavy effects are controlled by `siteConfig.effectsConfig`, which can be edited from the manager's Performance & Effects page.

## Local Development

```powershell
npm install
npm run dev
```

Open `http://127.0.0.1:3000`.

## Production Check

```powershell
npm run build
npm run start
```

## Environment Variables

Create `.env.local` when local API features are needed:

```env
DEEPSEEK_API_KEY=your_api_key
QWEATHER_KEY=your_weather_key
```

Secrets must stay in environment files or deployment platform settings, not in `siteConfig.ts`.

## Deployment

For Vercel, set the project Root Directory to `ivoblog/blog` and Build Command to `npm run build`.

The old template `public/CNAME` has been removed. Add your own domain from the deployment platform instead.
