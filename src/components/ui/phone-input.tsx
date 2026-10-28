import * as React from 'react';
import { Check, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { COUNTRIES, CountryCode, joinPhone, splitPhone, phoneDigits } from '@/lib/phone';

export interface CountryPickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected: CountryCode;
  onSelect: (country: CountryCode) => void;
}

/**
 * Full-width bottom sheet with a searchable, complete list of every country.
 * Shared by the phone input and the login pages so the picker looks identical
 * everywhere.
 */
export const CountryPickerSheet: React.FC<CountryPickerSheetProps> = ({
  open,
  onOpenChange,
  selected,
  onSelect,
}) => {
  const [query, setQuery] = React.useState('');

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^\+/, '');
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dial.startsWith(q) || c.code.toLowerCase() === q
    );
  }, [query]);

  return (
    <Drawer open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setQuery(''); }}>
      <DrawerContent className="inset-x-0 max-h-[85vh] w-full rounded-t-2xl">
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle>Select country</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-3">
          <div className="flex h-11 items-center gap-2 rounded-xl border border-input bg-muted/40 px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search country or code"
              className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
        <div className="overflow-y-auto px-2 pb-6">
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No country found.</p>
          )}
          {filtered.map((c) => {
            const active = c.code === selected.code && c.dial === selected.dial;
            return (
              <button
                key={`${c.code}-${c.dial}`}
                type="button"
                onClick={() => {
                  onSelect(c);
                  onOpenChange(false);
                  setQuery('');
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition-colors hover:bg-muted',
                  active && 'bg-primary/10'
                )}
              >
                <span className="text-xl">{c.flag}</span>
                <span className="flex-1 truncate">{c.name}</span>
                <span className="text-muted-foreground">+{c.dial}</span>
                {active && <Check className="h-4 w-4 text-primary" />}
              </button>
            );
          })}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export interface PhoneInputProps {
  /** Full E.164 value (e.g. "+919876543210") or empty string. */
  value: string;
  /** Called with the full E.164 value. */
  onChange: (e164: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

/**
 * Single-box phone input: country code + number together. The country list
 * opens as a full-width bottom sheet. Emits E.164 so any country can be saved.
 */
export const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChange,
  placeholder = '98765 43210',
  disabled,
  className,
  id,
}) => {
  const initial = React.useMemo(() => splitPhone(value), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [country, setCountry] = React.useState<CountryCode>(initial.country);
  const [national, setNational] = React.useState(initial.national);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!value) {
      setNational('');
      return;
    }
    const parts = splitPhone(value);
    setCountry(parts.country);
    setNational(parts.national);
  }, [value]);

  const emit = (c: CountryCode, n: string) => onChange(n ? joinPhone(c.dial, n) : '');

  return (
    <>
      <div
        className={cn(
          'flex h-10 w-full items-center rounded-md border border-input bg-background ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
          disabled && 'cursor-not-allowed opacity-50',
          className
        )}
      >
        <button
          type="button"
          aria-label="Select country code"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="flex h-full shrink-0 items-center gap-1.5 whitespace-nowrap pl-3 pr-1 text-sm font-medium disabled:cursor-not-allowed"
        >
          <span>{country.flag}</span>
          <span>+{country.dial}</span>
        </button>
        <Input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          value={national}
          onChange={(e) => {
            const digits = phoneDigits(e.target.value).slice(0, 15 - country.dial.length);
            setNational(digits);
            emit(country, digits);
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="h-full flex-1 border-0 bg-transparent pl-1.5 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>

      <CountryPickerSheet
        open={open}
        onOpenChange={setOpen}
        selected={country}
        onSelect={(c) => {
          setCountry(c);
          emit(c, national);
        }}
      />
    </>
  );
};

export default PhoneInput;
