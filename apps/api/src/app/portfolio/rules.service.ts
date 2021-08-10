import { RuleSettings } from '@ghostfolio/api/models/interfaces/rule-settings.interface';
import { Rule } from '@ghostfolio/api/src/app/portfolio/rules.service';
import { Injectable } from '@nestjs/common';
import { Currency } from '@prisma/client';

@Injectable()
export class RulesService {
  public constructor() {}

  public async evaluate<T extends RuleSettings>(
    aRules: Rule<T>[],
    aUserSettings: { baseCurrency: Currency }
  ) {
    return aRules
      .filter((rule) => {
        return rule.getSettings(aUserSettings)?.isActive;
      })
      .map((rule) => {
        const evaluationResult = rule.evaluate(rule.getSettings(aUserSettings));
        return { ...evaluationResult, name: rule.getName() };
      });
  }
}
