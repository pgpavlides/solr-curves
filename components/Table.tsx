export default function Table({
  caption,
  children,
}: {
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="table-wrap">
      {caption && <span className="table-caption">{caption}</span>}
      <div className="table-scroll">{children}</div>
    </div>
  );
}
