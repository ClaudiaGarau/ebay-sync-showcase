export type Id = string;

export type IsoDateString = string;

export type CurrencyCode = "EUR" | "USD" | "GBP";

export interface Money {
  amount: number;
  currency: CurrencyCode;
}
