import { getCustomerDetail } from "@/lib/queries/customers";
import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Pill } from "@/components/Pill";
import { SubscriberDetail } from "./SubscriberDetail";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SubscriberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getCustomerDetail(id.toUpperCase());
  if (!detail) notFound();

  const tariffs = await db.select().from(s.tariffs);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="crumb"><Link href="/subscribers">Subscribers</Link> / {detail.customer.id}</div>
          <h1>{detail.customer.fullName}</h1>
          <p>{detail.customer.phone} · {detail.customer.zone} · <Pill status={detail.customer.status} /></p>
        </div>
      </div>
      <SubscriberDetail detail={detail} tariffs={tariffs} />
    </>
  );
}
