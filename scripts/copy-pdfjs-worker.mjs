import { cpSync } from "fs";
import { join } from "path";

const source = join(
    process.cwd(),
    "node_modules",
    "pdfjs-dist",
    "build",
    "pdf.worker.min.mjs"
);

const destination = join(
    process.cwd(),
    "public",
    "pdf.worker.min.mjs"
);

cpSync(source, destination);

console.log(`Copied ${destination}`);