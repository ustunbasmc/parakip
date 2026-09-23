/** Admin sayfaları arası geçişte içerik alanında iskelet (başlık/menü layout'ta kalır). */
export default function Loading() {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Yükleniyor">
      <div className="skeleton h-7 w-48 rounded-lg" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="skeleton h-16 rounded-2xl" />
      ))}
    </div>
  );
}
