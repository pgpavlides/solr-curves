export default function SectionHead({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: string;
  lede?: string;
}) {
  return (
    <div className="section-head">
      <div>
        <span className="section-eyebrow">— {eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {lede && <p className="lede" dangerouslySetInnerHTML={{ __html: lede }} />}
    </div>
  );
}
