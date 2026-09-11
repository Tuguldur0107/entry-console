export const metadata = { title: "Хүсэлт хүлээн авлаа · Entry Accounting" };

export default function SignupDonePage() {
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <div className="card p-8">
        <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-success-bg text-xl text-success">✓</span>
        <h1 className="text-lg font-semibold">Хүсэлт хүлээн авлаа</h1>
        <p className="mt-2 text-sm text-text-2">Бид баталгаажуулаад системийг тань бэлдэж, заасан имэйл эсвэл утсаар холбогдоно. Ихэвчлэн ажлын 1 өдөрт багтана.</p>
      </div>
    </div>
  );
}
