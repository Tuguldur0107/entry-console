// Railway Public API (GraphQL) — харилцагчийн Entry-г нэг товчоор deploy:
//   project → Postgres (docker image + volume) → app service (GitHub repo)
//   → variables → domain → deploy. Token: RAILWAY_TOKEN (Account/Team token,
//   Railway → Account settings → Tokens), RAILWAY_WORKSPACE_ID (сонголтоор).
import { randomBytes } from "node:crypto";

const API = "https://backboard.railway.com/graphql/v2";

export class RailwayError extends Error {}

/**
 * Нэвтрэлт (аль нэг нь):
 *  - RAILWAY_TOKEN — Account/Team token (Railway → Account settings → Tokens). GitHub repo
 *    холбох (serviceConnect) ЗӨВХӨН энэ token-оор болно — project token GitHub контекстгүй.
 *  - RAILWAY_PROJECT_TOKEN — project token: service/volume/variable/domain үүсгэнэ, repo
 *    холбож чадахгүй → service бэлэн болоод «repo холбоогүй» төлөвтэй үлдэнэ (Railway дээр
 *    гараар холбох эсвэл RAILWAY_TOKEN нэмээд дахин оролдох).
 * Байршил:
 *  - RAILWAY_PROJECT_ID өгвөл харилцагч бүр ТЭР project дотор entry-<slug> + entry-<slug>-db
 *  - өгөхгүй бол (account token шаардана) харилцагч бүрд тусдаа project
 */
export type RailwayMode = "account" | "project" | "off";

export function railwayMode(): RailwayMode {
  if (process.env.RAILWAY_TOKEN) return "account";
  if (process.env.RAILWAY_PROJECT_TOKEN && process.env.RAILWAY_PROJECT_ID) return "project";
  return "off";
}

export function railwayConfigured(): boolean {
  return railwayMode() !== "off";
}

/** Repo холбох боломжтой эсэх — account token л GitHub контексттэй. */
export function railwayCanConnectRepo(): boolean {
  return railwayMode() === "account";
}

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const mode = railwayMode();
  if (mode === "off")
    throw new RailwayError("Railway тохируулаагүй — RAILWAY_TOKEN эсвэл RAILWAY_PROJECT_TOKEN + RAILWAY_PROJECT_ID");
  const auth: Record<string, string> =
    mode === "account"
      ? { Authorization: `Bearer ${process.env.RAILWAY_TOKEN}` }
      : { "Project-Access-Token": process.env.RAILWAY_PROJECT_TOKEN! };
  const response = await fetch(API, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  const json = (await response.json().catch(() => ({}))) as { data?: T; errors?: { message: string }[] };
  if (!response.ok || json.errors?.length)
    throw new RailwayError(`Railway: ${json.errors?.map((e) => e.message).join("; ") || `HTTP ${response.status}`}`);
  return json.data as T;
}

// ── Шалгалт ────────────────────────────────────────────────────────────────

export async function railwayCheck(): Promise<{ mode: RailwayMode; detail: string; canConnectRepo: boolean }> {
  const mode = railwayMode();
  if (mode === "off") return { mode, detail: "тохируулаагүй", canConnectRepo: false };
  const projectId = process.env.RAILWAY_PROJECT_ID;
  let who: string;
  if (mode === "account") {
    // Workspace (team) token-д `me` байхгүй — хувийн token бол email, үгүй бол workspace token гэж үзнэ
    who = await gql<{ me: { email: string } }>(`{ me { email } }`)
      .then((d) => `${d.me.email} (account token)`)
      .catch(() => "workspace token");
  } else {
    const d = await gql<{ projectToken: { projectId: string } }>(`{ projectToken { projectId } }`);
    who = "project token";
    if (d.projectToken.projectId !== projectId) throw new RailwayError("RAILWAY_PROJECT_ID token-ийн project-той таарахгүй");
  }
  if (projectId) {
    // Энэ query token project-д хандах эрхтэй эсэхийг бодитоор шалгана
    const p = await gql<{ project: { name: string; services: { edges: { node: { name: string } }[] } } }>(
      `query($id: String!) { project(id: $id) { name services { edges { node { name } } } } }`,
      { id: projectId }
    );
    return { mode, canConnectRepo: mode === "account", detail: `${who} · project «${p.project.name}» (${p.project.services.edges.length} service) — харилцагч бүр энэ project дотор service хос` };
  }
  if (who === "workspace token") throw new RailwayError("Workspace token-д RAILWAY_PROJECT_ID заавал (шинэ project үүсгэхэд workspace id хэрэгтэй)");
  return { mode, canConnectRepo: true, detail: `${who} — харилцагч бүрд тусдаа project` };
}

