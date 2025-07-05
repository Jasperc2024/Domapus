import { describe, it, expect } from 'vitest';
import {
  isValidZipCode,
  isValidState,
  isValidNumber,
  isValidPrice,
  isValidPercentage,
  isValidDate,
  validateZipData,
  validateZipDataBatch,
  type RawZipData,
} from '../../utils/dataValidation';

describe('dataValidation', () => {
  describe('isValidZipCode', () => {
    it('validates correct ZIP codes', () => {
      expect(isValidZipCode('12345')).toBe(true);
      expect(isValidZipCode('90210')).toBe(true);
      expect(isValidZipCode('00001')).toBe(true);
    });

    it('rejects invalid ZIP codes', () => {
      expect(isValidZipCode('1234')).toBe(false);
      expect(isValidZipCode('123456')).toBe(false);
      expect(isValidZipCode('abcde')).toBe(false);
      expect(isValidZipCode('')).toBe(false);
    });
  });

  describe('isValidState', () => {
    it('validates state codes', () => {
      expect(isValidState('CA')).toBe(true);
      expect(isValidState('NY')).toBe(true);
      expect(isValidState('TX')).toBe(true);
    });

    it('validates full state names', () => {
      expect(isValidState('California')).toBe(true);
      expect(isValidState('New York')).toBe(true);
    });

    it('rejects invalid states', () => {
      expect(isValidState('C')).toBe(false);
      expect(isValidState('CAL')).toBe(false);
      expect(isValidState('')).toBe(false);
    });
  });

  describe('isValidNumber', () => {
    it('validates numbers', () => {
      expect(isValidNumber(123)).toBe(true);
      expect(isValidNumber(0)).toBe(true);
      expect(isValidNumber(-123)).toBe(true);
      expect(isValidNumber(123.45)).toBe(true);
    });

    it('rejects invalid numbers', () => {
      expect(isValidNumber(NaN)).toBe(false);
      expect(isValidNumber(Infinity)).toBe(false);
      expect(isValidNumber('123')).toBe(false);
      expect(isValidNumber(null)).toBe(false);
      expect(isValidNumber(undefined)).toBe(false);
    });
  });

  describe('isValidPrice', () => {
    it('validates positive prices', () => {
      expect(isValidPrice(100000)).toBe(true);
      expect(isValidPrice(0)).toBe(true);
      expect(isValidPrice(999999.99)).toBe(true);
    });

    it('rejects negative prices', () => {
      expect(isValidPrice(-100)).toBe(false);
    });
  });

  describe('isValidPercentage', () => {
    it('validates reasonable percentages', () => {
      expect(isValidPercentage(50)).toBe(true);
      expect(isValidPercentage(-10)).toBe(true);
      expect(isValidPercentage(0)).toBe(true);
      expect(isValidPercentage(100)).toBe(true);
    });

    it('rejects extreme percentages', () => {
      expect(isValidPercentage(-150)).toBe(false);
      expect(isValidPercentage(1500)).toBe(false);
    });
  });

  describe('isValidDate', () => {
    it('validates date strings', () => {
      expect(isValidDate('2024-01-01')).toBe(true);
      expect(isValidDate('2024-12-31')).toBe(true);
      expect(isValidDate('2024-06-15')).toBe(true);
    });

    it('rejects invalid dates', () => {
      expect(isValidDate('invalid-date')).toBe(false);
      expect(isValidDate('')).toBe(false);
      expect(isValidDate('24-01-01')).toBe(false);
    });
  });

  describe('validateZipData', () => {
    const validRawData: RawZipData = {
      zip_code: '90210',
      state: 'CA',
      city: 'Beverly Hills',
      period_end: '2024-01-01',
      median_sale_price: 1000000,
      median_list_price: 1100000,
      homes_sold: 50,
      new_listings: 60,
      inventory: 100,
      median_dom: 30,
      avg_sale_to_list_ratio: 0.95,
      sold_above_list: 25,
      off_market_in_two_weeks: 40,
    };

    it('validates correct data', () => {
      const result = validateZipData(validRawData);
      expect(result).not.toBeNull();
      expect(result?.zipCode).toBe('90210');
      expect(result?.state).toBe('CA');
      expect(result?.city).toBe('Beverly Hills');
      expect(result?.medianSalePrice).toBe(1000000);
    });

    it('rejects data with invalid ZIP code', () => {
      const invalidData = { ...validRawData, zip_code: 'invalid' };
      const result = validateZipData(invalidData);
      expect(result).toBeNull();
    });

    it('rejects data with invalid state', () => {
      const invalidData = { ...validRawData, state: '' };
      const result = validateZipData(invalidData);
      expect(result).toBeNull();
    });

    it('rejects data with invalid date', () => {
      const invalidData = { ...validRawData, period_end: 'invalid-date' };
      const result = validateZipData(invalidData);
      expect(result).toBeNull();
    });

    it('handles missing optional fields gracefully', () => {
      const minimalData: RawZipData = {
        zip_code: '90210',
        state: 'CA',
        period_end: '2024-01-01',
      };
      const result = validateZipData(minimalData);
      expect(result).not.toBeNull();
      expect(result?.medianSalePrice).toBe(0);
      expect(result?.homesSold).toBe(0);
    });
  });

  describe('validateZipDataBatch', () => {
    it('validates multiple ZIP codes', () => {
      const rawDataArray: RawZipData[] = [
        {
          zip_code: '90210',
          state: 'CA',
          period_end: '2024-01-01',
          median_sale_price: 1000000,
        },
        {
          zip_code: '10001',
          state: 'NY',
          period_end: '2024-01-01',
          median_sale_price: 800000,
        },
      ];

      const results = validateZipDataBatch(rawDataArray);
      expect(results).toHaveLength(2);
      expect(results[0].zipCode).toBe('90210');
      expect(results[1].zipCode).toBe('10001');
    });

    it('filters out invalid data', () => {
      const rawDataArray: RawZipData[] = [
        {
          zip_code: '90210',
          state: 'CA',
          period_end: '2024-01-01',
        },
        {
          zip_code: 'invalid',
          state: 'CA',
          period_end: '2024-01-01',
        },
      ];

      const results = validateZipDataBatch(rawDataArray);
      expect(results).toHaveLength(1);
      expect(results[0].zipCode).toBe('90210');
    });
  });
});