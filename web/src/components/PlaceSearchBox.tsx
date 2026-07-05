import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { usePlacesAutocomplete } from "../hooks/usePlacesAutocomplete";
import { useFixedOverlayPosition } from "../hooks/useFixedOverlayPosition";
import { cn } from "../lib/cn";
import { Z } from "../lib/overlayStack";
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
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const menuId = useId();

  const { suggestions, loading, requiresSignIn, search, resetSessionToken, sessionToken } =
    usePlacesAutocomplete({ lat, lng });

  const isOpen = suggestions.length > 0 && inputValue.trim().length > 0;
  const panelStyle = useFixedOverlayPosition(isOpen, anchorRef, {
    matchAnchorWidth: true,
    gap: 4,
  });

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

  const suggestionsList = isOpen
    ? createPortal(
        <ul
          ref={listRef}
          id={menuId}
          role="listbox"
          className="fixed m-0 max-h-72 list-none overflow-y-auto overscroll-contain rounded-lg border border-border-strong bg-surface p-1 shadow-md"
          style={{ ...panelStyle, zIndex: Z.dropdown }}
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
        </ul>,
        document.body,
      )
    : null;

  return (
    <div className="place-search mb-4 w-full">
      <div ref={anchorRef} className="relative flex items-center">
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls={isOpen ? menuId : undefined}
          aria-activedescendant={activeOptionId}
          aria-label={placeholder}
          className="pr-11"
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
            className="group absolute right-0 flex h-11 w-11 cursor-pointer items-center justify-center border-0 bg-transparent p-0"
            type="button"
            aria-label="Clear search"
            onClick={clearInput}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-bg text-xs leading-none text-text-muted group-hover:bg-border group-hover:text-text">
              ✕
            </span>
          </button>
        )}
      </div>

      {requiresSignIn && inputValue.trim().length > 0 && !loading && (
        <p className="mt-1 text-sm text-text-muted">
          Sign in to search places and neighborhoods.
        </p>
      )}

      {suggestionsList}
    </div>
  );
}
