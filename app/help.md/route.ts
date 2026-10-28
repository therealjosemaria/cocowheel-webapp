import { HELP_MARKDOWN } from "@/lib/public-information";

export const dynamic = "force-static";

export function GET() {
  return new Response(HELP_MARKDOWN, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "Link": '<https://www.gumwheel.com/help>; rel="canonical"',
      "X-Robots-Tag": "noindex, follow",
    },
  });
}
