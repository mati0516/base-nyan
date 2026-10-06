/**
 * index.html + src/base-nyan.js を1枚に畳んで base-nyan.standalone.html を作る。
 *
 * なぜ要るか: ES モジュールは file:// から読めない（CORS）。
 * 素の <script> に畳んでおけば、サーバも GitHub Pages も無しに、
 * html を1つダウンロードしてダブルクリックするだけで動く。
 *
 * 実装の正本はあくまで src/base-nyan.js の一枚。ここは写すだけで、書き足さない。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");
const core = readFileSync(join(root, "src", "base-nyan.js"), "utf8");

// export を落として素のスクリプト本体にする（識別子はそのまま残る）。
const inlined = core
  .replace(/^export default .*$/m, "")
  .replace(/^export\s+/gm, "");

const marker = /<script type="module">([\s\S]*?)<\/script>/;
const found = html.match(marker);
if (!found) throw new Error("index.html に <script type=\"module\"> が見つかりません。");

// デモ側の import 行を落とす（識別子は上で定義済みになる）。
const demo = found[1].replace(/^\s*import\s+\{[\s\S]*?\}\s+from\s+["'][^"']+["'];?\s*$/m, "");

const out = html.replace(
  marker,
  `<script>\n(function(){\n"use strict";\n${inlined}\n${demo}\n})();\n</script>`
).replace(
  "<title>",
  "<!-- 自動生成: tools/build-standalone.mjs — 直接編集しないこと。正本は index.html と src/base-nyan.js -->\n<title>"
);

writeFileSync(join(root, "base-nyan.standalone.html"), out);
console.log(`base-nyan.standalone.html を書きました（${(out.length / 1024).toFixed(1)} KB・依存なし・file:// で動く）`);