/** Project горимд token-ийн project/environment; account горимд шинэ project үүсгэнэ. */
async function resolveProject(slug: string, displayName: string, log: DeployLog): Promise<{ projectId: string; environmentId: string; prefix: string }> {
  const projectId = process.env.RAILWAY_PROJECT_ID;
  if (projectId) {
    let environmentId = process.env.RAILWAY_ENVIRONMENT_ID;
    if (!environmentId) {
      const d = await gql<{ project: { environments: { edges: { node: { id: string; name: string } }[] } } }>(
        `query($id: String!) { project(id: $id) { environments { edges { node { id name } } } } }`,
        { id: projectId }
      );
      const envs = d.project.environments.edges.map((e) => e.node);
      environmentId = (envs.find((e) => e.name === "production") ?? envs[0])?.id;
      if (!environmentId) throw new RailwayError("Project-д environment олдсонгүй");
    }
    // Нэг project дотор олон харилцагч → service нэр угтвартай
    return { projectId, environmentId, prefix: `entry-${slug}` };
  }
  if (railwayMode() !== "account") throw new RailwayError("RAILWAY_PROJECT_ID алга — шинэ project үүсгэхэд account token (RAILWAY_TOKEN) хэрэгтэй");
  log("Railway project үүсгэж байна");
  const workspaceId = process.env.RAILWAY_WORKSPACE_ID || undefined;
  const created = await gql<{ projectCreate: { id: string; environments: { edges: { node: { id: string; name: string } }[] } } }>(
    `mutation($input: ProjectCreateInput!) {
       projectCreate(input: $input) { id environments { edges { node { id name } } } }
     }`,
    { input: { name: `entry-${slug}`, description: `Entry Accounting — ${displayName}`, ...(workspaceId ? { workspaceId } : {}) } }
  );
  const env = created.projectCreate.environments.edges.find((e) => e.node.name === "production")?.node ?? created.projectCreate.environments.edges[0]?.node;
  if (!env) throw new RailwayError("Project-д environment олдсонгүй");
  return { projectId: created.projectCreate.id, environmentId: env.id, prefix: "" };
}

// ── Deploy урсгал ──────────────────────────────────────────────────────────

export interface ExistingService {
  id: string;
  name: string;
  domain: string | null;
  connected: boolean;
}

/** Project доторх service-үүд (нэрээр дахин ашиглах — deploy дундаа унасан бол давхардуулахгүй). */
export async function listProjectServices(projectId: string, environmentId: string): Promise<ExistingService[]> {
  const d = await gql<{
    project: {
      services: {
        edges: {
          node: {
            id: string;
            name: string;
            serviceInstances: { edges: { node: { environmentId: string; domains: { serviceDomains: { domain: string }[] }; source: { repo: string | null; image: string | null } | null } }[] };
          };
        }[];
      };
    };
  }>(
    `query($id: String!) {
       project(id: $id) {
         services { edges { node { id name
           serviceInstances { edges { node { environmentId domains { serviceDomains { domain } } source { repo image } } } } } } }
       }
     }`,
    { id: projectId }
  );
  return d.project.services.edges.map(({ node }) => {
    const inst = node.serviceInstances.edges.find((e) => e.node.environmentId === environmentId)?.node;
    return {
      id: node.id,
      name: node.name,
      domain: inst?.domains.serviceDomains[0]?.domain ?? null,
      connected: !!(inst?.source?.repo || inst?.source?.image),
    };
  });
}

export interface RailwayDeployment {
  projectId: string;
  environmentId: string;
  postgresServiceId: string;
  appServiceId: string;
  domain: string;
  /** GitHub repo холбогдож build эхэлсэн эсэх — үгүй бол connectError-д шалтгаан */
  connected: boolean;
  connectError: string | null;
}

/** Service-д GitHub repo холбоно (build тэр дороо эхэлнэ). Account token шаардана. */
export async function connectRepo(serviceId: string, repo: string, branch = "main"): Promise<void> {
  if (!railwayCanConnectRepo())
    throw new RailwayError("Project token GitHub repo холбож чадахгүй — entry-console-д RAILWAY_TOKEN (account token) нэм, эсвэл Railway → service → Settings → Source-оос гараар холбо");
  await gql(
    `mutation($id: String!, $input: ServiceConnectInput!) { serviceConnect(id: $id, input: $input) { id } }`,
    { id: serviceId, input: { repo, branch } }
  );
}

