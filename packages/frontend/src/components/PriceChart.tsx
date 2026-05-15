import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, type IChartApi, ColorType, AreaSeries } from 'lightweight-charts';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';

interface TradePoint {
  blockTs: string;
  priceRaw: string;
  isBuy: boolean;
  bnbAmount: string;
  txHash: string;
}

export interface ParsedTrade {
  timestamp: number;
  isBuy: boolean;
  bnbAmount: number;
  price: number;
  txHash: string;
}

interface PriceChartProps {
  tokenLaunchId: string;
  height?: number;
  onTradesLoaded?: (trades: ParsedTrade[]) => void;
}

export default function PriceChart({ tokenLaunchId, height = 360, onTradesLoaded }: PriceChartProps) {
  const { t } = useTranslation('components');
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<any>(null);
  const [tradeCount, setTradeCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchAndUpdate = useCallback(async () => {
    try {
      const { data } = await api.get<TradePoint[]>(`/tokens/${tokenLaunchId}/trades?limit=100`);
      const parsed: ParsedTrade[] = data
        .map((row) => {
          const price = parseFloat(row.priceRaw);
          const ts = Number(row.blockTs);
          if (!isFinite(price) || price <= 0 || !ts) return null;
          return { timestamp: ts * 1000, isBuy: row.isBuy, bnbAmount: parseFloat(row.bnbAmount), price, txHash: row.txHash };
        })
        .filter(Boolean) as ParsedTrade[];

      parsed.sort((a, b) => a.timestamp - b.timestamp);
      setTradeCount(parsed.length);
      onTradesLoaded?.(parsed);

      if (seriesRef.current) {
        const chartData = parsed.map((p) => ({
          time: Math.floor(p.timestamp / 1000) as any,
          value: p.price,
        }));
        const deduped = chartData.filter((d, i) => i === 0 || d.time !== chartData[i - 1].time);
        seriesRef.current.setData(deduped);

        const ts = chartRef.current?.timeScale();
        if (ts && deduped.length > 0) {
          const dataStart = deduped[0].time as number;
          const dataEnd = deduped[deduped.length - 1].time as number;
          const span = Math.max(dataEnd - dataStart, 3600);
          const padding = Math.round(span * 0.2);
          ts.setVisibleRange({
            from: (dataStart - padding) as any,
            to: (dataEnd + padding + 3600) as any,
          });
        }
      }
    } catch {}
    setLoading(false);
  }, [tokenLaunchId, onTradesLoaded]);

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

    const series = chart.addSeries(AreaSeries, {
      lineColor: '#26a69a',
      topColor: 'rgba(38, 166, 154, 0.3)',
      bottomColor: 'rgba(38, 166, 154, 0.02)',
      lineWidth: 2,
      priceFormat: { type: 'price', precision: 12, minMove: 0.000000000001 },
      crosshairMarkerRadius: 4,
      crosshairMarkerBorderColor: '#26a69a',
      crosshairMarkerBackgroundColor: '#26a69a',
      lastValueVisible: true,
      priceLineVisible: false,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const observer = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [height]);

  useEffect(() => {
    fetchAndUpdate();
    const timer = setInterval(fetchAndUpdate, 30_000);
    return () => clearInterval(timer);
  }, [fetchAndUpdate]);

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
          {!loading && tradeCount === 0 && (
            <span className="text-[10px] text-muted-foreground">{t('bondingCurve.noData')}</span>
          )}
          {!loading && tradeCount > 0 && (
            <span className="text-[10px] text-muted-foreground/60">{tradeCount} {t('bondingCurve.trades')}</span>
          )}
        </div>
      </div>
      <div ref={containerRef} className="w-full" />
    </div>
  );
}
