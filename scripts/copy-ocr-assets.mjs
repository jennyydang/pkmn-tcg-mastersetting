// Copies the on-device OCR engine (Tesseract) and its English data into
// public/ocr so the card scanner works offline and inside the iOS app.
// Runs before `next dev` / `next build` (see package.json); public/ocr is git-ignored.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const out = join(process.cwd(), "public", "ocr");
mkdirSync(out, { recursive: true });

const pkgDir = (name) => dirname(require.resolve(`${name}/package.json`));
const files = [
  [join(pkgDir("tesseract.js"), "dist", "worker.min.js"), "worker.min.js"],
  // The LSTM engine builds (plain, SIMD, relaxed SIMD); Tesseract picks one per
  // device. Each .wasm.js embeds its WebAssembly, so the .wasm files aren't needed.
  ...["tesseract-core-lstm", "tesseract-core-simd-lstm", "tesseract-core-relaxedsimd-lstm"].map((f) => [
    join(pkgDir("tesseract.js-core"), `${f}.wasm.js`), `${f}.wasm.js`,
  ]),
  [join(pkgDir("@tesseract.js-data/eng"), "4.0.0_best_int", "eng.traineddata.gz"), "eng.traineddata.gz"],
];

for (const [from, to] of files) {
  if (!existsSync(from)) throw new Error(`OCR asset missing: ${from}`);
  copyFileSync(from, join(out, to));
}
console.log(`OCR assets copied to public/ocr (${files.length} files)`);
