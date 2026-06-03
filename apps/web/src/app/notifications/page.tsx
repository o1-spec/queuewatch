'use client';

import React, { useState, useEffect } from 'react';
import useSocket from '../../hooks/useSocket';
import { Bell, RefreshCw, Mail, Terminal, Send, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Notification } from '@queuewatch/shared';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function NotificationsInbox() {
  const { authFetch } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/notifications`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (e) {
      console.error('Failed to fetch notifications:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  useSocket({
    'notification.created': (newNotif: Notification) => {
      setNotifications((prev) => [newNotif, ...prev].slice(0, 100));
    },
  });

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email':
        return <Mail className="w-3.5 h-3.5 text-sky-400" />;
      case 'slack_webhook':
      case 'discord_webhook':
        return <Send className="w-3.5 h-3.5 text-indigo-400" />;
      default:
        return <Terminal className="w-3.5 h-3.5 text-zinc-400" />;
    }
  };

  return (
    <div className="space-y-6 font-mono text-[10px]">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-900 pb-4">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-tight flex items-center space-x-2">
            <Bell className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>Alarms & Notifications Dispatch Ledger</span>
          </h2>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            Audit logs of SRE page signals, nodemailer dispatches, and webhook alerts sent to engineering teams.
          </p>
        </div>

        <button
          onClick={fetchNotifications}
          className="px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-850 font-bold transition-all flex items-center space-x-1.5 shadow"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>REFRESH LEDGER</span>
        </button>
      </div>

      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg h-16"></div>
          ))}
        </div>
      ) : (
        <div className="bg-zinc-950 border border-zinc-900 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-900 bg-zinc-900/10 text-zinc-500 font-bold uppercase tracking-wider text-[8px]">
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Channel</th>
                  <th className="p-3">Target Scope</th>
                  <th className="p-3">Message Summary</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Reference</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map((notif) => (
                  <tr key={notif.id} className="border-b border-zinc-900/40 last:border-0 hover:bg-zinc-900/10 transition-colors">
                    <td className="p-3 text-zinc-500 font-sans">
                      {new Date(notif.timestamp).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <span className="flex items-center space-x-1.5 uppercase font-bold text-zinc-300">
                        {getChannelIcon(notif.channel)}
                        <span>{notif.channel.replace('_', ' ')}</span>
                      </span>
                    </td>
                    <td className="p-3">
                      {notif.queueName ? (
                        <span className="px-1.5 py-0.5 rounded text-[8px] bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono">
                          {notif.queueName}
                        </span>
                      ) : (
                        <span className="text-zinc-600">&mdash;</span>
                      )}
                    </td>
                    <td className="p-3 text-zinc-300 font-sans text-xs leading-normal">
                      {notif.message}
                    </td>
                    <td className="p-3">
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border uppercase ${
                        notif.status === 'sent'
                          ? 'bg-emerald-950/20 border-emerald-900 text-emerald-400'
                          : 'bg-rose-950/20 border-rose-900 text-rose-400'
                      }`}>
                        {notif.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {notif.incidentId ? (
                        <Link
                          href="/incidents"
                          className="text-indigo-400 hover:text-indigo-350 hover:underline font-bold"
                        >
                          View Incident &rarr;
                        </Link>
                      ) : (
                        <span className="text-zinc-650">&mdash;</span>
                      )}
                    </td>
                  </tr>
                ))}

                {notifications.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-zinc-600 font-bold">
                      No notification dispatches captured in persistent storage yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
