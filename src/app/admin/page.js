// src/app/admin/page.js
import AdminClient from "@/components/AdminClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Producer Studio (/admin)",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-6xl px-6 pb-20 pt-8">
        <AdminClient />
      </div>
    </main>
  );
}
