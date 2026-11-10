// Auto-WebP Vite plugin: any PNG/JPG/JPEG imported from src/ is converted to
// WebP on the fly — in dev via a middleware, in build via an emitted asset.
// Importers keep writing `import img from "./x.png"` and receive a WebP URL.
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

const IMG_RE = /\.(png|jpe?g)$/i;

export function autoWebpPlugin() {
  let isBuild = false;

  async function toWebp(file) {
    const buf = await fs.readFile(file);
    return sharp(buf).webp({ quality: 82 }).toBuffer();
  }

  return {
    name: "auto-webp",
    enforce: "pre",

    configResolved(config) {
      isBuild = config.command === "build";
    },

    configureServer(server) {
      server.middlewares.use("/@webp", async (req, res) => {
        try {
          const file = decodeURIComponent((req.url || "").split("?")[0].replace(/^\//, ""));
          if (!IMG_RE.test(file)) {
            res.statusCode = 404;
            return res.end("not found");
          }
          const webp = await toWebp(file);
          res.setHeader("Content-Type", "image/webp");
          res.setHeader("Cache-Control", "no-cache");
          res.end(webp);
        } catch (err) {
          res.statusCode = 500;
          res.end(String(err));
        }
      });
    },

    async load(id) {
      const [file, query] = id.split("?");
      if (query) return null; // leave ?url / ?raw / ?inline imports untouched
      if (!IMG_RE.test(file)) return null;
      if (!file.includes(`${path.sep}src${path.sep}`)) return null;

      if (isBuild) {
        const webp = await toWebp(file);
        const name = path.basename(file).replace(IMG_RE, ".webp");
        const ref = this.emitFile({ type: "asset", name, source: webp });
        return `export default import.meta.ROLLUP_FILE_URL_${ref};`;
      }

      return `export default ${JSON.stringify("/@webp/" + encodeURIComponent(file))};`;
    },
  };
}
