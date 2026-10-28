import React from 'react';
import { TextInput } from 'react-native';

type Props = {
  mode: 'date' | 'time';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  style?: object;
};

// Native platforms never render this component (the screens use the native
// date/time picker there); it only exists so the import resolves during native
// bundling.
export default function WebDateTimeInput({
  value,
  onChange,
  placeholder,
  disabled,
  style,
}: Props) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      editable={!disabled}
      style={style}
    />
  );
}
