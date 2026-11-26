import { useEffect, useMemo, useRef, useState } from "react";
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString } from "libphonenumber-js/max";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { countrySearchMatches, getLocalizedCountryNames } from "@/lib/countrySearch";

type Country = { code: string; name: string; callingCode: string; flag: string; minLocalDigits?: number; maxLocalDigits?: number; isDefault?: boolean };
type Props = { label?: string; countryCode?: string; localValue?: string; required?: boolean; disabled?: boolean; onChange: (v: { countryCode: string; callingCode: string; localValue: string; internationalValue: string }) => void };
const countryFlag = (code: string) =>
  String(code || "").toUpperCase().replace(/[A-Z]/g, (letter) =>
    String.fromCodePoint(127397 + letter.charCodeAt(0))
  );
const digits = (value: string) => String(value || "").replace(/\D/g, "");
const displayNames = new Intl.DisplayNames(["fr"], { type: "region" });

// Même référentiel international que le CRM : tous les territoires pris en
// charge par libphonenumber-js, avec leur indicatif téléphonique propre.
const COUNTRIES: Country[] = getCountries().map((code) => ({
  code,
  name: displayNames.of(code) || code,
  callingCode: "+" + getCountryCallingCode(code),
  flag: countryFlag(code),
  minLocalDigits: code === "CI" ? 10 : 7,
  maxLocalDigits: code === "CI" ? 10 : 15,
  isDefault: code === "CI",
})).sort((a, b) => a.name.localeCompare(b.name, "fr"));

const countryFromCode = (value: string) => {
  const normalized = String(value || "").trim();
  const exact = COUNTRIES.find((country) => country.code === normalized.toUpperCase());
  if (exact) return exact;
  const matches = COUNTRIES.filter((country) => country.callingCode === normalized);
  if (normalized === "+1") return COUNTRIES.find((country) => country.code === "US") || matches[0];
  if (normalized === "+44") return COUNTRIES.find((country) => country.code === "GB") || matches[0];
  return matches[0] || COUNTRIES.find((country) => country.code === "CI") || COUNTRIES[0];
};

export default function CountryPhoneInput({ label, countryCode, localValue = "", required, disabled, onChange }: Props) {
  const [selectedCode, setSelectedCode] = useState(() => countryFromCode(countryCode || "+225").code);
  const lastEmittedCallingCode = useRef<string | null>(null);
  const [internationalDraft, setInternationalDraft] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (lastEmittedCallingCode.current && countryCode === lastEmittedCallingCode.current) {
      lastEmittedCallingCode.current = null;
      return;
    }
    setInternationalDraft(null);
    setSelectedCode(countryFromCode(countryCode || "+225").code);
  }, [countryCode]);

  const selected = COUNTRIES.find((country) => country.code === selectedCode) || countryFromCode("+225");
  const options = useMemo(() => COUNTRIES.map((country) => ({
    value: country.code,
    label: country.flag + " " + country.name + " " + country.callingCode,
    searchTerms: `${getLocalizedCountryNames(country.code)} ${country.code} ${country.callingCode} ${country.code === "CI" ? "Ivory Coast Ivory-Coast Ivoire Ivorie" : ""}`,
  })), []);

  const normalizedLocal = (value: string, country: Country) => {
    const rawValue = String(value || "").trim();
    let valueDigits = digits(rawValue);
    const callingDigits = digits(country.callingCode);

    // Conserver les chiffres nationaux tels que saisis, notamment le zéro initial.
    if (rawValue.startsWith("+") && callingDigits && valueDigits.startsWith(callingDigits)) {
      const parsedInternational = parsePhoneNumberFromString(rawValue);
      if (parsedInternational?.countryCallingCode === callingDigits) {
        valueDigits = valueDigits.slice(callingDigits.length);
      }
    } else if (country.code === "CI" && valueDigits.length === 13 && valueDigits.startsWith("225")) {
      valueDigits = valueDigits.slice(3);
    }

    return valueDigits.slice(0, country.maxLocalDigits || 15);
  };

  const currentLocal = normalizedLocal(localValue, selected);
  const emit = (country: Country, value: string) => {
    setSelectedCode(country.code);
    lastEmittedCallingCode.current = country.callingCode;
    const local = normalizedLocal(value, country);
    onChange({
      countryCode: country.code,
      callingCode: country.callingCode,
      localValue: local,
      internationalValue: local ? country.callingCode + local : "",
    });
  };
  const handlePhoneInput = (rawValue: string) => {
    const raw = rawValue.trim();
    if (raw.startsWith("+")) {
      const rawDigits = digits(raw);
      const match = COUNTRIES
        .filter(country => rawDigits.startsWith(digits(country.callingCode)))
        .sort((a, b) => digits(b.callingCode).length - digits(a.callingCode).length)[0];
      setInternationalDraft(raw);
      if (!match) {
        onChange({ countryCode: selected.code, callingCode: selected.callingCode, localValue: "", internationalValue: "" });
        return;
      }
      const parsed = parsePhoneNumberFromString(raw);
      const country = (parsed?.country && COUNTRIES.find(item => item.code === parsed.country))
        || (match.callingCode === "+1" ? countryFromCode("+1") : match);
      const local = rawDigits.slice(digits(country.callingCode).length).slice(0, country.maxLocalDigits || 15);
      setSelectedCode(country.code);
      lastEmittedCallingCode.current = country.callingCode;
      onChange({
        countryCode: country.code,
        callingCode: country.callingCode,
        localValue: local,
        internationalValue: local ? country.callingCode + local : "",
      });
      return;
    }
    setInternationalDraft(null);
    emit(selected, rawValue);
  };

  return (
    <div className="space-y-2 min-w-0">
      {label && <label className="text-sm font-medium">{label}{required && " *"}</label>}
      <div className="flex w-full min-w-0 gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" disabled={disabled} className="w-[112px] shrink-0 justify-between px-3 font-normal">
              <span className="truncate">{selected.flag + " " + selected.callingCode}</span>
              <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-max min-w-[260px] max-w-[calc(100vw-24px)] p-0">
            <Command className="w-full min-w-0" filter={(value, search) => countrySearchMatches(value, search)}>
              <CommandInput placeholder="Rechercher un pays ou un indicatif..." />
              <CommandList>
                <CommandEmpty>Aucun pays trouvé.</CommandEmpty>
                <CommandGroup>
                  {options.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.label + " " + option.searchTerms}
                      onSelect={() => {
                        const country = COUNTRIES.find((item) => item.code === option.value);
                        if (country) { setInternationalDraft(null); emit(country, currentLocal); }
                        setOpen(false);
                      }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", selected.code === option.value ? "opacity-100" : "opacity-0")} />
                      <span className="truncate">{option.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Input
          className="min-w-0 flex-1"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={internationalDraft ?? currentLocal}
          disabled={disabled}
          required={required}
          minLength={selected.minLocalDigits}
          maxLength={internationalDraft ? (selected.maxLocalDigits || 15) + 4 : selected.maxLocalDigits}
          placeholder="Numéro local ou international"
          onChange={(event) => handlePhoneInput(event.target.value)}
        />
      </div>
    </div>
  );
}
