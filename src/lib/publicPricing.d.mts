export interface PricingPlan { id: string; name: string; price: number | null; priceLabel?: string; unit: string; details: string[]; recommended: boolean }
export interface PricingSection { id: string; name: string; icon: string; target: string; note: string; plans: PricingPlan[] }
export const PRICING_TITLE: string;
export const PRICING_DESCRIPTION: string;
export const PRICING_TABLES: string[];
export const PUBLIC_PRICING_URL: string;
export const PUBLIC_PRICING_KEY: string;
export function fetchPublicPricing(signal?: AbortSignal): Promise<Record<string, any>>;
export function formatPrice(price: number): string;
export function pricingSections(data?: Record<string, any>): PricingSection[];
export function pricingSchema(sections: PricingSection[], url: string): Record<string, any>;