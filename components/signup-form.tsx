"use client";

import { useActionState, useState } from "react";

import { submitSignupRequest } from "@/lib/actions";
import { Notice } from "./forms";

// Кирилл → латин (lib/signup.ts slugify-тай ижил — зөвхөн урьдчилан харуулахад)
const CYR: Record<string, string> = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"yo",ж:"j",з:"z",и:"i",й:"i",к:"k",л:"l",м:"m",н:"n",о:"o",ө:"u",п:"p",р:"r",с:"s",т:"t",у:"u",ү:"u",ф:"f",х:"kh",ц:"ts",ч:"ch",ш:"sh",щ:"sh",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya" };
const LEGAL_RE = /\b(ххк|хк|төхк|төүг|хзх|ббсб|онөаатүг|ноаатүг|тбб|llc|jsc|ltd|inc|co)\.?\b/gi;
const slugify = (s: string) => s.toLowerCase().replace(LEGAL_RE, " ").split("").map((c) => CYR[c] ?? c).join("").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 31);

export function SignupForm({ baseDomain }: { baseDomain: string | null }) {
  const [result, action, pending] = useActionState(submitSignupRequest, null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);
  const shown = touched ? slug : slugify(name);
  const slugOk = !shown || /^[a-z0-9][a-z0-9-]{1,30}$/.test(shown);
  return (
    <form action={action} className="space-y-4">
      {/* honeypot — хүн харахгүй, бот бөглөнө */}
      <div className="absolute -left-[9999px] top-0" aria-hidden="true">
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="company_name">Компанийн нэр *</label>
          <input id="company_name" name="company_name" className="input" required minLength={2} maxLength={120} placeholder="Говь ХК" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="register_no">Регистр / ТТД</label>
          <input id="register_no" name="register_no" className="input" placeholder="2107091" />
        </div>
        <div>
          <label className="label" htmlFor="slug">Системийн хаяг</label>
          <div className="flex items-center gap-1">
            <input id="slug" name="slug" className="input mono" placeholder={slugify(name) || "govi"} pattern="[a-z0-9][a-z0-9-]{1,30}" value={touched ? slug : ""} aria-invalid={!slugOk || undefined}
              onChange={(e) => { setTouched(true); setSlug(e.target.value.toLowerCase()); }} />
          </div>
          <p className="hint mt-1">{shown && slugOk ? <span className="mono">{baseDomain ? `${shown}.${baseDomain}` : `entry-${shown}`}</span> : "Хоосон бол нэрээс автоматаар"}</p>
        </div>
        <div>
          <label className="label" htmlFor="contact_name">Холбоо барих хүн *</label>
          <input id="contact_name" name="contact_name" className="input" required minLength={2} placeholder="Б.Бат, нягтлан" />
        </div>
        <div>
          <label className="label" htmlFor="phone">Утас</label>
          <input id="phone" name="phone" className="input" type="tel" placeholder="9911-2233" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="email">Имэйл *</label>
          <input id="email" name="email" className="input" type="email" required placeholder="bat@govi.mn" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="note">Тайлбар</label>
          <textarea id="note" name="note" className="textarea" rows={3} maxLength={2000} placeholder="Үйл ажиллагааны чиглэл, ажилтны тоо, одоо ямар программ ашигладаг…" />
        </div>
      </div>
      <Notice result={result} />
      <button className="btn btn-primary w-full" type="submit" disabled={pending || !slugOk}>{pending ? "Илгээж байна…" : "Хүсэлт илгээх"}</button>
      <p className="text-center text-xs text-text-3">Хүсэлтийг бид гараар баталгаажуулж, таны системийг бэлдээд имэйл/утсаар холбогдоно.</p>
    </form>
  );
}
