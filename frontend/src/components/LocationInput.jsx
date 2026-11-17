import { useEffect, useRef } from "react";
import { importLibrary } from "@googlemaps/js-api-loader";
import { loadMaps } from "../maps";

export default function LocationInput({ value, onChange, placeholder }) {
  const inputRef = useRef(null);

  useEffect(() => {
    let listener;
    let autocomplete;

    const setup = async () => {
      const loaded = await loadMaps();
      if (!loaded || !inputRef.current) {
        return;
      }

      const { Autocomplete } = await importLibrary("places");
      autocomplete = new Autocomplete(inputRef.current, {
        componentRestrictions: { country: "in" },
        fields: ["formatted_address", "name"],
        bounds: {
          south: 18.4,
          west: 73.7,
          north: 18.72,
          east: 74.05,
        },
      });

      listener = autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        const next = place.formatted_address || place.name;
        if (next) {
          onChange(next);
        }
      });
    };

    setup();

    return () => {
      if (listener) {
        listener.remove();
      }
    };
  }, [onChange]);

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete="off"
    />
  );
}
