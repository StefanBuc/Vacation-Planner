import { useState } from 'react'
import type { FormEvent } from 'react'

type FlightOption = {
  airline: string
  flight_number: string
  origin: string
  destination: string
  departure_time: string
  arrival_time: string
  duration_minutes: number
  price: number
  type: string
}

type HotelOption = {
  name: string
  latitude: number | null
  longitude: number | null
  rating: number
  price_per_night: number
  checkin_date: string
  checkout_date: string
}

type WeatherResult = {
  date_used: string
  max_temp_c: number | null
  min_temp_c: number | null
  precipitation_mm: number | null
}

type ActivityOption = {
  name: string | null
  description: string | null
  longitude: number | null
  latitude: number | null
  price: number
  duration_minutes: number
  type: string | null
}

type ActivityFilter = {
  id: 'sightseeing' | 'museums' | 'hikes' | 'parks' | 'food'
  label: string
  description: string
  categories: string[]
}

type StopForm = {
  id: string
  city: string
  airport: string
  days: number
  activityFilters: ActivityFilter['id'][]
}

type CityResult = {
  city: string
  airport: string | null
  days: number
  order: number
  checkin_date: string
  checkout_date: string
  hotels: HotelOption[]
  activities: ActivityOption[]
  weather: WeatherResult | null
}

type SearchResults = {
  origin_airport?: string
  start_date?: string
  end_date?: string
  currency?: string
  cities: CityResult[]
  activities: ActivityOption[]
  flights: FlightOption[]
  hotels: HotelOption[]
  weather: WeatherResult | null
}

type TripPlanResponse = {
  trip_data: SearchResults
  ai_plan: string
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '')
const AIRPORT_CODE_PATTERN = /^[A-Za-z]{3}$/
const ACTIVITY_FILTERS: ActivityFilter[] = [
  {
    id: 'sightseeing',
    label: 'Sightseeing',
    description: 'Landmarks and popular sights',
    categories: ['tourism.sights'],
  },
  {
    id: 'museums',
    label: 'Museums',
    description: 'Museums and exhibits',
    categories: ['entertainment.museum'],
  },
  {
    id: 'hikes',
    label: 'Hikes',
    description: 'Nature spots and trails',
    categories: ['natural'],
  },
  {
    id: 'parks',
    label: 'Parks',
    description: 'Urban parks and green space',
    categories: ['leisure.park'],
  },
  {
    id: 'food',
    label: 'Food',
    description: 'Restaurants and cafe areas',
    categories: ['catering.restaurant'],
  },
]

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function createStop(index: number): StopForm {
  return {
    id: `stop-${Date.now()}-${index}`,
    city: index === 1 ? 'Paris' : '',
    airport: '',
    days: index === 1 ? 3 : 2,
    activityFilters: ['sightseeing', 'museums'],
  }
}

function formatFlightDuration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

function formatTimestamp(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatWeatherNumber(value: number | null, suffix: string) {
  return value === null ? 'N/A' : `${value}${suffix}`
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong while loading this section.'
}

function isAirportCode(value: string) {
  return AIRPORT_CODE_PATTERN.test(value.trim())
}

async function postJson<T>(path: string, body: unknown) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      typeof data?.detail === 'string'
        ? data.detail
        : `Request failed with status ${response.status}`
    throw new Error(message)
  }

  return data as T
}

function buildActivityCategories(selectedFilters: ActivityFilter['id'][]) {
  const categories = new Set<string>()

  for (const filterId of selectedFilters) {
    const filter = ACTIVITY_FILTERS.find((option) => option.id === filterId)
    if (!filter) {
      continue
    }

    for (const category of filter.categories) {
      categories.add(category)
    }
  }

  return [...categories]
}

