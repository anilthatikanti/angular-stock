import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MenuItem, MessageService } from 'primeng/api';
import { TabViewModule } from 'primeng/tabview';
import { StockService } from '../../shared/services/stock.service';
import { FormsModule } from '@angular/forms';
import {
  IStockData,
  ITickerData,
} from '../../shared/interface/stock.interface';
import { GetStockNamePipe } from '../../shared/pips/get-stock-name.pipe';
import { CommonModule, DecimalPipe } from '@angular/common';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { DividerModule } from 'primeng/divider';
import { WatchList } from '../../shared/interface/watchList.interface';
import { ToastModule } from 'primeng/toast';
import { InputTextModule } from 'primeng/inputtext';
import { FloatLabelModule } from 'primeng/floatlabel';
import { debounceTime, firstValueFrom, Subject } from 'rxjs';
import { DialogModule } from 'primeng/dialog';
import { createChart, Time } from 'lightweight-charts';
import { HttpClient } from '@angular/common/http';
import {
  IHistoryData,
  HistoryData,
} from '../../shared/interface/response.interface';
import { SERVER_URL } from '../../environments/environment';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TvChartComponent } from './tv-chart/tv-chart.component';
import { Nifty50WatchListComponent } from './nift50-watch-list/nifty50-watch-list.component';
import { Meta, Title } from '@angular/platform-browser';
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CardModule,
    ButtonModule,
    TabViewModule,
    GetStockNamePipe,
    DecimalPipe,
    CommonModule,
    OverlayPanelModule,
    DividerModule,
    TabViewModule,
    FormsModule,
    ToastModule,
    FloatLabelModule,
    InputTextModule,
    ProgressSpinnerModule,
    DialogModule,
    TvChartComponent,
    Nifty50WatchListComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  nifty50: IStockData[] = [];
  liveDataMap: { [symbol: string]: ITickerData } = {};
  showAddButtonId!: number;
  selectedStock: IStockData = {
    symbol: 'ADANIENT.NS',
    name: 'Adani Enterprises Limited',
    current_price: 0,
    market_cap: 0,
    ohlc: {
      Open: 0,
      High: 0,
      Low: 0,
      Close: 0,
      Volume: 0,
    },
  };

  selectedChartStatisticData!: any;

  watchList: any[] = [];
  items: MenuItem[] = [
    { label: 'Dashboard', icon: 'pi pi-home' },
    { label: 'Transactions', icon: 'pi pi-chart-line' },
    { label: 'Products', icon: 'pi pi-list' },
    { label: 'Messages', icon: 'pi pi-inbox' },
  ];
  // Maximum number of data points to keep

  isLoading: boolean = true;
  loadingMessage: string = 'Loading dashboard...';
  chartData!: ITickerData;
  isChartReady: boolean = false;
  isMarketClosed = false;
  constructor(
    private stockService: StockService,
    private messageService: MessageService,
    private meta: Meta,
    private title: Title
  ) {
    this.loadMeta();
  }

  loadMeta() {
    this.title.setTitle('Dashboard | Angular Stock');
    this.meta.updateTag({
      name: 'description',
      content:
        'Dashboard to your Angular Stock account to manage portfolio and watchlist.',
    });
  }

  async ngOnInit() {
    try {
      this.isLoading = true;
      this.loadingMessage = 'Loading Nifty 50 stocks...';

      // Load Nifty 50 data first
      await this.stockService.loadNifty50Tokens();
      this.nifty50 = this.stockService.nifty50Data;
      this.selectedStock = this.nifty50[0];
      await this.initializeWebSocket();
    } catch (error) {
      console.error('Error initializing dashboard:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to initialize dashboard. Please refresh the page.',
      });
    } finally {
      this.isLoading = false;
    }
  }

  async initializeWebSocket() {
    // Initialize WebSocket connection
    this.loadingMessage = 'Connecting to live data...';
    const symbols = this.nifty50.map((data: IStockData) => data.symbol);
    await this.stockService.connect(symbols);

    // Subscribe to live data
    this.stockService.liveData$.subscribe((data: ITickerData | any) => {
      if (data.type === 'closed') {
        this.isMarketClosed = true;
        this.loadingMessage = data.message;
        return;
      }
      this.liveDataMap[data.id] = data;
      this.isMarketClosed = false;
      if (this.selectedStock.symbol === data.id) {
        this.chartData = data;
      }
    });
  }
  ngOnDestroy() {
    this.stockService.disconnect();
    this.stockService.liveData$.unsubscribe();
  }
}
