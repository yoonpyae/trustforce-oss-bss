"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { markNotificationsRead } from "@/lib/actions/notifications";
import { relTime } from "@/lib/format";

type Notification = { id: string; title: string; body: string; link: string | null; read: boolean; createdAt: Date };

export function NotificationBell({ notifications, unread }: { notifications: Notification[]; unread: number }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  return (
    <div className="notif-bell" ref={boxRef}>
      <button
        className="btn sm ghost"
        aria-label="Notifications"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next && unread > 0) markNotificationsRead();
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      >
        ⚑
        {unread > 0 && <span className="notif-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="notif-panel">
          {notifications.length === 0 ? (
            <div className="notif-empty">No notifications yet.</div>
          ) : (
            notifications.map((n) => {
              const item = (
                <div className={`notif-item${n.read ? "" : " unread"}`}>
                  <b>{n.title}</b>
                  <span className="hint">{n.body}</span>
                  <span className="hint num">{relTime(n.createdAt)}</span>
                </div>
              );
              return n.link ? (
                <Link key={n.id} href={n.link} onClick={() => setOpen(false)}>
                  {item}
                </Link>
              ) : (
                <div key={n.id}>{item}</div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
