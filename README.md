# Nexara - Frontend

This is the frontend for Nexara, live at [nexara.nikarva.com](https://nexara.nikarva.com). I built it with Next.js 14 using the App Router.

## What's working

- LinkedIn account connect/disconnect, in the settings section of the dashboard
- A campaign creation wizard for Connection Outreach campaigns — goal, audience/segment filters, message, then review before launch
- Live campaign and message status pushed from the backend over Server-Sent Events, used in the campaign detail view, the message thread view, and a shared alerts context
- A reply review screen for the supervised-mode pipeline — approve a queued reply or edit its draft before it sends
- Auth and session handling through Postgres on the client side

## Talks to

- The backend API, at a URL set through an environment variable, falling back to my local dev server if unset
- The backend's SSE stream, authenticated via a token in the query string rather than a header, since the browser's `EventSource` can't send custom headers
- Postgres directly from the client, for authentication

## Environment variables

This is what I actually read in the code — I don't have a `.env.example` committed yet, only a local `.env.local`.

```
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_POSTGRES_URL=
NEXT_PUBLIC_POSTGRES_ANON_KEY=
```

`NEXT_PUBLIC_API_URL` falls back to my local backend address if unset. The other two have no fallback — if either is missing, the client throws instead of failing gracefully, so both need to be set before running this anywhere.

## Running it locally

```bash
npm install
npm run dev      # starts the dev server on localhost:3000
npm run build    # production build
npm start        # runs the production build
```

Setting `NEXT_PUBLIC_API_URL` is the only thing needed beyond install — the dev server picks up `.env.local` automatically.

## Known limits

- Connection-acceptance status isn't reliably real-time — the frontend treats it as eventually consistent rather than instant, since the backend re-derives it during enrichment instead of pushing it live
- There's no reject/discard action for queued replies yet, only approve and edit
- No UI yet for the per-connection auto-approve toggle the backend already supports
- The admin dashboard and automated chat-mockup generation described elsewhere aren't part of this codebase
