"use client";

import React, { useEffect, useState, useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./Select";
import {
  BRAZILIAN_STATES,
  COUNTRIES,
  fetchCitiesByState,
  getCountryFlag,
  type BrazilianState,
  type City,
  type Country,
} from "@/data/locations";
import { Globe, MapPin, Building2, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export interface LocationValue {
  countryCode: string;
  stateUf?: string;
  cityName?: string;
}

export interface LocationSelectorProps {
  value?: LocationValue;
  onChange?: (val: LocationValue) => void;
  className?: string;
  showLabels?: boolean;
  disabled?: boolean;
}

export function LocationSelector({
  value,
  onChange,
  className,
  showLabels = true,
  disabled = false,
}: LocationSelectorProps) {
  const [country, setCountry] = useState<string>(value?.countryCode ?? "BR");
  const [stateUf, setStateUf] = useState<string>(value?.stateUf ?? "");
  const [cityName, setCityName] = useState<string>(value?.cityName ?? "");
  const [cities, setCities] = useState<City[]>([]);
  const [isLoadingCities, setIsLoadingCities] = useState<boolean>(false);
  const [, startTransition] = useTransition();

  // Atualiza estado interno quando o valor externo mudar
  useEffect(() => {
    if (value?.countryCode !== undefined) setCountry(value.countryCode);
    if (value?.stateUf !== undefined) setStateUf(value.stateUf);
    if (value?.cityName !== undefined) setCityName(value.cityName);
  }, [value?.countryCode, value?.stateUf, value?.cityName]);

  // Carrega cidades dinamicamente quando o estado (UF) é selecionado
  useEffect(() => {
    if (country === "BR" && stateUf) {
      let isMounted = true;
      setIsLoadingCities(true);
      fetchCitiesByState(stateUf)
        .then((data) => {
          if (isMounted) {
            setCities(data);
            setIsLoadingCities(false);
          }
        })
        .catch(() => {
          if (isMounted) {
            setCities([]);
            setIsLoadingCities(false);
          }
        });
      return () => {
        isMounted = false;
      };
    } else {
      setCities([]);
      setIsLoadingCities(false);
    }
  }, [country, stateUf]);

  const handleCountryChange = (newCountry: string) => {
    setCountry(newCountry);
    const resetState = newCountry === "BR" ? stateUf : "";
    const resetCity = newCountry === "BR" ? cityName : "";
    if (newCountry !== "BR") {
      setStateUf("");
      setCityName("");
    }
    onChange?.({
      countryCode: newCountry,
      stateUf: resetState,
      cityName: resetCity,
    });
  };

  const handleStateChange = (newUf: string) => {
    startTransition(() => {
      setStateUf(newUf);
      setCityName(""); // Reseta a cidade ao trocar de estado
      onChange?.({
        countryCode: country,
        stateUf: newUf,
        cityName: "",
      });
    });
  };

  const handleCityChange = (newCity: string) => {
    setCityName(newCity);
    onChange?.({
      countryCode: country,
      stateUf,
      cityName: newCity,
    });
  };

  return (
    <div className={cn("grid gap-3.5 sm:grid-cols-3", className)}>
      {/* 1. SELEÇÃO DE PAÍS */}
      <div className="flex flex-col gap-1.5">
        {showLabels && (
          <label className="flex items-center gap-1.5 text-xs font-semibold text-neutral-600">
            <Globe className="h-3.5 w-3.5 text-roxo" />
            País
          </label>
        )}
        <Select
          value={country}
          onValueChange={handleCountryChange}
          disabled={disabled}
        >
          <SelectTrigger className="bg-white/80 hover:bg-white focus:bg-white">
            <SelectValue placeholder="Selecione o país" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Destaque</SelectLabel>
              {COUNTRIES.filter((c) => c.sigla === "BR").map((c) => (
                <SelectItem key={c.sigla} value={c.sigla}>
                  <span className="mr-2 text-base">{getCountryFlag(c.sigla)}</span>
                  <span className="font-semibold">{c.nome_pais}</span>
                </SelectItem>
              ))}

              <SelectLabel>América Latina & Vizinhos</SelectLabel>
              {COUNTRIES.filter((c) =>
                ["AR", "CL", "UY", "PY", "CO", "PE", "BO", "EC", "VE"].includes(c.sigla)
              ).map((c) => (
                <SelectItem key={c.sigla} value={c.sigla}>
                  <span className="mr-2 text-base">{getCountryFlag(c.sigla)}</span>
                  {c.nome_pais}
                </SelectItem>
              ))}

              <SelectLabel>Todos os Países ({COUNTRIES.length})</SelectLabel>
              {COUNTRIES.filter(
                (c) =>
                  !["BR", "AR", "CL", "UY", "PY", "CO", "PE", "BO", "EC", "VE"].includes(c.sigla)
              ).map((c) => (
                <SelectItem key={c.sigla} value={c.sigla}>
                  <span className="mr-2 text-base">{getCountryFlag(c.sigla)}</span>
                  {c.nome_pais}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {/* 2. SELEÇÃO DE ESTADO (Ativo quando País é Brasil) */}
      <div className="flex flex-col gap-1.5">
        {showLabels && (
          <label className="flex items-center gap-1.5 text-xs font-semibold text-neutral-600">
            <MapPin className="h-3.5 w-3.5 text-roxo" />
            Estado (UF)
          </label>
        )}
        <Select
          value={stateUf}
          onValueChange={handleStateChange}
          disabled={disabled || country !== "BR"}
        >
          <SelectTrigger className="bg-white/80 hover:bg-white focus:bg-white">
            <SelectValue
              placeholder={
                country === "BR" ? "Selecione o estado" : "Apenas para Brasil"
              }
            />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Sudeste</SelectLabel>
              {BRAZILIAN_STATES.filter((s) => s.region === "Sudeste").map((s) => (
                <SelectItem key={s.uf} value={s.uf}>
                  <span className="font-semibold text-roxo mr-1.5">{s.uf}</span> – {s.name}
                </SelectItem>
              ))}

              <SelectLabel>Sul</SelectLabel>
              {BRAZILIAN_STATES.filter((s) => s.region === "Sul").map((s) => (
                <SelectItem key={s.uf} value={s.uf}>
                  <span className="font-semibold text-roxo mr-1.5">{s.uf}</span> – {s.name}
                </SelectItem>
              ))}

              <SelectLabel>Nordeste</SelectLabel>
              {BRAZILIAN_STATES.filter((s) => s.region === "Nordeste").map((s) => (
                <SelectItem key={s.uf} value={s.uf}>
                  <span className="font-semibold text-roxo mr-1.5">{s.uf}</span> – {s.name}
                </SelectItem>
              ))}

              <SelectLabel>Centro-Oeste</SelectLabel>
              {BRAZILIAN_STATES.filter((s) => s.region === "Centro-Oeste").map((s) => (
                <SelectItem key={s.uf} value={s.uf}>
                  <span className="font-semibold text-roxo mr-1.5">{s.uf}</span> – {s.name}
                </SelectItem>
              ))}

              <SelectLabel>Norte</SelectLabel>
              {BRAZILIAN_STATES.filter((s) => s.region === "Norte").map((s) => (
                <SelectItem key={s.uf} value={s.uf}>
                  <span className="font-semibold text-roxo mr-1.5">{s.uf}</span> – {s.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {/* 3. SELEÇÃO DE CIDADE (Carregada dinamicamente via JSON/IBGE ao escolher estado) */}
      <div className="flex flex-col gap-1.5">
        {showLabels && (
          <label className="flex items-center justify-between text-xs font-semibold text-neutral-600">
            <span className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-roxo" />
              Município / Cidade
            </span>
            {isLoadingCities && (
              <span className="flex items-center gap-1 text-[10px] text-roxo-500 font-normal">
                <Loader2 className="h-3 w-3 animate-spin" /> Carregando...
              </span>
            )}
          </label>
        )}
        <Select
          value={cityName}
          onValueChange={handleCityChange}
          disabled={disabled || !stateUf || isLoadingCities}
        >
          <SelectTrigger className="bg-white/80 hover:bg-white focus:bg-white">
            <SelectValue
              placeholder={
                !stateUf
                  ? "Escolha o estado antes"
                  : isLoadingCities
                  ? "Carregando municípios..."
                  : "Selecione o município"
              }
            />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>
                {stateUf ? `Cidades de ${stateUf} (${cities.length})` : "Cidades"}
              </SelectLabel>
              {cities.map((c) => (
                <SelectItem key={String(c.id)} value={c.name}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// Standalone Country Select
export function CountrySelect({
  value,
  onChange,
  className,
  disabled,
}: {
  value?: string;
  onChange?: (code: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Selecione o país" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Destaque</SelectLabel>
          {COUNTRIES.filter((c) => c.sigla === "BR").map((c) => (
            <SelectItem key={c.sigla} value={c.sigla}>
              <span className="mr-2 text-base">{getCountryFlag(c.sigla)}</span>
              <span className="font-semibold">{c.nome_pais}</span>
            </SelectItem>
          ))}
          <SelectLabel>Todos os Países ({COUNTRIES.length})</SelectLabel>
          {COUNTRIES.filter((c) => c.sigla !== "BR").map((c) => (
            <SelectItem key={c.sigla} value={c.sigla}>
              <span className="mr-2 text-base">{getCountryFlag(c.sigla)}</span> {c.nome_pais}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

// Standalone State Select
export function StateSelect({
  value,
  onChange,
  className,
  disabled,
}: {
  value?: string;
  onChange?: (uf: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Selecione o estado" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {BRAZILIAN_STATES.map((s) => (
            <SelectItem key={s.uf} value={s.uf}>
              <span className="font-semibold text-roxo mr-1.5">{s.uf}</span> – {s.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

// Standalone City Select
export function CitySelect({
  stateUf,
  value,
  onChange,
  className,
  disabled,
}: {
  stateUf: string;
  value?: string;
  onChange?: (city: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!stateUf) {
      setCities([]);
      return;
    }
    let active = true;
    setLoading(true);
    fetchCitiesByState(stateUf)
      .then((data) => {
        if (active) {
          setCities(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setCities([]);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [stateUf]);

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled || !stateUf || loading}>
      <SelectTrigger className={className}>
        <SelectValue
          placeholder={
            !stateUf
              ? "Escolha o estado"
              : loading
              ? "Carregando..."
              : "Selecione o município"
          }
        />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>{stateUf ? `Cidades de ${stateUf} (${cities.length})` : "Cidades"}</SelectLabel>
          {cities.map((c) => (
            <SelectItem key={String(c.id)} value={c.name}>
              {c.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
