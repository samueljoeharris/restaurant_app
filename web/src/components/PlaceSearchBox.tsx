import { useEffect, useId, useRef, useState } from "react";

import { api } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { usePlacesAutocomplete } from "../hooks/usePlacesAutocomplete";
import type { PlaceResolveResponse } from "../types";

interface PlaceSearchBoxProps {
  onSelectPlace: (resolved: PlaceResolveResponse) => void;
  onSelectRestaurant: (id: string) => void;
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
  const { idToken } = useAuth();
  const [inputValue, setInputValue] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
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
    setResolveError(null);
    search(val);
  }

  function clearInput() {
    setInputValue("");
    setActiveIndex(-1);
    setResolveError(null);
    search("");
    inputRef.current?.focus();
  }

  async function selectSuggestion(index: number) {
    const s = suggestions[index];
    if (!s) return;

    if (s.type === "restaurant" && s.restaurant_id) {
      setInputValue(s.primary_text);
      search(""); // collapse dropdown
      onSelectRestaurant(s.restaurant_id);
      return;
    }

    if (s.type === "place" && s.place_id) {
      if (!idToken) return; // shouldn't happen: autocomplete is sign-in gated
      setInputValue(s.primary_text);
      search(""); // collapse dropdown
      setResolving(true);
      setResolveError(null);
      try {
        const resolved = await api.resolvePlace(s.place_id, sessionToken.current, idToken);
        resetSessionToken();
        onSelectPlace(resolved);
      } catch (err) {
        setResolveError(err instanceof Error ? err.message : "Could not resolve place");
        setInputValue(""); // let user retry
      } finally {
        setResolving(false);
      }
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
        void selectSuggestion(activeIndex);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setActiveIndex(-1);
      search(""); // clear suggestions
    }
  }

  // Scroll active item into view
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
          disabled={resolving}
        />
        {(loading || resolving) && (
          <span className="place-search__spinner" aria-hidden="true" />
        )}
        {inputValue && !loading && !resolving && (
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

      {resolveError && (
        <p className="place-search__error error">{resolveError}</p>
      )}

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
                // mousedown fires before blur; prevent it from closing the list
                e.preventDefault();
              }}
              onClick={() => void selectSuggestion(i)}
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
