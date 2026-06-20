import { useEffect, useId, useRef, useState } from "react";

import { usePlacesAutocomplete } from "../hooks/usePlacesAutocomplete";
import { cn } from "../lib/cn";
import type { PlaceSearchPending, RestaurantSearchSelection } from "../lib/searchNavigation";

interface PlaceSearchBoxProps {
  onSelectPlace: (pending: PlaceSearchPending) => void;
  onSelectRestaurant: (selection: RestaurantSearchSelection) => void;
  placeholder?: string;
  lat?: number;
  lng?: number;
}

export function PlaceSearchBox({
  onSelectPlace,
  onSelectRestaurant,
  placeholder = "Search by name or place…",
  lat,
  lng,
}: PlaceSearchBoxProps) {
  const [inputValue, setInputValue] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const menuId = useId();

  const { suggestions, loading, requiresSignIn, search, resetSessionToken, sessionToken } =
    usePlacesAutocomplete({ lat, lng });

  const isOpen = suggestions.length > 0 && inputValue.trim().length > 0;

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setInputValue(val);
    setActiveIndex(-1);
    search(val);
  }

  function clearInput() {
    setInputValue("");
    setActiveIndex(-1);
    search("");
    inputRef.current?.focus();
  }

  function selectSuggestion(index: number) {
    const s = suggestions[index];
    if (!s) return;

    if (s.type === "restaurant" && s.restaurant_id) {
      setInputValue(s.primary_text);
      search("");
      onSelectRestaurant({
        restaurant_id: s.restaurant_id,
        lat: s.lat,
        lng: s.lng,
        name: s.primary_text,
        address: s.secondary_text ?? undefined,
      });
      return;
    }

    if (s.type === "place" && s.place_id) {
      setInputValue(s.primary_text);
      search("");
      const token = sessionToken.current;
      resetSessionToken();
      onSelectPlace({
        place_id: s.place_id,
        label: s.primary_text,
        session_token: token,
      });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0) {
        selectSuggestion(activeIndex);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setActiveIndex(-1);
      search("");
    }
  }

  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex] as HTMLElement | null;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  const activeOptionId =
    activeIndex >= 0 ? `${menuId}-option-${activeIndex}` : undefined;

  return (
    <div className="place-search relative mb-4 w-full">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls={isOpen ? menuId : undefined}
          aria-activedescendant={activeOptionId}
          aria-label={placeholder}
          className="pr-10"
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
        />
        {loading && (
          <span className="place-search__spinner absolute right-[0.65rem]" aria-hidden="true" />
        )}
        {inputValue && !loading && (
          <button
            className="absolute right-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-0 bg-bg p-0 text-xs leading-none text-text-muted hover:bg-border hover:text-text"
            type="button"
            aria-label="Clear search"
            onClick={clearInput}
          >
            ✕
          </button>
        )}
      </div>

      {requiresSignIn && inputValue.trim().length > 0 && !loading && (
        <p className="mt-1 text-sm text-text-muted">
          Sign in to search places and neighborhoods.
        </p>
      )}

      {isOpen && (
        <ul
          ref={listRef}
          id={menuId}
          role="listbox"
          className="absolute top-[calc(100%+4px)] right-0 left-0 z-40 m-0 max-h-72 list-none overflow-y-auto rounded-lg border border-border-strong bg-surface p-1 shadow-md"
          aria-label="Place suggestions"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.type === "restaurant" ? `r-${s.restaurant_id}` : `p-${s.place_id}`}
              id={`${menuId}-option-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              className={cn(
                "flex cursor-pointer items-start gap-2 px-3 py-2 transition-[background] duration-fast",
                i === activeIndex && "bg-brand-soft",
              )}
              onMouseDown={(e) => {
                e.preventDefault();
              }}
              onClick={() => selectSuggestion(i)}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <span className="shrink-0 text-base leading-snug" aria-hidden="true">
                {s.type === "restaurant" ? "🍽️" : "📍"}
              </span>
              <span className="grid min-w-0 gap-0.5">
                <span className="truncate text-sm font-semibold">{s.primary_text}</span>
                {s.secondary_text && (
                  <span className="truncate text-sm text-text-muted">
                    {s.secondary_text}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