export interface DeployLog {
  (step: string): void;
}

/**
 * Харилцагчийн repo-г Railway-д бүрэн deploy хийнэ. Project горимд нэрээр
 * (entry-<slug>, entry-<slug>-db) байгаа service-ийг дахин ашигладаг тул
 * дундаа унасан оролдлогыг аюулгүй давтаж болно. Account горимд шинэ project
 * үүсгэнэ — дуудагч railwayProjectId байхгүй үед л дуудна.
 */
export async function deployCustomer(input: {
  slug: string;
  displayName: string;
  githubRepo: string;
  branch?: string;
}, log: DeployLog = () => {}): Promise<RailwayDeployment> {
  const branch = input.branch ?? "main";

  // 1. Project (account горим: шинэ; project горим: token-ийн project)
  const { projectId, environmentId, prefix } = await resolveProject(input.slug, input.displayName, log);
  const pgName = prefix ? `${prefix}-db` : "Postgres";
  const appName = prefix || "entry-accounting";

  const existing = prefix ? await listProjectServices(projectId, environmentId) : [];
  const byName = (name: string) => existing.find((s) => s.name === name);

  // 2. Postgres — docker image + volume; DATABASE_URL-ийг өөр дээрээ variable болгоно
  let postgresServiceId: string;
  const pgExisting = byName(pgName);
  if (pgExisting) {
    log(`Postgres «${pgName}» аль хэдийн бий — дахин ашиглана`);
    postgresServiceId = pgExisting.id;
  } else {
    log("Postgres үүсгэж байна");
    const pgPassword = randomBytes(24).toString("base64url");
    const pg = await gql<{ serviceCreate: { id: string } }>(
      `mutation($input: ServiceCreateInput!) { serviceCreate(input: $input) { id } }`,
      {
        input: {
          projectId,
          name: pgName,
          source: { image: "postgres:16-alpine" },
          variables: {
            POSTGRES_USER: "entry",
            POSTGRES_PASSWORD: pgPassword,
            POSTGRES_DB: "entry",
            PGDATA: "/var/lib/postgresql/data/pgdata",
            DATABASE_URL: "postgresql://entry:" + pgPassword + "@${{RAILWAY_PRIVATE_DOMAIN}}:5432/entry",
          },
        },
      }
    );
    postgresServiceId = pg.serviceCreate.id;
    await gql(
      `mutation($input: VolumeCreateInput!) { volumeCreate(input: $input) { id } }`,
      { input: { projectId, serviceId: postgresServiceId, environmentId, mountPath: "/var/lib/postgresql/data" } }
    );
  }

  // 3. App service — эхлээд хоосон (source-гүй), variables + domain тавьсны ДАРАА repo холбоно
  //    (эхний build бүх variable-тай явахын тулд)
  let appServiceId: string;
  const appExisting = byName(appName);
  if (appExisting) {
    log(`App service «${appName}» аль хэдийн бий — дахин ашиглана`);
    appServiceId = appExisting.id;
  } else {
    log("App service үүсгэж байна");
    const app = await gql<{ serviceCreate: { id: string } }>(
      `mutation($input: ServiceCreateInput!) { serviceCreate(input: $input) { id } }`,
      { input: { projectId, name: appName } }
    );
    appServiceId = app.serviceCreate.id;
  }

  let domain = appExisting?.domain ?? null;
  if (!domain) {
    log("Domain үүсгэж байна");
    const dom = await gql<{ serviceDomainCreate: { domain: string } }>(
      `mutation($input: ServiceDomainCreateInput!) { serviceDomainCreate(input: $input) { id domain } }`,
      { input: { serviceId: appServiceId, environmentId } }
    );
    domain = dom.serviceDomainCreate.domain;
  }

  log("Variables тавьж байна");
  await gql(
    `mutation($input: VariableCollectionUpsertInput!) { variableCollectionUpsert(input: $input) }`,
    {
      input: {
        projectId,
        environmentId,
        serviceId: appServiceId,
        skipDeploys: true,
        variables: {
          DATABASE_URL: "${{" + pgName + ".DATABASE_URL}}",
          NEXT_PUBLIC_APP_URL: `https://${domain}`,
          NODE_ENV: "production",
          // NextAuth v5 нь proxy-ийн ард host-оо итгэдэггүй — үүнгүйгээр
          // нэвтрэх/бүртгүүлэх «UntrustedHost»-оор унана. Core дээр
          // trustHost: true болсон ч хуучин хувилбар дээрх (эсвэл sync
          // аваагүй) харилцагч ажиллахын тулд энд ч тавина.
          AUTH_TRUST_HOST: "true",
          // AUTH_SECRET-ийг дахин deploy-д солихгүй (session-ууд хүчингүй болно)
          ...(appExisting ? {} : { AUTH_SECRET: randomBytes(32).toString("base64") }),
        },
      },
    }
  );

  // Healthcheck + pre-deploy (db:push) — repo-ийн railway.toml-той ижил, ил тавина
  try {
    await gql(
      `mutation($serviceId: String!, $environmentId: String!, $input: ServiceInstanceUpdateInput!) {
         serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId, input: $input)
       }`,
      { serviceId: appServiceId, environmentId, input: { healthcheckPath: "/api/health", healthcheckTimeout: 60, preDeployCommand: ["npm run db:push"], restartPolicyType: "ON_FAILURE", restartPolicyMaxRetries: 5 } }
    );
  } catch {
    // preDeployCommand талбар дэмжигдэхгүй бол railway.toml-оос уншигдана
  }

  let connected = false;
  let connectError: string | null = null;
  if (appExisting?.connected) {
    log("Repo аль хэдийн холбогдсон — дахин deploy");
    await redeployService(appServiceId, environmentId);
    connected = true;
  } else {
    log("GitHub repo холбож deploy эхлүүлж байна");
    try {
      await connectRepo(appServiceId, input.githubRepo, branch);
      connected = true;
    } catch (error) {
      // Service, DB, domain, variables бүгд бэлэн — зөвхөн repo холболт дутуу.
      connectError = error instanceof Error ? error.message : String(error);
    }
  }

  return { projectId, environmentId, postgresServiceId, appServiceId, domain, connected, connectError };
}

