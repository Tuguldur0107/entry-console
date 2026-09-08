# Entry Console

Entry Accounting-ийн **харилцагчийн repo-уудыг** удирдах жижиг самбар. DB байхгүй —
эх сурвалж нь GitHub: харилцагч = `entry-customer` topic-той repo, тохиргоо нь repo
variables (`ENTRY_DISPLAY_NAME`, `ENTRY_APP_URL`), статус нь workflow run.

| Боломж | Хэрхэн |
|--------|--------|
| Харилцагч нэмэх | Core repo-ийн `provision-customer.yml`-ийг dispatch → repo үүсэх, core түүх push, Actions permission, `UPSTREAM_TOKEN`, хэрэглэгч урих |
| Хувилбарын самбар | Харилцагч бүрийн `<app>/api/health` → version vs core-ийн сүүлийн release |
| Sync | Харилцагчийн `upstream-sync.yml` dispatch (ref = tag) → PR |
| Эрх | Collaborator урих (Read/Write/Admin), хүлээгдэж буй урилга |

## Ажиллуулах

```bash
npm ci
cp .env.example .env.local   # CONSOLE_PASSWORD, AUTH_SECRET, GITHUB_TOKEN
npm run dev
```

## Railway

Шинэ service → GitHub repo `entry-console` → Variables: `CONSOLE_PASSWORD`, `AUTH_SECRET`,
`GITHUB_TOKEN` (+ `GITHUB_OWNER`, `GITHUB_OWNER_TYPE`, `CORE_REPO` шаардлагатай бол).
`railway.toml` healthcheck `/api/health`.

Core repo талд: Settings → Secrets → `PROVISION_TOKEN`, `UPSTREAM_READ_TOKEN`
(`.github/workflows/provision-customer.yml` толгойн тайлбар).
