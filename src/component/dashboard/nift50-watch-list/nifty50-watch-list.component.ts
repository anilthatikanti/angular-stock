import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
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
// import { WatchList } from '../../../shared/interface/watchList.interface';
import {
  StockService,
  // watchListData,
} from '../../../shared/services/stock.service';
import { TabViewModule } from 'primeng/tabview';
import { FormsModule } from '@angular/forms';
import { debounceTime, Subject } from 'rxjs';

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
export class Nifty50WatchListComponent implements OnInit {
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

  constructor(
    private messageService: MessageService,
    private stockService: StockService
  ) {
    this.searchSubject.pipe(debounceTime(150)).subscribe((value) => {
      this.nifty50 = this.stockService.nifty50Data.filter(
        (data: IStockData) => {
          return data.name.toUpperCase().startsWith(value.trim().toUpperCase());
        }
      );
    });
  }

  ngOnInit(): void {
    this.loadWatchListData();
  }

  async loadWatchListData() {
    this.watchListData = await this.stockService.getWatchListData();
    console.log('this.watchListData', this.watchListData);
  }
  searchStock(event: any) {
    this.searchSubject.next(event.target.value);
  }

  selectingStock(stock: IStockData) {
    this.selectingStockEvent.emit(stock);
  }

  async deleteWatchListItem(watchListItem: IWatchList, stockItem: IStock) {
    let res = await this.stockService.deleteWatchListItem(
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

    this.watchListData.forEach((watchList: IWatchList) => {
      if (watchList._id === watchListItem._id) {
        watchListItem = watchList;
        watchList.stocks = watchList.stocks.filter(
          (stock: IStock) => stock.symbol !== stockItem.symbol
        );
      }
      return watchList;
    });
    this.messageService.add({
      severity: 'success',
      summary: `${watchListItem.watchListName} stock deleted.`,
      detail: `${stockItem.longName} deleted from ${watchListItem.watchListName}.`,
    });
  }

  async updateWatchList(
    op: any,
    event: any,
    stock: IStockData,
    watchListId: string
  ) {
    let res = await this.stockService.addStockIntoWatchList(watchListId, stock);
    if (!res.status) {
      this.messageService.add({
        severity: 'error',
        summary: `Watchlist item add error`,
        detail: `${res.message}`,
      });
      op.toggle(event);
      return;
    }
    this.watchListData.forEach((watchList: IWatchList) => {
      if (watchList._id === `${watchListId}`) {
        let index = watchList.stocks.findIndex(
          (item: IStock) => item.symbol === stock.symbol
        );
        if (index == -1) {
          watchList.stocks.push({ symbol: stock.symbol, longName: stock.name });
          this.messageService.add({
            severity: 'success',
            summary: `${watchList.watchListName} updated.`,
            detail: `${stock.name} added into ${watchList.watchListName}.`,
          });
        }
      }
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
    let res = await this.stockService.updateWatchListName(
      this.editWatchList?._id,
      watchListNewName
    );
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

  createWatchList() {
    if (this.watchListData.length < 6) {
      let index = this.watchListData.findIndex(
        (watchList) => watchList.watchListName === this.createWatchListName
      );
      if (index === -1) {
        this.watchListData.push({
          _id: `${Date.now()}`,
          watchListName: this.createWatchListName,
          stocks: [],
        });
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
  deleteWatchList() {
    this.watchListData = this.watchListData.filter(
      (watchList) => watchList._id !== this.editWatchList?._id
    );
    this.editWatchList = undefined;
  }
}
