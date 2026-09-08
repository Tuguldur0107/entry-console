"use client";

import { useActionState } from "react";

import { login } from "@/lib/actions";
import { Notice } from "./forms";

export function LoginForm() {
  const [result, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="password">Нууц үг</label>
        <input id="password" name="password" type="password" className="input" autoFocus required />
      </div>
      <Notice result={result} />
      <button className="btn btn-primary w-full justify-center" type="submit" disabled={pending}>
        {pending ? "…" : "Нэвтрэх"}
      </button>
    </form>
  );
}
