import { useEffect, useId, useRef, useState } from "react";

import { usePlacesAutocomplete } from "../hooks/usePlacesAutocomplete";
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
    <div className="place-search">
      <div className="place-search__input-wrap">
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls={isOpen ? menuId : undefined}
          aria-activedescendant={activeOptionId}
          aria-label={placeholder}
          className="search place-search__input"
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
        />
        {loading && (
          <span className="place-search__spinner" aria-hidden="true" />
        )}
        {inputValue && !loading && (
          <button
            className="place-search__clear"
            type="button"
            aria-label="Clear search"
            onClick={clearInput}
          >
            ✕
          </button>
        )}
      </div>

      {requiresSignIn && inputValue.trim().length > 0 && !loading && (
        <p className="place-search__sign-in-hint muted small">
          Sign in to search places and neighborhoods.
        </p>
      )}

      {isOpen && (
        <ul
          ref={listRef}
          id={menuId}
          role="listbox"
          className="place-search__menu"
          aria-label="Place suggestions"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.type === "restaurant" ? `r-${s.restaurant_id}` : `p-${s.place_id}`}
              id={`${menuId}-option-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              className={`place-search__option${i === activeIndex ? " place-search__option--active" : ""} place-search__option--${s.type}`}
              onMouseDown={(e) => {
                e.preventDefault();
              }}
              onClick={() => selectSuggestion(i)}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <span className="place-search__option-icon" aria-hidden="true">
                {s.type === "restaurant" ? "🍽️" : "📍"}
              </span>
              <span className="place-search__option-body">
                <span className="place-search__option-primary">{s.primary_text}</span>
                {s.secondary_text && (
                  <span className="place-search__option-secondary muted small">
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
