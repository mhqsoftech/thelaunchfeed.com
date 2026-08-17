import type { RevenueProvider } from "@prisma/client";

export interface RevenueMetrics {
  mrrCents: number;
  arrCents: number;
  totalRevenueCents: number;
  currency: string;
  customerCount?: number;
  momGrowthPct?: number;
}

export interface RevenueProviderAdapter {
  readonly provider: RevenueProvider;
  getAuthUrl(state: string): string;
  exchangeCode(
    code: string
  ): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    externalAccountId: string;
  }>;
  refresh(
    refreshToken: string
  ): Promise<{ accessToken: string; expiresAt?: Date }>;
  fetchMetrics(
    accessToken: string,
    externalAccountId: string
  ): Promise<RevenueMetrics>;
}
