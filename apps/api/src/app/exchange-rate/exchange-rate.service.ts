import { Injectable } from '@nestjs/common';
import { Currency } from '@prisma/client';
import { DateQuery } from '@ghostfolio/api/app/core/interfaces/date-query.interface';
import { MarketDataService } from '@ghostfolio/api/app/core/market-data.service';
import Big from 'big.js';
import { DateBasedExchangeRate } from './date-based-exchange-rate.interface';

@Injectable()
export class ExchangeRateService {
  public constructor(private marketDataService: MarketDataService) {}

  public async getExchangeRates({
    dateQuery,
    sourceCurrencies,
    destinationCurrency
  }: {
    dateQuery: DateQuery;
    sourceCurrencies: Currency[];
    destinationCurrency: Currency;
  }): Promise<DateBasedExchangeRate[]> {
    const symbols = [...sourceCurrencies, destinationCurrency].map(
      (currency) => `${Currency.USD}${currency}`
    );
    const exchangeRates = await this.marketDataService.getRange({
      dateQuery,
      symbols
    });

    if (exchangeRates.length === 0) {
      return [];
    }
    const results: DateBasedExchangeRate[] = [];
    let currentDate = exchangeRates[0].date;
    let currentRates: { [symbol: string]: Big } = {};
    for (const exchangeRate of exchangeRates) {
      if (currentDate !== exchangeRate.date) {
        results.push({
          date: currentDate,
          exchangeRates: this.getUserExchangeRates(
            currentRates,
            destinationCurrency,
            sourceCurrencies
          )
        });
        currentDate = exchangeRate.date;
        currentRates = {};
      }
      currentRates[exchangeRate.symbol] = new Big(exchangeRate.marketPrice);
    }
    results.push({
      date: currentDate,
      exchangeRates: this.getUserExchangeRates(
        currentRates,
        destinationCurrency,
        sourceCurrencies
      )
    });
    return results;
  }

  private getUserExchangeRates(
    currentRates: { [symbol: string]: Big },
    destinationCurrency: Currency,
    sourceCurrencies: Currency[]
  ): { [currency: string]: Big } {
    const result: { [currency: string]: Big } = {};

    for (const sourceCurrency of sourceCurrencies) {
      let exchangeRate: Big;
      if (sourceCurrency === destinationCurrency) {
        exchangeRate = new Big(1);
      } else if (sourceCurrency === Currency.USD) {
        exchangeRate = currentRates[`${sourceCurrency}${destinationCurrency}`];
      } else if (destinationCurrency === Currency.USD) {
        exchangeRate = new Big(1).div(
          currentRates[`${destinationCurrency}${sourceCurrency}`]
        );
      } else {
        if (
          currentRates[`${Currency.USD}${destinationCurrency}`] &&
          currentRates[`${Currency.USD}${sourceCurrency}`]
        ) {
          exchangeRate = currentRates[
            `${Currency.USD}${destinationCurrency}`
          ].div(currentRates[`${Currency.USD}${sourceCurrency}`]);
        }
      }
      if (exchangeRate) {
        result[sourceCurrency] = exchangeRate;
      }
    }

    return result;
  }
}
