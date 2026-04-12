'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useLocale } from '../i18n/LocaleContext';
import type { TFunction } from '../i18n/LocaleContext';
import type { ActivityEvent } from '../../../shared/types';

interface Props {
  tripId: string;
}

function eventDescription(event: ActivityEvent, t: TFunction): string {
  const actor = event.member_name ?? t('activity.someone');
  const meta = event.metadata as Record<string, string | number>;

  switch (event.event_type) {
    case 'TRIP_CREATED':
      return t('activity.tripCreated', { name: String(meta.name ?? '') });
    case 'MEMBER_JOINED':
      return t('activity.memberJoined', { actor });
    case 'MEMBER_REMOVED':
      return t('activity.memberRemoved', { name: String(meta.member_name ?? actor) });
    case 'EXPENSE_ADDED':
      return t('activity.expenseAdded', { actor, title: String(meta.title ?? '') });
    case 'EXPENSE_UPDATED':
      return t('activity.expenseUpdated', { actor, title: String(meta.title ?? '') });
    case 'EXPENSE_DELETED':
      return t('activity.expenseDeleted', { actor, title: String(meta.title ?? '') });
    default:
      return event.event_type;
  }
}

function formatRelativeTime(dateStr: string, t: TFunction): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return t('activity.justNow');
  if (diffMins < 60) return t('activity.minsAgo', { count: diffMins });
  if (diffHours < 24) return t('activity.hoursAgo', { count: diffHours });
  if (diffDays < 7) return t('activity.daysAgo', { count: diffDays });
  return date.toLocaleDateString();
}

const EVENT_ICONS: Record<string, string> = {
  TRIP_CREATED: '🗺️',
  MEMBER_JOINED: '👋',
  MEMBER_REMOVED: '👤',
  EXPENSE_ADDED: '💰',
  EXPENSE_UPDATED: '✏️',
  EXPENSE_DELETED: '🗑️',
};

export function ActivityFeed({ tripId }: Props) {
  const { t } = useLocale();
  const [cursor, setCursor] = useState<string | undefined>();
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['activity', tripId, cursor],
    queryFn: async () => {
      const result = await api.activity.list(tripId, cursor);
      setEvents((prev) => {
        // Append new events (avoid duplicates)
        const ids = new Set(prev.map((e) => e.id));
        const newEvents = result.events.filter((e) => !ids.has(e.id));
        return cursor ? [...prev, ...newEvents] : result.events;
      });
      return result;
    },
    staleTime: 30_000,
  });

  if (isLoading && events.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>{t('activity.noActivity')}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-3">
        {events.map((event) => (
          <div key={event.id} className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-sm">
              {EVENT_ICONS[event.event_type] ?? '•'}
            </div>
            <div className="flex-1 pt-1">
              <p className="text-sm text-gray-700">{eventDescription(event, t)}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {formatRelativeTime(event.created_at, t)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {data?.next_cursor && (
        <button
          onClick={() => setCursor(data.next_cursor)}
          disabled={isFetching}
          className="w-full mt-4 py-2 text-sm text-indigo-600 hover:underline disabled:opacity-50"
        >
          {isFetching ? t('activity.loading') : t('activity.loadMore')}
        </button>
      )}
    </div>
  );
}
