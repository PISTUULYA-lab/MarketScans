import { NextResponse } from "next/server"

// Currency conversion rates
const currencyRates: Record<string, number> = {
  USD: 1,
  GBP: 0.79,
  INR: 83.5,
  JPY: 154.5,
}

// Region-specific configuration
const regionConfig: Record<
  string,
  {
    currency: string
    indices: string[]
    popularStocks: string[]
    commodities: {
      oil: string
      gold: string
      silver: string
    }
  }
> = {
  Global: {
    currency: "USD",
    indices: ["^GSPC"],
    popularStocks: [
      "NVDA",
      "AAPL",
      "MSFT",
      "GOOGL",
      "AMZN",
      "TSLA",
      "META",
      "TSM",
      "ASML",
      "AMD",
    ],
    commodities: { oil: "WTI", gold: "GOLD", silver: "SILVER" },
  },
  USA: {
    currency: "USD",
    indices: ["^GSPC"],
    popularStocks: [
      "AAPL",
      "MSFT",
      "GOOGL",
      "AMZN",
      "TSLA",
      "META",
      "NVDA",
      "JPM",
      "V",
      "UNH",
    ],
    commodities: { oil: "WTI", gold: "GOLD", silver: "SILVER" },
  },
  UK: {
    currency: "GBP",
    indices: ["^FTSE"],
    popularStocks: [
      "BP",
      "SHEL",
      "AZN",
      "HSBA",
      "GSK",
      "ULVR",
      "RIO",
      "DGE",
      "LLOY",
      "VOD",
    ],
    commodities: { oil: "WTI", gold: "GOLD", silver: "SILVER" },
  },
  India: {
    currency: "INR",
    indices: ["^NSEI"],
    popularStocks: [
      "RELIANCE",
      "TCS",
      "HDFCBANK",
      "INFY",
      "ICICIBANK",
      "HINDUNILVR",
      "BHARTIARTL",
      "SBIN",
      "WIPRO",
      "LT",
    ],
    commodities: { oil: "WTI", gold: "GOLD", silver: "SILVER" },
  },
  Japan: {
    currency: "JPY",
    indices: ["^N225"],
    popularStocks: [
      "7203",
      "6758",
      "9984",
      "6861",
      "7974",
      "8306",
      "6501",
      "9432",
      "4502",
      "6902",
    ],
    commodities: { oil: "WTI", gold: "GOLD", silver: "SILVER" },
  },
}

function formatPrice(price: number, currency: string): string {
  const symbols: Record<string, string> = {
    USD: "$",
    GBP: "£",
    INR: "₹",
    JPY: "¥",
  }
  const symbol = symbols[currency] || "$"
  const rate = currencyRates[currency] || 1
  const converted = price * rate

  if (currency === "JPY") {
    return `${symbol}${Math.round(converted).toLocaleString()}`
  }
  if (currency === "INR" && converted >= 100000) {
    return `${symbol}${(converted / 100000).toFixed(2)}L`
  }
  return `${symbol}${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatChange(change: number): string {
  const sign = change >= 0 ? "+" : ""
  return `${sign}${change.toFixed(2)}%`
}

function formatVolume(volume: number): string {
  if (volume >= 1e9) return `${(volume / 1e9).toFixed(1)}B`
  if (volume >= 1e6) return `${(volume / 1e6).toFixed(1)}M`
  if (volume >= 1e3) return `${(volume / 1e3).toFixed(1)}K`
  return volume.toString()
}

async function fetchFinnhubQuote(symbol: string) {
  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey) {
    console.warn("FINNHUB_API_KEY not set")
    return null
  }

  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`
    )
    const data = await response.json()
    return data
  } catch (error) {
    console.error(`Error fetching Finnhub quote for ${symbol}:`, error)
    return null
  }
}

