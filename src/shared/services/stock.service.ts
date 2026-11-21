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
  ws?: WebSocket;
  isTockensLoaded: boolean = false;
  watchListData: IWatchList[] = [];
  private symbols: string[] = [];
  private intentionalClose: boolean = false;
  private reconnectAttempts: number = 0;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private readonly baseReconnectDelay: number = 1000; // 1s, 2s, 4s ... up to 30s
  private readonly maxReconnectDelay: number = 30000;
  private messageBuffer: (ITickerData | IClosed)[] = [];
  private bufferTimer?: ReturnType<typeof setTimeout>;
  private readonly bufferSize: number = 10;
  private readonly bufferTimeout: number = 100; // ms

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

  private async connectWebSocket() {
    clearTimeout(this.reconnectTimer);
    try {
      // getIdToken() refreshes an expired token, so reconnects after 1h+ still authenticate.
      const jwtToken = await this.firebaseAuth.currentUser?.getIdToken();
      if (!jwtToken) {
        throw new Error('No authentication token available');
      }
      if (this.intentionalClose) return;

      // Always start from a fresh socket; a closed WebSocket can't be reopened.
      this.closeSocket();
      const ws = new WebSocket(WEB_SOCKET, jwtToken);
      this.ws = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        ws.send(
          JSON.stringify({
            action: 'subscribe',
            variables: this.symbols,
            type: 'ltp',
          })
        );
      };

      ws.onerror = (error) => {
        // 'close' always follows 'error', and reconnecting is handled there.
        console.error('WebSocket error:', error);
      };

      ws.onclose = (event) => {
        if (this.ws !== ws) return; // an older socket we replaced
        console.warn(`WebSocket closed (code ${event.code})`);
        this.ws = undefined;
        this.scheduleReconnect();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const messages = Array.isArray(data) ? data : [data];
          // Pass on only price ticks and "market closed" notices; subscription
          // acknowledgements and errors are not ticker data.
          const relevant = messages.filter((m: any) => {
            if (m?.id) return true;
            if (m?.type === 'closed') return true;
            if (m?.error) console.warn('WebSocket server message:', m.error);
            return false;
          });
          if (relevant.length) this.bufferMessages(relevant);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
    } catch (error) {
      console.error('Error establishing WebSocket connection:', error);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.intentionalClose) return;
    clearTimeout(this.reconnectTimer);
    const delay = Math.min(
      this.baseReconnectDelay * 2 ** this.reconnectAttempts,
      this.maxReconnectDelay
    );
    this.reconnectAttempts++;
    console.log(`Reconnecting WebSocket in ${delay / 1000}s (attempt ${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => this.connectWebSocket(), delay);
  }

  private closeSocket() {
    const ws = this.ws;
    this.ws = undefined;
    if (ws && ws.readyState !== WebSocket.CLOSED) {
      ws.onclose = null;
      ws.close();
    }
  }

  private bufferMessages(messages: (ITickerData | IClosed)[]) {
    this.messageBuffer.push(...messages);

    if (this.messageBuffer.length >= this.bufferSize) {
      this.flushBuffer();
    } else if (!this.bufferTimer) {
      // One timer per batch, not one per message.
      this.bufferTimer = setTimeout(() => this.flushBuffer(), this.bufferTimeout);
    }
  }

  private flushBuffer() {
    clearTimeout(this.bufferTimer);
    this.bufferTimer = undefined;
    if (this.messageBuffer.length === 0 || this.liveData$.closed) {
      this.messageBuffer = [];
      return;
    }
    const batch = this.messageBuffer;
    this.messageBuffer = [];
    batch.forEach((message) => this.liveData$.next(message));
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
    this.symbols = nifty50InstrumentalTokens;
    this.intentionalClose = false;
    this.reconnectAttempts = 0;
    await this.connectWebSocket();
  }

  disconnect() {
    this.intentionalClose = true; // stops the reconnect loop
    clearTimeout(this.reconnectTimer);
    clearTimeout(this.bufferTimer);
    this.bufferTimer = undefined;
    this.messageBuffer = [];
    if (this.ws) console.log('🚫 Closing WebSocket...');
    this.closeSocket();
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
