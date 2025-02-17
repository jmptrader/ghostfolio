import { LookupItem } from '@ghostfolio/api/app/symbol/interfaces/lookup-item.interface';
import { UNKNOWN_KEY } from '@ghostfolio/common/config';
import {
  DATE_FORMAT,
  isCrypto,
  isCurrency,
  parseCurrency
} from '@ghostfolio/common/helper';
import { Granularity } from '@ghostfolio/common/types';
import { Injectable } from '@nestjs/common';
import { AssetClass, Currency, DataSource } from '@prisma/client';
import * as bent from 'bent';
import { format } from 'date-fns';
import * as yahooFinance from 'yahoo-finance';

import { DataProviderInterface } from '../../interfaces/data-provider.interface';
import {
  IDataProviderHistoricalResponse,
  IDataProviderResponse,
  MarketState
} from '../../interfaces/interfaces';
import {
  IYahooFinanceHistoricalResponse,
  IYahooFinanceQuoteResponse
} from './interfaces/interfaces';

@Injectable()
export class YahooFinanceService implements DataProviderInterface {
  private yahooFinanceHostname = 'https://query1.finance.yahoo.com';

  public constructor() {}

  public canHandle(symbol: string) {
    return true;
  }

  public async get(
    aSymbols: string[]
  ): Promise<{ [symbol: string]: IDataProviderResponse }> {
    if (aSymbols.length <= 0) {
      return {};
    }

    const yahooSymbols = aSymbols.map((symbol) => {
      return this.convertToYahooSymbol(symbol);
    });

    try {
      const response: { [symbol: string]: IDataProviderResponse } = {};

      const data: {
        [symbol: string]: IYahooFinanceQuoteResponse;
      } = await yahooFinance.quote({
        modules: ['price', 'summaryProfile'],
        symbols: yahooSymbols
      });

      for (const [yahooSymbol, value] of Object.entries(data)) {
        // Convert symbols back
        const symbol = convertFromYahooSymbol(yahooSymbol);

        response[symbol] = {
          assetClass: this.parseAssetClass(value.price?.quoteType),
          currency: parseCurrency(value.price?.currency),
          dataSource: DataSource.YAHOO,
          exchange: this.parseExchange(value.price?.exchangeName),
          marketState:
            value.price?.marketState === 'REGULAR' || isCrypto(symbol)
              ? MarketState.open
              : MarketState.closed,
          marketPrice: value.price?.regularMarketPrice || 0,
          name: value.price?.longName || value.price?.shortName || symbol
        };

        const url = value.summaryProfile?.website;
        if (url) {
          response[symbol].url = url;
        }
      }

      return response;
    } catch (error) {
      console.error(error);

      return {};
    }
  }

  public async getHistorical(
    aSymbols: string[],
    aGranularity: Granularity = 'day',
    from: Date,
    to: Date
  ): Promise<{
    [symbol: string]: { [date: string]: IDataProviderHistoricalResponse };
  }> {
    if (aSymbols.length <= 0) {
      return {};
    }

    const yahooSymbols = aSymbols.map((symbol) => {
      return this.convertToYahooSymbol(symbol);
    });

    try {
      const historicalData: {
        [symbol: string]: IYahooFinanceHistoricalResponse[];
      } = await yahooFinance.historical({
        symbols: yahooSymbols,
        from: format(from, DATE_FORMAT),
        to: format(to, DATE_FORMAT)
      });

      const response: {
        [symbol: string]: { [date: string]: IDataProviderHistoricalResponse };
      } = {};

      for (const [yahooSymbol, timeSeries] of Object.entries(historicalData)) {
        // Convert symbols back
        const symbol = convertFromYahooSymbol(yahooSymbol);
        response[symbol] = {};

        timeSeries.forEach((timeSerie) => {
          response[symbol][format(timeSerie.date, DATE_FORMAT)] = {
            marketPrice: timeSerie.close,
            performance: timeSerie.open - timeSerie.close
          };
        });
      }

      return response;
    } catch (error) {
      console.error(error);

      return {};
    }
  }

  public async search(aSymbol: string): Promise<{ items: LookupItem[] }> {
    let items: LookupItem[] = [];

    try {
      const get = bent(
        `${this.yahooFinanceHostname}/v1/finance/search?q=${aSymbol}&lang=en-US&region=US&quotesCount=8&newsCount=0&enableFuzzyQuery=false&quotesQueryId=tss_match_phrase_query&multiQuoteQueryId=multi_quote_single_token_query&newsQueryId=news_cie_vespa&enableCb=true&enableNavLinks=false&enableEnhancedTrivialQuery=true`,
        'GET',
        'json',
        200
      );

      const searchResult = await get();

      const symbols: string[] = searchResult.quotes
        .filter((quote) => {
          // filter out undefined symbols
          return quote.symbol;
        })
        .filter(({ quoteType }) => {
          return quoteType === 'EQUITY' || quoteType === 'ETF';
        })
        .map(({ symbol }) => {
          return symbol;
        });

      const marketData = await this.get(symbols);

      items = searchResult.quotes
        .filter((quote) => {
          return quote.isYahooFinance;
        })
        .filter(({ quoteType }) => {
          return (
            quoteType === 'CRYPTOCURRENCY' ||
            quoteType === 'EQUITY' ||
            quoteType === 'ETF'
          );
        })
        .filter(({ quoteType, symbol }) => {
          if (quoteType === 'CRYPTOCURRENCY') {
            // Only allow cryptocurrencies in USD
            return symbol.includes(Currency.USD);
          }

          return true;
        })
        .map(({ longname, shortname, symbol }) => {
          return {
            currency: marketData[symbol]?.currency,
            dataSource: DataSource.YAHOO,
            name: longname || shortname,
            symbol: convertFromYahooSymbol(symbol)
          };
        });
    } catch {}

    return { items };
  }

  /**
   * Converts a symbol to a Yahoo symbol
   *
   * Currency:        USDCHF=X
   * Cryptocurrency:  BTC-USD
   */
  private convertToYahooSymbol(aSymbol: string) {
    if (isCurrency(aSymbol)) {
      if (isCrypto(aSymbol)) {
        // Add a dash before the last three characters
        // BTCUSD  -> BTC-USD
        // DOGEUSD -> DOGE-USD
        return `${aSymbol.substring(0, aSymbol.length - 3)}-${aSymbol.substring(
          aSymbol.length - 3
        )}`;
      }

      return `${aSymbol}=X`;
    }

    return aSymbol;
  }

  private parseAssetClass(aString: string): AssetClass {
    let assetClass: AssetClass;

    switch (aString?.toLowerCase()) {
      case 'cryptocurrency':
        assetClass = AssetClass.CASH;
        break;
      case 'equity':
      case 'etf':
        assetClass = AssetClass.EQUITY;
        break;
    }

    return assetClass;
  }

  private parseExchange(aString: string): string {
    if (aString?.toLowerCase() === 'ccc') {
      return UNKNOWN_KEY;
    }

    return aString;
  }
}

export const convertFromYahooSymbol = (aSymbol: string) => {
  const symbol = aSymbol.replace('-', '');
  return symbol.replace('=X', '');
};
