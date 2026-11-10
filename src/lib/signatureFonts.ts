// Cover-letter signature fonts load only when cover-letter code is used,
// keeping ~30 script font families off every other page's first paint.
const HREF =
  "https://fonts.googleapis.com/css2?family=Aguafina+Script&family=Alex+Brush&family=Allura&family=Arizonia&family=Bilbo&family=Bilbo+Swash+Caps&family=Caveat:wght@400;700&family=Cedarville+Cursive&family=Clicker+Script&family=Dancing+Script:wght@400;600;700&family=Euphoria+Script&family=Great+Vibes&family=Herr+Von+Muellerhoff&family=Homemade+Apple&family=Italianno&family=Kaushan+Script&family=Marck+Script&family=Monsieur+La+Doulaise&family=Mrs+Saint+Delafield&family=Pacifico&family=Parisienne&family=Pinyon+Script&family=Qwigley&family=Rochester&family=Sacramento&family=Satisfy&family=Sofia&family=Tangerine:wght@400;700&family=WindSong:wght@400;500&family=Yellowtail&display=swap";

export function ensureSignatureFonts() {
  if (typeof document === "undefined") return;
  if (document.querySelector(`link[data-signature-fonts]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = HREF;
  link.setAttribute("data-signature-fonts", "");
  document.head.appendChild(link);
}

ensureSignatureFonts();
