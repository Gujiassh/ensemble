import { createContext } from "react";
import type { Translator } from "./format";

export const I18nContext = createContext<Translator | null>(null);