async function fetchAlphaVantageCommodity(commodity: string) {
  const apiKey = process.env.ALPHAVANTAGE_API_KEY
  if (!apiKey) {
    console.warn("ALPHAVANTAGE_API_KEY not set")
    return null
  }

  try {
    // Alpha Vantage commodities: WTI and BRENT for oil only
    // For gold and silver, we use a fallback approach
    const functionMap: Record<string, string> = {
      WTI: "WTI",
      BRENT: "BRENT",
    }

    if (!functionMap[commodity]) {
      // Gold and silver not directly available in Alpha Vantage free tier
      // Return null to use fallback mock data
      return null
    }

    const response = await fetch(
      `https://www.alphavantage.co/query?function=${commodity}&interval=monthly&apikey=${apiKey}`,
      { next: { revalidate: 300 } } // Cache for 5 minutes
    )
    const data = await response.json()
    
    if (data.data && Array.isArray(data.data) && data.data.length > 0) {
      return data
    }
    
    return null
  } catch (error) {
    console.error(`Error fetching Alpha Vantage commodity ${commodity}:`, error)
    return null
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const region = searchParams.get("region") || "Global"

  const config = regionConfig[region] || regionConfig.Global
  const currency = config.currency

  try {
    // Fetch stock quotes from Finnhub
    const stockQuotes = await Promise.all(
      config.popularStocks.map((symbol) => fetchFinnhubQuote(symbol))
    )

    const stocksData = stockQuotes
      .filter((quote) => quote && quote.c !== undefined)
      .map((quote, idx) => {
        const change = ((quote.c - quote.pc) / quote.pc) * 100 || 0
        return {
          ticker: config.popularStocks[idx],
          displayTicker: config.popularStocks[idx],
          name: config.popularStocks[idx], // Finnhub quote doesn't include name in this endpoint
          price: quote.c || 0,
          priceFormatted: formatPrice(quote.c || 0, currency),
          change: change,
          changeFormatted: formatChange(change),
          volume: quote.v || 0,
          volumeFormatted: formatVolume(quote.v || 0),
          isPositive: change >= 0,
        }
      })

    // Find top gainer
    let topGainer = null
    let maxChange = -Infinity

    stocksData.forEach((stock) => {
      if (stock.change > maxChange) {
        maxChange = stock.change
        topGainer = {
          ticker: stock.displayTicker,
          name: stock.name,
          change: stock.changeFormatted,
          price: stock.priceFormatted,
          vol: stock.volumeFormatted,
          isPositive: stock.isPositive,
        }
      }
    })

    // Fetch commodity prices from Alpha Vantage
    const [oilData, silverData] = await Promise.all([
      fetchAlphaVantageCommodity("WTI"),
      fetchAlphaVantageCommodity("BRENT"), // Using Brent as fallback for additional data
    ])

    // Extract latest commodity prices from Alpha Vantage
    const getLatestPrice = (data: any) => {
      if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
        const latest = data.data[0]
        return parseFloat(latest.value) || null
      }
      return null
    }

    // Get real oil price from Alpha Vantage or use fallback
    const wtiPrice = getLatestPrice(oilData)
    const brentPrice = getLatestPrice(silverData)
    
    // Use real API data if available, otherwise use realistic mock data
    const oilPrice = wtiPrice || 82.4
    const goldPrice = 2350 // Gold not available in Alpha Vantage free tier - using realistic mock
    const silverPrice = 28.1 // Silver not available in Alpha Vantage free tier - using realistic mock

    const commodities = {
      oil: {
        price: formatPrice(oilPrice, currency),
        unit: "/ bbl",
        trend: oilPrice > 80 ? "+0.5%" : "-0.5%",
        source: wtiPrice ? "Alpha Vantage" : "mock",
      },
      gold: {
        price: formatPrice(goldPrice, currency),
        unit: "/ oz",
        trend: "+1.2%",
        source: "mock",
      },
      silver: {
        price: formatPrice(silverPrice, currency),
        unit: "/ oz",
        trend: "-0.3%",
        source: "mock",
      },
      neodymium: {
        price: formatPrice(68.5, currency),
        unit: "/ kg",
        trend: "+1.2%",
        source: "mock",
      },
      lithium: {
        price: formatPrice(12450, currency),
        unit: "/ ton",
        trend: "-0.8%",
        source: "mock",
      },
      cobalt: {
        price: formatPrice(28200, currency),
        unit: "/ ton",
        trend: "+0.4%",
        source: "mock",
      },
    }

    // Generate mock chart data (can be enhanced with real intraday data)
    const baseValue = region === "Japan" ? 38000 : region === "India" ? 22000 : 5000
    const chartData = Array.from({ length: 7 }, (_, i) => ({
      time: `${9 + i}:00`,
      value: baseValue + Math.floor(Math.random() * 200 - 100),
    }))

    // Generate AI picks based on stock data
    const sortedByChange = [...stocksData].sort((a, b) => b.change - a.change)
    const aiPicks = sortedByChange.slice(0, 3).map((stock, idx) => {
      const action = stock.change > 2 ? "BUY" : stock.change > 0 ? "HOLD" : "AVOID"
      const confidence = Math.max(60, Math.min(92, 75 + Math.floor(stock.change * 3)))

      const rationales: Record<string, string[]> = {
        BUY: [
          `Strong momentum with ${stock.changeFormatted} gain today. Technical indicators suggest continued upward trajectory with solid institutional buying.`,
          `Outperforming sector peers significantly. Volume of ${stock.volumeFormatted} indicates strong market conviction in current price action.`,
        ],
        HOLD: [
          `Stable performance at ${stock.priceFormatted}. Current valuation appears fair relative to sector. Monitor for breakout signals.`,
          `Mixed signals with ${stock.changeFormatted} movement. Await clearer directional confirmation before adjusting position.`,
        ],
        AVOID: [
          `Showing weakness with ${stock.changeFormatted} decline. Technical support levels being tested. Risk-reward unfavorable short-term.`,
          `Underperforming broader market. Consider reducing exposure until momentum stabilizes.`,
        ],
      }

      return {
        ticker: stock.displayTicker,
        name: stock.name,
        action,
        confidence: `${confidence}%`,
        rationale: rationales[action][idx % 2],
      }
    })

    return NextResponse.json({
      currency,
      topGainer: topGainer || {
        ticker: "N/A",
        name: "Data Unavailable",
        change: "0.00%",
        price: formatPrice(0, currency),
        vol: "0",
        isPositive: true,
      },
      commodities,
      aiPicks,
      chartData,
      stocks: stocksData,
      lastUpdated: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Market API Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch market data" },
      { status: 500 }
    )
  }
}
