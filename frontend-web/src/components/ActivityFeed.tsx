'use client';

import { useState } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ActivityEvent } from '../../../shared/types';

interface Props {
  tripId: string;
}

function eventDescription(event: ActivityEvent): string {
  const actor = event.member_name ?? 'Someone';
  const meta = event.metadata as Record<string, string | number>;

  switch (event.event_type) {
    case 'TRIP_CREATED':
      return `Trip "${meta.name ?? ''}" was created`;
    case 'MEMBER_JOINED':
      return `${actor} joined the trip`;
    case 'MEMBER_REMOVED':
      return `${meta.member_name ?? actor} was removed from the trip`;
    case 'EXPENSE_ADDED':
      return `${actor} added "${meta.title ?? ''}"`;
    case 'EXPENSE_UPDATED':
      return `${actor} updated "${meta.title ?? ''}"`;
    case 'EXPENSE_DELETED':
      return `${actor} deleted "${meta.title ?? ''}"`;
    default:
      return event.event_type;
  }
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
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
        <p>No activity yet.</p>
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
              <p className="text-sm text-gray-700">{eventDescription(event)}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {formatRelativeTime(event.created_at)}
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
          {isFetching ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  );
}
