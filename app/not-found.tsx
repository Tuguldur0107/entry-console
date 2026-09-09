import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mx-auto mt-10 max-w-md p-6 text-center">
      <p className="text-sm font-medium">Хуудас олдсонгүй</p>
      <p className="mt-1 text-sm text-text-3">Харилцагч устгагдсан эсвэл хаяг буруу байна.</p>
      <Link href="/" className="btn mt-4">Самбар руу</Link>
    </div>
  );
}
