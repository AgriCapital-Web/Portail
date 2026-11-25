import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";
import { countrySearchMatches, getLocalizedCountryNames } from "@/lib/countrySearch";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

interface PhoneNumberFieldProps {
  countries?: string[];
  disabled: boolean;
  value?: string;
  onChange: (value?: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}

const displayNames = new Intl.DisplayNames(["fr"], { type: "region" });
const countryFlag = (code: string) =>
  String(code || "").toUpperCase().replace(/[A-Z]/g, letter => String.fromCodePoint(127397 + letter.charCodeAt(0)));
const CI_SEARCH_TERMS = [
  "Côte d'Ivoire", "Cote d'Ivoire", "Cote d Ivoire", "Côte d Ivoire",
  "Cote ivoire", "Côte ivoire", "cote divoire", "cote divoir",
  "cote d ivoir", "cot d ivoir", "cot d'ivoire", "cot ivoire",
  "ivoire", "ivorie", "ivor", "Ivory Coast", "Ivory", "CI", "225", "+225",
].join(" ");

export default function PhoneNumberField({
  countries = [],
  disabled,
  value,
  onChange,
  onKeyDown,
}: PhoneNumberFieldProps) {
  const countryOptions = useMemo(() => {
    const allowed = new Set((countries || []).map(code => code.toUpperCase()));
    return getCountries()
      .filter(code => allowed.size === 0 || allowed.has(code))
      .map(code => ({
        code,
        name: displayNames.of(code) || code,
        callingCode: "+" + getCountryCallingCode(code),
        searchTerms: `${getLocalizedCountryNames(code)} ${code} +${getCountryCallingCode(code)} ${code === "CI" ? CI_SEARCH_TERMS + " Ivory Coast Ivory-Coast" : ""}`,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [countries]);

  const initialCountry = countryOptions.find(country => country.code === "CI")?.code
    || countryOptions[0]?.code
    || "CI";
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(initialCountry as CountryCode);
  const [localNumber, setLocalNumber] = useState("");
  const [open, setOpen] = useState(false);
  const lastEmittedValue = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!value) {
      if (lastEmittedValue.current !== value) setLocalNumber("");
      return;
    }
    if (lastEmittedValue.current === value) {
      lastEmittedValue.current = undefined;
      return;
    }
    const parsed = parsePhoneNumberFromString(value);
    if (parsed?.country && countryOptions.some(country => country.code === parsed.country)) {
      setSelectedCountry(parsed.country);
      setLocalNumber(parsed.formatNational());
      return;
    }
    const localParsed = parsePhoneNumberFromString(value, selectedCountry);
    setLocalNumber(localParsed?.formatNational() || value.replace(/^\+\d+/, ""));
  }, [value, countryOptions, selectedCountry]);

  const emit = (country: CountryCode, rawValue: string) => {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      lastEmittedValue.current = undefined;
      onChange(undefined);
      return;
    }
    const internationalPaste = trimmed.startsWith("+") ? parsePhoneNumberFromString(trimmed) : undefined;
    if (internationalPaste?.country) {
      setSelectedCountry(internationalPaste.country);
      setLocalNumber(internationalPaste.formatNational());
      lastEmittedValue.current = internationalPaste.number;
      onChange(internationalPaste.number);
      return;
    }
    // Keep the exact national input visible while the user types. Normalize only the value sent to the form.
    const digits = trimmed.replace(/\D/g, "");
    const parsed = parsePhoneNumberFromString(trimmed, country);
    const normalized = parsed?.number || (digits ? "+" + getCountryCallingCode(country) + digits : undefined);
    lastEmittedValue.current = normalized;
    onChange(normalized);
  };

  const selected = countryOptions.find(country => country.code === selectedCountry)
    || countryOptions.find(country => country.code === "CI")
    || countryOptions[0];

  const selectCountry = (code: CountryCode) => {
    setSelectedCountry(code);
    setOpen(false);
    emit(code, localNumber);
  };

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-label="Rechercher un pays et son indicatif"
            aria-expanded={open}
            disabled={disabled}
            className="h-11 min-w-[112px] justify-between gap-2 px-3 phone-input"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span aria-hidden="true">{selected ? countryFlag(selected.code) : "🌍"}</span>
              <span className="font-medium">{selected?.callingCode || "+225"}</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(340px,calc(100vw-24px))] p-0" align="start">
          <Command filter={(value, search) => countrySearchMatches(value, search)}>
            <CommandInput placeholder="Rechercher un pays, un nom ou un indicatif..." />
            <CommandList>
              <CommandEmpty>Aucun pays trouvé.</CommandEmpty>
              <CommandGroup>
                {countryOptions.map(country => (
                  <CommandItem
                    key={country.code}
                    value={`${country.name} ${country.callingCode} ${country.code} ${country.searchTerms}`}
                    onSelect={() => selectCountry(country.code)}
                  >
                    <Check className={`mr-2 h-4 w-4 ${selectedCountry === country.code ? "opacity-100" : "opacity-0"}`} />
                    <span className="mr-2" aria-hidden="true">{countryFlag(country.code)}</span>
                    <span className="min-w-0 flex-1 truncate">{country.name}</span>
                    <span className="ml-2 text-muted-foreground">{country.callingCode}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Input
        className="h-11 min-w-0 flex-1 phone-input"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        aria-label="Numéro de téléphone"
        placeholder="Numéro de téléphone"
        value={localNumber}
        disabled={disabled}
        onChange={event => {
          const next = event.target.value;
          setLocalNumber(next);
          emit(selectedCountry, next);
        }}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}
