"use client"

import { useState, useEffect, useRef } from "react"
import useSWR from "swr"
import {
  TrendingUp,
  Globe,
  ArrowUpRight,
  ArrowDownRight,
  Compass,
  ShieldAlert,
  Layers,
  RefreshCw,
  Zap,
  Activity,
  Search,
  X,
  AlertCircle,
} from "lucide-react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts"

// Types
interface CommodityData {
  price: string
  unit: string
  trend: string
}

interface AIPick {
  ticker: string
  name: string
  action: "BUY" | "HOLD" | "AVOID"
  confidence: string
  rationale: string
}

interface TopGainer {
  ticker: string
  name: string
  change: string
  price: string
  vol: string
  isPositive: boolean
}

interface ChartDataPoint {
  time: string
  value: number
}

interface StockData {
  ticker: string
  displayTicker: string
  name: string
  price: number
  priceFormatted: string
  change: number
  changeFormatted: string
  volume: number
  volumeFormatted: string
  isPositive: boolean
}

interface MarketData {
  currency: string
  topGainer: TopGainer
  commodities: {
    oil: CommodityData
    gold: CommodityData
    silver: CommodityData
    neodymium: CommodityData
    lithium: CommodityData
    cobalt: CommodityData
  }
  aiPicks: AIPick[]
  chartData: ChartDataPoint[]
  stocks: StockData[]
  lastUpdated: string
}

interface SearchResult {
  symbol: string
  displaySymbol: string
  name: string
  exchange: string
  type: string
}

interface QuoteData {
  ticker: string
  fullSymbol: string
  name: string
  priceFormatted: string
  changeFormatted: string
  volumeFormatted: string
  isPositive: boolean
}

const regions = [
  { value: "Global", label: "Global Registry" },
  { value: "USA", label: "United States (USD)" },
  { value: "UK", label: "United Kingdom (GBP)" },
  { value: "India", label: "India (INR)" },
  { value: "Japan", label: "Japan (JPY)" },
]

const fetcher = (url: string) => fetch(url).then((res) => res.json())

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

function CommodityCard({
  label,
  data,
}: {
  label: string
  data: CommodityData
}) {
  const isPositive = data.trend.startsWith("+")
  return (
    <div className="bg-slate-950 p-4 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors">
      <span className="text-slate-400 text-xs font-medium">{label}</span>
      <div className="flex items-baseline justify-between mt-1">
        <p className="text-sm font-bold text-slate-200">
          {data.price}
          <span className="text-slate-500 font-normal ml-1">{data.unit}</span>
        </p>
        <span
          className={`text-xs font-semibold ${isPositive ? "text-emerald-400" : "text-red-400"}`}
        >
          {data.trend}
        </span>
      </div>
    </div>
  )
}

function AIPickCard({ pick }: { pick: AIPick }) {
  const actionColors = {
    BUY: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    HOLD: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    AVOID: "bg-red-500/20 text-red-400 border-red-500/30",
  }

  return (
    <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 space-y-3">
      <div className="flex justify-between items-start">
        <div>
          <span className="text-sm font-bold text-white">{pick.ticker}</span>
          <p className="text-xs text-slate-400">{pick.name}</p>
        </div>
        <span
          className={`text-xs font-black px-3 py-1 rounded-md border ${actionColors[pick.action]}`}
        >
          {pick.action}
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs text-cyan-400">
        <Zap size={12} className="animate-pulse" />
        <span>{pick.confidence} Confidence</span>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed bg-slate-900/50 p-3 rounded-lg border border-slate-800">
        {pick.rationale}
      </p>
    </div>
  )
}

