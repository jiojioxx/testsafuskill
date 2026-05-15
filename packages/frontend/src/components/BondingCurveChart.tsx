import { useEffect, useRef, useState, useMemo } from 'react';
import { createChart, type IChartApi, ColorType, LineSeries, AreaSeries } from 'lightweight-charts';
import { formatEther } from 'viem';
import { useTranslation } from 'react-i18next';
import { CDPV2 } from '@/lib/bonding-curve';
import api from '@/lib/api';
import type { Hex } from 'viem';

function computeBondingCurvePoints(
  _r: bigint, h: bigint, k: bigint, _currentSupply: bigint, dexSupplyThresh: bigint, numPoints = 100,
): { supply: number; price: number }[] {
  const rNum = Number(formatEther(_r));
  const hNum = Number(formatEther(h));
  const kNum = Number(formatEther(k)) * 1e18;
  const maxSupply = Number(formatEther(dexSupplyThresh));

  const curve = CDPV2.getCurve(rNum, hNum, kNum);
  const points: { supply: number; price: number }[] = [];
  const step = maxSupply / numPoints;

  for (let i = 0; i <= numPoints; i++) {
    const s = step * i;
    const priceWei = curve.price(s);
    const priceBnb = priceWei / 1e18;
    if (!isFinite(priceBnb) || priceBnb <= 0) break;
    points.push({ supply: s, price: priceBnb });
  }
  return points;
}

interface TradePoint {
  blockTs: string;
  priceRaw: string;
  isBuy: boolean;
  bnbAmount: string;
  supplyRaw: string;
  txHash: string;
}

interface BondingCurveChartProps {
  tokenAddress: Hex;
  chainId: number;
  r: bigint;
  h: bigint;
  k: bigint;
  currentSupply: bigint;
  dexSupplyThresh: bigint;
  /** tokenLaunchId used to fetch trades from API */
  tokenLaunchId?: string;
  creationTxHash?: string;
  height?: number;
}

