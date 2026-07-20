-- Přejmenování: měsíční limit POČTU generování → měsíční ROZPOČET v centech USD
-- (přání Hany: logičtější limitovat náklady přímo). Rename (ne drop+add) →
-- zachová řádek konfigurace; hodnota 0 (= bez limitu) zůstává platná.
ALTER TABLE "AppConfig" DROP CONSTRAINT "AppConfig_limit_nonneg";
ALTER TABLE "AppConfig" RENAME COLUMN "monthlyGenerationLimit" TO "monthlyBudgetUsdCents";
ALTER TABLE "AppConfig" ADD CONSTRAINT "AppConfig_budget_nonneg" CHECK ("monthlyBudgetUsdCents" >= 0);
