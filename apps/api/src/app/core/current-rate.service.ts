import { GetValueObject } from '@ghostfolio/api/app/core/interfaces/get-value-object.interface';
import { GetValueParams } from '@ghostfolio/api/app/core/interfaces/get-value-params.interface';
import { GetValuesParams } from '@ghostfolio/api/app/core/interfaces/get-values-params.interface';
import { DataProviderService } from '@ghostfolio/api/services/data-provider.service';
import { ExchangeRateDataService } from '@ghostfolio/api/services/exchange-rate-data.service';
import { resetHours } from '@ghostfolio/common/helper';
import { Injectable } from '@nestjs/common';
import { isAfter, isBefore, isToday } from 'date-fns';
import { flatten } from 'lodash';

import { MarketDataService } from './market-data.service';
import { ExchangeRateService } from '../exchange-rate/exchange-rate.service';
import { Big } from 'big.js';

@Injectable()
export class CurrentRateService {
  public constructor(
    private readonly dataProviderService: DataProviderService,
    private readonly exchangeRateDataService: ExchangeRateDataService,
    private readonly marketDataService: MarketDataService,
    private readonly exchangeRateService: ExchangeRateService
  ) {}

  public async getValue({
    currency,
    date,
    symbol,
    userCurrency
  }: GetValueParams): Promise<GetValueObject> {
    if (isToday(date)) {
      const dataProviderResult = await this.dataProviderService.get([symbol]);
      return {
        date: resetHours(date),
        marketPrice: dataProviderResult?.[symbol]?.marketPrice ?? 0,
        symbol: symbol
      };
    }

    const marketData = await this.marketDataService.get({
      date,
      symbol
    });

    if (marketData) {
      return {
        date: marketData.date,
        marketPrice: this.exchangeRateDataService.toCurrency(
          marketData.marketPrice,
          currency,
          userCurrency
        ),
        symbol: marketData.symbol
      };
    }

    throw new Error(`Value not found for ${symbol} at ${resetHours(date)}`);
  }

  public async getValues({
    currencies,
    dateQuery,
    symbols,
    userCurrency
  }: GetValuesParams): Promise<GetValueObject[]> {
    const includeToday =
      (!dateQuery.lt || isBefore(new Date(), dateQuery.lt)) &&
      (!dateQuery.gte || isBefore(dateQuery.gte, new Date())) &&
      (!dateQuery.in || this.containsToday(dateQuery.in));

    const promises: Promise<
      {
        date: Date;
        marketPrice: number;
        symbol: string;
      }[]
    >[] = [];

    const sourceCurrencies = Object.values(currencies);
    const exchangeRates = await this.exchangeRateService.getExchangeRates({
      dateQuery,
      sourceCurrencies,
      destinationCurrency: userCurrency
    });

    if (includeToday) {
      const today = resetHours(new Date());
      promises.push(
        this.dataProviderService.get(symbols).then((dataResultProvider) => {
          const result = [];
          for (const symbol of symbols) {
            result.push({
              symbol,
              date: today,
              marketPrice: this.exchangeRateDataService.toCurrency(
                dataResultProvider?.[symbol]?.marketPrice ?? 0,
                dataResultProvider?.[symbol]?.currency,
                userCurrency
              )
            });
          }
          return result;
        })
      );
    }

    promises.push(
      this.marketDataService
        .getRange({
          dateQuery,
          symbols
        })
        .then((data) => {
          const result = [];
          let j = 0;
          for (const marketDataItem of data) {
            const currency = currencies[marketDataItem.symbol];
            while (
              j + 1 < exchangeRates.length &&
              !isAfter(exchangeRates[j + 1].date, marketDataItem.date)
            ) {
              j++;
            }
            let exchangeRate: Big;
            if (currency !== userCurrency) {
              exchangeRate = exchangeRates[j]?.exchangeRates[currency];

              for (
                let k = j;
                k >= 0 && !exchangeRates[k]?.exchangeRates[currency];
                k--
              ) {
                exchangeRate = exchangeRates[k]?.exchangeRates[currency];
              }
            } else {
              exchangeRate = new Big(1);
            }
            if (exchangeRate) {
              result.push({
                date: marketDataItem.date,
                marketPrice: exchangeRate
                  .mul(marketDataItem.marketPrice)
                  .toNumber(),
                symbol: marketDataItem.symbol
              });
            }
          }
          return result;
        })
    );

    return flatten(await Promise.all(promises));
  }

  private containsToday(dates: Date[]): boolean {
    for (const date of dates) {
      if (isToday(date)) {
        return true;
      }
    }
    return false;
  }
}
