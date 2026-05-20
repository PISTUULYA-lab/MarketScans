import { NextResponse } from "next/server"

// Region-specific configuration
const regionConfig: Record<
  string,
  {
    suffixes: string[]
  }
> = {
  Global: {
    suffixes: [""],
  },
  USA: {
    suffixes: [""],
  },
  UK: {
    suffixes: [".L"],
  },
  India: {
    suffixes: [".NS", ".BO"],
  },
  Japan: {
    suffixes: [".T", ".JP"],
  },
}

async function searchFinnhub(query: string) {
  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey) {
    console.warn("FINNHUB_API_KEY not set")
    return []
  }

  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${apiKey}`
    )
    const data = await response.json()
    return data.result || []
  } catch (error) {
    console.error("Finnhub search error:", error)
    return []
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q") || ""
  const region = searchParams.get("region") || "Global"

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] })
  }

  const regionConfig_ = regionConfig[region] || regionConfig.Global

  try {
    const searchResults = await searchFinnhub(query)

    const filteredResults = searchResults
      .filter((result: any) => {
        // Only show equity types
        if (result.type !== "equity") return false

        // Filter by region suffixes if not Global
        if (region !== "Global") {
          const symbol = result.symbol || ""
          return regionConfig_.suffixes.some(
            (suffix) => symbol.endsWith(suffix) || suffix === ""
          )
        }

        return true
      })
      .slice(0, 10)
      .map((result: any) => ({
        symbol: result.symbol || "",
        displaySymbol: result.symbol
          ?.replace(".L", "")
          .replace(".NS", "")
          .replace(".BO", "")
          .replace(".T", "")
          .replace(".JP", "") || "",
        name: result.description || result.symbol || "Unknown",
        exchange: result.symbol ? result.symbol.split(".")[1] || "US" : "US",
        type: "equity",
      }))

    return NextResponse.json({ results: filteredResults })
  } catch (error) {
    console.error("Search API Error:", error)
    return NextResponse.json({ results: [] })
  }
}
