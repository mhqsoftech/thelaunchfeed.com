export interface PredefinedDirectory {
  id: string;
  name: string;
  url: string;
  description: string;
  category: "Curated Directory" | "Daily Launchpad" | "Indie Hacker" | "AI & SaaS";
  sampleEndpoint?: string;
}

export const PREDEFINED_DIRECTORIES: PredefinedDirectory[] = [
  {
    id: "startupfame",
    name: "Startup Fame",
    url: "https://startupfa.me",
    description: "Daily discovery launchpad for trending startups, SaaS tools, and maker projects (High Yield: 20+ leads/crawl).",
    category: "Daily Launchpad",
  },
  {
    id: "fazier",
    name: "Fazier",
    url: "https://fazier.com",
    description: "Launch platform and leaderboard for early-stage AI tools, software, and tech products (High Yield: 10+ leads/crawl).",
    category: "Daily Launchpad",
  },
  {
    id: "microlaunch",
    name: "Microlaunch",
    url: "https://microlaunch.net",
    description: "Launchpad for micro-startups, indie hackers, and solo founders with direct product pages.",
    category: "Indie Hacker",
  },
  {
    id: "tinylaunch",
    name: "TinyLaunch",
    url: "https://tinylaunch.com",
    description: "Minimalist launch directory for builders, developer tools, and indie products.",
    category: "Indie Hacker",
  },
  {
    id: "peerlist",
    name: "Peerlist Launchpad",
    url: "https://peerlist.io/launchpad",
    description: "Community-driven launchpad where developers and indie makers launch tech products.",
    category: "Daily Launchpad",
  },
  {
    id: "launchigniter",
    name: "LaunchIgniter",
    url: "https://launchigniter.com",
    description: "Curated launch platform for high-growth tech tools and startups.",
    category: "Daily Launchpad",
  },
  {
    id: "techcrunch_startups",
    name: "TechCrunch Startups Feed",
    url: "https://techcrunch.com/category/startups/feed/",
    description: "Official real-time RSS/Atom feed of newly launched tech startups and funding rounds.",
    category: "Curated Directory",
  },
  {
    id: "uneed",
    name: "Uneed.best",
    url: "https://www.uneed.best",
    description: "Curated daily directory of top new tools and software.",
    category: "Curated Directory",
  },
  {
    id: "producthunt",
    name: "Product Hunt Feed",
    url: "https://www.producthunt.com/feed",
    description: "Premier global tech product launch and daily discovery RSS/Atom feed.",
    category: "Daily Launchpad",
  },
  {
    id: "betalist",
    name: "BetaList",
    url: "https://betalist.com",
    description: "Early access platform showcasing pre-launch and newly launched startups.",
    category: "Curated Directory",
  },
  {
    id: "devhunt",
    name: "DevHunt",
    url: "https://devhunt.org",
    description: "Developer tools and open-source software launch directory.",
    category: "Daily Launchpad",
  },
  {
    id: "startupbase",
    name: "StartupBase",
    url: "https://startupbase.io",
    description: "Community for makers sharing and discussing early-stage startups.",
    category: "Indie Hacker",
  },
  {
    id: "futurepedia",
    name: "Futurepedia",
    url: "https://www.futurepedia.io",
    description: "The largest AI tools and AI applications directory.",
    category: "AI & SaaS",
  },
];

export interface AutoOutreachConfig {
  enabled: boolean;
  dailyLimit: number;
  autoSendOnCrawl: boolean;
  sendDelayMs: number;
  testEmailRecipient?: string;
}

export const DEFAULT_AUTO_CONFIG: AutoOutreachConfig = {
  enabled: false,
  dailyLimit: 50,
  autoSendOnCrawl: false,
  sendDelayMs: 1000,
  testEmailRecipient: "",
};

export interface CustomDirectory {
  id: string;
  name: string;
  url: string;
  description: string;
  category: "Curated Directory" | "Daily Launchpad" | "Indie Hacker" | "AI & SaaS";
  addedAt: string;
  isCustom?: boolean;
}

export interface AutoCrawlerConfig {
  enabled: boolean;
  scheduledTime: string; // e.g. "09:00"
  selectedDirectoryIds: string[]; // specific IDs or ["ALL"]
  lastRunAt: string | null;
  lastRunStatus?: "SUCCESS" | "PARTIAL" | "ERROR" | "IDLE";
  lastRunStats?: {
    directoriesScanned: number;
    totalLeadsFound: number;
    newLeadsSaved: number;
    timestamp: string;
  };
}

export const DEFAULT_AUTO_CRAWLER_CONFIG: AutoCrawlerConfig = {
  enabled: false,
  scheduledTime: "09:00",
  selectedDirectoryIds: ["ALL"],
  lastRunAt: null,
  lastRunStatus: "IDLE",
};

export interface ExtractedLead {
  name: string;
  email: string;
  organization: string;
  productUrl?: string;
  sourceDirectory: string;
  sourceUrl?: string;
  notes?: string;
}

export interface CrawlResult {
  sourceDirectory: string;
  sourceUrl: string;
  leadsFound: number;
  newLeadsSaved: number;
  existingLeadsUpdated: number;
  feedScanned?: boolean;
  feedItemsFound?: number;
  leads: ExtractedLead[];
}
