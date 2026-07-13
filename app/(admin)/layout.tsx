export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-gray-100">
      <header className="border-b border-gray-800 bg-gray-900 px-4 py-3">
        <span className="text-sm font-semibold tracking-wide text-white">
          Beyoğlu Anlık · Yönetim Paneli
        </span>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
