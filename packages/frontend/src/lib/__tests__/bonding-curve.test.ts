import { describe, it, expect } from 'vitest';
import { CDPV2 } from '../bonding-curve';

describe('CDPV2 Bonding Curve', () => {
  // BSC default params: r=6.14, h=107036752, k=6797205657.28
  const curve = CDPV2.getCurve(6.14, 107036752, 6797205657.28);

  describe('getCurve', () => {
    it('should create curve with r, h, k params', () => {
      const c = CDPV2.getCurve(6.14, 107036752, 6797205657.28);
      expect(c).toBeDefined();
    });

    it('should create legacy curve when h is undefined', () => {
      const c = CDPV2.getCurve(15);
      expect(c).toBeDefined();
    });
  });

  describe('price', () => {
    it('should return a positive price for non-zero supply', () => {
      const p = curve.price(1_000_000);
      expect(p).toBeGreaterThan(0);
    });

    it('should return higher price for higher supply', () => {
      const p1 = curve.price(1_000_000);
      const p2 = curve.price(100_000_000);
      expect(p2).toBeGreaterThan(p1);
    });

    it('should return a very small price at zero supply', () => {
      const p = curve.price(0);
      expect(p).toBeGreaterThan(0);
      expect(p).toBeLessThan(1);
    });
  });

  describe('estimateSupply / estimateReserve', () => {
    it('should be inverse functions', () => {
      const supply = 50_000_000;
      const reserve = curve.estimateReserve(supply);
      const backToSupply = curve.estimateSupply(reserve);
      expect(Math.abs(backToSupply - supply)).toBeLessThan(1); // rounding tolerance
    });

    it('should return 0 supply for 0 reserve', () => {
      expect(curve.estimateSupply(0)).toBe(0);
    });

    it('should return 0 reserve for 0 supply', () => {
      expect(curve.estimateReserve(0)).toBe(0);
    });
  });

  describe('previewBuy / previewSell', () => {
    it('should return positive tokens for buy', () => {
      const tokens = curve.previewBuy(0, 1, 0); // 1 BNB at 0 supply
      expect(tokens).toBeGreaterThan(0);
    });

    it('should return positive BNB for sell', () => {
      const bnb = curve.previewSell(1_000_000, 500_000, 0);
      expect(bnb).toBeGreaterThan(0);
    });

    it('should return less tokens with tax', () => {
      const noTax = curve.previewBuy(0, 1, 0);
      const withTax = curve.previewBuy(0, 1, 0.05);
      expect(withTax).toBeLessThan(noTax);
    });

    it('should return less BNB when selling with tax', () => {
      const noTax = curve.previewSell(1_000_000, 500_000, 0);
      const withTax = curve.previewSell(1_000_000, 500_000, 0.05);
      expect(withTax).toBeLessThan(noTax);
    });
  });

  describe('fdv / mc', () => {
    it('should return FDV based on current price', () => {
      const fdv = curve.fdv(50_000_000);
      expect(fdv).toBeGreaterThan(0);
    });

    it('should return market cap based on reserve', () => {
      const mc = curve.mc(1);
      expect(mc).toBeGreaterThan(0);
    });
  });
});
