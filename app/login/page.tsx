import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { hasSession } from "@/lib/auth";

export default async function LoginPage() {
  if (await hasSession()) redirect("/");
  return (
    <div className="mx-auto mt-16 max-w-sm">
      <div className="card p-6">
        <h1 className="mb-1 text-base font-semibold">Нэвтрэх</h1>
        <p className="mb-5 text-sm text-text-3">Entry-ийн харилцагчийн удирдлага — зөвхөн админ.</p>
        <LoginForm />
      </div>
    </div>
  );
}
