import { IStock, IStockData, IWatchList } from './stock.interface';

export type ApiResponse = {
  message: string;
  payload: IStockData[];
  status: boolean;
};

export type ApiWatchListResponse = {
  message: string;
  payload: IWatchList[];
  status: boolean;
};

export type HistoryData = {
  message: string;
  payload: IHistoryData[];
  status: boolean;
};

export interface IHistoryData {
  Datetime: string;
  Open: number;
  High: number;
  Low: number;
  Close: number;
  Volume: number;
  Dividends: number;
  'Stock Splits': number;
}

export interface Response {
  success: boolean;
  data?: any;
  message?: string;
}