export interface RailwayStatus {
  status: string;
  createdAt: string;
  deploymentId: string;
}

export async function latestDeployment(projectId: string, environmentId: string, serviceId: string): Promise<RailwayStatus | null> {
  const d = await gql<{ deployments: { edges: { node: { id: string; status: string; createdAt: string } }[] } }>(
    `query($input: DeploymentListInput!) { deployments(input: $input, first: 1) { edges { node { id status createdAt } } } }`,
    { input: { projectId, environmentId, serviceId } }
  );
  const node = d.deployments.edges[0]?.node;
  return node ? { deploymentId: node.id, status: node.status, createdAt: node.createdAt } : null;
}

export async function redeployService(serviceId: string, environmentId: string): Promise<void> {
  await gql(
    `mutation($serviceId: String!, $environmentId: String!) { serviceInstanceDeployV2(serviceId: $serviceId, environmentId: $environmentId) }`,
    { serviceId, environmentId }
  );
}

export interface VolumeInstanceInfo {
  id: string;
  volumeId: string;
  serviceId: string | null;
  sizeMB: number;
}

/** Environment доторх volume instance-ууд (service-д холбоотой эсвэл салангид). */
export async function listVolumeInstances(projectId: string, environmentId: string): Promise<VolumeInstanceInfo[]> {
  const d = await gql<{ project: { environments: { edges: { node: { id: string; volumeInstances: { edges: { node: { id: string; volumeId: string; serviceId: string | null; currentSizeMB: number } }[] } } }[] } } }>(
    `query($id: String!) { project(id: $id) { environments { edges { node { id volumeInstances { edges { node { id volumeId serviceId currentSizeMB } } } } } } } }`,
    { id: projectId }
  );
  const env = d.project.environments.edges.find((e) => e.node.id === environmentId)?.node;
  return (env?.volumeInstances.edges ?? []).map((e) => ({ id: e.node.id, volumeId: e.node.volumeId, serviceId: e.node.serviceId, sizeMB: e.node.currentSizeMB }));
}

export async function volumeInstanceForService(projectId: string, environmentId: string, serviceId: string): Promise<string | null> {
  const list = await listVolumeInstances(projectId, environmentId);
  return list.find((v) => v.serviceId === serviceId)?.id ?? null;
}

