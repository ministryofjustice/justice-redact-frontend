import { cpSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const sourceDir = join(
  process.cwd(),
  "node_modules",
  "govuk-frontend",
  "dist",
  "govuk",
  "assets"
);

const targetDir = join(process.cwd(), "public", "assets");

if (!existsSync(targetDir)) {
  mkdirSync(targetDir, { recursive: true });
}

cpSync(sourceDir, targetDir, { recursive: true });

console.log("Copied GOV.UK Frontend assets to public/assets");