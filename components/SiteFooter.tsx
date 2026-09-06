import { compiledOn, transcriptCount, eaDate } from "@/data/meta";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <p className="fine">wardogspilot.com · compiled {compiledOn}</p>
      <p className="fine">
        Built from {transcriptCount} captioned community tutorials. Figures
        reflect the closed betas and may change at Early Access on {eaDate}.
        Verify keybind defaults in game. Unofficial — not affiliated with the
        developer.
      </p>
    </footer>
  );
}