function StockSearchResult({
  stock,
  onClose,
}: {
  stock: QuoteData
  onClose: () => void
}) {
  return (
    <div className="bg-slate-950 border border-cyan-500/30 rounded-xl p-4 relative animate-in slide-in-from-top-2">
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-slate-500 hover:text-white transition-colors"
      >
        <X size={16} />
      </button>
      <div className="flex justify-between items-start">
        <div>
          <span className="text-lg font-bold text-white">{stock.ticker}</span>
          <p className="text-xs text-slate-400">{stock.name}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-white">{stock.priceFormatted}</p>
          <span
            className={`inline-flex items-center gap-1 text-sm font-semibold ${
              stock.isPositive ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {stock.isPositive ? (
              <ArrowUpRight size={14} />
            ) : (
              <ArrowDownRight size={14} />
            )}
            {stock.changeFormatted}
          </span>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
        <span>Vol: {stock.volumeFormatted}</span>
      </div>
    </div>
  )
}

function SearchBox({
  region,
  currency,
  accentColor,
}: {
  region: string
  currency: string
  accentColor: "cyan" | "emerald"
}) {
  const [query, setQuery] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [selectedStock, setSelectedStock] = useState<QuoteData | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const debouncedQuery = useDebounce(query, 300)

  const { data: searchResults, isLoading: isSearching } = useSWR<{
    results: SearchResult[]
  }>(
    debouncedQuery.length >= 2
      ? `/api/search?q=${encodeURIComponent(debouncedQuery)}&region=${region}`
      : null,
    fetcher
  )

  const [fetchingQuote, setFetchingQuote] = useState(false)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSelectStock = async (result: SearchResult) => {
    setFetchingQuote(true)
    setIsOpen(false)
    setQuery("")

    try {
      const res = await fetch(
        `/api/quote?symbol=${encodeURIComponent(result.symbol)}&currency=${currency}`
      )
      const data = await res.json()
      if (!data.error) {
        setSelectedStock(data)
      }
    } catch (error) {
      console.error("Failed to fetch quote:", error)
    } finally {
      setFetchingQuote(false)
    }
  }

  const borderColor =
    accentColor === "cyan" ? "focus:border-cyan-500" : "focus:border-emerald-500"
  const iconColor = accentColor === "cyan" ? "text-cyan-400" : "text-emerald-400"

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          size={16}
          className={`absolute left-3 top-1/2 -translate-y-1/2 ${iconColor}`}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search companies..."
          className={`w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none ${borderColor} transition-colors`}
        />
        {isSearching && (
          <RefreshCw
            size={14}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 animate-spin"
          />
        )}

        {/* Search Results Dropdown */}
        {isOpen && query.length >= 2 && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-2 bg-slate-900 border border-slate-800 rounded-xl shadow-xl max-h-64 overflow-y-auto"
          >
            {searchResults?.results && searchResults.results.length > 0 ? (
              searchResults.results.map((result) => (
                <button
                  key={result.symbol}
                  onClick={() => handleSelectStock(result)}
                  className="w-full px-4 py-3 text-left hover:bg-slate-800 transition-colors border-b border-slate-800 last:border-b-0"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-sm font-bold text-white">
                        {result.displaySymbol}
                      </span>
                      <p className="text-xs text-slate-400 truncate max-w-[200px]">
                        {result.name}
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                      {result.exchange}
                    </span>
                  </div>
                </button>
              ))
            ) : !isSearching && debouncedQuery.length >= 2 ? (
              <div className="px-4 py-6 text-center text-slate-500 text-sm">
                <AlertCircle size={20} className="mx-auto mb-2 opacity-50" />
                No results found for &quot;{debouncedQuery}&quot;
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Selected Stock Display */}
      {fetchingQuote && (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-center">
          <RefreshCw size={20} className="text-slate-500 animate-spin" />
        </div>
      )}

      {selectedStock && !fetchingQuote && (
        <StockSearchResult
          stock={selectedStock}
          onClose={() => setSelectedStock(null)}
        />
      )}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="bg-slate-800/50 h-32 rounded-2xl" />
      <div className="bg-slate-800/50 h-24 rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-slate-800/50 h-20 rounded-xl" />
        ))}
      </div>
      <div className="space-y-3">
        <div className="bg-slate-800/50 h-32 rounded-xl" />
        <div className="bg-slate-800/50 h-32 rounded-xl" />
      </div>
    </div>
  )
}

function MarketPanel({
  region,
  setRegion,
  panelLabel,
  accentColor,
}: {
  region: string
  setRegion: (r: string) => void
  panelLabel: string
  accentColor: "cyan" | "emerald"
}) {
  const { data, error, isLoading } = useSWR<MarketData>(
    `/api/market?region=${region}`,
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: true,
      dedupingInterval: 10000,
    }
  )

  const iconColor = accentColor === "cyan" ? "text-cyan-400" : "text-emerald-400"
  const borderFocus =
    accentColor === "cyan" ? "focus:border-cyan-400" : "focus:border-emerald-400"
  const chartColor = accentColor === "cyan" ? "#22d3ee" : "#34d399"

  if (error) {
    return (
      <div className="bg-slate-900 border border-red-500/30 rounded-3xl p-6 flex flex-col items-center justify-center min-h-[600px]">
        <AlertCircle size={48} className="text-red-400 mb-4" />
        <p className="text-red-400 font-medium">Failed to load market data</p>
        <p className="text-slate-500 text-sm mt-1">Please try again later</p>
      </div>
    )
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl">
      {/* Panel Header */}
      <div className="flex justify-between items-center bg-slate-950 p-3 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-2 text-slate-300 font-semibold">
          {accentColor === "cyan" ? (
            <Globe size={18} className={iconColor} />
          ) : (
            <Layers size={18} className={iconColor} />
          )}
          {panelLabel}
        </div>
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className={`bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-medium text-white focus:outline-none ${borderFocus} transition-colors cursor-pointer`}
        >
          {regions.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {/* Search Box */}
      <SearchBox
        region={region}
        currency={data?.currency || "USD"}
        accentColor={accentColor}
      />

      {isLoading || !data ? (
        <LoadingSkeleton />
      ) : (
        <>
          {/* Top Gainer Banner */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-3">
              Daily Peak Growth Equities
            </span>
            <div className="flex justify-between items-start relative">
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp size={20} className="text-emerald-400" />
                  <span className="text-2xl font-black tracking-tight text-white">
                    {data.topGainer.ticker}
                  </span>
                </div>
                <p className="text-sm text-slate-400 mt-1">
                  {data.topGainer.name}
                </p>
                <p className="text-lg font-bold text-white mt-2">
                  {data.topGainer.price}
                </p>
              </div>
              <div className="text-right">
                <span
                  className={`inline-flex items-center gap-1 ${
                    data.topGainer.isPositive
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-red-500/10 text-red-400"
                  } text-lg font-bold px-3 py-1.5 rounded-lg`}
                >
                  {data.topGainer.isPositive ? (
                    <ArrowUpRight size={20} />
                  ) : (
                    <ArrowDownRight size={20} />
                  )}
                  {data.topGainer.change}
                </span>
                <p className="text-xs text-slate-500 mt-2">
                  Volume: {data.topGainer.vol}
                </p>
              </div>
            </div>
          </div>

          {/* Mini Chart */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Intraday Index Movement
              </span>
              <Activity size={14} className={iconColor} />
            </div>
            <div className="h-24">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.chartData}>
                  <defs>
                    <linearGradient
                      id={`gradient-${accentColor}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor={chartColor}
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor={chartColor}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="time"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748b", fontSize: 10 }}
                  />
                  <YAxis hide domain={["dataMin - 50", "dataMax + 50"]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      border: "1px solid #1e293b",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    labelStyle={{ color: "#94a3b8" }}
                    itemStyle={{ color: chartColor }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={chartColor}
                    strokeWidth={2}
                    fill={`url(#gradient-${accentColor})`}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Commodities Tracker */}
          <div className="space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">
              Critical Resources Pricing
            </span>
            <div className="grid grid-cols-2 gap-3">
              <CommodityCard
                label="Crude Oil (Brent)"
                data={data.commodities.oil}
              />
              <CommodityCard label="Gold Spot" data={data.commodities.gold} />
              <CommodityCard
                label="Silver Spot"
                data={data.commodities.silver}
              />
              <CommodityCard
                label="Neodymium (REE)"
                data={data.commodities.neodymium}
              />
              <CommodityCard label="Lithium" data={data.commodities.lithium} />
              <CommodityCard label="Cobalt" data={data.commodities.cobalt} />
            </div>
          </div>

          {/* AI Insights Engine */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {accentColor === "cyan" ? (
                <Compass className="text-cyan-400 animate-pulse" size={18} />
              ) : (
                <ShieldAlert
                  className="text-emerald-400 animate-pulse"
                  size={18}
                />
              )}
              <span className="text-sm font-bold tracking-tight text-white">
                AI Quantitative Alpha
              </span>
            </div>
            <div className="space-y-3">
              {data.aiPicks.map((pick) => (
                <AIPickCard key={pick.ticker} pick={pick} />
              ))}
            </div>
          </div>

          {/* Last Updated */}
          <div className="text-center text-[10px] text-slate-600">
            Last updated:{" "}
            {new Date(data.lastUpdated).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </div>
        </>
      )}
    </div>
  )
}

export default function MarketDashboard() {
  const [leftRegion, setLeftRegion] = useState("Global")
  const [rightRegion, setRightRegion] = useState("India")
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [isMounted, setIsMounted] = useState(false)

  // Update the last refresh time every 30 seconds (client-side only)
  useEffect(() => {
    // Set initial timestamp on mount
    setIsMounted(true)
    setLastRefresh(new Date())

    const interval = setInterval(() => {
      setLastRefresh(new Date())
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      {/* App Main Branding Header */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            GeoMacro Intelligence Hub
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Cross-Border Stock Analytics & Geopolitical AI Rationale
          </p>
        </div>
        {isMounted && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs flex items-center gap-2 text-slate-400">
            <RefreshCw size={14} className="text-emerald-400 animate-spin" />
            <span>
              Live Data · Auto-refresh{" "}
              {lastRefresh
                ? lastRefresh.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "--:--"}
            </span>
          </div>
        )}
      </header>

      {/* Main Dual Column Dashboard */}
      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        <MarketPanel
          region={leftRegion}
          setRegion={setLeftRegion}
          panelLabel="Target Zone A"
          accentColor="cyan"
        />
        <MarketPanel
          region={rightRegion}
          setRegion={setRightRegion}
          panelLabel="Target Zone B"
          accentColor="emerald"
        />
      </main>
    </div>
  )
}