/**
 * Service-ийг volume-тэй нь хамт бүрмөсөн устгана. Account/workspace token
 * шаардана (project token устгах эрхгүй). Байхгүй service-ийг алгасна.
 */
export async function deleteService(projectId: string, environmentId: string, serviceId: string): Promise<void> {
  if (!railwayCanConnectRepo())
    throw new RailwayError("Project token service устгаж чадахгүй — RAILWAY_TOKEN (account token) хэрэгтэй");
  const volumes = await listVolumeInstances(projectId, environmentId).catch(() => [] as VolumeInstanceInfo[]);
  for (const v of volumes.filter((v) => v.serviceId === serviceId))
    await gql(`mutation($id: String!) { volumeDelete(volumeId: $id) }`, { id: v.volumeId });
  try {
    await gql(`mutation($id: String!) { serviceDelete(id: $id) }`, { id: serviceId });
  } catch (error) {
    // Аль хэдийн устсан бол амжилттай гэж үзнэ
    if (!/not found|does not exist/i.test(error instanceof Error ? error.message : "")) throw error;
  }
}

/** Ямар ч service-д холбоогүй (салангид) volume-уудыг устгана — зардал хэмнэнэ. */
export async function deleteOrphanVolumes(projectId: string, environmentId: string): Promise<number> {
  const list = await listVolumeInstances(projectId, environmentId);
  let n = 0;
  for (const v of list.filter((v) => !v.serviceId)) {
    await gql(`mutation($id: String!) { volumeDelete(volumeId: $id) }`, { id: v.volumeId });
    n += 1;
  }
  return n;
}

// ── Нөөцлөлт (Railway volume backup) ────────────────────────────────────────

export type BackupKind = "DAILY" | "WEEKLY" | "MONTHLY";
export const DEFAULT_BACKUP_KINDS: BackupKind[] = ["DAILY", "WEEKLY"];

export async function setBackupSchedule(volumeInstanceId: string, kinds: BackupKind[]): Promise<void> {
  await gql(
    `mutation($id: String!, $kinds: [VolumeInstanceBackupScheduleKind!]!) { volumeInstanceBackupScheduleUpdate(volumeInstanceId: $id, kinds: $kinds) }`,
    { id: volumeInstanceId, kinds }
  );
}

export interface BackupStatus {
  kinds: string[];
  count: number;
  lastBackupAt: string | null;
}

export async function getBackupStatus(volumeInstanceId: string): Promise<BackupStatus> {
  const d = await gql<{ volumeInstanceBackupScheduleList: { kind: string }[]; volumeInstanceBackupList: { createdAt: string }[] }>(
    `query($id: String!) {
       volumeInstanceBackupScheduleList(volumeInstanceId: $id) { kind }
       volumeInstanceBackupList(volumeInstanceId: $id) { createdAt }
     }`,
    { id: volumeInstanceId }
  );
  const dates = d.volumeInstanceBackupList.map((b) => b.createdAt).sort();
  return { kinds: d.volumeInstanceBackupScheduleList.map((s) => s.kind), count: dates.length, lastBackupAt: dates[dates.length - 1] ?? null };
}

export async function createBackup(volumeInstanceId: string, name: string): Promise<void> {
  await gql(`mutation($id: String!, $name: String!) { volumeInstanceBackupCreate(volumeInstanceId: $id, name: $name) }`, { id: volumeInstanceId, name });
}

// ── Custom domain ───────────────────────────────────────────────────────────

export interface DnsRecord {
  hostlabel: string;
  fqdn: string;
  recordType: string;
  requiredValue: string;
  currentValue: string | null;
  status: string;
}

export interface CustomDomainInfo {
  id: string;
  domain: string;
  verified: boolean;
  certificateStatus: string | null;
  dns: DnsRecord[];
}

const DOMAIN_FIELDS = `id domain status { verified certificateStatus dnsRecords { hostlabel fqdn recordType requiredValue currentValue status } }`;
type DomainNode = { id: string; domain: string; status: { verified: boolean; certificateStatus: string | null; dnsRecords: DnsRecord[] } };
const toDomainInfo = (n: DomainNode): CustomDomainInfo => ({ id: n.id, domain: n.domain, verified: !!n.status?.verified, certificateStatus: n.status?.certificateStatus ?? null, dns: n.status?.dnsRecords ?? [] });

