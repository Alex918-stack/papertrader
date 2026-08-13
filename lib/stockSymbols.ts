export interface StockInfo {
  symbol: string;
  name: string;
  description: string;
}

export const ALL_STOCKS: StockInfo[] = [
  { symbol: "AAPL", name: "Apple Inc.", description: "Designs iPhones, Macs, and other consumer electronics, alongside services like the App Store and Apple Music." },
  { symbol: "MSFT", name: "Microsoft Corp.", description: "Makes Windows, Office, and Azure cloud services, with a growing focus on AI products." },
  { symbol: "GOOGL", name: "Alphabet Inc.", description: "Parent company of Google Search, YouTube, and Android, with major investments in AI and cloud computing." },
  { symbol: "AMZN", name: "Amazon.com Inc.", description: "E-commerce and cloud computing giant, also known for AWS, Prime, and Alexa." },
  { symbol: "NVDA", name: "NVIDIA Corp.", description: "Designs GPUs widely used in gaming, data centers, and AI model training." },
  { symbol: "META", name: "Meta Platforms Inc.", description: "Owns Facebook, Instagram, and WhatsApp, and is investing heavily in AI and virtual/augmented reality." },
  { symbol: "TSLA", name: "Tesla Inc.", description: "Electric vehicle manufacturer that also develops energy storage and autonomous driving technology." },
  { symbol: "BRK.B", name: "Berkshire Hathaway Inc.", description: "Diversified holding company led by Warren Buffett, with stakes in insurance, railroads, and consumer brands." },
  { symbol: "JPM", name: "JPMorgan Chase & Co.", description: "One of the largest banks in the US, offering consumer banking, investment banking, and asset management." },
  { symbol: "V", name: "Visa Inc.", description: "Operates one of the world's largest electronic payment networks." },
  { symbol: "UNH", name: "UnitedHealth Group Inc.", description: "Health insurance and healthcare services company, one of the largest in the US." },
  { symbol: "JNJ", name: "Johnson & Johnson", description: "Healthcare company spanning pharmaceuticals, medical devices, and consumer health products." },
  { symbol: "WMT", name: "Walmart Inc.", description: "The world's largest retailer by revenue, operating supercenters and a growing e-commerce business." },
  { symbol: "MA", name: "Mastercard Inc.", description: "Global payments technology company that processes electronic transactions between banks and merchants." },
  { symbol: "PG", name: "Procter & Gamble Co.", description: "Consumer goods company behind brands like Tide, Pampers, and Gillette." },
  { symbol: "HD", name: "Home Depot Inc.", description: "The largest home improvement retailer in the US, serving both DIY customers and contractors." },
  { symbol: "DIS", name: "Walt Disney Co.", description: "Entertainment company spanning film studios, theme parks, and streaming through Disney+." },
  { symbol: "NFLX", name: "Netflix Inc.", description: "Subscription streaming service offering movies, TV shows, and original productions worldwide." },
  { symbol: "BAC", name: "Bank of America Corp.", description: "One of the largest banks in the US, offering consumer, commercial, and investment banking services." },
  { symbol: "XOM", name: "Exxon Mobil Corp.", description: "Major oil and gas company involved in exploration, production, and refining worldwide." },
  { symbol: "PFE", name: "Pfizer Inc.", description: "Pharmaceutical company developing vaccines and treatments across multiple therapeutic areas." },
  { symbol: "KO", name: "Coca-Cola Co.", description: "Beverage company known for Coca-Cola and a wide portfolio of soft drinks, juices, and water brands." },
  { symbol: "PEP", name: "PepsiCo Inc.", description: "Food and beverage company behind Pepsi, Lay's, Gatorade, and Quaker brands." },
  { symbol: "ADBE", name: "Adobe Inc.", description: "Software company known for Photoshop, Acrobat, and its Creative Cloud subscription suite." },
  { symbol: "CSCO", name: "Cisco Systems Inc.", description: "Networking hardware and software company that builds much of the internet's core infrastructure." },
  { symbol: "INTC", name: "Intel Corp.", description: "Semiconductor company that designs and manufactures computer processors and chips." },
  { symbol: "AMD", name: "Advanced Micro Devices Inc.", description: "Designs CPUs and GPUs, competing directly with Intel and NVIDIA in computing hardware." },
  { symbol: "CRM", name: "Salesforce Inc.", description: "Cloud-based customer relationship management (CRM) software provider for businesses." },
  { symbol: "NKE", name: "Nike Inc.", description: "Designs and markets athletic footwear, apparel, and equipment worldwide." },
  { symbol: "MCD", name: "McDonald's Corp.", description: "The world's largest fast-food restaurant chain by revenue, operating primarily through franchises." },
  { symbol: "T", name: "AT&T Inc.", description: "Telecommunications company providing wireless, broadband, and media services." },
  { symbol: "VZ", name: "Verizon Communications Inc.", description: "Major US telecommunications provider offering wireless and broadband services." },
  { symbol: "ABT", name: "Abbott Laboratories", description: "Healthcare company producing medical devices, diagnostics, and nutritional products." },
  { symbol: "COST", name: "Costco Wholesale Corp.", description: "Membership-based warehouse retailer selling bulk goods at discounted prices." },
  { symbol: "ORCL", name: "Oracle Corp.", description: "Enterprise software and cloud infrastructure company, known for its database products." },
  { symbol: "IBM", name: "IBM Corp.", description: "Enterprise technology company offering cloud computing, AI, and consulting services." },
  { symbol: "GS", name: "Goldman Sachs Group Inc.", description: "Global investment bank providing services in trading, asset management, and advisory." },
  { symbol: "UBER", name: "Uber Technologies Inc.", description: "Ride-hailing and delivery platform connecting riders, drivers, and couriers worldwide." },
  { symbol: "PYPL", name: "PayPal Holdings Inc.", description: "Digital payments platform enabling online money transfers between individuals and businesses." },
  { symbol: "SBUX", name: "Starbucks Corp.", description: "The world's largest coffeehouse chain, operating company-owned and licensed stores globally." },
];

// A small curated subset shown on the Dashboard by default,
// to keep API usage low on the homepage
export const WATCHED_STOCKS: StockInfo[] = ALL_STOCKS.filter((s) =>
  ["AAPL", "TSLA", "NVDA", "MSFT", "AMZN"].includes(s.symbol)
);