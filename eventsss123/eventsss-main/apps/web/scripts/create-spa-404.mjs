import { copyFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const outputDirectory = resolve(process.cwd(), "dist");
const indexPath = resolve(outputDirectory, "index.html");
const fallbackPath = resolve(outputDirectory, "404.html");

const html = await readFile(indexPath, "utf8");
if (!html.includes('<div id="root"></div>') || !html.includes("/assets/")) {
  throw new Error("The production index.html is missing the expected SPA root or bundled assets.");
}

await copyFile(indexPath, fallbackPath);
const fallback = await readFile(fallbackPath, "utf8");
if (fallback !== html) {
  throw new Error("The static-host SPA fallback does not match index.html.");
}

process.stdout.write("Created dist/404.html for direct React Router deep links.\n");
