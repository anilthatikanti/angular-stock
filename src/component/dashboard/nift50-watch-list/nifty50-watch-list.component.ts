import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { Button } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { DividerModule } from 'primeng/divider';
import {
  IStock,
  IStockData,
  ITickerData,
  IWatchList,
} from '../../../shared/interface/stock.interface';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { MessageService } from 'primeng/api';
import { StockService } from '../../../shared/services/stock.service';
import { TabViewModule } from 'primeng/tabview';
import { FormsModule } from '@angular/forms';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  from,
  map,
  of,
  Subject,
  Subscription,
  switchMap,
} from 'rxjs';

@Component({
  selector: 'app-nifty50-watch-list',
  standalone: true,
  imports: [
    Button,
    DialogModule,
    CommonModule,
    DividerModule,
    CardModule,
    OverlayPanelModule,
    TabViewModule,
    FormsModule,
  ],
  templateUrl: './nifty50-watch-list.component.html',
  styleUrl: './nifty50-watch-list.component.css',
})
export class Nifty50WatchListComponent implements OnInit, OnDestroy {
  @Input() nifty50: IStockData[] = [];
  @Input() liveDataMap: { [symbol: string]: ITickerData } = {};
  @Output() selectingStockEvent: EventEmitter<IStockData> =
    new EventEmitter<IStockData>();

  watchListData: IWatchList[] = [];
  activeTabViewIndex: number = 0;
  editWatchList?: IWatchList;
  createWatchListName: string = '';
  searchSubject: Subject<string> = new Subject();

  createWatchListDialogVisible: boolean = false;
  private subscriptions = new Subscription();

  constructor(
    private messageService: MessageService,
    private stockService: StockService
  ) {
    // Search box: empty -> Nifty 50 list; text -> any ticker via /stocks/search.
    // switchMap ignores results of older, slower searches.
    this.subscriptions.add(
      this.searchSubject
        .pipe(
          debounceTime(400),
          map((value) => value.trim()),
          distinctUntilChanged(),
          switchMap((query) =>
            query
              ? from(this.stockService.searchStocks(query)).pipe(
                  catchError(() => {
                    this.messageService.add({
                      severity: 'error',
                      summary: 'Search error',
                      detail: 'Unable to search stocks. Please try again.',
                    });
                    return of(null);
                  })
                )
              : of(this.stockService.nifty50Data)
          )
        )
        .subscribe((stocks) => {
          if (stocks) this.nifty50 = stocks;
        })
    );
  }

