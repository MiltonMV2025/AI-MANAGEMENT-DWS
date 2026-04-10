import { ICON_OPTIONS, type IconName } from "../../lib/icon-library";
import { cn } from "../../lib/utils";

type IconPickerProps = {
  selected: IconName;
  onSelect: (value: IconName) => void;
};

export function IconPicker({ selected, onSelect }: IconPickerProps): React.JSX.Element {
  return (
    <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
      {ICON_OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = selected === option.key;

        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onSelect(option.key)}
            className={cn(
              "rounded-lg border p-3 text-center transition",
              active
                ? "border-primary bg-accent text-accent-foreground"
                : "border-input bg-background text-muted-foreground hover:bg-accent"
            )}
          >
            <Icon className="mx-auto h-5 w-5" />
            <span className="mt-2 block text-xs font-medium">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}