export async function createCustomDomain(projectId: string, environmentId: string, serviceId: string, domain: string): Promise<CustomDomainInfo> {
  const d = await gql<{ customDomainCreate: DomainNode }>(
    `mutation($input: CustomDomainCreateInput!) { customDomainCreate(input: $input) { ${DOMAIN_FIELDS} } }`,
    { input: { projectId, environmentId, serviceId, domain } }
  );
  return toDomainInfo(d.customDomainCreate);
}

export async function getCustomDomain(id: string, projectId: string): Promise<CustomDomainInfo> {
  const d = await gql<{ customDomain: DomainNode }>(`query($id: String!, $p: String!) { customDomain(id: $id, projectId: $p) { ${DOMAIN_FIELDS} } }`, { id, p: projectId });
  return toDomainInfo(d.customDomain);
}

export async function deleteCustomDomain(id: string): Promise<void> {
  await gql(`mutation($id: String!) { customDomainDelete(id: $id) }`, { id });
}

// ── Зогсоох / сэргээх ──────────────────────────────────────────────────────

const RUNNING = new Set(["SUCCESS", "DEPLOYING", "BUILDING", "INITIALIZING", "QUEUED", "WAITING", "SLEEPING"]);

/** Идэвхтэй deployment-ийг устгана — service зогсоно (volume, variable хэвээр). */
export async function stopService(projectId: string, environmentId: string, serviceId: string): Promise<boolean> {
  const latest = await latestDeployment(projectId, environmentId, serviceId);
  if (!latest || !RUNNING.has(latest.status)) return false;
  await gql(`mutation($id: String!) { deploymentRemove(id: $id) }`, { id: latest.deploymentId });
  return true;
}

/** Service-ийн variable-уудыг нэмж/солино. */
export async function upsertVariables(projectId: string, environmentId: string, serviceId: string, variables: Record<string, string>, skipDeploys = true): Promise<void> {
  await gql(
    `mutation($input: VariableCollectionUpsertInput!) { variableCollectionUpsert(input: $input) }`,
    { input: { projectId, environmentId, serviceId, skipDeploys, variables } }
  );
}

// ── Хяналтын cron service (console-ийн /api/cron/check-ийг 5 мин тутам дуудна) ─

export const MONITOR_SERVICE_NAME = "entry-console-monitor";

export async function findServiceByName(projectId: string, environmentId: string, name: string): Promise<ExistingService | null> {
  const list = await listProjectServices(projectId, environmentId);
  return list.find((s) => s.name === name) ?? null;
}

/**
 * curl image-тэй cron service үүсгэнэ. CONSOLE_API_KEY-г console service-ийн
 * variable-аас reference хийнэ (утга нь Railway-аас гарахгүй).
 */
export async function ensureMonitorService(input: { projectId: string; environmentId: string; consoleServiceName: string; consoleUrl: string; schedule?: string }): Promise<{ serviceId: string; created: boolean }> {
  const existing = await findServiceByName(input.projectId, input.environmentId, MONITOR_SERVICE_NAME);
  if (existing) return { serviceId: existing.id, created: false };
  const created = await gql<{ serviceCreate: { id: string } }>(
    `mutation($input: ServiceCreateInput!) { serviceCreate(input: $input) { id } }`,
    {
      input: {
        projectId: input.projectId,
        name: MONITOR_SERVICE_NAME,
        source: { image: "curlimages/curl:8.10.1" },
        variables: {
          CONSOLE_URL: input.consoleUrl,
          CONSOLE_API_KEY: "${{" + input.consoleServiceName + ".CONSOLE_API_KEY}}",
        },
      },
    }
  );
  const serviceId = created.serviceCreate.id;
  await gql(
    `mutation($serviceId: String!, $environmentId: String!, $input: ServiceInstanceUpdateInput!) {
       serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId, input: $input)
     }`,
    {
      serviceId,
      environmentId: input.environmentId,
      input: {
        cronSchedule: input.schedule ?? "*/5 * * * *",
        startCommand: 'sh -c \'curl -fsS -m 240 -X POST -H "Authorization: Bearer $CONSOLE_API_KEY" "$CONSOLE_URL/api/cron/check"\'',
        restartPolicyType: "NEVER",
      },
    }
  );
  await redeployService(serviceId, input.environmentId);
  return { serviceId, created: true };
}

export function railwayProjectUrl(projectId: string, serviceId?: string): string {
  return serviceId ? `https://railway.com/project/${projectId}/service/${serviceId}` : `https://railway.com/project/${projectId}`;
}
