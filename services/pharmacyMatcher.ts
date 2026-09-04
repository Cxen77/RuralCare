/**
 * RuralCare Pharmacy Matcher
 * PRD Section 9.2 — Smart prescription fulfillment matcher
 * Prioritizes complete fulfillment with fewest trips over nearest store
 */

import type { Pharmacy, PrescriptionItem, PharmacyMatchResult } from '../types/schema';

/**
 * Match a prescription's items against all nearby pharmacies.
 * Returns pharmacies sorted by: (1) completeness desc, (2) cost asc, (3) distance asc
 */
export function matchPharmacies(
  prescriptionItems: PrescriptionItem[],
  pharmacies: Pharmacy[]
): PharmacyMatchResult[] {
  const results: PharmacyMatchResult[] = [];

  for (const pharmacy of pharmacies) {
    const availableItems: { drugName: string; pricePerUnit: number; quantity: number }[] = [];
    const missingItems: string[] = [];
    let totalCost = 0;

    for (const rxItem of prescriptionItems) {
      // Match by generic name or drug name (case-insensitive)
      const stockItem = pharmacy.inventory.find(
        s =>
          s.genericName.toLowerCase() === rxItem.genericName.toLowerCase() ||
          s.drugName.toLowerCase() === rxItem.drugName.toLowerCase()
      );

      if (stockItem && stockItem.quantity >= rxItem.quantity) {
        const itemCost = stockItem.pricePerUnit * rxItem.quantity;
        availableItems.push({
          drugName: rxItem.drugName,
          pricePerUnit: stockItem.pricePerUnit,
          quantity: rxItem.quantity,
        });
        totalCost += itemCost;
      } else {
        missingItems.push(rxItem.drugName);
      }
    }

    const completeness =
      prescriptionItems.length > 0
        ? availableItems.length / prescriptionItems.length
        : 0;

    results.push({
      pharmacyId: pharmacy.id,
      pharmacyName: pharmacy.name,
      distanceKm: pharmacy.distanceKm,
      availableItems,
      missingItems,
      completeness,
      totalCost: Math.round(totalCost * 100) / 100,
      isJanAushadhi: pharmacy.isJanAushadhi,
    });
  }

  // Sort: completeness DESC → totalCost ASC → distance ASC
  results.sort((a, b) => {
    if (b.completeness !== a.completeness) return b.completeness - a.completeness;
    if (a.totalCost !== b.totalCost) return a.totalCost - b.totalCost;
    return a.distanceKm - b.distanceKm;
  });

  return results;
}

/**
 * Generate a unique reservation token
 */
export function generateReservationToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let token = 'RSV-';
  for (let i = 0; i < 8; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}
