# Entry Console

Entry Accounting-ийн **харилцагчдыг** удирдах самбар. Хоёр эх сурвалж:
- **Postgres** (`customers`, `customer_events`) — бизнесийн бүртгэл: нэр, ТТД, холбоо барих,
  багц, сарын төлбөр, төлөв, түүх. Төлбөр тооцооны хүснэгтүүд энд нэмэгдэнэ.
- **GitHub** — техник төлөв: `entry-customer` topic-той repo, workflow run, collaborator.
  DB-д байхгүй repo самбар нээхэд автоматаар бүртгэгдэнэ; provisioning → repo үүсмэгц active.

| Боломж | Хэрхэн |
|--------|--------|
| Самбар | KPI (идэвхтэй, MRR, хоцорсон, хүрэхгүй), анхаарах зүйлс, сүүлийн үйл явдал, бөөн sync |
| Тохиргоо, шалгалт | Token scope, org эрх, core secret/variable, workflow, DB — ногоон/улаан шалгалт + засах заавар |
| Харилцагчид | Хайлт, төлвөөр шүүх, CSV экспорт; дэлгэрэнгүйд гэрээ/төлбөр, sync, эрх, түүх, төлөв |
| Dark mode | Системийн тохиргоо + гараар солих, localStorage-д хадгална |
| Харилцагч нэмэх (бүртгэл + repo) | Core repo-ийн `provision-customer.yml`-ийг dispatch → repo үүсэх, core түүх push, Actions permission, `UPSTREAM_TOKEN`, хэрэглэгч урих |
| Хувилбарын самбар | Харилцагч бүрийн `<app>/api/health` → version vs core-ийн сүүлийн release |
| Sync | Харилцагчийн `upstream-sync.yml` dispatch (ref = tag) → PR |
| Эрх | Collaborator урих (Read/Write/Admin), хүлээгдэж буй урилга |

## Ажиллуулах

```bash
npm ci
cp .env.example .env.local   # DATABASE_URL, CONSOLE_PASSWORD, AUTH_SECRET, GITHUB_TOKEN
npm run db:push
npm run dev
```

## Railway

Service `entry-console` (GitHub repo) + Postgres `Entry console DB`. Variables: `DATABASE_URL`
(Postgres-ийн reference), `CONSOLE_PASSWORD`, `AUTH_SECRET`, `GITHUB_TOKEN`, `GITHUB_OWNER`,
`GITHUB_OWNER_TYPE` (+ `CORE_REPO`). `railway.toml`: preDeploy `db:push`, healthcheck `/api/health`.

**Харилцагчийн автомат deploy:** `RAILWAY_TOKEN` (account token) + `RAILWAY_PROJECT_ID` (+ `RAILWAY_ENVIRONMENT_ID`)
өгвөл харилцагч бүрд тэр project дотор `entry-<код>` (GitHub repo, healthcheck `/api/health`,
preDeploy `db:push`) + `entry-<код>-db` (postgres:16 + volume) service үүсч, `DATABASE_URL`,
`AUTH_SECRET`, `NEXT_PUBLIC_APP_URL` тавигдаж, domain нь харилцагчийн Deploy хаяг болно
(`lib/railway.ts`, `lib/deploy.ts`). Нэрээр байгаа service-ийг дахин ашигладаг тул унасан
оролдлогыг аюулгүй давтана. Railway-ийн GitHub app `GITHUB_OWNER` org-д суусан байх ёстой.
Зөвхөн `RAILWAY_PROJECT_TOKEN` өгвөл service/DB/domain үүснэ, харин repo холболтыг Railway дээр
гараар хийнэ (project token GitHub контекстгүй) — самбар «repo холбогдоогүй» гэж анхааруулна.

Core repo талд: Settings → Secrets → `PROVISION_TOKEN`, `UPSTREAM_READ_TOKEN`
(`.github/workflows/provision-customer.yml` толгойн тайлбар).
