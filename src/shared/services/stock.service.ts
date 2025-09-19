import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
  ApiResponse,
  ApiWatchListResponse,
} from '../interface/response.interface';
import {
  IClosed,
  IStockData,
  ITickerData,
  IWatchList,
} from '../interface/stock.interface';
import { firstValueFrom, ReplaySubject, Subject } from 'rxjs';
// import { IWatchList } from '../interface/watchList.interface';
import { Auth } from '@angular/fire/auth';
import { WEB_SOCKET, SERVER_URL } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class StockService {
  nifty50Data: IStockData[] = [];
  liveData$: Subject<ITickerData | IClosed> = new Subject<
    ITickerData | IClosed
  >();
  dataMap: Map<number, ITickerData> = new Map<number, ITickerData>();
  ws!: WebSocket;
  isTockensLoaded: boolean = false;
  watchListData: IWatchList[] = [];
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private messageBuffer: ITickerData[] = [];
  private bufferSize: number = 10;
  private bufferTimeout: number = 100; // ms

  constructor(private http: HttpClient, private firebaseAuth: Auth) {}

  async loadNifty50Tokens(): Promise<void> {
    try {
      const data = await firstValueFrom(
        this.http.get<ApiResponse>(`${SERVER_URL}/stocks/nifty50`)
      );
      if (data.status) {
        this.nifty50Data = data.payload;
        this.isTockensLoaded = true;
      }
    } catch (error) {
      console.error('Error loading Nifty 50 tokens', error);
    }
  }

  private async connectWebSocket(nifty50InstrumentalTokens: string[]) {
    try {
      const jwtToken: any = await this.firebaseAuth.currentUser?.getIdToken();
      if (!jwtToken) {
        throw new Error('No authentication token available');
      }
      if (!this.ws) {
        this.ws = new WebSocket(WEB_SOCKET, jwtToken);
      }
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.ws.send(
          JSON.stringify({
            action: 'subscribe',
            variables: nifty50InstrumentalTokens,
            type: 'ltp',
          })
        );
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.handleReconnect(nifty50InstrumentalTokens);
      };

      this.ws.onclose = (event) => {
        console.warn('WebSocket closed:', event);
        // this.handleReconnect(nifty50InstrumentalTokens);
      };

      this.ws.onmessage = (event) => {
        try {
          const stocks = JSON.parse(event.data);
          if (Array.isArray(stocks)) {
            this.bufferMessages(stocks);
          } else {
            this.bufferMessages([stocks]);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
    } catch (error) {
      console.error('Error establishing WebSocket connection:', error);
      // this.handleReconnect(nifty50InstrumentalTokens);
    }
  }

  private handleReconnect(tokens: string[]) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(
        `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
      );
      setTimeout(
        () => this.connectWebSocket(tokens),
        this.reconnectDelay * this.reconnectAttempts
      );
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  private bufferMessages(messages: ITickerData[]) {
    this.messageBuffer = [...this.messageBuffer, ...messages];

    if (this.messageBuffer.length >= this.bufferSize) {
      this.flushBuffer();
    } else {
      setTimeout(() => this.flushBuffer(), this.bufferTimeout);
    }
  }

  private flushBuffer() {
    if (this.messageBuffer.length > 0) {
      this.messageBuffer.forEach((stock) => this.liveData$.next(stock));
      this.messageBuffer = [];
    }
  }

  async getWatchListData() {
    if (this.watchListData.length) return this.watchListData;
    let data = await firstValueFrom(
      this.http.get<ApiWatchListResponse>(`${SERVER_URL}/stocks/get-watchlist`)
    );
    if (data.status) {
      this.watchListData = data.payload;
    }
    return this.watchListData;
  }

  async connect(nifty50InstrumentalTokens: string[]) {
    if (this.liveData$?.closed || !this.liveData$) {
      this.liveData$ = new ReplaySubject<ITickerData | IClosed>(1);
    }
    await this.connectWebSocket(nifty50InstrumentalTokens);
  }

  disconnect() {
    if (this.ws) {
      console.log('🚫 Closing WebSocket...');
      this.ws.close(); // ✅ Properly close WebSocket   // ✅ Prevent reconnection issues
    }
  }
  async deleteWatchListItem(watchListId: string, stockSymbol: string) {
    let res = await firstValueFrom(
      this.http.patch<ApiWatchListResponse>(
        `${SERVER_URL}/stocks/del-stock-watchlist`,
        {
          watchListId,
          stockSymbol,
        }
      )
    );
    return res;
  }

  async updateWatchListName(watchListId: string, name: string) {
    let res = await firstValueFrom(
      this.http.patch<ApiWatchListResponse>(
        `${SERVER_URL}/stocks/update-watchlistName`,
        {
          watchListId,
          name,
        }
      )
    );
    return res;
  }

  async addStockIntoWatchList(watchListId: string, stockItem: IStockData) {
    let res = await firstValueFrom(
      this.http.patch<ApiWatchListResponse>(
        `${SERVER_URL}/stocks/add-stock-watchlist`,
        {
          watchListId,
          stockSymbol: stockItem.symbol,
          longName: stockItem.name,
        }
      )
    );
    return res;
  }

  async createWatchList(name: string) {
    let res = await firstValueFrom(
      this.http.post<any>(`${SERVER_URL}/stocks/create-watchList`, {
        name,
      })
    );
    return res;
  }

  async deleteWatchList(watchListId: string) {
    let res = await firstValueFrom(
      this.http.delete<ApiWatchListResponse>(
        `${SERVER_URL}/stocks/delete-watchList`,
        {
          body: { watchListId },
        }
      )
    );
    return res;
  }
}
