import { Injectable, signal } from '@angular/core';

/**
 * Phone layout state shared by the bottom bar (LayoutComponent) and the dashboard.
 * On small screens the dashboard shows either the chart or the watchlist panel
 * (search + Nifty 50 + watchlists); the bottom bar's Watchlist button switches it.
 */
@Injectable({ providedIn: 'root' })
export class MobileNavService {
  readonly watchlistOpen = signal(false);

  openWatchlist() {
    this.watchlistOpen.set(true);
  }

  closeWatchlist() {
    this.watchlistOpen.set(false);
  }
}