export default function BondingCurveChart({
  tokenAddress, chainId, r, h, k, currentSupply, dexSupplyThresh, tokenLaunchId, height = 320,
}: BondingCurveChartProps) {
  const { t } = useTranslation('components');
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const areaSeriesRef = useRef<any>(null);
  const curveSeriesRef = useRef<any>(null);

  const [trades, setTrades] = useState<{ timestamp: number; price: number }[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch trades from backend API
  useEffect(() => {
    if (!tokenLaunchId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setTrades([]);
    setLoading(true);

    const fetchTrades = async () => {
      try {
        const { data } = await api.get<TradePoint[]>(`/tokens/${tokenLaunchId}/trades?limit=500`);
        if (cancelled) return;

        const points = data
          .map((t) => {
            const price = parseFloat(t.priceRaw);
            const ts = Number(t.blockTs) * 1000; // blockTs is seconds → ms
            if (!isFinite(price) || price <= 0 || !ts) return null;
            return { timestamp: ts, price };
          })
          .filter(Boolean) as { timestamp: number; price: number }[];

        setTrades(points.sort((a, b) => a.timestamp - b.timestamp));
      } catch (err) {
        console.warn('[Chart] failed to fetch trades from API', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchTrades();
    // Poll every 30s for new trades
    const timer = window.setInterval(fetchTrades, 30_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [tokenLaunchId]);

  // Bonding curve line data
  const curveLineData = useMemo(() => {
    if (!k || k === 0n) return [];
    const points = computeBondingCurvePoints(r, h, k, currentSupply, dexSupplyThresh, 200);
    if (points.length === 0) return [];

    const validPoints = points.filter(p => isFinite(p.price) && p.price > 0);
    if (validPoints.length === 0) return [];

    const now = Math.floor(Date.now() / 1000);
    const curveStart = now - 30 * 24 * 3600;
    const curveEnd = now + 7 * 24 * 3600;
    const timeSpan = Math.max(curveEnd - curveStart, validPoints.length);

    const mapped = validPoints.map((p, i) => ({
      time: (curveStart + Math.floor((i / validPoints.length) * timeSpan)) as any,
      value: p.price,
    }));

    const deduped: typeof mapped = [];
    for (const pt of mapped) {
      if (deduped.length === 0 || pt.time > deduped[deduped.length - 1].time) {
        deduped.push(pt);
      }
    }
    return deduped;
  }, [r, h, k, currentSupply, dexSupplyThresh]);

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgba(150, 150, 150, 0.8)',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(100, 100, 100, 0.08)' },
        horzLines: { color: 'rgba(100, 100, 100, 0.08)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(100, 100, 100, 0.2)',
        scaleMargins: { top: 0.15, bottom: 0.12 },
      },
      leftPriceScale: { visible: false },
      timeScale: {
        borderColor: 'rgba(100, 100, 100, 0.2)',
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        horzLine: { color: 'rgba(100, 100, 100, 0.3)', labelBackgroundColor: '#333' },
        vertLine: { color: 'rgba(100, 100, 100, 0.3)', labelBackgroundColor: '#333' },
      },
    });

    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: '#26a69a',
      topColor: 'rgba(38, 166, 154, 0.3)',
      bottomColor: 'rgba(38, 166, 154, 0.02)',
      lineWidth: 2,
      priceFormat: { type: 'price', precision: 10, minMove: 0.0000000001 },
      priceScaleId: 'right',
      crosshairMarkerRadius: 4,
      crosshairMarkerBorderColor: '#26a69a',
      crosshairMarkerBackgroundColor: '#26a69a',
      lastValueVisible: true,
      priceLineVisible: false,
    });

    const curveSeries = chart.addSeries(LineSeries, {
      color: 'rgba(240, 185, 11, 0.35)',
      lineWidth: 1,
      lineStyle: 2,
      priceFormat: { type: 'price', precision: 10, minMove: 0.0000000001 },
      crosshairMarkerVisible: false,
      priceScaleId: 'curve',
      lastValueVisible: false,
      priceLineVisible: false,
    });

    chart.priceScale('curve').applyOptions({
      scaleMargins: { top: 0.05, bottom: 0.05 },
      visible: false,
    });

    chartRef.current = chart;
    areaSeriesRef.current = areaSeries;
    curveSeriesRef.current = curveSeries;

    const observer = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, [height]);

  // Update chart data whenever trades or curve changes
  useEffect(() => {
    if (!areaSeriesRef.current || !curveSeriesRef.current) return;
    if (loading) return;

    if (trades.length > 0) {
      const sorted = [...trades].sort((a, b) => a.timestamp - b.timestamp);
      const areaData = sorted.map((p) => ({
        time: Math.floor(p.timestamp / 1000) as any,
        value: p.price,
      }));
      const deduped = areaData
        .filter((d, i) => i === 0 || d.time !== areaData[i - 1].time)
        .filter(d => isFinite(d.value) && d.value > 0);
      areaSeriesRef.current.setData(deduped);
    } else {
      areaSeriesRef.current.setData([]);
    }

    if (curveLineData.length > 0) {
      curveSeriesRef.current.setData(curveLineData);
    }

    const ts = chartRef.current?.timeScale();
    if (ts) {
      const now = Math.floor(Date.now() / 1000);
      if (trades.length > 0) {
        const dataStart = Math.floor(trades[0].timestamp / 1000);
        const dataEnd = Math.floor(trades[trades.length - 1].timestamp / 1000);
        const span = Math.max(dataEnd - dataStart, 3600);
        const padding = Math.round(span * 0.2);
        ts.setVisibleRange({
          from: (dataStart - padding) as any,
          to: (dataEnd + padding + 3600) as any,
        });
      } else {
        ts.setVisibleRange({ from: (now - 24 * 3600) as any, to: (now + 3600) as any });
      }
    }
  }, [trades, curveLineData, loading]);

  const hasData = trades.length > 0 || curveLineData.length > 0;

  return (
    <div className="w-full rounded-lg overflow-hidden border border-border bg-card">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-foreground">
            {t('bondingCurve.priceChart')}
          </span>
          {loading && (
            <span className="text-[10px] text-muted-foreground animate-pulse">{t('bondingCurve.loading')}</span>
          )}
          {!loading && !hasData && (
            <span className="text-[10px] text-muted-foreground">{t('bondingCurve.noData')}</span>
          )}
          {!loading && hasData && trades.length > 0 && (
            <span className="text-[10px] text-muted-foreground/60">{trades.length} {t('bondingCurve.trades')}</span>
          )}
          {!loading && hasData && trades.length === 0 && (
            <span className="text-[10px] text-muted-foreground">{t('bondingCurve.noCurve')}</span>
          )}
        </div>
      </div>

      <div ref={containerRef} className="w-full" />
    </div>
  );
}
