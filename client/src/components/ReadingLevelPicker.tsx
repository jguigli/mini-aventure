// Reading level as three pills, with the radio group keyboard pattern:
// Tab enters the group on the selected pill, arrow keys move AND select.
import { useRef, type KeyboardEvent } from "react";
import type { ReadingLevel } from "@shared/schema";

export const READING_LEVEL_OPTIONS: { value: ReadingLevel; label: string; grades: string }[] = [
  { value: "8-10", label: "8-10 ans", grades: "CM1-CM2" },
  { value: "11-12", label: "11-12 ans", grades: "6e-5e" },
  { value: "13-15", label: "13-15 ans", grades: "4e-3e" },
];

interface Props {
  value: ReadingLevel;
  onChange: (value: ReadingLevel) => void;
  disabled?: boolean;
}

export function ReadingLevelPicker({ value, onChange, disabled }: Props) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const nextIndex = (index + step + READING_LEVEL_OPTIONS.length) % READING_LEVEL_OPTIONS.length;
    onChange(READING_LEVEL_OPTIONS[nextIndex].value);
    buttons.current[nextIndex]?.focus();
  };

  return (
    <div className="level-picker" role="radiogroup" aria-labelledby="level-label">
      {READING_LEVEL_OPTIONS.map((option, index) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            className={`level-pill${checked ? " is-checked" : ""}`}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            disabled={disabled}
          >
            <span className="level-pill-label">{option.label}</span>
            <span className="level-pill-grades">{option.grades}</span>
          </button>
        );
      })}
    </div>
  );
}
