import { cpSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const sourceDir = join(
  process.cwd(),
  "node_modules",
  "@ministryofjustice",
  "frontend",
  "moj",
  "assets"
);

const targetDir = join(process.cwd(), "public", "moj", "assets");

if (!existsSync(targetDir)) {
  mkdirSync(targetDir, { recursive: true });
}

cpSync(sourceDir, targetDir, { recursive: true });

console.log("Copied MOJ Frontend assets to public/moj/assets");