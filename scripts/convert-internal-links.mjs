import fs from "node:fs";

const write = process.argv.includes("--write");
const files = [
  "src/app/account-blocked/page.tsx",
  "src/app/booking/checkout/page.tsx",
  "src/app/cart/page.tsx",
  "src/app/checkout/page.tsx",
  "src/app/client/bookings/[id]/page.tsx",
  "src/app/client/orders/[id]/page.tsx",
  "src/app/not-authorized/page.tsx",
  "src/app/profile-required/page.tsx",
  "src/components/layout/AdminLayout.tsx",
  "src/components/layout/ClientLayout.tsx",
  "src/components/layout/CourierLayout.tsx",
  "src/components/layout/PartnerLayout.tsx",
  "src/components/layout/PublicHeader.tsx"
];

const internalAnchor = /<a\b(?=[^>]*\bhref=(["'])\/[^"']*\1)[^>]*>[\s\S]*?<\/a>/g;
let total = 0;
const changed = [];

for (const file of files) {
  const original = fs.readFileSync(file, "utf8");
  let count = 0;
  let next = original.replace(internalAnchor, (match) => {
    count += 1;
    return match.replace(/^<a\b/, "<Link").replace(/<\/a>$/, "</Link>");
  });

  if (count > 0 && !/from ["']next\/link["']/.test(next)) {
    const importLine = 'import Link from "next/link";\n';
    if (next.startsWith('"use client";\n\n')) {
      next = `"use client";\n\n${importLine}${next.slice('"use client";\n\n'.length)}`;
    } else if (next.startsWith("'use client';\n\n")) {
      next = `'use client';\n\n${importLine}${next.slice("'use client';\n\n".length)}`;
    } else {
      next = importLine + next;
    }
  }

  total += count;
  if (next !== original) {
    changed.push(`${file}:${count}`);
    if (write) fs.writeFileSync(file, next);
  }
}

console.log(`Internal anchors converted: ${total}`);
console.log(`Changed files: ${changed.join(", ") || "none"}`);

if (!write && total === 0) {
  console.log("No conversion needed.");
}

if (write && total < 17) {
  throw new Error(`Expected at least 17 lint-reported internal anchors, converted ${total}`);
}
