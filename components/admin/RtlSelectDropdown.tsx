'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

type Option = {
  value: string;
  label: string;
};

interface RtlSelectDropdownProps {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  placeholder?: string;
  buttonClassName?: string;
}

export function RtlSelectDropdown(props: RtlSelectDropdownProps) {
  const { value, options, onChange, placeholder = '—', buttonClassName } = props;

  const selectedLabel =
    options.find((o) => o.value === value)?.label || placeholder;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={`w-full justify-start text-md font-normal ${
            buttonClassName ?? ''
          }`}
        >
          {selectedLabel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-56 bg-white text-right *:text-right"
        style={{ direction: 'rtl' }}
      >
        <DropdownMenuRadioGroup
          value={value}
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


