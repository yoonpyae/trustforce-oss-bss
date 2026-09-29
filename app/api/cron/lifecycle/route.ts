import { runLifecycleSweep } from "@/lib/lifecycle";

export const maxDuration = 30;

// Vercel Cron calls this daily (see vercel.json) with an automatic
// `Authorization: Bearer $CRON_SECRET` header, as long as a CRON_SECRET
// env var is set on the project — see https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runLifecycleSweep();
  return Response.json({ status: "ok", ...result });
}
