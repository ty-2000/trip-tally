'use client';

import { useState } from 'react';
import { useTripStore } from '../store/tripStore';
import { useAddMember } from '../hooks/useMembers';
import { useLocale } from '../i18n/LocaleContext';
import type { Member } from '../../../shared/types';

interface Props {
  tripId: string;
  members: Member[];
  currentMemberId: string | null;
}

export function MemberManager({ tripId, members, currentMemberId }: Props) {
  const { t } = useLocale();
  const [showAddMember, setShowAddMember] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  const setCurrentMember = useTripStore((s) => s.setCurrentMember);
  const addMember = useAddMember(tripId);

  const handleSelectMember = (member: Member) => {
    setCurrentMember(tripId, member.id, member.name);
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!newName.trim()) return;

    try {
      await addMember.mutateAsync(newName.trim());
      setNewName('');
      setShowAddMember(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('member.failedAdd'));
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">{t('member.whoAreYou')}</h3>
        <button
          onClick={() => setShowAddMember(!showAddMember)}
          className="text-xs text-indigo-600 hover:underline"
        >
          {t('member.addPerson')}
        </button>
      </div>

      {/* Member pills */}
      <div className="flex flex-wrap gap-2">
        {members.map((m) => (
          <button
            key={m.id}
            onClick={() => handleSelectMember(m)}
            className={`px-3 py-1 rounded-full text-sm font-medium border ${
              m.id === currentMemberId
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'
            }`}
          >
            {m.name}
          </button>
        ))}

        {members.length === 0 && (
          <p className="text-sm text-gray-400">{t('member.noMembers')}</p>
        )}
      </div>

      {/* Add member form */}
      {showAddMember && (
        <form onSubmit={handleAddMember} className="mt-3 flex gap-2">
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('member.yourNamePlaceholder')}
            className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            maxLength={100}
          />
          <button
            type="submit"
            disabled={addMember.isPending}
            className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {t('member.add')}
          </button>
          <button
            type="button"
            onClick={() => { setShowAddMember(false); setNewName(''); }}
            className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            {t('member.cancel')}
          </button>
        </form>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {!currentMemberId && (
        <p className="mt-2 text-xs text-amber-600">
          {t('member.selectName')}
        </p>
      )}
    </div>
  );
}
