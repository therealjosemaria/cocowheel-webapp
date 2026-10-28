import { PUBLIC_GUIDE } from "@/lib/public-information";

export const dynamic = "force-static";

export function GET() {
  return new Response(PUBLIC_GUIDE, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600", "X-Robots-Tag": "noindex, follow" },
  });
}
