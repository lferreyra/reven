import { useState, useEffect } from 'react';
import { ARG_BRANDS, EXPANDED_MODELS } from '../data/static-db';

const BASE_URL = 'https://argautos.com/api/v1';

export type Brand = { id: number; name: string; slug: string };
export type AutoModel = { id: number; name: string; slug: string; brand_id: number };
export type Version = { id: number; name: string; slug: string; model_id: number };
export type Valuation = { id: number; year: number; price: string; currency: string; acara_price?: string | null };

const STATIC_BRANDS: Brand[] = ARG_BRANDS.map((name, i) => ({
  id: i + 5000,
  name,
  slug: name.toLowerCase().replace(/\s+/g, '-')
}));

export function useArgAutos(selectedBrandName?: string, selectedModelName?: string, selectedVersionName?: string) {
  const [brands, setBrands] = useState<Brand[]>(STATIC_BRANDS);
  const [models, setModels] = useState<AutoModel[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [valuations, setValuations] = useState<Valuation[]>([]);

  const [loadingBrands, setLoadingBrands] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [loadingValuations, setLoadingValuations] = useState(false);

  // 1. Fetch Brands (Fallback to Static)
  useEffect(() => {
    const fetchBrands = async () => {
      setLoadingBrands(true);
      try {
        const res = await fetch(`${BASE_URL}/brands?per_page=100`);
        const d = await res.json();
        if (d.data && d.data.length > 0) {
          // Normalize to UPPERCASE to match static brand names stored in filters
          const normalized = d.data
            .map((b: Brand) => ({ ...b, name: b.name.toUpperCase() }))
            .sort((a: Brand, b: Brand) => a.name.localeCompare(b.name));
          setBrands(normalized);
        } else {
          setBrands(STATIC_BRANDS);
        }
      } catch {
        setBrands(STATIC_BRANDS);
      } finally {
        setLoadingBrands(false);
      }
    };
    fetchBrands();
  }, []);

  // Resolve IDs from current brands/models arrays
  const selectedBrand = brands.find(b => b.name === selectedBrandName);
  const selectedBrandId = selectedBrand?.id;
  const selectedModelId = models.find(m => m.name === selectedModelName)?.id;
  const selectedVersionId = versions.find(v => v.name === selectedVersionName)?.id;

  // 2. Fetch Models
  useEffect(() => {
    if (!selectedBrandName) {
      setModels([]);
      return;
    }

    const fetchModels = async () => {
      setLoadingModels(true);

      if (selectedBrandId && selectedBrandId < 5000) {
        try {
          const res = await fetch(`${BASE_URL}/brands/${selectedBrandId}/models?per_page=100`);
          const d = await res.json();
          if (d.data && d.data.length > 0) {
            setModels(d.data
              .map((m: AutoModel) => ({ ...m, name: m.name.toUpperCase() }))
              .sort((a: AutoModel, b: AutoModel) => a.name.localeCompare(b.name)));
            setLoadingModels(false);
            return;
          }
        } catch {
          console.warn('API error fetching models, using static fallback');
        }
      }

      // Fallback to static DB
      const staticModels = EXPANDED_MODELS[selectedBrandName.toUpperCase()] || [];
      setModels(staticModels.map((name, i) => ({
        id: i + 10000,
        name,
        slug: name.toLowerCase(),
        brand_id: selectedBrandId || 0,
      })));
      setLoadingModels(false);
    };

    fetchModels();
  }, [selectedBrandId, selectedBrandName]);

  // 3. Fetch Versions
  // Strategy:
  //   a) If we have a real API model ID (< 10000) → fetch directly.
  //   b) If model ID is static (>= 10000) but brand has a real API ID → do a name-based
  //      lookup: re-fetch brand's models from API, find the matching model, then fetch versions.
  //   c) If brand is also static → no versions available from API.
  useEffect(() => {
    if (!selectedModelName) {
      setVersions([]);
      return;
    }

    let cancelled = false;

    const fetchVersions = async () => {
      setLoadingVersions(true);

      try {
        let modelApiId: number | null = null;

        // Fast path: already have a real model ID
        if (selectedModelId && selectedModelId < 10000) {
          modelApiId = selectedModelId;
        } else if (selectedBrandId && selectedBrandId < 5000) {
          // Slow path: look up real model ID by name in the API
          const res = await fetch(`${BASE_URL}/brands/${selectedBrandId}/models?per_page=100`);
          const d = await res.json();
          const match = d.data?.find((m: AutoModel) =>
            m.name.toLowerCase() === selectedModelName.toLowerCase()
          );
          if (match) modelApiId = match.id;
        }

        if (modelApiId) {
          const res = await fetch(`${BASE_URL}/models/${modelApiId}/versions?per_page=100`);
          const d = await res.json();
          if (!cancelled && d.data) {
            setVersions(d.data
              .map((v: any) => ({ ...v, name: v.name_raw || v.name.toUpperCase() }))
              .sort((a: Version, b: Version) => a.name.localeCompare(b.name)));
            return;
          }
        }
      } catch {
        // silent — will fall through to setVersions([])
      }

      if (!cancelled) setVersions([]);
    };

    fetchVersions().finally(() => {
      if (!cancelled) setLoadingVersions(false);
    });

    return () => { cancelled = true; };
  }, [selectedModelId, selectedModelName, selectedBrandId]);

  // 4. Fetch Valuations (ACARA)
  useEffect(() => {
    if (!selectedVersionId || selectedVersionId >= 10000) {
      setValuations([]);
      return;
    }
    setLoadingValuations(true);
    fetch(`${BASE_URL}/versions/${selectedVersionId}/valuations?currency=ars&sources=acara`)
      .then(r => r.json())
      .then(d => { if (d.data) setValuations(d.data); })
      .catch(() => setValuations([]))
      .finally(() => setLoadingValuations(false));
  }, [selectedVersionId]);

  return {
    brands, models, versions, valuations,
    loadingBrands, loadingModels, loadingVersions, loadingValuations,
  };
}