function App() {
  const today = new Date()
  const [form, setForm] = useState(() => ({
    origin: 'YYZ',
    startDate: formatDateInput(addDays(today, 7)),
    currency: 'CAD',
    returnToOrigin: true,
    stops: [createStop(1)],
  }))
  const [results, setResults] = useState<SearchResults | null>(null)
  const [aiPlan, setAiPlan] = useState('')
  const [formError, setFormError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const totalDays = form.stops.reduce((sum, stop) => sum + Number(stop.days || 0), 0)
  const resultCities = results?.cities ?? []

  function updateStop(stopId: string, updates: Partial<StopForm>) {
    setForm((current) => ({
      ...current,
      stops: current.stops.map((stop) =>
        stop.id === stopId ? { ...stop, ...updates } : stop,
      ),
    }))
  }

  function addStop() {
    setForm((current) => ({
      ...current,
      stops: [...current.stops, createStop(current.stops.length + 1)],
    }))
  }

  function removeStop(stopId: string) {
    setForm((current) => ({
      ...current,
      stops: current.stops.length === 1
        ? current.stops
        : current.stops.filter((stop) => stop.id !== stopId),
    }))
  }

  function toggleActivityFilter(stopId: string, filterId: ActivityFilter['id']) {
    setForm((current) => ({
      ...current,
      stops: current.stops.map((stop) => {
        if (stop.id !== stopId) {
          return stop
        }

        const activityFilters = stop.activityFilters.includes(filterId)
          ? stop.activityFilters.filter((value) => value !== filterId)
          : [...stop.activityFilters, filterId]

        return { ...stop, activityFilters }
      }),
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!isAirportCode(form.origin)) {
      setFormError('Origin must be a 3-letter airport code like YYZ.')
      return
    }

    for (const [index, stop] of form.stops.entries()) {
      if (!stop.city.trim()) {
        setFormError(`City ${index + 1} needs a city name.`)
        return
      }

      if (stop.airport.trim() && !isAirportCode(stop.airport)) {
        setFormError(`City ${index + 1} airport must be a 3-letter code like CDG, or left blank.`)
        return
      }

      if (!Number.isInteger(Number(stop.days)) || Number(stop.days) < 1) {
        setFormError(`City ${index + 1} needs at least 1 day.`)
        return
      }
    }

    setFormError('')
    setIsLoading(true)

    const requestBody = {
      origin_airport: form.origin.trim().toUpperCase(),
      outbound_date: form.startDate,
      currency: form.currency.trim().toUpperCase(),
      return_to_origin: form.returnToOrigin,
      include_activities: form.stops.some((stop) => stop.activityFilters.length > 0),
      include_weather: true,
      stops: form.stops.map((stop) => ({
        city: stop.city.trim(),
        airport: stop.airport.trim() ? stop.airport.trim().toUpperCase() : null,
        days: Number(stop.days),
        activity_categories: buildActivityCategories(stop.activityFilters),
      })),
    }

    try {
      const tripPlan = await postJson<TripPlanResponse>('/plan-trip/', requestBody)

      setResults({
        origin_airport: tripPlan.trip_data?.origin_airport,
        start_date: tripPlan.trip_data?.start_date,
        end_date: tripPlan.trip_data?.end_date,
        currency: tripPlan.trip_data?.currency,
        cities: tripPlan.trip_data?.cities ?? [],
        activities: tripPlan.trip_data?.activities ?? [],
        flights: tripPlan.trip_data?.flights ?? [],
        hotels: tripPlan.trip_data?.hotels ?? [],
        weather: tripPlan.trip_data?.weather ?? null,
      })
      setAiPlan(tripPlan.ai_plan ?? '')
    } catch (error) {
      setAiPlan('')
      setResults(null)
      setFormError(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#17251f_0%,#101815_46%,#0c1210_100%)] px-4 py-8 text-stone-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="border border-white/10 bg-white/6 shadow-xl shadow-black/20 backdrop-blur">
          <div className="grid min-w-0 gap-6 p-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:p-6">
            <div className="min-w-0 space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200">
                  Vacation Planner Test UI
                </p>
                <h1 className="mt-3 max-w-xl text-3xl font-semibold text-white sm:text-4xl">
                  Build a multi-city trip plan.
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-300">
                  Add each city you want to visit, choose what you want to do there, and set how
                  many days you want to stay. Airport codes are optional for city stops.
                </p>
              </div>

              <div className="grid gap-3 text-sm text-stone-300 sm:grid-cols-2">
                <div className="border border-white/10 bg-black/20 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-stone-500">API</p>
                  <p className="mt-1 break-all text-stone-100">{API_BASE_URL}</p>
                </div>
                <div className="border border-white/10 bg-black/20 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Trip Length</p>
                  <p className="mt-1 text-stone-100">{totalDays} planned days</p>
                </div>
                <div className="border border-white/10 bg-black/20 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Route</p>
                  <p className="mt-1 text-stone-100">POST /plan-trip/</p>
                </div>
                <div className="border border-white/10 bg-black/20 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Stops</p>
                  <p className="mt-1 text-stone-100">{form.stops.length} cities</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="grid min-w-0 gap-4 border border-white/10 bg-black/25 p-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="grid gap-2 text-sm text-stone-200">
                  Origin airport
                  <input
                    type="text"
                    value={form.origin}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, origin: event.target.value }))
                    }
                    placeholder="YYZ"
                    className="border border-white/10 bg-white/5 px-3 py-2 text-base uppercase text-white outline-none transition focus:border-emerald-300"
                  />
                </label>

                <label className="grid gap-2 text-sm text-stone-200">
                  Start date
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, startDate: event.target.value }))
                    }
                    className="border border-white/10 bg-white/5 px-3 py-2 text-base text-white outline-none transition focus:border-emerald-300"
                  />
                </label>

                <label className="grid gap-2 text-sm text-stone-200">
                  Currency
                  <input
                    type="text"
                    value={form.currency}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))
                    }
                    placeholder="CAD"
                    className="border border-white/10 bg-white/5 px-3 py-2 text-base uppercase text-white outline-none transition focus:border-emerald-300"
                  />
                </label>
              </div>

              <label className="flex items-center gap-3 border border-white/10 bg-white/5 px-3 py-2 text-sm text-stone-200">
                <input
                  type="checkbox"
                  checked={form.returnToOrigin}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, returnToOrigin: event.target.checked }))
                  }
                  className="h-4 w-4 accent-emerald-300"
                />
                Return to origin after the final city when the final stop has an airport
              </label>

              <div className="grid gap-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-white">City Stops</h2>
                  <button
                    type="button"
                    onClick={addStop}
                    className="border border-emerald-300/50 bg-emerald-300/10 px-3 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-300/20"
                  >
                    Add city
                  </button>
                </div>

                {form.stops.map((stop, index) => (
                  <section key={stop.id} className="grid min-w-0 gap-4 border border-white/10 bg-white/4 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-100">
                        City {index + 1}
                      </h3>
                      <button
                        type="button"
                        onClick={() => removeStop(stop.id)}
                        disabled={form.stops.length === 1}
                        className="border border-white/10 px-3 py-1 text-sm text-stone-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid min-w-0 gap-3 md:grid-cols-3">
                      <label className="grid min-w-0 content-start gap-2 text-sm text-stone-200">
                        City
                        <input
                          type="text"
                          value={stop.city}
                          onChange={(event) => updateStop(stop.id, { city: event.target.value })}
                          placeholder="Paris"
                          className="h-10 w-full min-w-0 border border-white/10 bg-white/5 px-3 py-2 text-base text-white outline-none transition focus:border-emerald-300"
                        />
                      </label>

                      <label className="grid min-w-0 content-start gap-2 text-sm text-stone-200">
                        <span className="flex items-center gap-2">
                          Airport optional
                          <span className="group relative inline-flex">
                            <span
                              aria-label="Airport help"
                              className="inline-flex h-4 w-4 items-center justify-center border border-white/20 bg-white/5 text-[11px] font-semibold text-stone-300"
                            >
                              i
                            </span>
                            <span className="pointer-events-none absolute left-1/2 top-6 z-10 hidden w-52 -translate-x-1/2 border border-white/10 bg-[#17251f] px-3 py-2 text-xs leading-5 text-stone-200 shadow-xl group-hover:block">
                              Blank skips flight lookup for this stop.
                            </span>
                          </span>
                        </span>
                        <input
                          type="text"
                          value={stop.airport}
                          onChange={(event) => updateStop(stop.id, { airport: event.target.value })}
                          placeholder="CDG"
                          className="h-10 w-full min-w-0 border border-white/10 bg-white/5 px-3 py-2 text-base uppercase text-white outline-none transition focus:border-emerald-300"
                        />
                      </label>

                      <label className="grid min-w-0 content-start gap-2 text-sm text-stone-200">
                        Days
                        <input
                          type="number"
                          min="1"
                          value={stop.days}
                          onChange={(event) => updateStop(stop.id, { days: Number(event.target.value) })}
                          className="h-10 w-full min-w-0 border border-white/10 bg-white/5 px-3 py-2 text-base text-white outline-none transition focus:border-emerald-300"
                        />
                      </label>
                    </div>

                    <div className="grid gap-2">
                      <p className="text-sm text-stone-300">Activities for {stop.city || `city ${index + 1}`}</p>
                      <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                        {ACTIVITY_FILTERS.map((filter) => {
                          const isSelected = stop.activityFilters.includes(filter.id)

                          return (
                            <button
                              key={filter.id}
                              type="button"
                              onClick={() => toggleActivityFilter(stop.id, filter.id)}
                              className={`min-w-0 border px-3 py-2 text-left transition ${
                                isSelected
                                  ? 'border-emerald-300/60 bg-emerald-300/15 text-white'
                                  : 'border-white/10 bg-white/5 text-stone-300 hover:bg-white/10'
                              }`}
                            >
                              <span className="block min-w-0 wrap-break-word text-sm font-semibold">{filter.label}</span>
                              <span className="mt-1 block min-w-0 wrap-break-word text-xs leading-5 text-stone-400">
                                {filter.description}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </section>
                ))}
              </div>

              {formError ? (
                <p className="border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                  {formError}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isLoading}
                className="bg-emerald-300 px-4 py-3 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:bg-emerald-900 disabled:text-stone-300"
              >
                {isLoading ? 'Planning...' : 'Plan multi-city trip'}
              </button>
            </form>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <aside className="grid content-start gap-6">
            <article className="border border-white/10 bg-black/20 p-5">
              <h2 className="text-lg font-semibold text-white">City Weather</h2>
              <div className="mt-4 grid gap-3">
                {resultCities.length ? (
                  resultCities.map((city) => (
                    <div key={`${city.city}-weather`} className="border border-white/10 bg-white/5 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">{city.city}</p>
                          <p className="text-sm text-stone-400">{city.checkin_date}</p>
                        </div>
                        <span className="border border-emerald-300/30 bg-emerald-300/10 px-2 py-1 text-xs text-emerald-100">
                          {city.days} days
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                        <p className="border border-white/10 bg-black/20 p-2">
                          High
                          <span className="mt-1 block font-semibold text-white">
                            {formatWeatherNumber(city.weather?.max_temp_c ?? null, ' C')}
                          </span>
                        </p>
                        <p className="border border-white/10 bg-black/20 p-2">
                          Low
                          <span className="mt-1 block font-semibold text-white">
                            {formatWeatherNumber(city.weather?.min_temp_c ?? null, ' C')}
                          </span>
                        </p>
                        <p className="border border-white/10 bg-black/20 p-2">
                          Rain
                          <span className="mt-1 block font-semibold text-white">
                            {formatWeatherNumber(city.weather?.precipitation_mm ?? null, ' mm')}
                          </span>
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="border border-dashed border-white/10 bg-white/5 px-4 py-8 text-sm text-stone-400">
                    Search a trip to load city weather here.
                  </p>
                )}
              </div>
            </article>

            <article className="border border-white/10 bg-black/20 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-white">Flights</h2>
                {results ? (
                  <span className="border border-white/10 bg-white/5 px-2 py-1 text-xs text-stone-300">
                    {results.flights.length} found
                  </span>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3">
                {results?.flights.length ? (
                  results.flights.map((flight) => (
                    <div
                      key={`${flight.airline}-${flight.flight_number}-${flight.departure_time}`}
                      className="border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">
                            {flight.airline} {flight.flight_number}
                          </p>
                          <p className="text-sm uppercase tracking-wide text-emerald-100">
                            {flight.origin} to {flight.destination}
                          </p>
                        </div>
                        <p className="font-semibold text-white">${flight.price}</p>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-stone-300">
                        <p>Depart: {formatTimestamp(flight.departure_time)}</p>
                        <p>Arrive: {formatTimestamp(flight.arrival_time)}</p>
                        <p>Duration: {formatFlightDuration(flight.duration_minutes)}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="border border-dashed border-white/10 bg-white/5 px-4 py-8 text-sm text-stone-400">
                    Add airport codes to city stops to load flight segments.
                  </p>
                )}
              </div>
            </article>
          </aside>

          <section className="grid gap-6">
            <article className="border border-white/10 bg-black/20 p-5">
              <h2 className="text-lg font-semibold text-white">AI Plan</h2>
              {aiPlan ? (
                <pre className="mt-4 whitespace-pre-wrap border border-white/10 bg-white/5 p-4 font-sans text-sm leading-6 text-stone-200">
                  {aiPlan}
                </pre>
              ) : (
                <p className="mt-4 border border-dashed border-white/10 bg-white/5 px-4 py-8 text-sm text-stone-400">
                  Search a trip to load the generated plan here.
                </p>
              )}
            </article>

            <article className="border border-white/10 bg-black/20 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-white">City Details</h2>
                {results ? (
                  <span className="border border-white/10 bg-white/5 px-2 py-1 text-xs text-stone-300">
                    {resultCities.length} cities
                  </span>
                ) : null}
              </div>

              <div className="mt-4 grid gap-4">
                {resultCities.length ? (
                  resultCities.map((city) => (
                    <section key={`${city.order}-${city.city}`} className="border border-white/10 bg-white/4 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">
                            Stop {city.order}
                          </p>
                          <h3 className="mt-1 text-xl font-semibold text-white">
                            {city.airport ? `${city.city} (${city.airport})` : city.city}
                          </h3>
                          <p className="mt-1 text-sm text-stone-400">
                            {city.checkin_date} to {city.checkout_date} - {city.days} days
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm text-stone-300">
                          <span className="border border-white/10 bg-black/20 px-3 py-2">
                            {city.hotels.length} hotels
                          </span>
                          <span className="border border-white/10 bg-black/20 px-3 py-2">
                            {city.activities.length} activities
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 xl:grid-cols-2">
                        <div>
                          <h4 className="text-sm font-semibold text-white">Hotels</h4>
                          <div className="mt-2 grid gap-2">
                            {city.hotels.slice(0, 4).map((hotel) => (
                              <div key={`${city.city}-${hotel.name}`} className="border border-white/10 bg-black/20 p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <p className="font-semibold text-white">{hotel.name}</p>
                                  <p className="text-emerald-100">${hotel.price_per_night.toFixed(0)}</p>
                                </div>
                                <p className="mt-1 text-sm text-stone-400">
                                  {hotel.rating ? `${hotel.rating}/5 rating` : 'No rating available'}
                                </p>
                              </div>
                            ))}
                            {!city.hotels.length ? (
                              <p className="border border-dashed border-white/10 p-3 text-sm text-stone-400">
                                No hotels returned for this city.
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div>
                          <h4 className="text-sm font-semibold text-white">Activities</h4>
                          <div className="mt-2 grid gap-2">
                            {city.activities.slice(0, 4).map((activity, index) => (
                              <div key={`${city.city}-${activity.name ?? 'activity'}-${index}`} className="border border-white/10 bg-black/20 p-3">
                                <p className="font-semibold text-white">
                                  {activity.name ?? 'Unnamed activity'}
                                </p>
                                <p className="mt-1 text-sm text-stone-400">
                                  {activity.type ?? 'Activity'} - {activity.duration_minutes} min
                                </p>
                              </div>
                            ))}
                            {!city.activities.length ? (
                              <p className="border border-dashed border-white/10 p-3 text-sm text-stone-400">
                                No activities returned for this city.
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </section>
                  ))
                ) : (
                  <p className="border border-dashed border-white/10 bg-white/5 px-4 py-8 text-sm text-stone-400">
                    Search a trip to load city-by-city details here.
                  </p>
                )}
              </div>
            </article>
          </section>
        </section>
      </div>
    </main>
  )
}

export default App
