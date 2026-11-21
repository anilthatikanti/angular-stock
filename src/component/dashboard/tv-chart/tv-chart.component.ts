import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CardModule } from 'primeng/card';
import {
  IStockData,
  ITickerData,
} from '../../../shared/interface/stock.interface';
import { CommonModule } from '@angular/common';
import { createChart, Time } from 'lightweight-charts';
import { firstValueFrom } from 'rxjs';
import { HistoryData } from '../../../shared/interface/response.interface';
import { MessageService } from 'primeng/api';
import { HttpClient } from '@angular/common/http';
import { SERVER_URL } from '../../../environments/environment';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DropdownModule } from 'primeng/dropdown';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-tv-chart',
  standalone: true,
  imports: [
    CardModule,
    CommonModule,
    ProgressSpinnerModule,
    DropdownModule,
    FormsModule,
  ],
  templateUrl: './tv-chart.component.html',
  styleUrl: './tv-chart.component.css',
})
export class TvChartComponent implements AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('chartContainer') chartContainerRef: ElementRef | undefined;
  @Input() isParentLoading: boolean = true;
  @Input() liveDataMap: { [symbol: string]: ITickerData } = {};
  @Input() selectedStock!: IStockData;
  @Input() chartData!: ITickerData;
  innerHeight: number = window.innerHeight;
  innerWidth: number = window.innerWidth;
  ChartAreaSeries!: any;
  selectedChartStatisticData!: any;
  chart: any;
  stockHistoryData!: { time: Time; value: number }[];
  // private isChartInitialized: boolean = false;
  
  private lastChartUpdate: number = 0;
  private chartUpdateThrottle: number = 100; // ms
  // Max points kept on the chart. 7 days of 1-minute NSE data is ~1,900 points; the old
  // limit of 1000 silently cut the first days off.
  private chartDataLimit: number = 5000;
  private chartUpdateTimeout: any;
  private resizeObserver?: ResizeObserver;
  isChartLoading: boolean = false;
  
  timeIntervalOptions: { name: string; code: string }[] = [
    { name: '1 Min', code: '1m' },
    { name: '2 Min', code: '2m' },
    { name: '5 Min', code: '5m' },
    { name: '15 Min', code: '15m' },
    { name: '30 Min', code: '30m' },
    { name: '1 Hr', code: '1h' },
    { name: '1 Day', code: '1d' },
    { name: '5 Day', code: '5d' },
    { name: '1 week', code: '1wk' },
    { name: '1 Month', code: '1mo' },
    { name: '3 Months', code: '3mo' }
  ];
  timePeriodOptions: { name: string; code: string; disabled?: boolean }[] = [
    { name: '1 Day', code: '1d' },
    { name: '7 Days', code: '7d' },
    { name: '1 Month', code: '1m' },
    { name: '3 Months', code: '3m' },
    { name: '6 Months', code: '6m' },
    { name: '1 Year', code: '1y' }
  ];
  // Selected values are the option objects themselves so the dropdowns can match them.
  interval: { name: string; code: string } = this.timeIntervalOptions[0]; // 1 Min
  timePeriod: { name: string; code: string; disabled?: boolean } = this.timePeriodOptions[1]; // 7 Days
  @HostListener('window:resize', ['$event'])
  onWindowResize() {
    this.innerHeight = window.innerHeight;
    this.innerWidth = window.innerWidth;
    if (this.chart) {
      const { height, width } = this.getResponsiveChartSize(8);
      this.chart.resize(width, height - 275);
    }
  }
  // Yahoo only serves intraday data for a limited look-back window (in days).
  private readonly maxRangeDaysByInterval: Record<string, number> = {
    '1m': 7,
    '2m': 60,
    '5m': 60,
    '15m': 60,
    '30m': 60,
    '1h': 730,
  };

  constructor(
    private messageService: MessageService,
    private http: HttpClient
  ) {
    this.updatePeriodOptions();
  }

  private periodToDays(code: string): number {
    const match = code.match(/^(\d+)([dwmy])$/);
    if (!match) return 0;
    const perUnit: Record<string, number> = { d: 1, w: 7, m: 30, y: 365 };
    return parseInt(match[1]) * perUnit[match[2]];
  }

  private isValidCombination(periodCode: string, intervalCode: string): boolean {
    const days = this.periodToDays(periodCode);
    const maxDays = this.maxRangeDaysByInterval[intervalCode] ?? Infinity;
    const intervalMs = this.parseIntervalToMs(intervalCode);
    // Within Yahoo's look-back limit, and long enough to hold more than one point.
    return days <= maxDays && days * 24 * 60 * 60 * 1000 > intervalMs;
  }

  // Disable periods Yahoo can't serve for the chosen interval.
  private updatePeriodOptions() {
    for (const option of this.timePeriodOptions) {
      option.disabled = !this.isValidCombination(option.code, this.interval.code);
    }
  }

  onIntervalChange() {
    this.updatePeriodOptions();
    if (!this.isValidCombination(this.timePeriod.code, this.interval.code)) {
      // Pick the longest period that works with this interval.
      const fallback = [...this.timePeriodOptions].reverse().find((o) => !o.disabled);
      if (fallback) this.timePeriod = fallback;
    }
    this.displayChart(this.selectedStock);
  }

  ngOnChanges(changes: SimpleChanges): void {
    // console.log('selectedStock', this.selectedChartStatisticData)
    if (
      changes['selectedStock']?.previousValue !==
      changes['selectedStock']?.currentValue
    ) {
      this.displayChart(changes['selectedStock'].currentValue);
    } else if (
      changes['chartData']?.previousValue !== changes['chartData']?.currentValue
    ) {
      this.upDateChartData(changes['chartData'].currentValue);
    }
  }
  ngAfterViewInit(): void {
    // Initialize chart after view is ready
    setTimeout(() => this.initializeChart(), 0);
  }
  getResponsiveChartSize(rem: number = 8) {
    const vh = window.innerHeight;
    const vw = parseFloat(
      getComputedStyle(this.chartContainerRef?.nativeElement).width
    );
    const height = vh;
    const width = vw; // tweak as per sidebar/padding
    return { height, width };
  }

  getFormattedChange(symbol: string): string {
    const data = this.liveDataMap[symbol];
    if (!data) return '0.00 (0.00%)';
    const stats = this.selectedChartStatisticData;
    if (!this.isChartLoading && stats && symbol === this.selectedStock?.symbol && data.price) {
      // Keep the day's panel current: Close follows the live price; High/Low widen.
      stats.Close = data.price;
      if (data.price > stats.High) stats.High = data.price;
      if (stats.Low && data.price < stats.Low) stats.Low = data.price;
    }
    const ch = (data?.change ?? 0).toFixed(2);
    const chp = (data?.changePercent ?? 0).toFixed(2);
    return `${data?.change >= 0 ? '+ ' : ''}${ch} (${
      data?.changePercent >= 0 ? '+ ' : ''
    }${chp}%)`;
  }

  private async initializeChart() {
    try {
      if (!this.chartContainerRef) {
        throw new Error('Chart container not found');
      }

      // Ensure container has dimensions
      if (
        this.chartContainerRef.nativeElement.offsetHeight === 0 ||
        this.chartContainerRef.nativeElement.offsetWidth === 0
      ) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        if (
          this.chartContainerRef.nativeElement.offsetHeight === 0 ||
          this.chartContainerRef.nativeElement.offsetWidth === 0
        ) {
          throw new Error('Chart container has no dimensions');
        }
      }

      await this.createChart();
      // this.isChartInitialized = true;

      // Load initial chart data after initialization
      if (this.selectedStock) {
        await this.displayChart(this.selectedStock);
      }
    } catch (error) {
      console.error('Error initializing chart:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to initialize chart. Please try again.',
      });
    } finally {
      this.isChartLoading = false;
    }
  }

  private async createChart() {
    return new Promise<void>((resolve, reject) => {
      try {
        if (!this.chartContainerRef) {
          reject(new Error('Chart container not found'));
          return;
        }
        const { height, width } = this.getResponsiveChartSize(8);

        const chartOptions = {
          // width:this.innerWidth - 610,height: this.innerHeight - 278,
          width: width,
          height: height - 275,
          layout: {
            textColor: 'black',
            background: { color: 'white' },
          },
          grid: {
            vertLines: { visible: false },
            horzLines: { visible: false },
          },
          // Show times in the viewer's local time zone (the library defaults to UTC,
          // which put NSE's 09:15-15:30 IST session at 03:45-10:00).
          localization: {
            timeFormatter: (time: number) =>
              new Date(time * 1000).toLocaleString(undefined, {
                day: '2-digit',
                month: 'short',
                year: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              }),
          },
          timeScale: {
            timeVisible: true,
            secondsVisible: false,
            fixLeftEdge: true,
            fixRightEdge: true,
            lockVisibleTimeRangeOnResize: true,
            tickMarkFormatter: (time: number, tickMarkType: number) => {
              const d = new Date(time * 1000);
              switch (tickMarkType) {
                case 0: // year
                  return String(d.getFullYear());
                case 1: // month
                  return d.toLocaleString(undefined, { month: 'short' });
                case 2: // day of month
                  return String(d.getDate());
                default: // time
                  return d.toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  });
              }
            },
          },
          rightPriceScale: {
            borderVisible: false,
          },
          handleScroll: {
            mouseWheel: true,
            pressedMouseMove: true,
            horzTouchDrag: true,
            vertTouchDrag: true,
          },
        };

        this.chart = createChart(
          this.chartContainerRef.nativeElement,
          chartOptions
        );

        // Follow the container's width. It changes after the chart is created (loader,
        // Nifty list, scrollbars) without a window resize; a stale width made the chart
        // wider than its card and the price scale overflowed.
        const container = this.chartContainerRef.nativeElement as HTMLElement;
        this.resizeObserver = new ResizeObserver(() => {
          const width = Math.floor(container.getBoundingClientRect().width);
          if (width > 0 && this.chart) this.chart.applyOptions({ width });
        });
        this.resizeObserver.observe(container);
        this.ChartAreaSeries = this.chart.addAreaSeries({
          lineColor: '#2962FF',
          topColor: '#2962FF',
          bottomColor: 'rgba(41, 98, 255, 0.28)',
          priceFormat: {
            type: 'price',
            precision: 2,
            minMove: 0.01,
          },
        });
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Values for the Open / Close / Low / High panel: the DAY's figures, not the last chart
   * candle (with a 1-minute interval that is a single minute, often O = H = L = C).
   * Uses the quote's day values when present, otherwise the candles of the latest
   * trading day in the history.
   */
  private getDayStatistics(stock: IStockData, payload: any[]) {
    const last = payload[payload.length - 1];
    if (!last) return undefined; // no history -> panel hidden (template checks for it)
    const ohlc = stock?.ohlc;
    if (ohlc && ohlc.Open > 0 && ohlc.High > 0 && ohlc.Low > 0) {
      return {
        ...last,
        Open: ohlc.Open,
        High: ohlc.High,
        Low: ohlc.Low,
        Close: stock.current_price || ohlc.Close || last.Close,
        Volume: ohlc.Volume,
      };
    }

    // Fallback: candles from the same IST calendar day as the latest candle.
    const istDay = (iso: string) =>
      new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const lastDay = istDay(last.Datetime);
    const dayCandles = payload.filter((c) => istDay(c.Datetime) === lastDay);
    return {
      ...last,
      Open: dayCandles[0].Open,
      High: Math.max(...dayCandles.map((c) => c.High)),
      Low: Math.min(...dayCandles.map((c) => c.Low)),
      Close: last.Close,
      Volume: dayCandles.reduce((sum, c) => sum + (c.Volume || 0), 0),
    };
  }

  async displayChart(stock: IStockData = this.selectedStock) {
    if (!this.ChartAreaSeries) {
      console.warn('Chart not initialized yet');
      return;
    }

    this.isChartLoading = true;
    try {
      const historyData: HistoryData = await firstValueFrom(
        this.http.get<HistoryData>(
          `${SERVER_URL}/stocks/history?symbol=${stock.symbol}&interval=${this.interval.code}&period=${this.timePeriod.code}`
        )
      );

      if (historyData.status) {
        this.stockHistoryData = historyData.payload
          .slice(-this.chartDataLimit)
          .map((item) => ({
            time: Math.floor(new Date(item.Datetime).getTime() / 1000) as Time,
            value: item.Close,
          }));

        this.selectedChartStatisticData = this.getDayStatistics(
          stock,
          historyData.payload
        );
        this.ChartAreaSeries.setData(this.stockHistoryData);
        this.chart.timeScale().fitContent();
        this.selectedStock = stock;
        if (this.stockHistoryData.length === 0) {
          this.messageService.add({
            severity: 'info',
            summary: 'No chart data',
            detail: `No ${this.interval.name} data for ${stock.name} in ${this.timePeriod.name}.`,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching history data:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to fetch stock history data.',
      });
    } finally {
      this.isChartLoading = false;
    }
  }

  upDateChartData(data: ITickerData) {
    if (
      // !this.isChartInitialized ||
      !this.ChartAreaSeries ||
      !this.selectedStock ||
      !this.selectedChartStatisticData
    ) {
      return;
    }

    if (this.selectedStock.symbol === data.id) {
      const now = Date.now();
      if (now - this.lastChartUpdate < this.chartUpdateThrottle) {
        clearTimeout(this.chartUpdateTimeout);
        this.chartUpdateTimeout = setTimeout(
          () => this.updateChartWithData(data),
          this.chartUpdateThrottle
        );
        return;
      }
      this.updateChartWithData(data);
      this.lastChartUpdate = now;
    }
  }
  private parseIntervalToMs(intervalCode: string): number {
  const match = intervalCode.match(/^(\d+)([a-zA-Z]+)$/);
  if (!match) return 0;

  const [, valueStr, unit] = match;
  const value = parseInt(valueStr);

  const multipliers: Record<string, number> = {
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    wk: 7 * 24 * 60 * 60 * 1000,
    mo: 30 * 24 * 60 * 60 * 1000, // rough month
  };

  return multipliers[unit] ? value * multipliers[unit] : 0;
}

private updateChartWithData(data: ITickerData) {
  if (this.isChartLoading) return;
  else if (
    !this.ChartAreaSeries ||
    !this.selectedChartStatisticData ||
    !this.stockHistoryData
  ) {
    return;
  }

  try {
    const intervalSec = this.parseIntervalToMs(this.interval.code) / 1000;
    if (!intervalSec || this.stockHistoryData.length === 0) return;

    // Chart times are UTC epoch seconds (same as the history data), so no
    // time-zone conversion is needed here.
    const last = this.stockHistoryData[this.stockHistoryData.length - 1];
    const lastTime = Number(last.time);
    const nowSec = Math.floor(Date.now() / 1000);
    const intervalsPassed = Math.floor((nowSec - lastTime) / intervalSec);

    // marketHours comes from the server (1 = regular NSE session, holidays included).
    if (data.marketHours === 1 && intervalsPassed >= 1) {
      // A new candle period has started: add a point aligned to the interval.
      const nextTime = lastTime + intervalsPassed * intervalSec;
      this.stockHistoryData.push({ time: nextTime as Time, value: data.price });
      this.selectedChartStatisticData.Datetime = new Date(nextTime * 1000).toISOString();

      if (this.stockHistoryData.length > this.chartDataLimit) {
        this.stockHistoryData = this.stockHistoryData.slice(-this.chartDataLimit);
      }
      this.ChartAreaSeries.setData(this.stockHistoryData);
    } else if (last.value !== data.price) {
      // Same candle period: move the latest point.
      last.value = data.price;
      this.ChartAreaSeries.update(last);
    }
  } catch (error) {
    console.error('Error updating chart data:', error);
  }
}

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    if (this.chart) {
      this.chart.remove();
    }
    if (this.chartUpdateTimeout) {
      clearTimeout(this.chartUpdateTimeout);
    }
  }
}
