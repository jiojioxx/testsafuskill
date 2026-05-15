/**
 * CDPV2 Bonding Curve calculator for Flap Protocol
 * Formula: (x + h)(y + r) = K
 */
export class CDPV2 {
  private r: number;
  private h: number;
  private k: number;

  static readonly BILLION = 1_000_000_000;

  static getCurve(r: number, h?: number, k?: number): CDPV2 {
    if (h == null) {
      return new CDPV2(r, 0, 1e9 * r);
    }
    return new CDPV2(r, h!, k!);
  }

  constructor(r: number, h = 0, k = 0) {
    this.r = r;
    this.h = h;
    this.k = k;
  }

  /** Estimate circulating supply given reserve */
  estimateSupply(reserve: number): number {
    if (!reserve) return 0;
    return CDPV2.BILLION + this.h - this.k / (reserve + this.r);
  }

  /** Estimate reserve given circulating supply */
  estimateReserve(supply: number): number {
    if (!supply) return 0;
    return this.k / (CDPV2.BILLION + this.h - supply) - this.r;
  }

  /** Token price at given supply */
  price(supply: number): number {
    const denom = CDPV2.BILLION + this.h - (supply || 0);
    return this.k / (denom * denom);
  }

  /** Fully diluted valuation */
  fdv(supply: number): number {
    return this.price(supply) * CDPV2.BILLION;
  }

  /** Market cap */
  mc(reserve: number): number {
    const supply = this.estimateSupply(reserve);
    return this.fdv(supply);
  }

  /**
   * Preview buy: how many tokens for given BNB input
   * @param currentSupply current circulating supply (in tokens, not wei)
   * @param inputBnb BNB amount
   * @param taxRate tax rate (0-1, e.g. 0.01 for 1%)
   * @param dexSupplyThresh graduation threshold (default 800M)
   */
  previewBuy(currentSupply: number, inputBnb: number, taxRate = 0, dexSupplyThresh = 800_000_000): number {
    const fee = 0.01 + taxRate;
    const inputAfterFee = inputBnb * (1 - fee);

    const maxReserve = this.estimateReserve(dexSupplyThresh);
    const currReserve = this.estimateReserve(currentSupply);

    const newReserve = currReserve + Math.min(inputAfterFee, maxReserve - currReserve);
    const newSupply = this.estimateSupply(newReserve);

    return Math.max(0, newSupply - currentSupply);
  }

  /**
   * Preview sell: how much BNB for given token amount
   * @param currentSupply current circulating supply
   * @param tokenAmount tokens to sell
   * @param taxRate tax rate (0-1)
   */
  previewSell(currentSupply: number, tokenAmount: number, taxRate = 0): number {
    const fee = 0.01 + taxRate;

    const currReserve = this.estimateReserve(currentSupply);
    const newReserve = this.estimateReserve(currentSupply - tokenAmount);

    const outputBeforeFee = currReserve - newReserve;
    return Math.max(0, outputBeforeFee * (1 - fee));
  }
}
