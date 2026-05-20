import { NextResponse } from "next/server"

const currencyRates: Record<string, number> = {
  USD: 1,
  GBP: 0.79,
  INR: 83.5,
  JPY: 154.5,
}

function formatPrice(price: number, currency: string): string {
  const symbols: Record<string, string> = {
    USD: "$",
    GBP: "£",
    INR: "₹",
    JPY: "¥",
  }
  const symbol = symbols[currency] || "$"
  const converted = price * (currencyRates[currency] || 1)

  if (currency === "JPY") {
    return `${symbol}${Math.round(converted).toLocaleString()}`
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get("symbol")
  const currency = searchParams.get("currency") || "USD"

  if (!symbol) {
    return NextResponse.json({ error: "Symbol required" }, { status: 400 })
  }

  try {
    const quote = await fetchFinnhubQuote(symbol)

    if (!quote || quote.c === undefined) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 })
    }

    const change = ((quote.c - quote.pc) / quote.pc) * 100 || 0

    return NextResponse.json({
      ticker: symbol.replace(".NS", "").replace(".L", "").replace(".T", ""),
      fullSymbol: symbol,
      name: symbol,
      price: quote.c || 0,
      priceFormatted: formatPrice(quote.c || 0, currency),
      change: change,
      changeFormatted: formatChange(change),
      volume: quote.v || 0,
      volumeFormatted: formatVolume(quote.v || 0),
      isPositive: change >= 0,
      dayHigh: quote.h,
      dayLow: quote.l,
      open: quote.o,
      previousClose: quote.pc,
      currency: currency,
    })
  } catch (error) {
    console.error("Quote API Error:", error)
    return NextResponse.json({ error: "Failed to fetch quote" }, { status: 500 })
  }
}
