// Харилцагч үүсгэх ЦӨМ логик — server action (маягт) ба REST (/api/customers)
// хоёулаа энийг дуудна: шалгалт → core workflow dispatch → DB бүртгэл.
import { config } from "./config";
import { getCustomerBySlug, logEvent } from "./customers";
import { db } from "./db";
import { CUSTOMER_PLANS, customers, type Customer, type CustomerPlan } from "./db/schema";
import { dispatchWorkflow, getCustomerRepo, getDefaultBranch } from "./github";
import { railwayConfigured } from "./railway";

export interface ProvisionInput {
  slug: string;
  displayName: string;
  registerNo?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  githubUsers?: string;
  appUrl?: string;
  ref?: string;
  plan?: string;
  monthlyFee?: string;
  /** Repo бэлэн болмогц Railway-д автоматаар deploy (Railway тохируулсан үед) */
  autoDeploy?: boolean | string;
}

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,30}$/;

export class ProvisionError extends Error {}

export async function provision(input: ProvisionInput): Promise<Customer> {
  const slug = input.slug.trim().toLowerCase();
  const displayName = input.displayName.trim();
  const githubUsers = (input.githubUsers ?? "").trim();
  const appUrl = (input.appUrl ?? "").trim();
  const ref = (input.ref ?? "").trim() || "main";
  const plan = ((input.plan ?? "pilot").trim() || "pilot") as CustomerPlan;
  const monthlyFee = (input.monthlyFee ?? "0").trim() || "0";
  const autoDeploy = railwayConfigured() && (input.autoDeploy === true || input.autoDeploy === "on" || input.autoDeploy === "true");

  if (!SLUG_RE.test(slug)) throw new ProvisionError("Код зөвхөн жижиг латин үсэг, тоо, зураас (2–31 тэмдэгт)");
  if (!displayName) throw new ProvisionError("Харилцагчийн нэр хоосон байна");
  if (appUrl && !/^https?:\/\//.test(appUrl)) throw new ProvisionError("App URL https://-ээр эхлэх ёстой");
  if (!CUSTOMER_PLANS.includes(plan)) throw new ProvisionError("Багц буруу");
  if (!/^\d+(\.\d{1,2})?$/.test(monthlyFee)) throw new ProvisionError("Сарын төлбөр тоо байх ёстой");
  if (await getCustomerBySlug(slug)) throw new ProvisionError(`"${slug}" код аль хэдийн бүртгэлтэй`);
  if (await getCustomerRepo(slug))
    throw new ProvisionError(`${config.repoPrefix}${slug} repo аль хэдийн бий — самбар нээхэд автоматаар бүртгэгдэнэ`);

  const branch = await getDefaultBranch(config.coreRepo);
  await dispatchWorkflow(config.coreRepo, "provision-customer.yml", branch, {
    slug,
    display_name: displayName,
    github_users: githubUsers,
    app_url: appUrl,
    ref,
  });

  const [created] = await db
    .insert(customers)
    .values({
      slug,
      displayName,
      registerNo: input.registerNo?.trim() || null,
      contactName: input.contactName?.trim() || null,
      contactEmail: input.contactEmail?.trim() || null,
      contactPhone: input.contactPhone?.trim() || null,
      githubRepo: `${config.owner}/${config.repoPrefix}${slug}`,
      githubUsers: githubUsers || null,
      appUrl: appUrl || null,
      seededRef: ref,
      plan,
      monthlyFee,
      status: "provisioning",
      autoDeploy,
    })
    .returning();
  await logEvent(created.id, "provisioned", `Repo үүсгэх ажил эхэллээ (core ${ref})${autoDeploy ? " · repo бэлэн болмогц Railway deploy" : ""}`);
  return created;
}
