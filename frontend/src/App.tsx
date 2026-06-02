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

type SearchResults = {
  activities: ActivityOption[]
  flights: FlightOption[]
  hotels: HotelOption[]
  weather: WeatherResult | null
}

type TripPlanResponse = {
  trip_data: SearchResults
  ai_plan: string
}

type SearchErrors = Partial<Record<'activities' | 'flights' | 'hotels' | 'weather', string>>

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
  const [form, setForm] = useState({
    destinationCity: '',
    flightDestination: '',
    activityFilters: ['sightseeing', 'museums'] as ActivityFilter['id'][],
    origin: 'YYZ',
    startDate: formatDateInput(addDays(today, 7)),
    endDate: formatDateInput(addDays(today, 12)),
    currency: 'USD',
  })
  const [results, setResults] = useState<SearchResults | null>(null)
  const [aiPlan, setAiPlan] = useState('')
  const [sectionErrors, setSectionErrors] = useState<SearchErrors>({})
  const [formError, setFormError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  function toggleActivityFilter(filterId: ActivityFilter['id']) {
    setForm((current) => ({
      ...current,
      activityFilters: current.activityFilters.includes(filterId)
        ? current.activityFilters.filter((value) => value !== filterId)
        : [...current.activityFilters, filterId],
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const destinationCity = form.destinationCity.trim()

    if (!destinationCity) {
      setFormError('Destination city is required.')
      return
    }

    if (form.endDate < form.startDate) {
      setFormError('Return date must be on or after the departure date.')
      return
    }

    setFormError('')
    setIsLoading(true)
    setSectionErrors({})

    const requestBody = {
      origin_airport: form.origin.trim().toUpperCase(),
      destination_airport: form.flightDestination.trim().toUpperCase(),
      destination_city: destinationCity,
      outbound_date: form.startDate,
      return_date: form.endDate,
      currency: form.currency.trim().toUpperCase(),
      include_activities: form.activityFilters.length > 0,
      include_weather: true,
      activity_categories: buildActivityCategories(form.activityFilters),
    }
    const flightInputError =
      !form.origin.trim() || !form.flightDestination.trim()
        ? 'Enter both origin and flight destination codes like YYZ and CDG.'
        : !isAirportCode(form.origin) || !isAirportCode(form.flightDestination)
          ? 'Flights use 3-letter airport codes like YYZ, CDG, or ORY.'
          : undefined

    if (flightInputError) {
      setAiPlan('')
      setResults((current) =>
        current ?? {
          activities: [],
          flights: [],
          hotels: [],
          weather: null,
        },
      )
      setSectionErrors({ flights: flightInputError })
      setIsLoading(false)
      return
    }

    try {
      const tripPlan = await postJson<TripPlanResponse>('/plan-trip/', requestBody)

      setResults({
        activities: tripPlan.trip_data?.activities ?? [],
        flights: tripPlan.trip_data?.flights ?? [],
        hotels: tripPlan.trip_data?.hotels ?? [],
        weather: tripPlan.trip_data?.weather ?? null,
      })
      setAiPlan(tripPlan.ai_plan ?? '')
      setSectionErrors({})
    } catch (error) {
      setAiPlan('')
      setResults({
        activities: [],
        flights: [],
        hotels: [],
        weather: null,
      })
      setFormError(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.2),transparent_32%),linear-gradient(180deg,#020617_0%,#0f172a_52%,#111827_100%)] px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/8 shadow-2xl shadow-sky-950/20 backdrop-blur">
          <div className="grid gap-6 p-6 md:grid-cols-[1.1fr_0.9fr] md:p-8">
            <div className="space-y-4">
              <span className="inline-flex rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-200">
                Vacation Planner Test UI
              </span>
              <div className="space-y-3">
                <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  Quick trip search for flights, hotels, and weather.
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                  This page is intentionally simple for testing your FastAPI backend. Enter a
                  destination city, travel dates, and flight airport codes, then it will send one
                  combined trip-planning request to the backend.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-slate-300">
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
                  API: {API_BASE_URL}
                </span>
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
                  Currency: {form.currency}
                </span>
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
                  Route: POST /plan-trip/
                </span>
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="grid gap-4 rounded-2xl border border-white/10 bg-slate-950/45 p-5"
            >
              <label className="grid gap-2 text-sm text-slate-200">
                Destination city
                <input
                  type="text"
                  value={form.destinationCity}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, destinationCity: event.target.value }))
                  }
                  placeholder="Paris"
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none transition focus:border-sky-400 focus:bg-white/10"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm text-slate-200">
                  Origin airport code
                  <input
                    type="text"
                    value={form.origin}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, origin: event.target.value }))
                    }
                    placeholder="YYZ"
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base uppercase text-white outline-none transition focus:border-sky-400 focus:bg-white/10"
                  />
                </label>

                <label className="grid gap-2 text-sm text-slate-200">
                  Flight destination airport code
                  <input
                    type="text"
                    value={form.flightDestination}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, flightDestination: event.target.value }))
                    }
                    placeholder="CDG"
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base uppercase text-white outline-none transition focus:border-sky-400 focus:bg-white/10"
                  />
                </label>
              </div>

              <p className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs leading-5 text-slate-300">
                Use the city name for hotels and weather, and a specific 3-letter airport code for
                flights. Example: destination city <span className="font-semibold text-white">Paris</span> with
                flight code <span className="font-semibold text-white">CDG</span> or <span className="font-semibold text-white">ORY</span>. Exact airports are more reliable than metro codes like <span className="font-semibold text-white">PAR</span>.
              </p>

              <div className="grid gap-3">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm text-slate-200">Activity types</label>
                  <span className="text-xs text-slate-400">
                    {form.activityFilters.length} selected
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {ACTIVITY_FILTERS.map((filter) => {
                    const isSelected = form.activityFilters.includes(filter.id)

                    return (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => toggleActivityFilter(filter.id)}
                        className={`rounded-2xl border px-4 py-3 text-left transition ${
                          isSelected
                            ? 'border-sky-400/50 bg-sky-400/15 text-white'
                            : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        <p className="text-sm font-semibold">{filter.label}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-400">
                          {filter.description}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm text-slate-200">
                  Departure date
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, startDate: event.target.value }))
                    }
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none transition focus:border-sky-400 focus:bg-white/10"
                  />
                </label>

                <label className="grid gap-2 text-sm text-slate-200">
                  Return date
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, endDate: event.target.value }))
                    }
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none transition focus:border-sky-400 focus:bg-white/10"
                  />
                </label>
              </div>

              <label className="grid gap-2 text-sm text-slate-200">
                Currency
                <input
                  type="text"
                  value={form.currency}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))
                  }
                  placeholder="USD"
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base uppercase text-white outline-none transition focus:border-sky-400 focus:bg-white/10"
                />
              </label>

              {formError ? (
                <p className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                  {formError}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isLoading}
                className="rounded-xl bg-sky-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:bg-sky-700 disabled:text-slate-300"
              >
                {isLoading ? 'Searching...' : 'Search trip'}
              </button>
            </form>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <article className="rounded-3xl border border-white/10 bg-slate-950/55 p-6 shadow-xl shadow-slate-950/30 backdrop-blur">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-white">Weather</h2>
                <p className="text-sm text-slate-400">Based on the departure date.</p>
              </div>
              {results?.weather ? (
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
                  {results.weather.date_used}
                </span>
              ) : null}
            </div>

            {sectionErrors.weather ? (
              <p className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                {sectionErrors.weather}
              </p>
            ) : null}

            {results?.weather ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-slate-400">High</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {formatWeatherNumber(results.weather.max_temp_c, ' C')}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-slate-400">Low</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {formatWeatherNumber(results.weather.min_temp_c, ' C')}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-slate-400">Precipitation</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {formatWeatherNumber(results.weather.precipitation_mm, ' mm')}
                  </p>
                </div>
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-white/10 bg-white/3 px-4 py-8 text-sm text-slate-400">
                Search a trip to load weather data here.
              </p>
            )}
          </article>

          <div className="grid gap-6">
            <article className="rounded-3xl border border-white/10 bg-slate-950/55 p-6 shadow-xl shadow-slate-950/30 backdrop-blur">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">AI Plan</h2>
                  <p className="text-sm text-slate-400">Generated from the `/plan-trip/` response.</p>
                </div>
              </div>

              {aiPlan ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-slate-200">
                    {aiPlan}
                  </pre>
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-white/10 bg-white/3 px-4 py-8 text-sm text-slate-400">
                  Search a trip to load the generated plan here.
                </p>
              )}
            </article>

            <article className="rounded-3xl border border-white/10 bg-slate-950/55 p-6 shadow-xl shadow-slate-950/30 backdrop-blur">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">Flights</h2>
                  <p className="text-sm text-slate-400">Returned inside the `/plan-trip/` response.</p>
                </div>
                {results ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                    {results.flights.length} found
                  </span>
                ) : null}
              </div>

              {sectionErrors.flights ? (
                <p className="mb-4 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                  {sectionErrors.flights}
                </p>
              ) : null}

              <div className="grid gap-3">
                {results?.flights.length ? (
                  results.flights.map((flight) => (
                    <div
                      key={`${flight.airline}-${flight.flight_number}-${flight.departure_time}`}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold text-white">
                            {flight.airline} {flight.flight_number}
                          </p>
                          <p className="text-sm uppercase tracking-wide text-sky-200">
                            {flight.origin} to {flight.destination}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-white">${flight.price}</p>
                          <p className="text-sm text-slate-400">{flight.type}</p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
                        <p>Depart: {formatTimestamp(flight.departure_time)}</p>
                        <p>Arrive: {formatTimestamp(flight.arrival_time)}</p>
                        <p>Duration: {formatFlightDuration(flight.duration_minutes)}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-white/10 bg-white/3 px-4 py-8 text-sm text-slate-400">
                    {results
                      ? 'No flights returned for this search.'
                      : 'Search a trip to load flight options here.'}
                  </p>
                )}
              </div>
            </article>

            <article className="rounded-3xl border border-white/10 bg-slate-950/55 p-6 shadow-xl shadow-slate-950/30 backdrop-blur">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">Activities</h2>
                  <p className="text-sm text-slate-400">Returned inside the `/plan-trip/` response.</p>
                </div>
                {results ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                    {results.activities.length} found
                  </span>
                ) : null}
              </div>

              {sectionErrors.activities ? (
                <p className="mb-4 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                  {sectionErrors.activities}
                </p>
              ) : null}

              <div className="grid gap-3 md:grid-cols-2">
                {results?.activities.length ? (
                  results.activities.map((activity, index) => (
                    <div
                      key={`${activity.name ?? 'activity'}-${activity.type ?? 'unknown'}-${index}`}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold text-white">
                            {activity.name ?? 'Unnamed activity'}
                          </p>
                          <p className="text-sm text-sky-200">
                            {activity.type ?? 'Activity'}
                          </p>
                        </div>
                        <p className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-slate-300">
                          {activity.duration_minutes} min
                        </p>
                      </div>
                      <div className="mt-4 space-y-2 text-sm text-slate-300">
                        <p>{activity.description ?? 'No description available.'}</p>
                        <p>
                          Coordinates:{' '}
                          {activity.latitude !== null && activity.longitude !== null
                            ? `${activity.latitude.toFixed(3)}, ${activity.longitude.toFixed(3)}`
                            : 'N/A'}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-white/10 bg-white/3 px-4 py-8 text-sm text-slate-400 md:col-span-2">
                    {results
                      ? form.activityFilters.length
                        ? 'No activities returned for the selected filters.'
                        : 'Pick one or more activity filters to load activities.'
                      : 'Search a trip to load activities here.'}
                  </p>
                )}
              </div>
            </article>

            <article className="rounded-3xl border border-white/10 bg-slate-950/55 p-6 shadow-xl shadow-slate-950/30 backdrop-blur">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">Hotels</h2>
                  <p className="text-sm text-slate-400">Returned inside the `/plan-trip/` response.</p>
                </div>
                {results ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                    {results.hotels.length} found
                  </span>
                ) : null}
              </div>

              {sectionErrors.hotels ? (
                <p className="mb-4 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                  {sectionErrors.hotels}
                </p>
              ) : null}

              <div className="grid gap-3 md:grid-cols-2">
                {results?.hotels.length ? (
                  results.hotels.map((hotel) => (
                    <div
                      key={`${hotel.name}-${hotel.checkin_date}-${hotel.checkout_date}`}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold text-white">{hotel.name}</p>
                          <p className="text-sm text-slate-400">
                            {hotel.rating ? `${hotel.rating}/5 rating` : 'No rating available'}
                          </p>
                        </div>
                        <p className="text-lg font-semibold text-emerald-200">
                          ${hotel.price_per_night.toFixed(0)}
                        </p>
                      </div>
                      <div className="mt-4 space-y-2 text-sm text-slate-300">
                        <p>
                          Stay: {hotel.checkin_date} to {hotel.checkout_date}
                        </p>
                        <p>
                          Coordinates:{' '}
                          {hotel.latitude !== null && hotel.longitude !== null
                            ? `${hotel.latitude.toFixed(3)}, ${hotel.longitude.toFixed(3)}`
                            : 'N/A'}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-white/10 bg-white/3 px-4 py-8 text-sm text-slate-400 md:col-span-2">
                    {results
                      ? 'No hotels returned for this search.'
                      : 'Search a trip to load hotel options here.'}
                  </p>
                )}
              </div>
            </article>
          </div>
        </section>
      </div>
    </main>
  )
}

export default App
