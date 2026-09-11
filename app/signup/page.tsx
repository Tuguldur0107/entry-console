import { SignupForm } from "@/components/signup-form";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Бүртгүүлэх · Entry Accounting" };

/** НЭЭЛТТЭЙ хуудас — session шаардахгүй. Хүсэлт → console-д «Хүсэлт» төлөвтэй бүртгэл. */
export default function SignupPage() {
  return (
    <div className="mx-auto mt-8 max-w-xl pb-12">
      <div className="mb-6 text-center">
        <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-primary text-lg font-bold text-primary-fg">E</span>
        <h1 className="text-xl font-semibold tracking-tight">Entry Accounting-д бүртгүүлэх</h1>
        <p className="mt-1 text-sm text-text-3">Монгол нягтлан бодох бүртгэлийн систем — компани бүрд тусдаа, хаалттай орчин.</p>
      </div>
      <div className="card p-6">
        <SignupForm baseDomain={config.baseDomain} />
      </div>
      <ol className="mt-6 grid gap-2 text-sm text-text-2 sm:grid-cols-3">
        <li className="card p-3"><span className="mono text-text-3">1</span> Хүсэлт илгээнэ</li>
        <li className="card p-3"><span className="mono text-text-3">2</span> Бид баталгаажуулж, системийг тань бэлдэнэ (ажлын 1 өдөр)</li>
        <li className="card p-3"><span className="mono text-text-3">3</span> Хаяг ирмэгц нэвтэрч, өгөгдлөө оруулна</li>
      </ol>
    </div>
  );
}
