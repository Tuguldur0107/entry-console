"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { checkPassword, createSession, destroySession, requireSession } from "./auth";
import { config } from "./config";
import {
  dispatchWorkflow,
  getCustomerRepo,
  getDefaultBranch,
  getLatestRelease,
  GitHubError,
  inviteCollaborator,
  setVariable,
} from "./github";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

function errorText(error: unknown): string {
  if (error instanceof GitHubError) return error.message;
  return error instanceof Error ? error.message : String(error);
}

export async function login(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const password = String(formData.get("password") ?? "");
  if (!password || !checkPassword(password)) return { ok: false, error: "Нууц үг буруу" };
  await createSession();
  redirect("/");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,30}$/;

/** "Харилцагч нэмэх" → core repo-ийн provision-customer.yml workflow_dispatch. */
export async function provisionCustomer(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const displayName = String(formData.get("display_name") ?? "").trim();
  const githubUsers = String(formData.get("github_users") ?? "").trim();
  const appUrl = String(formData.get("app_url") ?? "").trim();
  const ref = String(formData.get("ref") ?? "main").trim() || "main";

  if (!SLUG_RE.test(slug))
    return { ok: false, error: "Код зөвхөн жижиг латин үсэг, тоо, зураас (2–31 тэмдэгт)" };
  if (!displayName) return { ok: false, error: "Харилцагчийн нэр хоосон байна" };
  if (appUrl && !/^https?:\/\//.test(appUrl)) return { ok: false, error: "App URL https://-ээр эхлэх ёстой" };
  if (await getCustomerRepo(slug))
    return { ok: false, error: `${config.repoPrefix}${slug} repo аль хэдийн бий` };

  try {
    const branch = await getDefaultBranch(config.coreRepo);
    await dispatchWorkflow(config.coreRepo, "provision-customer.yml", branch, {
      slug,
      display_name: displayName,
      github_users: githubUsers,
      app_url: appUrl,
      ref,
    });
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
  redirect(`/?provisioning=${encodeURIComponent(slug)}`);
}

/** Харилцагчийн repo дээр upstream-sync.yml-ийг заасан ref-ээр ажиллуулна. */
export async function syncCustomer(slug: string, ref?: string): Promise<ActionResult> {
  await requireSession();
  const repo = await getCustomerRepo(slug);
  if (!repo) return { ok: false, error: "Харилцагч олдсонгүй" };
  try {
    const target = ref?.trim() || (await getLatestRelease())?.tagName || "main";
    const branch = await getDefaultBranch(repo.fullName);
    await dispatchWorkflow(repo.fullName, "upstream-sync.yml", branch, { ref: target });
    revalidatePath(`/customers/${slug}`);
    return { ok: true, message: `Sync эхэллээ: ${target} → PR нээгдэнэ (1–2 мин)` };
  } catch (error) {
    if (error instanceof GitHubError && error.status === 404)
      return {
        ok: false,
        error: "upstream-sync.yml энэ repo-д алга — харилцагчийн repo хуучин core-оос seed хийгдсэн байна",
      };
    return { ok: false, error: errorText(error) };
  }
}

export async function inviteUser(
  slug: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireSession();
  const username = String(formData.get("username") ?? "").trim().replace(/^@/, "");
  const permission = String(formData.get("permission") ?? "push");
  if (!/^[A-Za-z0-9-]{1,39}$/.test(username)) return { ok: false, error: "GitHub нэр буруу" };
  if (!["pull", "push", "admin"].includes(permission)) return { ok: false, error: "Эрх буруу" };
  const repo = await getCustomerRepo(slug);
  if (!repo) return { ok: false, error: "Харилцагч олдсонгүй" };
  try {
    await inviteCollaborator(repo.fullName, username, permission as "pull" | "push" | "admin");
    revalidatePath(`/customers/${slug}`);
    return { ok: true, message: `${username} уригдлаа (${permission})` };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

export async function saveAppUrl(
  slug: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireSession();
  const appUrl = String(formData.get("app_url") ?? "").trim();
  const displayName = String(formData.get("display_name") ?? "").trim();
  if (appUrl && !/^https?:\/\//.test(appUrl)) return { ok: false, error: "URL https://-ээр эхлэх ёстой" };
  const repo = await getCustomerRepo(slug);
  if (!repo) return { ok: false, error: "Харилцагч олдсонгүй" };
  try {
    await setVariable(repo.fullName, "ENTRY_APP_URL", appUrl);
    if (displayName) await setVariable(repo.fullName, "ENTRY_DISPLAY_NAME", displayName);
    revalidatePath(`/customers/${slug}`);
    revalidatePath("/");
    return { ok: true, message: "Хадгалагдлаа" };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}
