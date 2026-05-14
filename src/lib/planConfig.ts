export interface PlanConfig {
  id: "basic" | "pro";
  nameKey: string;
  descKey: string;
  daily_run_limit: number;
  daily_image_limit: number;
  monthly_run_limit: number;
  daily_token_limit: number;
  monthly_token_limit: number;
}

export const PLAN_CONFIGS: PlanConfig[] = [
  {
    id: "basic",
    nameKey: "pricing.basicName",
    descKey: "pricing.basicDesc",
    daily_run_limit: 50,
    daily_image_limit: 30,
    monthly_run_limit: 200,
    daily_token_limit: 300_000,
    monthly_token_limit: 5_000_000,
  },
  {
    id: "pro",
    nameKey: "pricing.proName",
    descKey: "pricing.proDesc",
    daily_run_limit: 200,
    daily_image_limit: 100,
    monthly_run_limit: 1_000,
    daily_token_limit: 1_000_000,
    monthly_token_limit: 20_000_000,
  },
];
