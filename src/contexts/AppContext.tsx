import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type Theme = "light" | "dark" | "system";
type Locale = "ar" | "en";

interface AppPreferences {
  theme: Theme;
  locale: Locale;
  setTheme: (theme: Theme) => void;
  setLocale: (locale: Locale) => void;
  accessibility: {
    highContrast: boolean;
    largeText: boolean;
    reducedMotion: boolean;
    simplified: boolean;
  };
  setAccessibility: (patch: Partial<AppPreferences["accessibility"]>) => void;
}

const Context = createContext<AppPreferences | null>(null);

export function AppPreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem("academicos-theme") as Theme) || "light",
  );
  const [locale, setLocaleState] = useState<Locale>("ar");
  const [accessibility, setAccessibilityState] = useState<
    AppPreferences["accessibility"]
  >(() => {
    try {
      return {
        highContrast: false,
        largeText: false,
        reducedMotion: false,
        simplified: false,
        ...JSON.parse(localStorage.getItem("academicos-accessibility") || "{}"),
      };
    } catch {
      return {
        highContrast: false,
        largeText: false,
        reducedMotion: false,
        simplified: false,
      };
    }
  });
  useEffect(() => {
    localStorage.setItem("academicos-locale", "ar");
  }, []);

  // اللغة والاتجاه مملوكان لـI18nProvider وحده. كان هذا التأثير يعيد فرض
  // العربية/RTL عند كل تغيير للسمة أو تفضيلات الوصول، فيقلب واجهة المستخدم
  // الإنجليزي إلى RTL بمجرد تبديل الوضع الليلي.
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      root.classList.toggle(
        "dark",
        theme === "dark" || (theme === "system" && media.matches),
      );
    };
    apply();
    if (theme !== "system") return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("a11y-high-contrast", accessibility.highContrast);
    root.classList.toggle("a11y-large-text", accessibility.largeText);
    root.classList.toggle("a11y-reduced-motion", accessibility.reducedMotion);
    root.classList.toggle("a11y-simplified", accessibility.simplified);
  }, [accessibility]);

  const value = useMemo(
    () => ({
      theme,
      locale,
      setTheme: (next: Theme) => {
        localStorage.setItem("academicos-theme", next);
        setThemeState(next);
      },
      setLocale: (next: Locale) => {
        localStorage.setItem("academicos-locale", next);
        setLocaleState(next);
      },
      accessibility,
      setAccessibility: (patch: Partial<AppPreferences["accessibility"]>) =>
        setAccessibilityState((current) => {
          const next = { ...current, ...patch };
          localStorage.setItem(
            "academicos-accessibility",
            JSON.stringify(next),
          );
          return next;
        }),
    }),
    [theme, locale, accessibility],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAppPreferences() {
  const ctx = useContext(Context);
  if (!ctx)
    throw new Error(
      "useAppPreferences must be used inside AppPreferencesProvider",
    );
  return ctx;
}
