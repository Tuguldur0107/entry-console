// Орчны хувьсагч — нэг газраас, дутуу бол ойлгомжтой алдаа.

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} орчны хувьсагч тохируулаагүй (.env.example)`);
  return value;
}

export const config = {
  get password() {
    return required("CONSOLE_PASSWORD");
  },
  get authSecret() {
    return required("AUTH_SECRET");
  },
  get githubToken() {
    return required("GITHUB_TOKEN");
  },
  owner: process.env.GITHUB_OWNER ?? "Tuguldur0107",
  ownerType: (process.env.GITHUB_OWNER_TYPE === "org" ? "org" : "user") as "user" | "org",
  coreRepo: process.env.CORE_REPO ?? "Tuguldur0107/entry-accounting",
  /** Харилцагчийн repo-г таних topic (provision-customer.yml тавьдаг). */
  customerTopic: "entry-customer",
  repoPrefix: "entry-",
};
