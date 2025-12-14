'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

type Option = {
  value: string;
  label: string;
  color?: string; // Hex color or Tailwind class
  bgClass?: string; // Tailwind background class
  textClass?: string; // Tailwind text class
};

interface RtlSelectDropdownProps {
  value: string | string[];
  options: Option[];
  onChange: (value: any) => void;
  placeholder?: string;
  buttonClassName?: string;
  multiple?: boolean;
}

export function RtlSelectDropdown(props: RtlSelectDropdownProps) {
  const {
    value,
    options,
    onChange,
    placeholder = '—',
    buttonClassName,
    multiple = false,
  } = props;

  const getLabel = () => {
    if (multiple && Array.isArray(value)) {
      if (value.length === 0) return placeholder;
      const labels = value
        .map((v) => options.find((o) => o.value === v)?.label)
        .filter(Boolean);
      return labels.length > 0 ? labels.join(', ') : placeholder;
    }
    const selectedOption = options.find((o) => o.value === (value as string));
    if (!selectedOption) return placeholder;
    return selectedOption.label;
  };

  const getSelectedOption = () => {
    if (multiple && Array.isArray(value)) {
      return null;
    }
    return options.find((o) => o.value === (value as string));
  };

  const selectedOption = getSelectedOption();

  const handleMultiChange = (val: string, checked: boolean) => {
    const current = Array.isArray(value) ? value : [];
    let next: string[];
    if (checked) {
      next = [...current, val];
    } else {
      next = current.filter((v) => v !== val);
    }
    onChange(next);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={`w-full justify-start text-md font-normal ${
            buttonClassName ?? ''
          }`}
        >
          <div className="flex items-center gap-2 truncate">
            {selectedOption?.bgClass && (
              <span
                className={`inline-block h-4 w-4 shrink-0 rounded-full ${selectedOption.bgClass} ${selectedOption.textClass || ''}`}
                style={selectedOption.color ? { backgroundColor: selectedOption.color } : undefined}
              />
            )}
            <span className="truncate">{getLabel()}</span>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-56 bg-white text-right *:text-right max-h-60 overflow-y-auto"
        style={{ direction: 'rtl' }}
      >
        {multiple ? (
          options.map((opt) => (
            <DropdownMenuCheckboxItem
              key={opt.value}
              checked={Array.isArray(value) && value.includes(opt.value)}
              onCheckedChange={(checked) =>
                handleMultiChange(opt.value, checked)
              }
              className="hover:bg-blue-600 hover:text-white"
            >
              <div className="flex items-center gap-2">
                {opt.bgClass && (
                  <span
                    className={`inline-block h-4 w-4 rounded-full ${opt.bgClass} ${opt.textClass || ''}`}
                    style={opt.color ? { backgroundColor: opt.color } : undefined}
                  />
                )}
                <span>{opt.label}</span>
              </div>
            </DropdownMenuCheckboxItem>
          ))
        ) : (
          <DropdownMenuRadioGroup
            value={value as string}
            onValueChange={(val) => onChange(val)}
          >
            {options.map((opt) => (
              <DropdownMenuRadioItem
                key={opt.value}
                value={opt.value}
                className="hover:bg-blue-600 hover:text-white"
              >
                <div className="flex items-center gap-2">
                  {opt.bgClass && (
                    <span
                      className={`inline-block h-4 w-4 rounded-full ${opt.bgClass} ${opt.textClass || ''}`}
                      style={opt.color ? { backgroundColor: opt.color } : undefined}
                    />
                  )}
                  <span>{opt.label}</span>
                </div>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
