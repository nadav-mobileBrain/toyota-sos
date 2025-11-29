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
    return (
      options.find((o) => o.value === (value as string))?.label || placeholder
    );
  };

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
          <span className="truncate">{getLabel()}</span>
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
              {opt.label}
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
                {opt.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
