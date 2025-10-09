import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SelectWithPortalProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  children: React.ReactNode;
  className?: string;
  error?: boolean;
}

export function SelectWithPortal({ 
  value, 
  onValueChange, 
  placeholder, 
  children, 
  className,
  error 
}: SelectWithPortalProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={error ? 'border-destructive' : ''}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent 
        className="select-content-fixed z-[9999]" 
        side="bottom" 
        align="start"
        position="popper"
        sideOffset={4}
        container={document.body}
      >
        {children}
      </SelectContent>
    </Select>
  );
}
