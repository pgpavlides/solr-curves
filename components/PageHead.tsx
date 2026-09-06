export default function PageHead({
  eyebrow,
  title,
  accent,
  lede,
}: {
  eyebrow: string;
  title: string;
  accent?: string;
  lede: string;
}) {
  return (
    <header className="page-head">
      <span className="eyebrow">
        <span className="dot" />
        {eyebrow}
      </span>
      <h1>
        {title}
        {accent && <span className="accent"> {accent}</span>}
      </h1>
      <p dangerouslySetInnerHTML={{ __html: lede }} />
    </header>
  );
}
