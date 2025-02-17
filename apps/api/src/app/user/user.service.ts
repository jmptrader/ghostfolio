import { ConfigurationService } from '@ghostfolio/api/services/configuration.service';
import { PrismaService } from '@ghostfolio/api/services/prisma.service';
import { locale } from '@ghostfolio/common/config';
import { User as IUser, UserWithSettings } from '@ghostfolio/common/interfaces';
import { getPermissions, permissions } from '@ghostfolio/common/permissions';
import { SubscriptionType } from '@ghostfolio/common/types/subscription.type';
import { Injectable } from '@nestjs/common';
import { Currency, Prisma, Provider, User, ViewMode } from '@prisma/client';
import { isBefore } from 'date-fns';

import { UserSettingsParams } from './interfaces/user-settings-params.interface';

const crypto = require('crypto');

@Injectable()
export class UserService {
  public static DEFAULT_CURRENCY = Currency.USD;

  public constructor(
    private readonly configurationService: ConfigurationService,
    private readonly prismaService: PrismaService
  ) {}

  public async getUser({
    Account,
    alias,
    id,
    permissions,
    Settings,
    subscription
  }: UserWithSettings): Promise<IUser> {
    const access = await this.prismaService.access.findMany({
      include: {
        User: true
      },
      orderBy: { User: { alias: 'asc' } },
      where: { GranteeUser: { id } }
    });

    return {
      alias,
      id,
      permissions,
      subscription,
      access: access.map((accessItem) => {
        return {
          alias: accessItem.User.alias,
          id: accessItem.id
        };
      }),
      accounts: Account,
      settings: {
        locale,
        baseCurrency: Settings?.currency ?? UserService.DEFAULT_CURRENCY,
        viewMode: Settings?.viewMode ?? ViewMode.DEFAULT
      }
    };
  }

  public async user(
    userWhereUniqueInput: Prisma.UserWhereUniqueInput
  ): Promise<UserWithSettings | null> {
    const userFromDatabase = await this.prismaService.user.findUnique({
      include: { Account: true, Settings: true, Subscription: true },
      where: userWhereUniqueInput
    });

    const user: UserWithSettings = userFromDatabase;

    const currentPermissions = getPermissions(userFromDatabase.role);

    if (this.configurationService.get('ENABLE_FEATURE_FEAR_AND_GREED_INDEX')) {
      currentPermissions.push(permissions.accessFearAndGreedIndex);
    }

    user.permissions = currentPermissions;

    if (userFromDatabase?.Settings) {
      if (!userFromDatabase.Settings.currency) {
        // Set default currency if needed
        userFromDatabase.Settings.currency = UserService.DEFAULT_CURRENCY;
      }
    } else if (userFromDatabase) {
      // Set default settings if needed
      userFromDatabase.Settings = {
        currency: UserService.DEFAULT_CURRENCY,
        updatedAt: new Date(),
        userId: userFromDatabase?.id,
        viewMode: ViewMode.DEFAULT
      };
    }

    if (this.configurationService.get('ENABLE_FEATURE_SUBSCRIPTION')) {
      if (userFromDatabase?.Subscription?.length > 0) {
        const latestSubscription = userFromDatabase.Subscription.reduce(
          (a, b) => {
            return new Date(a.expiresAt) > new Date(b.expiresAt) ? a : b;
          }
        );

        user.subscription = {
          expiresAt: latestSubscription.expiresAt,
          type: isBefore(new Date(), latestSubscription.expiresAt)
            ? SubscriptionType.Premium
            : SubscriptionType.Basic
        };
      } else {
        user.subscription = {
          type: SubscriptionType.Basic
        };
      }

      if (user.subscription.type === SubscriptionType.Basic) {
        user.permissions = user.permissions.filter((permission) => {
          return permission !== permissions.updateViewMode;
        });
        user.Settings.viewMode = ViewMode.ZEN;
      }
    }

    return user;
  }

  public async users(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.UserWhereUniqueInput;
    where?: Prisma.UserWhereInput;
    orderBy?: Prisma.UserOrderByInput;
  }): Promise<User[]> {
    const { skip, take, cursor, where, orderBy } = params;
    return this.prismaService.user.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy
    });
  }

  public createAccessToken(password: string, salt: string): string {
    const hash = crypto.createHmac('sha512', salt);
    hash.update(password);

    return hash.digest('hex');
  }

  public async createUser(data?: Prisma.UserCreateInput): Promise<User> {
    let user = await this.prismaService.user.create({
      data: {
        ...data,
        Account: {
          create: {
            isDefault: true,
            name: 'Default Account'
          }
        }
      }
    });

    if (data.provider === Provider.ANONYMOUS) {
      const accessToken = this.createAccessToken(
        user.id,
        this.getRandomString(10)
      );

      const hashedAccessToken = this.createAccessToken(
        accessToken,
        process.env.ACCESS_TOKEN_SALT
      );

      user = await this.prismaService.user.update({
        data: { accessToken: hashedAccessToken },
        where: { id: user.id }
      });

      return { ...user, accessToken };
    }

    return user;
  }

  public async updateUser(params: {
    where: Prisma.UserWhereUniqueInput;
    data: Prisma.UserUpdateInput;
  }): Promise<User> {
    const { where, data } = params;
    return this.prismaService.user.update({
      data,
      where
    });
  }

  public async deleteUser(where: Prisma.UserWhereUniqueInput): Promise<User> {
    await this.prismaService.access.deleteMany({
      where: { OR: [{ granteeUserId: where.id }, { userId: where.id }] }
    });

    await this.prismaService.account.deleteMany({
      where: { userId: where.id }
    });

    await this.prismaService.analytics.delete({
      where: { userId: where.id }
    });

    await this.prismaService.order.deleteMany({
      where: { userId: where.id }
    });

    try {
      await this.prismaService.settings.delete({
        where: { userId: where.id }
      });
    } catch {}

    return this.prismaService.user.delete({
      where
    });
  }

  public async updateUserSettings({
    currency,
    userId,
    viewMode
  }: UserSettingsParams) {
    await this.prismaService.settings.upsert({
      create: {
        currency,
        User: {
          connect: {
            id: userId
          }
        },
        viewMode
      },
      update: {
        currency,
        viewMode
      },
      where: {
        userId: userId
      }
    });

    return;
  }

  private getRandomString(length: number) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const result = [];

    for (let i = 0; i < length; i++) {
      result.push(
        characters.charAt(Math.floor(Math.random() * characters.length))
      );
    }
    return result.join('');
  }
}
