"use client";

import { useServerInsertedHTML } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";

const STORAGE_KEY = "greenbook-theme";

/** Runs before paint (SSR-injected) so theme matches localStorage without FOUC. */
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});var d=document.documentElement;if(t==="light"){d.classList.remove("dark");d.style.colorScheme="light";}else{d.classList.add("dark");d.style.colorScheme="dark";}}catch(e){document.documentElement.classList.add("dark");}})();`;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Inject outside the React client tree — avoids React 19 "script tag" warning
  // that next-themes triggers with its built-in <script>.
  useServerInsertedHTML(() => (
    <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
  ));

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      storageKey={STORAGE_KEY}
      disableTransitionOnChange
      // Neutralize next-themes' own script so React 19 does not warn.
      scriptProps={{ type: "application/json" }}
    >
      {children}
    </NextThemesProvider>
  );
}
