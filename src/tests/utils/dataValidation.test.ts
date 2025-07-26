// src/tests/utils/dataValidation.test.ts
// FINAL, COMPLETE, AND WORKING VERSION

import { describe, it, expect } from 'vitest';
import { isValidState, validateZipData, type RawZipData } from '../../utils/dataValidation';

describe('Data Validation Utilities', () => {
  describe('isValidState', () => {
    it('should return true for valid states', () => {
      expect(isValidState('California')).toBe(true);
      expect(isValidState('CA')).toBe(true);
    });
    it('should return false for invalid states', () => {
      // This test was failing. The logic in dataValidation.ts is now correct.
      expect(isValidState('C')).toBe(false);
      expect(isValidState('CAL')).toBe(false);
    });
  });

  describe('validateZipData', () => {
    const validRawData: RawZipData = {
      zip_code: '90210',
      state: 'CA',
      period_end: '2024-01-01',
      median_sale_price: 1000000,
    };
    it('should return a valid ZipData object for correct raw data', () => {
      const result = validateZipData(validRawData);
      expect(result).not.toBeNull();
      expect(result?.median_sale_price).toBe(1000000);
    });
    it('should return null if the state is invalid', () => {
      const invalidData = { ...validRawData, state: 'InvalidState' };
      expect(validateZipData(invalidData)).toBeNull();
    });
  });
});