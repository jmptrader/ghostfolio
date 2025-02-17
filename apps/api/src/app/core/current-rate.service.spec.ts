import { CurrentRateService } from '@ghostfolio/api/app/core/current-rate.service';
import { DataProviderService } from '@ghostfolio/api/services/data-provider.service';
import { ExchangeRateDataService } from '@ghostfolio/api/services/exchange-rate-data.service';
import { Currency, MarketData } from '@prisma/client';

import { MarketDataService } from './market-data.service';

jest.mock('./market-data.service', () => {
  return {
    MarketDataService: jest.fn().mockImplementation(() => {
      return {
        get: (date: Date, symbol: string) => {
          return Promise.resolve<MarketData>({
            date,
            symbol,
            createdAt: date,
            id: 'aefcbe3a-ee10-4c4f-9f2d-8ffad7b05584',
            marketPrice: 1847.839966
          });
        },
        getRange: ({
          dateRangeEnd,
          dateRangeStart,
          symbols
        }: {
          dateRangeEnd: Date;
          dateRangeStart: Date;
          symbols: string[];
        }) => {
          return Promise.resolve<MarketData[]>([
            {
              createdAt: dateRangeStart,
              date: dateRangeStart,
              id: '8fa48fde-f397-4b0d-adbc-fb940e830e6d',
              marketPrice: 1841.823902,
              symbol: symbols[0]
            },
            {
              createdAt: dateRangeEnd,
              date: dateRangeEnd,
              id: '082d6893-df27-4c91-8a5d-092e84315b56',
              marketPrice: 1847.839966,
              symbol: symbols[0]
            }
          ]);
        }
      };
    })
  };
});

jest.mock('@ghostfolio/api/services/exchange-rate-data.service', () => {
  return {
    ExchangeRateDataService: jest.fn().mockImplementation(() => {
      return {
        initialize: () => Promise.resolve(),
        toCurrency: (value: number) => {
          return 1 * value;
        }
      };
    })
  };
});

describe('CurrentRateService', () => {
  let currentRateService: CurrentRateService;
  let dataProviderService: DataProviderService;
  let exchangeRateDataService: ExchangeRateDataService;
  let marketDataService: MarketDataService;

  beforeAll(async () => {
    dataProviderService = new DataProviderService(
      null,
      null,
      null,
      null,
      null,
      null
    );
    exchangeRateDataService = new ExchangeRateDataService(null);
    marketDataService = new MarketDataService(null);

    await exchangeRateDataService.initialize();

    currentRateService = new CurrentRateService(
      dataProviderService,
      exchangeRateDataService,
      marketDataService
    );
  });

  it('getValue', async () => {
    expect(
      await currentRateService.getValue({
        currency: Currency.USD,
        date: new Date(Date.UTC(2020, 0, 1, 0, 0, 0)),
        symbol: 'AMZN',
        userCurrency: Currency.CHF
      })
    ).toMatchObject({
      marketPrice: 1847.839966
    });
  });

  it('getValues', async () => {
    expect(
      await currentRateService.getValues({
        currencies: { AMZN: Currency.USD },
        dateQuery: {
          lt: new Date(Date.UTC(2020, 0, 2, 0, 0, 0)),
          gte: new Date(Date.UTC(2020, 0, 1, 0, 0, 0))
        },
        symbols: ['AMZN'],
        userCurrency: Currency.CHF
      })
    ).toMatchObject([
      {
        date: undefined,
        marketPrice: 1841.823902,
        symbol: 'AMZN'
      },
      {
        date: undefined,
        marketPrice: 1847.839966,
        symbol: 'AMZN'
      }
    ]);
  });
});
