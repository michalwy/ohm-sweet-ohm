"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";

export type DateFormatPrefs = {
  dateFormat: string;
  timeFormat: string;
  relativeFormat: boolean;
};

const DEFAULT: DateFormatPrefs = {
  dateFormat: "locale",
  timeFormat: "locale",
  relativeFormat: false
};

const DateFormatContext = createContext<DateFormatPrefs>(DEFAULT);

export function DateFormatProvider({
  dateFormat,
  timeFormat,
  relativeFormat,
  children
}: DateFormatPrefs & { children: ReactNode }) {
  return (
    <DateFormatContext.Provider value={{ dateFormat, timeFormat, relativeFormat }}>
      {children}
    </DateFormatContext.Provider>
  );
}

export function useDateFormatPrefs(): DateFormatPrefs {
  return useContext(DateFormatContext);
}
