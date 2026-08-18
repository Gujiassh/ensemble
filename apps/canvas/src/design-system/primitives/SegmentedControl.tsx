import { useId } from "react";

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
};

type SegmentedControlProps<T extends string> = {
  label: string;
  value: T;
  options: SegmentOption<T>[];
  onValueChange: (value: T) => void;
  name?: string;
};

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onValueChange,
  name,
}: SegmentedControlProps<T>) {
  const groupId = useId();
  const groupName = name ?? groupId;

  return (
    <fieldset className="ds-segmented">
      <legend className="ds-segmented__legend">{label}</legend>
      <div className="ds-segmented__list" role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <label
              key={option.value}
              className={
                selected ? "ds-segmented__option is-selected" : "ds-segmented__option"
              }
            >
              <input
                type="radio"
                className="ds-segmented__input"
                name={groupName}
                value={option.value}
                checked={selected}
                onChange={() => onValueChange(option.value)}
              />
              <span className="ds-segmented__label">{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
