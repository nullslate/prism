import { useEffect, useState } from "react";
import { commands } from "@/lib/tauri";
import type { ThemeColors } from "@/lib/types";

export function useTheme(themeName: string) {
  const [colors, setColors] = useState<ThemeColors | null>(null);

  useEffect(() => {
    commands.getTheme(themeName).then((theme) => {
      setColors(theme.colors);
      applyTheme(theme.colors);
    });
  }, [themeName]);

  return colors;
}

function applyTheme(colors: ThemeColors) {
  const root = document.documentElement;
  root.style.setProperty("--prism-bg", colors.bg);
  root.style.setProperty("--prism-fg", colors.fg);
  root.style.setProperty("--prism-accent", colors.accent);
  root.style.setProperty("--prism-border", colors.border);
  root.style.setProperty("--prism-sidebar-bg", colors.sidebar_bg);
  root.style.setProperty("--prism-heading", colors.heading);
  root.style.setProperty("--prism-code-bg", colors.code_bg);
  root.style.setProperty("--prism-selection", colors.selection);
  root.style.setProperty("--prism-syntax-keyword", colors.syntax_keyword);
  root.style.setProperty("--prism-syntax-string", colors.syntax_string);
  root.style.setProperty("--prism-syntax-comment", colors.syntax_comment);
  root.style.setProperty("--prism-syntax-function", colors.syntax_function);
  root.style.setProperty("--prism-syntax-number", colors.syntax_number);
  root.style.setProperty("--prism-syntax-operator", colors.syntax_operator);
  root.style.setProperty("--prism-syntax-type", colors.syntax_type);
  root.style.setProperty("--prism-syntax-variable", colors.syntax_variable);
}
