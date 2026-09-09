import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { hasSession } from "@/lib/auth";

export const metadata = { title: "Нэвтрэх" };

export default async function LoginPage() {
  if (await hasSession()) redirect("/");
  return (
    <div className="mx-auto mt-16 max-w-sm">
      <div className="card p-6">
        <div className="mb-5 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-base font-bold text-primary-fg">E</span>
          <div>
            <h1 className="text-base font-semibold leading-tight">Entry Console</h1>
            <p className="text-xs text-text-3">Харилцагчийн удирдлага · зөвхөн админ</p>
          </div>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
