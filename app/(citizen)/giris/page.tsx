import { loginAction } from "@/app/giris/actions";

export default async function GirisPage({
  searchParams,
}: {
  searchParams: Promise<{ hata?: string }>;
}) {
  const { hata } = await searchParams;

  return (
    <main className="flex-1 flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Beyoğlu Anlık&apos;a Giriş</h1>
        <p className="mt-1 text-sm text-gray-500">
          Bu bir demo girişidir. Gerçek bir e-Devlet/TC Kimlik sorgusu yapılmaz; girdiğiniz
          bilgiler yalnızca bu prototipte &quot;Beyoğlu sakini&quot; simülasyonu için kullanılır.
        </p>

        {hata && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
            Lütfen adınızı ve 11 haneli (sahte) TC kimlik numaranızı doğru girin.
          </p>
        )}

        <form action={loginAction} className="mt-4 space-y-4">
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
              Ad Soyad
            </label>
            <input
              id="fullName"
              name="fullName"
              required
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              placeholder="Ayşe Yılmaz"
            />
          </div>
          <div>
            <label htmlFor="fakeTcNo" className="block text-sm font-medium text-gray-700">
              TC Kimlik No (demo)
            </label>
            <input
              id="fakeTcNo"
              name="fakeTcNo"
              required
              pattern="[0-9]{11}"
              maxLength={11}
              inputMode="numeric"
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              placeholder="11 haneli sayı"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Beyoğlu Sakini Olarak Doğrula ve Giriş Yap
          </button>
        </form>
      </div>
    </main>
  );
}
