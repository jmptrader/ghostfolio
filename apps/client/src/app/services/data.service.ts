import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { CreateAccountDto } from '@ghostfolio/api/app/account/create-account.dto';
import { UpdateAccountDto } from '@ghostfolio/api/app/account/update-account.dto';
import { ImportDataDto } from '@ghostfolio/api/app/import/import-data.dto';
import { CreateOrderDto } from '@ghostfolio/api/app/order/create-order.dto';
import { UpdateOrderDto } from '@ghostfolio/api/app/order/update-order.dto';
import {
  HistoricalDataItem,
  PortfolioPositionDetail
} from '@ghostfolio/api/app/portfolio/interfaces/portfolio-position-detail.interface';
import { PortfolioPositions } from '@ghostfolio/api/app/portfolio/interfaces/portfolio-positions.interface';
import { LookupItem } from '@ghostfolio/api/app/symbol/interfaces/lookup-item.interface';
import { SymbolItem } from '@ghostfolio/api/app/symbol/interfaces/symbol-item.interface';
import { UserItem } from '@ghostfolio/api/app/user/interfaces/user-item.interface';
import { UpdateUserSettingsDto } from '@ghostfolio/api/app/user/update-user-settings.dto';
import {
  Access,
  AdminData,
  Export,
  InfoItem,
  PortfolioPerformance,
  PortfolioPosition,
  PortfolioReport,
  PortfolioSummary,
  User
} from '@ghostfolio/common/interfaces';
import { InvestmentItem } from '@ghostfolio/common/interfaces/investment-item.interface';
import { permissions } from '@ghostfolio/common/permissions';
import { DateRange } from '@ghostfolio/common/types';
import { Order as OrderModel } from '@prisma/client';
import { Account as AccountModel } from '@prisma/client';
import { parseISO } from 'date-fns';
import { cloneDeep } from 'lodash';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { SettingsStorageService } from './settings-storage.service';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private info: InfoItem;

  public constructor(
    private http: HttpClient,
    private settingsStorageService: SettingsStorageService
  ) {}

  public createCheckoutSession({
    couponId,
    priceId
  }: {
    couponId?: string;
    priceId: string;
  }) {
    return this.http.post('/api/subscription/stripe/checkout-session', {
      couponId,
      priceId
    });
  }

  public fetchAccounts() {
    return this.http.get<AccountModel[]>('/api/account');
  }

  public fetchAdminData() {
    return this.http.get<AdminData>('/api/admin');
  }

  public deleteAccount(aId: string) {
    return this.http.delete<any>(`/api/account/${aId}`);
  }

  public deleteOrder(aId: string) {
    return this.http.delete<any>(`/api/order/${aId}`);
  }

  public deleteUser(aId: string) {
    return this.http.delete<any>(`/api/user/${aId}`);
  }

  public fetchAccesses() {
    return this.http.get<Access[]>('/api/access');
  }

  public fetchChart({ range }: { range: DateRange }) {
    return this.http.get<HistoricalDataItem[]>('/api/portfolio/chart', {
      params: { range }
    });
  }

  public fetchExport() {
    return this.http.get<Export>('/api/export');
  }

  public fetchInfo(): InfoItem {
    const info = cloneDeep((window as any).info);

    if (window.localStorage.getItem('utm_source') === 'trusted-web-activity') {
      info.globalPermissions = info.globalPermissions.filter(
        (permission) => permission !== permissions.enableSubscription
      );
    }

    return info;
  }

  public fetchSymbolItem(aSymbol: string) {
    return this.http.get<SymbolItem>(`/api/symbol/${aSymbol}`);
  }

  public fetchPositions({
    range
  }: {
    range: DateRange;
  }): Observable<PortfolioPositions> {
    return this.http.get<PortfolioPositions>('/api/portfolio/positions', {
      params: { range }
    });
  }

  public fetchSymbols(aQuery: string) {
    return this.http
      .get<{ items: LookupItem[] }>(`/api/symbol/lookup?query=${aQuery}`)
      .pipe(
        map((respose) => {
          return respose.items;
        })
      );
  }

  public fetchOrders(): Observable<OrderModel[]> {
    return this.http.get<any[]>('/api/order').pipe(
      map((data) => {
        for (const item of data) {
          item.createdAt = parseISO(item.createdAt);
          item.date = parseISO(item.date);
        }
        return data;
      })
    );
  }

  public fetchInvestments() {
    return this.http.get<InvestmentItem[]>('/api/portfolio/investments');
  }

  public fetchPortfolioPerformance(aParams: { [param: string]: any }) {
    return this.http.get<PortfolioPerformance>('/api/portfolio/performance', {
      params: aParams
    });
  }

  public fetchPortfolioPositions(aParams: { [param: string]: any }) {
    return this.http.get<{ [symbol: string]: PortfolioPosition }>(
      '/api/portfolio/details',
      { params: aParams }
    );
  }

  public fetchPortfolioReport() {
    return this.http.get<PortfolioReport>('/api/portfolio/report');
  }

  public fetchPortfolioSummary(): Observable<PortfolioSummary> {
    return this.http.get<any>('/api/portfolio/summary').pipe(
      map((summary) => {
        if (summary.firstOrderDate) {
          summary.firstOrderDate = parseISO(summary.firstOrderDate);
        }

        return summary;
      })
    );
  }

  public fetchPositionDetail(aSymbol: string) {
    return this.http.get<PortfolioPositionDetail>(
      `/api/portfolio/position/${aSymbol}`
    );
  }

  public loginAnonymous(accessToken: string) {
    return this.http.get<any>(`/api/auth/anonymous/${accessToken}`);
  }

  public postAccount(aAccount: CreateAccountDto) {
    return this.http.post<OrderModel>(`/api/account`, aAccount);
  }

  public postImport(aImportData: ImportDataDto) {
    return this.http.post<void>('/api/import', aImportData);
  }

  public postOrder(aOrder: CreateOrderDto) {
    return this.http.post<OrderModel>(`/api/order`, aOrder);
  }

  public postUser() {
    return this.http.post<UserItem>(`/api/user`, {});
  }

  public putAccount(aAccount: UpdateAccountDto) {
    return this.http.put<UserItem>(`/api/account/${aAccount.id}`, aAccount);
  }

  public putOrder(aOrder: UpdateOrderDto) {
    return this.http.put<UserItem>(`/api/order/${aOrder.id}`, aOrder);
  }

  public putUserSettings(aData: UpdateUserSettingsDto) {
    return this.http.put<User>(`/api/user/settings`, aData);
  }
}
