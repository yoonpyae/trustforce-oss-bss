import { db } from "@/lib/db";
import * as s from "@/lib/schema";

function esc(str: string) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

export async function GET() {
  const [olts, dns, sns, fibers] = await Promise.all([
    db.select().from(s.olts),
    db.select().from(s.distributionNodes),
    db.select().from(s.splitterNodes),
    db.select().from(s.fibers),
  ]);

  const placemarks: string[] = [];
  for (const o of olts) {
    placemarks.push(`<Placemark><name>${esc(o.id)}</name><description>${esc(o.name)} — ${esc(o.vendor)} ${esc(o.model)}</description><Point><coordinates>${o.lng},${o.lat},0</coordinates></Point></Placemark>`);
  }
  for (const d of dns) {
    placemarks.push(`<Placemark><name>${esc(d.id)}</name><description>${esc(d.name)} — DN 1:${d.splitRatio}</description><Point><coordinates>${d.lng},${d.lat},0</coordinates></Point></Placemark>`);
  }
  for (const sn of sns) {
    placemarks.push(`<Placemark><name>${esc(sn.id)}</name><description>${esc(sn.name)} — SN 1:${sn.splitRatio}</description><Point><coordinates>${sn.lng},${sn.lat},0</coordinates></Point></Placemark>`);
  }
  const lines: string[] = [];
  for (const f of fibers) {
    const coords = f.route.map(([lat, lng]) => `${lng},${lat},0`).join(" ");
    lines.push(`<Placemark><name>${esc(f.id)}</name><description>${esc(f.kind)} fibre, ${f.lengthM}m</description><LineString><coordinates>${coords}</coordinates></LineString></Placemark>`);
  }

  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
<name>TrustForce ODN plant</name>
${placemarks.join("\n")}
${lines.join("\n")}
</Document>
</kml>`;

  return new Response(kml, {
    headers: {
      "Content-Type": "application/vnd.google-earth.kml+xml",
      "Content-Disposition": 'attachment; filename="trustforce-odn-plant.kml"',
    },
  });
}
