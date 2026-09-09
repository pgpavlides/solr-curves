/*
  The broccolipilot mark.

  It used to be an inline SVG so CSS could recolour it — a two-tone shield that
  took the system's luminance palette like everything else. This one cannot do
  that and should not: it is a full-colour illustration, cut out of the first
  frame of the brand animation, and the green is the brand.

  It is a plain <img> rather than next/image on purpose. This route set is a
  static export, so there is no image optimiser at runtime, and the file is
  already a 66 KB webp with an alpha channel — one request, cached, done.

  Sized entirely by its container: every call site wraps it in a square box and
  `object-fit: contain` keeps the mark's own 4:5 shape inside that box. See
  .logo in styles/globals.css.
*/
export default function Logo({
  className = "",
  title = "broccolipilot",
}: {
  className?: string;
  title?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={`logo ${className}`}
      src="/logo.webp"
      alt={title}
      width={560}
      height={694}
      draggable={false}
    />
  );
}
