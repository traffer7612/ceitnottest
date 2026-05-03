/**
 * Serves the static lightpaper from `public/ceitnot-lightpaper.html` (copy of `docs/CEITNOT-LIGHTPAPER.html`).
 */
export default function LightpaperPage() {
  const src = `${import.meta.env.BASE_URL}ceitnot-lightpaper.html`;
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      <h1 className="page-title text-2xl sm:text-3xl mb-2">Lightpaper</h1>
      <p className="page-subtitle text-sm sm:text-base mb-6 max-w-2xl">
        Overview of the Ceitnot protocol: collateral, Siphon, IRM, liquidations, and governance. Use your
        browser print dialog to save as PDF (enable background graphics).
      </p>
      <div className="rounded-xl border border-ceitnot-border/80 overflow-hidden bg-white shadow-sm">
        <iframe
          title="Ceitnot — Lightpaper"
          src={src}
          className="w-full h-[min(86vh,1600px)] min-h-[560px] sm:min-h-[640px] border-0 block"
          loading="lazy"
        />
      </div>
    </div>
  );
}
