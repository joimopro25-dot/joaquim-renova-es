import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-24 bg-gray-50">
      <h1 className="text-4xl font-bold mb-4 text-slate-800">Joaquim Renovações</h1>
      <p className="text-xl mb-8 text-slate-600 italic text-center max-w-2xl">
        Em breve: Uma nova forma de acompanhar a sua obra com transparência e qualidade.
      </p>
      <div className="flex gap-4">
        <Link 
          href="/admin" 
          className="bg-slate-800 text-white px-6 py-2 rounded-lg hover:bg-slate-700 transition"
        >
          Área Staff (CRM)
        </Link>
        <Link 
          href="/portal" 
          className="border border-slate-800 text-slate-800 px-6 py-2 rounded-lg hover:bg-slate-50 transition"
        >
          Área Cliente
        </Link>
      </div>
    </main>
  );
}