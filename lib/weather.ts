const geocodeCache = new Map<string, { lat: number; lon: number } | null>();
const forecastCache = new Map<string, PrevisaoDia | null>();

export type PrevisaoHora = { hora: number; temp: number; codigo: number };
export type PrevisaoDia = { tempMin: number; tempMax: number; horas: PrevisaoHora[] };

export async function geocodeCidade(cidade: string): Promise<{ lat: number; lon: number } | null> {
  const chave = cidade.trim().toLowerCase();
  if (geocodeCache.has(chave)) return geocodeCache.get(chave) || null;
  try {
    const resp = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cidade)}&count=1&language=pt&country=PT`);
    const json = await resp.json();
    const r = json.results?.[0];
    const resultado = r ? { lat: r.latitude, lon: r.longitude } : null;
    geocodeCache.set(chave, resultado);
    return resultado;
  } catch {
    geocodeCache.set(chave, null);
    return null;
  }
}

export async function previsaoParaCidade(cidade: string, dataISO: string): Promise<PrevisaoDia | null> {
  const chave = `${cidade.trim().toLowerCase()}|${dataISO}`;
  if (forecastCache.has(chave)) return forecastCache.get(chave) || null;

  const coords = await geocodeCidade(cidade);
  if (!coords) { forecastCache.set(chave, null); return null; }

  try {
    const resp = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&hourly=temperature_2m,weathercode&daily=temperature_2m_min,temperature_2m_max&timezone=Europe%2FLisbon&start_date=${dataISO}&end_date=${dataISO}`
    );
    const json = await resp.json();
    if (!json.daily || !json.hourly) { forecastCache.set(chave, null); return null; }
    const horas: PrevisaoHora[] = (json.hourly.time || []).map((t: string, i: number) => ({
      hora: Number(t.slice(11, 13)),
      temp: json.hourly.temperature_2m[i],
      codigo: json.hourly.weathercode[i],
    }));
    const resultado: PrevisaoDia = {
      tempMin: json.daily.temperature_2m_min[0],
      tempMax: json.daily.temperature_2m_max[0],
      horas,
    };
    forecastCache.set(chave, resultado);
    return resultado;
  } catch {
    forecastCache.set(chave, null);
    return null;
  }
}

// Códigos WMO simplificados (https://open-meteo.com/en/docs)
export function iconeTempo(codigo: number): string {
  if (codigo === 0) return '☀️';
  if ([1, 2].includes(codigo)) return '🌤️';
  if (codigo === 3) return '☁️';
  if ([45, 48].includes(codigo)) return '🌫️';
  if ([51, 53, 55, 56, 57].includes(codigo)) return '🌦️';
  if ([61, 63, 65, 80, 81, 82].includes(codigo)) return '🌧️';
  if ([66, 67].includes(codigo)) return '🌧️';
  if ([71, 73, 75, 77, 85, 86].includes(codigo)) return '❄️';
  if ([95, 96, 99].includes(codigo)) return '⛈️';
  return '🌡️';
}

export function horaMaisProxima(previsao: PrevisaoDia, horaAlvo: number | null): PrevisaoHora | null {
  if (previsao.horas.length === 0) return null;
  if (horaAlvo === null) return previsao.horas[Math.min(12, previsao.horas.length - 1)];
  return previsao.horas.reduce((melhor, h) => (Math.abs(h.hora - horaAlvo) < Math.abs(melhor.hora - horaAlvo) ? h : melhor), previsao.horas[0]);
}
