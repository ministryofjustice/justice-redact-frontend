import { cpSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const files = [
  {
    from: join(
      process.cwd(),
      "node_modules",
      "govuk-frontend",
      "dist",
      "govuk",
      "govuk-frontend.min.css"
    ),
    to: join(process.cwd(), "public", "styles", "govuk-frontend.min.css"),
  },
  {
    from: join(
      process.cwd(),
      "node_modules",
      "@ministryofjustice",
      "frontend",
      "moj",
      "moj-frontend.min.css"
    ),
    to: join(process.cwd(), "public", "styles", "moj-frontend.min.css"),
  },
];

const stylesDir = join(process.cwd(), "public", "styles");
if (!existsSync(stylesDir)) {
  mkdirSync(stylesDir, { recursive: true });
}

for (const file of files) {
  cpSync(file.from, file.to);
  console.log(`Copied ${file.to}`);
}