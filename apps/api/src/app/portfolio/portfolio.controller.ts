import {
  hasNotDefinedValuesInObject,
  nullifyValuesInObject
} from '@ghostfolio/api/helper/object.helper';
import { ExchangeRateDataService } from '@ghostfolio/api/services/exchange-rate-data.service';
import { ImpersonationService } from '@ghostfolio/api/services/impersonation.service';
import {
  PortfolioPerformance,
  PortfolioPosition,
  PortfolioReport,
  PortfolioSummary
} from '@ghostfolio/common/interfaces';
import { InvestmentItem } from '@ghostfolio/common/interfaces/investment-item.interface';
import {
  getPermissions,
  hasPermission,
  permissions
} from '@ghostfolio/common/permissions';
import { RequestWithUser } from '@ghostfolio/common/types';
import {
  Controller,
  Get,
  Headers,
  HttpException,
  Inject,
  Param,
  Query,
  Res,
  UseGuards
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import Big from 'big.js';
import { Response } from 'express';
import { StatusCodes, getReasonPhrase } from 'http-status-codes';

import {
  HistoricalDataItem,
  PortfolioPositionDetail
} from './interfaces/portfolio-position-detail.interface';
import { PortfolioPositions } from './interfaces/portfolio-positions.interface';
import { PortfolioService } from './portfolio.service';

@Controller('portfolio')
export class PortfolioController {
  public constructor(
    private readonly exchangeRateDataService: ExchangeRateDataService,
    private readonly impersonationService: ImpersonationService,
    private portfolioService: PortfolioService,
    @Inject(REQUEST) private readonly request: RequestWithUser
  ) {}

  @Get('/investments')
  @UseGuards(AuthGuard('jwt'))
  public async findAll(
    @Headers('impersonation-id') impersonationId
  ): Promise<InvestmentItem[]> {
    let investments = await this.portfolioService.getInvestments(
      impersonationId
    );

    if (
      impersonationId &&
      !hasPermission(
        getPermissions(this.request.user.role),
        permissions.readForeignPortfolio
      )
    ) {
      const maxInvestment = investments.reduce(
        (investment, item) => Math.max(investment, item.investment),
        1
      );

      investments = investments.map((item) => ({
        date: item.date,
        investment: item.investment / maxInvestment
      }));
    }

    return investments;
  }

  @Get('chart')
  @UseGuards(AuthGuard('jwt'))
  public async getChart(
    @Headers('impersonation-id') impersonationId,
    @Query('range') range,
    @Res() res: Response
  ): Promise<HistoricalDataItem[]> {
    let chartData = await this.portfolioService.getChart(
      impersonationId,
      range
    );

    let hasNullValue = false;

    chartData.forEach((chartDataItem) => {
      if (hasNotDefinedValuesInObject(chartDataItem)) {
        hasNullValue = true;
      }
    });

    if (hasNullValue) {
      res.status(StatusCodes.ACCEPTED);
    }

    if (
      impersonationId &&
      !hasPermission(
        getPermissions(this.request.user.role),
        permissions.readForeignPortfolio
      )
    ) {
      let maxValue = 0;

      chartData.forEach((portfolioItem) => {
        if (portfolioItem.value > maxValue) {
          maxValue = portfolioItem.value;
        }
      });

      chartData = chartData.map((historicalDataItem) => {
        return {
          ...historicalDataItem,
          marketPrice: Number((historicalDataItem.value / maxValue).toFixed(2))
        };
      });
    }

    return <any>res.json(chartData);
  }

  @Get('details')
  @UseGuards(AuthGuard('jwt'))
  public async getDetails(
    @Headers('impersonation-id') impersonationId,
    @Query('range') range,
    @Res() res: Response
  ): Promise<{ [symbol: string]: PortfolioPosition }> {
    let details: { [symbol: string]: PortfolioPosition } = {};

    const impersonationUserId =
      await this.impersonationService.validateImpersonationId(
        impersonationId,
        this.request.user.id
      );

    try {
      details = await this.portfolioService.getDetails(
        impersonationUserId,
        range
      );
    } catch (error) {
      console.error(error);

      res.status(StatusCodes.ACCEPTED);
    }

    if (hasNotDefinedValuesInObject(details)) {
      res.status(StatusCodes.ACCEPTED);
    }

    if (
      impersonationId &&
      !hasPermission(
        getPermissions(this.request.user.role),
        permissions.readForeignPortfolio
      )
    ) {
      const totalInvestment = Object.values(details)
        .map((portfolioPosition) => {
          return portfolioPosition.investment;
        })
        .reduce((a, b) => a + b, 0);

      const totalValue = Object.values(details)
        .map((portfolioPosition) => {
          return this.exchangeRateDataService.toCurrency(
            portfolioPosition.quantity * portfolioPosition.marketPrice,
            portfolioPosition.currency,
            this.request.user.Settings.currency
          );
        })
        .reduce((a, b) => a + b, 0);

      for (const [symbol, portfolioPosition] of Object.entries(details)) {
        portfolioPosition.grossPerformance = null;
        portfolioPosition.investment =
          portfolioPosition.investment / totalInvestment;

        for (const [account, { current, original }] of Object.entries(
          portfolioPosition.accounts
        )) {
          portfolioPosition.accounts[account].current = current / totalValue;
          portfolioPosition.accounts[account].original =
            original / totalInvestment;
        }

        portfolioPosition.quantity = null;
      }
    }

    return <any>res.json(details);
  }

  @Get('performance')
  @UseGuards(AuthGuard('jwt'))
  public async getPerformance(
    @Headers('impersonation-id') impersonationId,
    @Query('range') range,
    @Res() res: Response
  ): Promise<PortfolioPerformance> {
    const performanceInformation = await this.portfolioService.getPerformance(
      impersonationId,
      range
    );

    if (performanceInformation?.hasErrors) {
      res.status(StatusCodes.ACCEPTED);
    }

    let performance = performanceInformation.performance;
    if (
      impersonationId &&
      !hasPermission(
        getPermissions(this.request.user.role),
        permissions.readForeignPortfolio
      )
    ) {
      performance = nullifyValuesInObject(performance, [
        'currentGrossPerformance',
        'currentNetPerformance',
        'currentValue'
      ]);
    }

    return <any>res.json(performance);
  }

  @Get('positions')
  @UseGuards(AuthGuard('jwt'))
  public async getPositions(
    @Headers('impersonation-id') impersonationId,
    @Query('range') range,
    @Res() res: Response
  ): Promise<PortfolioPositions> {
    const result = await this.portfolioService.getPositions(
      impersonationId,
      range
    );

    if (result?.hasErrors) {
      res.status(StatusCodes.ACCEPTED);
    }

    return <any>res.json(result);
  }

  @Get('summary')
  @UseGuards(AuthGuard('jwt'))
  public async getSummary(
    @Headers('impersonation-id') impersonationId
  ): Promise<PortfolioSummary> {
    let summary = await this.portfolioService.getSummary(impersonationId);

    if (
      impersonationId &&
      !hasPermission(
        getPermissions(this.request.user.role),
        permissions.readForeignPortfolio
      )
    ) {
      summary = nullifyValuesInObject(summary, [
        'cash',
        'committedFunds',
        'currentGrossPerformance',
        'currentNetPerformance',
        'currentValue',
        'fees',
        'totalBuy',
        'totalSell'
      ]);
    }

    return summary;
  }

  @Get('position/:symbol')
  @UseGuards(AuthGuard('jwt'))
  public async getPosition(
    @Headers('impersonation-id') impersonationId,
    @Param('symbol') symbol
  ): Promise<PortfolioPositionDetail> {
    let position = await this.portfolioService.getPosition(
      impersonationId,
      symbol
    );

    if (position) {
      if (
        impersonationId &&
        !hasPermission(
          getPermissions(this.request.user.role),
          permissions.readForeignPortfolio
        )
      ) {
        position = nullifyValuesInObject(position, ['grossPerformance']);
      }

      return position;
    }

    throw new HttpException(
      getReasonPhrase(StatusCodes.NOT_FOUND),
      StatusCodes.NOT_FOUND
    );
  }

  @Get('report')
  @UseGuards(AuthGuard('jwt'))
  public async getReport(
    @Headers('impersonation-id') impersonationId
  ): Promise<PortfolioReport> {
    return await this.portfolioService.getReport(impersonationId);
  }
}