  ngOnInit(): void {
    this.loadWatchListData();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  async loadWatchListData() {
    try {
      this.watchListData = await this.stockService.getWatchListData();
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Watchlist error',
        detail: 'Unable to load your watchlists. Please refresh the page.',
      });
      return;
    }
    this.syncLiveSymbols();
  }

  // Live prices for every stock in the watchlists, not only Nifty 50 ones.
  private syncLiveSymbols() {
    const symbols = this.watchListData.flatMap((w) =>
      (w.stocks ?? []).map((s) => s.symbol)
    );
    this.stockService.setWatchListSymbols(symbols);
  }

  private isInWatchList(symbol: string, watchList: IWatchList): boolean {
    return !!watchList.stocks?.some((s) => s.symbol === symbol);
  }

  searchStock(event: any) {
    this.searchSubject.next(event.target.value ?? '');
  }

  selectingStock(stock: IStockData) {
    this.selectingStockEvent.emit(stock);
  }

  async deleteWatchListItem(watchListItem: IWatchList, stockItem: IStock) {
    try {
      const res = await this.stockService.deleteWatchListItem(
        watchListItem._id,
        stockItem.symbol
      );
      if (!res.status) {
        this.messageService.add({
          severity: 'error',
          summary: `Watchlist item delete error`,
          detail: `${res.message}`,
        });
        return;
      }
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: `Watchlist item delete error`,
        detail: `Unable to delete ${stockItem.longName}. Please try again.`,
      });
      return;
    }

    const watchList = this.watchListData.find(
      (w) => w._id === watchListItem._id
    );
    if (watchList) {
      watchList.stocks = watchList.stocks.filter(
        (stock: IStock) => stock.symbol !== stockItem.symbol
      );
    }
    this.syncLiveSymbols();
    this.messageService.add({
      severity: 'success',
      summary: `${watchListItem.watchListName} stock deleted.`,
      detail: `${stockItem.longName} deleted from ${watchListItem.watchListName}.`,
    });
  }

  // "+" menu: works for Nifty 50 stocks and for any stock found by the search.
  async updateWatchList(
    op: any,
    event: any,
    stock: IStockData,
    watchListId: string
  ) {
    const watchList = this.watchListData.find((w) => w._id === watchListId);
    if (!watchList) {
      op.toggle(event);
      return;
    }
    if (this.isInWatchList(stock.symbol, watchList)) {
      this.messageService.add({
        severity: 'info',
        summary: 'Already added',
        detail: `${stock.name} is already in ${watchList.watchListName}.`,
      });
      op.toggle(event);
      return;
    }

    try {
      const res = await this.stockService.addStockIntoWatchList(
        watchListId,
        stock
      );
      if (!res.status) {
        this.messageService.add({
          severity: 'error',
          summary: `Watchlist item add error`,
          detail: `${res.message}`,
        });
        op.toggle(event);
        return;
      }
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: `Watchlist item add error`,
        detail: `Unable to add ${stock.name}. Please try again.`,
      });
      op.toggle(event);
      return;
    }

    watchList.stocks.push({ symbol: stock.symbol, longName: stock.name });
    this.syncLiveSymbols();
    this.messageService.add({
      severity: 'success',
      summary: `${watchList.watchListName} updated.`,
      detail: `${stock.name} added into ${watchList.watchListName}.`,
    });
    op.toggle(event);
  }

  getWatchListStocksCount() {
    return this.watchListData[this.activeTabViewIndex]?.stocks?.length ?? 0;
  }

  async updatedWatchListName(watchListNewName: string) {
    if (!this.editWatchList || this.editWatchList.watchListName === '') return;
    if (this.editWatchList.watchListName === watchListNewName) {
      this.editWatchList = undefined;
      return;
    }
    let res;
    try {
      res = await this.stockService.updateWatchListName(
        this.editWatchList?._id,
        watchListNewName
      );
    } catch {
      res = { status: false, message: 'Unable to rename. Please try again.' };
    }
    if (!res.status) {
      this.messageService.add({
        severity: 'error',
        summary: `Watchlist name update error`,
        detail: `${res.message}`,
      });
      return;
    }
    this.watchListData.forEach((watchList: IWatchList) => {
      if (watchList._id === this.editWatchList?._id) {
        this.messageService.add({
          severity: 'success',
          summary: `Watch list name updated`,
          detail: `${watchList.watchListName} is changed to ${watchListNewName}`,
        });
        watchList.watchListName = watchListNewName;
        this.editWatchList = undefined;
      }
      return watchList;
    });
  }

  async createWatchList() {
    if (this.watchListData.length < 6) {
      let index = this.watchListData.findIndex(
        (watchList) => watchList.watchListName === this.createWatchListName
      );
      if (index === -1) {
        let res;
        try {
          res = await this.stockService.createWatchList(
            this.createWatchListName
          );
        } catch {
          res = { status: false, message: 'Unable to create. Please try again.' };
        }
        if (!res.status) {
          this.messageService.add({
            severity: 'error',
            summary: `Watchlist create error`,
            detail: `${res.message}`,
          });
          this.createWatchListDialogVisible = false;
          return;
        }
        this.watchListData.push(res.payload);
        this.createWatchListDialogVisible = false;
        this.createWatchListName = '';
      } else {
        this.messageService.add({
          severity: 'warning',
          summary: `Watchlist create error`,
          detail: `${this.createWatchListName} is already exist.`,
        });
      }
    } else {
      this.messageService.add({
        severity: 'info',
        summary: `Maximum 6 watchlist allowed.`,
        detail: `Already reached to maximum watchlists.`,
      });
    }
    this.createWatchListDialogVisible = false;
  }

  cancelNewWatchList() {
    this.createWatchListName = '';
    this.createWatchListDialogVisible = false;
  }

  async deleteWatchList() {
    if (!this.editWatchList) return;
    let res;
    try {
      res = await this.stockService.deleteWatchList(this.editWatchList._id);
    } catch {
      res = { status: false };
    }
    if (!res.status) {
      this.messageService.add({
        severity: 'error',
        summary: `Watchlist delete error`,
        detail: `Unable to delete ${this.editWatchList.watchListName}. Please try again later.`,
      });
      return;
    }
    this.watchListData = this.watchListData.filter(
      (watchList) => watchList._id !== this.editWatchList?._id
    );
    // The service caches the list; keep it in sync so the deleted list doesn't come back.
    this.stockService.watchListData = this.watchListData;
    this.editWatchList = undefined;
    // Keep the open tab valid after removing one.
    this.activeTabViewIndex = Math.min(
      this.activeTabViewIndex,
      Math.max(this.watchListData.length - 1, 0)
    );
    this.syncLiveSymbols();
    this.messageService.add({
      severity: 'success',
      summary: `Watchlist deleted`,
      detail: `Watchlist deleted successfully.`,
    });
  }
}
