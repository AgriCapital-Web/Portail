import PhoneInput, { type Country } from "react-phone-number-input";
import "react-phone-number-input/style.css";

interface PhoneNumberFieldProps {
  countries: string[];
  disabled: boolean;
  value?: string;
  onChange: (value?: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}

export default function PhoneNumberField({
  countries,
  disabled,
  value,
  onChange,
  onKeyDown,
}: PhoneNumberFieldProps) {
  return (
    <PhoneInput
      countries={countries as Country[]}
      disabled={disabled}
      international
      defaultCountry="CI"
      countryCallingCodeEditable={false}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      aria-label="Numéro de téléphone international"
      className="phone-input"
    />
  );
}
