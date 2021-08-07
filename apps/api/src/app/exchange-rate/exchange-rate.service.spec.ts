import { ExchangeRateService } from './exchange-rate.service';
import { Currency, MarketData } from '@prisma/client';

import { MarketDataService } from '../core/market-data.service';
import { addDays, endOfDay, isBefore } from 'date-fns';
import { Big } from 'big.js';
import { DateQuery } from '@ghostfolio/api/app/core/interfaces/date-query.interface';

jest.mock('../core/market-data.service', () => {
  return {
    MarketDataService: jest.fn().mockImplementation(() => {
      return {
        getRange: ({
          dateQuery,
          symbols
        }: {
          dateQuery: DateQuery;
          symbols: string[];
        }) => {
          const exchangeRateMap = {
            USDEUR: 1,
            USDCHF: 2,
            USDUSD: 0
          };
          const result = [];
          let j = 1;
          for (
            let i = dateQuery.gte;
            isBefore(i, dateQuery.lt);
            i = addDays(i, 1)
          ) {
            const marketPrice = j++;
            for (const symbol of symbols) {
              result.push({
                createdAt: i,
                date: i,
                id: '8fa48fde-f397-4b0d-adbc-fb940e830e6d',
                marketPrice: marketPrice * exchangeRateMap[symbol] + 1,
                symbol: symbol
              });
            }
          }
          return Promise.resolve<MarketData[]>(result);
        }
      };
    })
  };
});

describe('ExchangeRateService', () => {
  let exchangeRateService: ExchangeRateService;
  let marketDataService: MarketDataService;

  beforeAll(async () => {
    marketDataService = new MarketDataService(null);
    exchangeRateService = new ExchangeRateService(marketDataService);
  });

  describe('getExchangeRates', () => {
    it('source and destination USD', async () => {
      const startDate = new Date(2021, 0, 1);
      const exchangeRates = await exchangeRateService.getExchangeRates({
        dateQuery: {
          gte: startDate,
          lt: endOfDay(startDate)
        },
        sourceCurrencies: [Currency.USD],
        destinationCurrency: Currency.USD
      });

      expect(exchangeRates).toEqual([
        {
          date: startDate,
          exchangeRates: {
            USD: new Big(1)
          }
        }
      ]);
    });

    it('source USD and destination CHF', async () => {
      const startDate = new Date(2021, 0, 1);
      const exchangeRates = await exchangeRateService.getExchangeRates({
        dateQuery: {
          gte: startDate,
          lt: endOfDay(startDate)
        },
        sourceCurrencies: [Currency.USD],
        destinationCurrency: Currency.CHF
      });

      expect(exchangeRates).toEqual([
        {
          date: startDate,
          exchangeRates: {
            USD: new Big(3)
          }
        }
      ]);
    });

    it('source CHF and destination USD', async () => {
      const startDate = new Date(2021, 0, 1);
      const exchangeRates = await exchangeRateService.getExchangeRates({
        dateQuery: {
          gte: startDate,
          lt: endOfDay(startDate)
        },
        sourceCurrencies: [Currency.CHF],
        destinationCurrency: Currency.USD
      });

      expect(exchangeRates).toEqual([
        {
          date: startDate,
          exchangeRates: {
            CHF: new Big(1).div(3)
          }
        }
      ]);
    });

    it('source CHF and destination EUR', async () => {
      const startDate = new Date(2021, 0, 1);
      const exchangeRates = await exchangeRateService.getExchangeRates({
        dateQuery: {
          gte: startDate,
          lt: endOfDay(startDate)
        },
        sourceCurrencies: [Currency.CHF],
        destinationCurrency: Currency.EUR
      });

      expect(exchangeRates).toEqual([
        {
          date: startDate,
          exchangeRates: {
            CHF: new Big(2).div(3)
          }
        }
      ]);
    });

    it('source CHF,EUR,USD and destination EUR', async () => {
      const startDate = new Date(2021, 0, 1);
      const exchangeRates = await exchangeRateService.getExchangeRates({
        dateQuery: {
          gte: startDate,
          lt: endOfDay(startDate)
        },
        sourceCurrencies: [Currency.CHF, Currency.USD, Currency.EUR],
        destinationCurrency: Currency.EUR
      });

      expect(exchangeRates).toEqual([
        {
          date: startDate,
          exchangeRates: {
            CHF: new Big(2).div(3),
            USD: new Big(2),
            EUR: new Big(1)
          }
        }
      ]);
    });

    it('with multiple days', async () => {
      const startDate = new Date(2021, 0, 1);
      const exchangeRates = await exchangeRateService.getExchangeRates({
        dateQuery: {
          gte: startDate,
          lt: endOfDay(addDays(startDate, 1))
        },
        sourceCurrencies: [Currency.CHF, Currency.USD, Currency.EUR],
        destinationCurrency: Currency.EUR
      });

      expect(exchangeRates).toEqual([
        {
          date: startDate,
          exchangeRates: {
            CHF: new Big(2).div(3),
            USD: new Big(2),
            EUR: new Big(1)
          }
        },
        {
          date: addDays(startDate, 1),
          exchangeRates: {
            CHF: new Big(3).div(5),
            USD: new Big(3),
            EUR: new Big(1)
          }
        }
      ]);
    });
  });
});
