// ─── SEO Helpers ─────────────────────────────────────────────────────────────

/**
 * Genera un slug SEO-friendly para URLs de vehículos.
 * Formato: marca-modelo-version-año-id
 * Ej: "alfa-romeo-mito-14-tbi-2015-abc123"
 */
export function generateVehicleSlug(
  brand: string,
  model: string,
  version: string,
  year: number | string,
  id: string,
): string {
  const parts = [brand, model, version, String(year)]
    .map(part =>
      part
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // remove accents
        .replace(/[^a-z0-9]+/g, '-')     // replace non-alphanumeric with dash
        .replace(/-+/g, '-')             // collapse multiple dashes
        .replace(/^-|-$/g, '')           // trim dashes
    )
    .filter(Boolean);

  // Append short ID (last 8 chars) for uniqueness
  const shortId = id.slice(-8).toLowerCase();
  parts.push(shortId);

  return parts.join('-');
}

/**
 * Extrae el ID del vehículo del slug SEO.
 * El ID es siempre los últimos 8 caracteres del slug.
 */
export function extractIdFromSlug(slug: string): string {
  // The ID is the last segment after the final dash
  const parts = slug.split('-');
  return parts[parts.length - 1];
}

/**
 * Genera el path completo para la URL de un vehículo.
 */
export function getVehiclePath(
  brand: string,
  model: string,
  version: string,
  year: number | string,
  id: string,
): string {
  return `/vehicle/${generateVehicleSlug(brand, model, version, year, id)}`;
}
