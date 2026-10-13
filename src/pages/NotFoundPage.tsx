import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-6">
      <div className="space-y-2">
        <span className="text-xs font-black uppercase tracking-widest text-sky-700 bg-sky-50 px-3 py-1 rounded-full border border-sky-200">
          Error 404
        </span>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
          Página no encontrada
        </h1>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          La dirección que buscas no existe o ha sido movida. Puedes regresar a la página principal.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <Link
          to="/panel"
          className="inline-flex items-center px-5 py-2.5 rounded-xl bg-[#0b2545] hover:bg-sky-900 text-white font-bold text-xs shadow-md transition-colors"
        >
          Volver al Inicio
        </Link>
      </div>
    </div>
  );
}
