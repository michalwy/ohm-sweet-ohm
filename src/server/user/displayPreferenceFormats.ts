/**
 * The values a user's display preferences may take, shared by the server action and the API
 * operations (#286). Pure, so unit tests and the OpenAPI document can load it.
 */
export const DISPLAY_DATE_FORMATS = ["locale", "abbr", "YMD", "DMY", "MDY"] as const;
export const DISPLAY_TIME_FORMATS = ["locale", "12h", "24h"] as const;

export type DisplayDateFormat = (typeof DISPLAY_DATE_FORMATS)[number];
export type DisplayTimeFormat = (typeof DISPLAY_TIME_FORMATS)[number];

export function isDisplayDateFormat(value: string): value is DisplayDateFormat {
  return (DISPLAY_DATE_FORMATS as readonly string[]).includes(value);
}

export function isDisplayTimeFormat(value: string): value is DisplayTimeFormat {
  return (DISPLAY_TIME_FORMATS as readonly string[]).includes(value);
}
