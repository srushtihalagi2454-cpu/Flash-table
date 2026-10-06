import { CancellationRecord, Reservation } from '../types';
import { isReservationForCustomer } from '../data/mockData';

const STORAGE_KEY_PREFIX = 'flashtable_cancellation_records';

/**
 * Retrieves all stored cancellation records from localStorage.
 */
export function getAllCancellationRecords(): CancellationRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to read cancellation records from localStorage:', err);
    return [];
  }
}

/**
 * Saves a new cancellation record to persistent localStorage.
 */
export function recordCancellationToStorage(record: CancellationRecord): void {
  try {
    const existing = getAllCancellationRecords();
    const filtered = existing.filter((r) => r.reservationId !== record.reservationId);
    filtered.unshift(record);
    localStorage.setItem(STORAGE_KEY_PREFIX, JSON.stringify(filtered));
  } catch (err) {
    console.warn('Failed to save cancellation record to localStorage:', err);
  }
}

/**
 * Computes how many cancellations a customer has completed in the past.
 * Considers both in-memory reservations marked as 'cancelled' and stored cancellation records.
 */
export function getCustomerCancellationCount(
  userId?: string,
  customerPhone?: string,
  reservations?: Reservation[]
): number {
  const normUserId = (userId || '').trim().toLowerCase();
  const normPhone = (customerPhone || '').replace(/\D/g, '');

  const seenReservationIds = new Set<string>();

  // 1. Check in-memory reservations
  if (Array.isArray(reservations)) {
    for (const r of reservations) {
      if (r.status === 'cancelled' || r.cancellationStatus === 'cancelled') {
        const matchesUser = normUserId && isReservationForCustomer(r, normUserId);
        const matchesPhone = normPhone && r.customerPhone && r.customerPhone.replace(/\D/g, '') === normPhone;

        if (matchesUser || matchesPhone) {
          seenReservationIds.add(r.id);
        }
      }
    }
  }

  // 2. Check localStorage records
  const stored = getAllCancellationRecords();
  for (const rec of stored) {
    const recUserId = (rec.userId || '').trim().toLowerCase();
    const recPhone = (rec.customerPhone || '').replace(/\D/g, '');

    const matchesUser = normUserId && recUserId && (recUserId === normUserId);
    const matchesPhone = normPhone && recPhone && (recPhone === normPhone);

    if (matchesUser || matchesPhone) {
      seenReservationIds.add(rec.reservationId);
    }
  }

  return seenReservationIds.size;
}

export interface CancellationPlan {
  priorCount: number;
  attemptNumber: number; // 1 for first cancellation, 2 for second, etc.
  isFirstCancellation: boolean;
  penaltyAmount: number; // 0 for 1st cancellation, 100 for 2nd+
  penaltyApplicability: 'none_first_cancellation' | 'applicable';
}

/**
 * Prepares the policy rules for an upcoming cancellation:
 * - First cancellation: ₹0 penalty fee, warning on completion.
 * - Second and subsequent cancellations: ₹100 penalty fee, acknowledgement & payment process required.
 */
export function prepareCancellationPlan(
  userId?: string,
  customerPhone?: string,
  reservations?: Reservation[]
): CancellationPlan {
  const priorCount = getCustomerCancellationCount(userId, customerPhone, reservations);
  const attemptNumber = priorCount + 1;
  const isFirstCancellation = priorCount === 0;
  const penaltyAmount = isFirstCancellation ? 0 : 100;
  const penaltyApplicability = isFirstCancellation ? 'none_first_cancellation' : 'applicable';

  return {
    priorCount,
    attemptNumber,
    isFirstCancellation,
    penaltyAmount,
    penaltyApplicability,
  };
}
