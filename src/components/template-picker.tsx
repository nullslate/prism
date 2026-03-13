import { useCallback, useEffect, useRef, useState } from "react";
import { commands } from "@/lib/tauri";
import { log } from "@/lib/logger";
import type { TemplateMeta } from "@/lib/types";

interface TemplatePickerProps {
  onCreate: (path: string) => void;
  onClose: () => void;
}

export function TemplatePickerDialog({ onCreate, onClose }: TemplatePickerProps) {
  const [templates, setTemplates] = useState<TemplateMeta[]>([]);
  const [filter, setFilter] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateMeta | null>(null);
  const [fileName, setFileName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    commands.listTemplates().then(setTemplates).catch(log.error);
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, [selectedTemplate]);

  const filtered = templates.filter((t) =>
    t.name.toLowerCase().includes(filter.toLowerCase()),
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const handleSubmit = useCallback(() => {
    if (!selectedTemplate) return;
    const trimmed = fileName.trim();
    if (!trimmed) return;
    const path = trimmed.endsWith(".md") ? trimmed : `${trimmed}.md`;
    commands
      .createFromTemplate(selectedTemplate.name, path)
      .then((actualPath) => onCreate(actualPath))
      .catch((err) => log.error("Failed to create from template:", err));
  }, [selectedTemplate, fileName, onCreate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (selectedTemplate) {
        // Step 2: filename input
        if (e.key === "Enter") {
          e.preventDefault();
          handleSubmit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          setSelectedTemplate(null);
          setFileName("");
        }
        return;
      }

      // Step 1: template picker
      if (e.key === "ArrowDown" || (e.key === "j" && e.ctrlKey)) {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp" || (e.key === "k" && e.ctrlKey)) {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && filtered[selectedIndex]) {
        e.preventDefault();
        setSelectedTemplate(filtered[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [selectedTemplate, filtered, selectedIndex, handleSubmit, onClose],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "var(--prism-bg)" }}
    >
      <div
        className="flex items-center border-b px-3 gap-2"
        style={{ borderColor: "var(--prism-border)" }}
      >
        <span style={{ color: "var(--prism-muted)" }}>&#x25A3;</span>
        {selectedTemplate ? (
          <input
            ref={inputRef}
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`New file from "${selectedTemplate.name}"...`}
            className="flex-1 py-2.5 text-sm outline-none"
            style={{
              background: "transparent",
              color: "var(--prism-fg)",
              fontFamily: "var(--font-mono)",
            }}
          />
        ) : (
          <input
            ref={inputRef}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Select template..."
            className="flex-1 py-2.5 text-sm outline-none"
            style={{
              background: "transparent",
              color: "var(--prism-fg)",
              fontFamily: "var(--font-mono)",
            }}
          />
        )}
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center text-sm hover:opacity-80"
          style={{ color: "var(--prism-muted)" }}
        >
          &#x00D7;
        </button>
      </div>
      {!selectedTemplate && (
        <ul ref={listRef} className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <li
              className="px-3 py-4 text-sm text-center"
              style={{ color: "var(--prism-muted)", fontFamily: "var(--font-mono)" }}
            >
              {templates.length === 0
                ? "No templates found. Add .md files to templates/"
                : "No matching templates"}
            </li>
          ) : (
            filtered.map((t, i) => (
              <li
                key={t.path}
                className="px-3 py-2 text-sm cursor-pointer"
                style={{
                  background:
                    i === selectedIndex
                      ? "var(--prism-selection)"
                      : "transparent",
                  fontFamily: "var(--font-mono)",
                }}
                onClick={() => setSelectedTemplate(t)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <div style={{ color: "var(--prism-fg)" }}>{t.name}</div>
                <div
                  className="truncate"
                  style={{ color: "var(--prism-muted)", fontSize: "11px" }}
                >
                  {t.path}
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
