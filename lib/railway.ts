// Railway Public API (GraphQL) — харилцагчийн Entry-г нэг товчоор deploy:
//   project → Postgres (docker image + volume) → app service (GitHub repo)
//   → variables → domain → deploy. Token: RAILWAY_TOKEN (Account/Team token,
//   Railway → Account settings → Tokens), RAILWAY_WORKSPACE_ID (сонголтоор).
import { randomBytes } from "node:crypto";

const API = "https://backboard.railway.com/graphql/v2";

export class RailwayError extends Error {}

/**
 * Хоёр горим:
 *  - project:  RAILWAY_PROJECT_TOKEN + RAILWAY_PROJECT_ID (+ RAILWAY_ENVIRONMENT_ID) —
 *              харилцагч бүр НЭГ project дотор тусдаа service хос (app + Postgres).
 *              Project token хангалттай (Railway project → Settings → Tokens).
 *  - account:  RAILWAY_TOKEN (Account/Team token) — харилцагч бүрд тусдаа project.
 */
export type RailwayMode = "project" | "account" | "off";

export function railwayMode(): RailwayMode {
  if (process.env.RAILWAY_PROJECT_TOKEN && process.env.RAILWAY_PROJECT_ID) return "project";
  if (process.env.RAILWAY_TOKEN) return "account";
  return "off";
}

export function railwayConfigured(): boolean {
  return railwayMode() !== "off";
}

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const mode = railwayMode();
  if (mode === "off")
    throw new RailwayError("Railway тохируулаагүй — RAILWAY_PROJECT_TOKEN + RAILWAY_PROJECT_ID эсвэл RAILWAY_TOKEN");
  const auth: Record<string, string> =
    mode === "project"
      ? { "Project-Access-Token": process.env.RAILWAY_PROJECT_TOKEN! }
      : { Authorization: `Bearer ${process.env.RAILWAY_TOKEN}` };
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

export async function railwayCheck(): Promise<{ mode: RailwayMode; detail: string }> {
  const mode = railwayMode();
  if (mode === "off") return { mode, detail: "тохируулаагүй" };
  if (mode === "project") {
    const d = await gql<{ projectToken: { projectId: string; environmentId: string } }>(`{ projectToken { projectId environmentId } }`);
    const p = await gql<{ project: { name: string; services: { edges: { node: { name: string } }[] } } }>(
      `query($id: String!) { project(id: $id) { name services { edges { node { name } } } } }`,
      { id: d.projectToken.projectId }
    );
    return { mode, detail: `project «${p.project.name}» (${p.project.services.edges.length} service) — харилцагч бүр энэ project дотор service хос болно` };
  }
  const d = await gql<{ me: { name: string; email: string; workspaces: { id: string; name: string }[] } }>(`{ me { name email workspaces { id name } } }`);
  return { mode, detail: `${d.me.email} · workspace: ${d.me.workspaces.map((w) => w.name).join(", ")} — харилцагч бүрд тусдаа project` };
}

/** Project горимд token-ийн project/environment; account горимд шинэ project үүсгэнэ. */
async function resolveProject(slug: string, displayName: string, log: DeployLog): Promise<{ projectId: string; environmentId: string; prefix: string }> {
  if (railwayMode() === "project") {
    const projectId = process.env.RAILWAY_PROJECT_ID!;
    let environmentId = process.env.RAILWAY_ENVIRONMENT_ID;
    if (!environmentId) {
      const d = await gql<{ projectToken: { environmentId: string } }>(`{ projectToken { environmentId } }`);
      environmentId = d.projectToken.environmentId;
    }
    // Нэг project дотор олон харилцагч → service нэр угтвартай
    return { projectId, environmentId, prefix: `entry-${slug}` };
  }
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

interface ExistingService {
  id: string;
  name: string;
  domain: string | null;
  connected: boolean;
}

/** Project доторх service-үүд (нэрээр дахин ашиглах — deploy дундаа унасан бол давхардуулахгүй). */
async function listProjectServices(projectId: string, environmentId: string): Promise<ExistingService[]> {
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

  if (appExisting?.connected) {
    log("Repo аль хэдийн холбогдсон — дахин deploy");
    await redeployService(appServiceId, environmentId);
  } else {
    log("GitHub repo холбож deploy эхлүүлж байна");
    await gql(
      `mutation($id: String!, $input: ServiceConnectInput!) { serviceConnect(id: $id, input: $input) { id } }`,
      { id: appServiceId, input: { repo: input.githubRepo, branch } }
    );
  }

  return { projectId, environmentId, postgresServiceId, appServiceId, domain };
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

export function railwayProjectUrl(projectId: string, serviceId?: string): string {
  return serviceId ? `https://railway.com/project/${projectId}/service/${serviceId}` : `https://railway.com/project/${projectId}`;
}
