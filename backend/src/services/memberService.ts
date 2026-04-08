import { tripRepo, memberRepo } from '../repositories/postgres';
import { NotFoundError, ConflictError, BadRequestError } from '../utils/response';
import type { Member } from '../../../shared/types';

export async function addMember(tripId: string, name: string): Promise<Member> {
  const trip = await tripRepo.findById(tripId);
  if (!trip) throw new NotFoundError(`Trip ${tripId} not found`);

  try {
    return await memberRepo.create(tripId, name);
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code === '23505'
    ) {
      throw new ConflictError(`Member "${name}" already exists in this trip`);
    }
    throw err;
  }
}

export async function getMembers(tripId: string): Promise<Member[]> {
  return memberRepo.findByTrip(tripId);
}

export async function getMember(tripId: string, memberId: string): Promise<Member> {
  const member = await memberRepo.findById(tripId, memberId);
  if (!member) throw new NotFoundError(`Member ${memberId} not found`);
  return member;
}

export async function removeMember(tripId: string, memberId: string): Promise<void> {
  if (await memberRepo.hasSplits(tripId, memberId)) {
    throw new BadRequestError(
      'Cannot remove a member who has expense splits. Delete or update the expenses first.'
    );
  }
  if (await memberRepo.hasPaidExpenses(tripId, memberId)) {
    throw new BadRequestError(
      'Cannot remove a member who has paid for expenses. Delete or reassign the expenses first.'
    );
  }

  const removed = await memberRepo.remove(tripId, memberId);
  if (!removed) throw new NotFoundError(`Member ${memberId} not found`);
}
