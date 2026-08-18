import "dotenv/config";
import { PrismaClient, ProductStatus, RankPeriod } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = (process.env.DATABASE_URL || "").replace(
  /([?&])sslmode=require\b/g,
  "$1sslmode=verify-full"
);
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

/* ──────────────────────────────────────────────────────────────────────────────
   CATEGORIES
────────────────────────────────────────────────────────────────────────────── */
const CATEGORIES = [
  { slug: "ai", name: "AI & Machine Learning" },
  { slug: "dev-tools", name: "Developer Tools" },
  { slug: "design", name: "Design" },
  { slug: "productivity", name: "Productivity" },
  { slug: "saas", name: "SaaS" },
  { slug: "mobile", name: "Mobile Apps" },
  { slug: "open-source", name: "Open Source" },
  { slug: "fintech", name: "Fintech" },
  { slug: "health", name: "Health & Fitness" },
  { slug: "education", name: "Education" },
];

/* ──────────────────────────────────────────────────────────────────────────────
   FOUNDERS / MAKERS (Realistic, Highly Detailed, Human-Written Profiles)
────────────────────────────────────────────────────────────────────────────── */
interface FounderData {
  username: string;
  name: string;
  title: string;
  email: string;
  bio: string;
  websiteUrl: string;
  twitterHandle: string;
  githubHandle: string;
  image: string;
}

const FOUNDERS: FounderData[] = [
  {
    username: "zenorocha",
    name: "Zeno Rocha",
    title: "Founder & CEO at Resend · Creator of Dracula Theme",
    email: "zeno@resend.com",
    bio: "Building Resend to revolutionize email developer experience. Before founding Resend, I spent over a decade building developer tools and frontend architectures, authoring '14 Habits of Highly Productive Developers' and creating the Dracula color theme used by over 5 million software engineers globally. Our mission is to make transactional and marketing email as effortless and type-safe as writing React components.",
    websiteUrl: "https://zenorocha.com",
    twitterHandle: "zenorocha",
    githubHandle: "zenorocha",
    image: "https://github.com/zenorocha.png",
  },
  {
    username: "steventey",
    name: "Steven Tey",
    title: "Founder & CEO of Dub.co · Ex-Vercel Developer Advocate",
    email: "steven@dub.co",
    bio: "Founder and CEO at Dub.co, building open-source link management and conversion telemetry for modern growth teams. Formerly Senior Developer Advocate at Vercel, helping developers master Next.js, Edge Computing, and web performance. Passionate about building blazingly fast, beautifully designed web primitives that respect user privacy and eliminate vendor lock-in.",
    websiteUrl: "https://steventey.com",
    twitterHandle: "steventey",
    githubHandle: "steven-tey",
    image: "https://github.com/steven-tey.png",
  },
  {
    username: "peer_rich",
    name: "Peer Richelsen",
    title: "Co-Founder & Co-CEO of Cal.com",
    email: "peer@cal.com",
    bio: "Co-Founder & Co-CEO of Cal.com (formerly Calendso), the open-source scheduling infrastructure for the internet. Believer in open startups, commercial open-source software (COSS), and distributed remote engineering. On a mission to save humanity 1 billion hours wasted on scheduling friction while maintaining complete data sovereignty.",
    websiteUrl: "https://peer.im",
    twitterHandle: "peer_rich",
    githubHandle: "peerrich",
    image: "https://unavatar.io/x/peer_rich",
  },
  {
    username: "shadcn",
    name: "shadcn",
    title: "Creator of shadcn/ui · Design Systems Engineer",
    email: "shadcn@ui.shadcn.com",
    bio: "Design systems engineer and creator of shadcn/ui. Dedicated to re-architecting how developers build web interfaces by prioritizing code ownership, accessible Radix primitives, and minimalist Tailwind design tokens. Obsessed with micro-interactions, responsive typography, and developer autonomy.",
    websiteUrl: "https://ui.shadcn.com",
    twitterHandle: "shadcn",
    githubHandle: "shadcn",
    image: "https://github.com/shadcn.png",
  },
  {
    username: "rauchg",
    name: "Guillermo Rauch",
    title: "CEO & Founder of Vercel · Creator of Next.js & Socket.io",
    email: "rauchg@vercel.com",
    bio: "CEO and Founder of Vercel. Creator of Next.js, Socket.io, and Mongoose. Dedicated to making the web faster, more accessible, and easier to scale through serverless edge compute, generative UI systems like v0, and frontend cloud infrastructure. Author of Guillermo's Law: 'If you want to make something popular, make it fast.'",
    websiteUrl: "https://rauchg.com",
    twitterHandle: "rauchg",
    githubHandle: "rauchg",
    image: "https://github.com/rauchg.png",
  },
  {
    username: "michaeltruell",
    name: "Michael Truell",
    title: "Co-Founder & CEO at Cursor (Anysphere)",
    email: "michael@cursor.com",
    bio: "Co-founder and CEO of Anysphere building Cursor, the AI-first code editor. Researched deep learning and systems at MIT. Focused on building developer environments where engineers can orchestrate high-level architectures with multi-file Composer agents while AI manages AST mutations and predictive line-level edits in real-time.",
    websiteUrl: "https://cursor.com",
    twitterHandle: "michael_truell",
    githubHandle: "truell20",
    image: "https://github.com/truell20.png",
  },
  {
    username: "aravindsrinivas",
    name: "Aravind Srinivas",
    title: "Co-Founder & CEO of Perplexity AI · Ex-OpenAI / DeepMind",
    email: "aravind@perplexity.ai",
    bio: "Co-founder and CEO of Perplexity AI, building the world's most transparent conversational answer engine. Previously research scientist at OpenAI, DeepMind, and UC Berkeley specializing in deep reinforcement learning, diffusion models, and transformer architectures. Committed to turning the internet into an interactive, verifiable knowledge oracle.",
    websiteUrl: "https://perplexity.ai",
    twitterHandle: "AravSrinivas",
    githubHandle: "AravindSrinivas",
    image: "https://unavatar.io/twitter/AravSrinivas",
  },
  {
    username: "nikitashamgunov",
    name: "Nikita Shamgunov",
    title: "CEO & Co-Founder of Neon · Ex-MemSQL CEO",
    email: "nikita@neon.tech",
    bio: "CEO and Co-founder of Neon, pioneering serverless PostgreSQL with architectural separation of storage and compute. Former founder and CEO of SingleStore (MemSQL) and database engine architect at Microsoft SQL Server. Passionate about building instant cloud branching, point-in-time recovery, and serverless scalability for data infrastructure.",
    websiteUrl: "https://neon.tech",
    twitterHandle: "nikitashamgunov",
    githubHandle: "nikitashamgunov",
    image: "https://unavatar.io/twitter/nikitashamgunov",
  },
  {
    username: "kiwicopple",
    name: "Paul Copplestone",
    title: "Co-Founder & CEO at Supabase",
    email: "paul@supabase.com",
    bio: "Co-founder and CEO of Supabase, the open-source Firebase alternative built on PostgreSQL. Deeply committed to open-source database tooling, real-time replication, and developer ergonomics. Believes that Postgres is the most durable computing foundation ever created and software should run on open standards.",
    websiteUrl: "https://supabase.com",
    twitterHandle: "kiwicopple",
    githubHandle: "kiwicopple",
    image: "https://github.com/kiwicopple.png",
  },
  {
    username: "dylanfield",
    name: "Dylan Field",
    title: "Co-Founder & CEO of Figma",
    email: "dylan@figma.com",
    bio: "Co-founder and CEO of Figma, the collaborative web platform connecting designers and engineers. Thiel Fellow and Brown University alumni. Believes in democratizing software design through in-browser WebAssembly rendering, interactive FigJam whiteboards, and seamless code-to-design Dev Mode handoffs.",
    websiteUrl: "https://figma.com",
    twitterHandle: "zoink",
    githubHandle: "zoink",
    image: "https://avatars.githubusercontent.com/u/10623745?v=4",
  },
  {
    username: "karrisaarinen",
    name: "Karri Saarinen",
    title: "Co-Founder & CEO of Linear · Ex-Principal Designer at Airbnb",
    email: "karri@linear.app",
    bio: "Co-founder and CEO of Linear, crafting high-performance issue tracking and product planning tools for modern software teams. Formerly Principal Designer at Airbnb where I created the company's first universal design system. Passionate about craftsmanship, keyboard-driven productivity, and local-first software architectures.",
    websiteUrl: "https://linear.app",
    twitterHandle: "karrisaarinen",
    githubHandle: "karrisaarinen",
    image: "https://unavatar.io/x/karrisaarinen",
  },
  {
    username: "thomaspaulmann",
    name: "Thomas Paul Mann",
    title: "Co-Founder & CEO at Raycast · Ex-Facebook Tech Lead",
    email: "thomas@raycast.com",
    bio: "Co-founder and CEO of Raycast, building the lightning-fast, extendable desktop launcher for macOS and Windows. Former Tech Lead at Facebook. On a mission to keep developers in their keyboard flow state by unifying clipboard history, window management, AI commands, and third-party extensions into a sub-10ms interface.",
    websiteUrl: "https://raycast.com",
    twitterHandle: "thomaspaulmann",
    githubHandle: "thomaspaulmann",
    image: "https://github.com/thomaspaulmann.png",
  },
  {
    username: "ivanzhao",
    name: "Ivan Zhao",
    title: "Co-Founder & CEO of Notion",
    email: "ivan@notion.so",
    bio: "Co-founder and CEO of Notion, building the connected workspace for docs, wikis, and relational databases. Deeply inspired by computing pioneers Douglas Engelbart, Ted Nelson, and Alan Kay. Committed to creating modular software tools that empower every human to shape their own computing environments without writing code.",
    websiteUrl: "https://notion.so",
    twitterHandle: "ivanhzhao",
    githubHandle: "ivanzhao",
    image: "https://unavatar.io/twitter/ivanhzhao",
  },
  {
    username: "birkjernstrom",
    name: "Birk Jernström",
    title: "Founder & CEO of Polar.sh",
    email: "birk@polar.sh",
    bio: "Founder and CEO of Polar.sh, building the modern Merchant of Record and monetization engine for open-source maintainers and developer tool creators. Dedicated to solving international sales tax compliance, digital license key provisioning, and automated bounty distribution for the global open source community.",
    websiteUrl: "https://polar.sh",
    twitterHandle: "birkjernstrom",
    githubHandle: "birk",
    image: "https://github.com/birk.png",
  },
  {
    username: "antonosika",
    name: "Anton Osika",
    title: "Co-Founder & CEO of Lovable · Ex-CERN Physicist",
    email: "anton@lovable.dev",
    bio: "Co-founder and CEO of Lovable, building the autonomous AI software engineer that turns natural language into production full-stack web applications. Physicist by training with previous research at CERN and deep tech leadership across Scandinavia. Dedicated to lowering the barrier of software creation for the next 100 million makers.",
    websiteUrl: "https://lovable.dev",
    twitterHandle: "antonosika",
    githubHandle: "antonosika",
    image: "https://github.com/antonosika.png",
  },
  {
    username: "amjadmasad",
    name: "Amjad Masad",
    title: "Co-Founder & CEO at Replit · Ex-Facebook Engineer",
    email: "amjad@replit.com",
    bio: "Co-founder and CEO of Replit, bringing the next billion software creators online with AI-assisted in-browser development environments and zero-config cloud deployments. Formerly software engineer at Facebook and Codecademy founding engineer. Passionate about computer science education and distributed compute.",
    websiteUrl: "https://amjad.blog",
    twitterHandle: "amasad",
    githubHandle: "amasad",
    image: "https://github.com/amasad.png",
  },
  {
    username: "tylerdenk",
    name: "Tyler Denk",
    title: "Co-Founder & CEO of beehiiv · Ex-Morning Brew Tech Lead",
    email: "tyler@beehiiv.com",
    bio: "Co-founder and CEO of beehiiv, the publishing and monetization platform built by newsletter people for creators and digital publishers. Formerly Senior Product Manager and second engineering hire at Morning Brew where I architected custom newsletter growth and referral infrastructure. Passionate about media economics and subscriber retention.",
    websiteUrl: "https://beehiiv.com",
    twitterHandle: "denk_tweets",
    githubHandle: "tylerdenk",
    image: "https://unavatar.io/twitter/denk_tweets",
  },
  {
    username: "vjeux",
    name: "Christopher Chedeau (vjeux)",
    title: "Co-Creator of Excalidraw, Prettier & React Native",
    email: "vjeux@excalidraw.com",
    bio: "Front-end engineering addict, open-source maintainer, and creator of Excalidraw, Prettier code formatter, and the React Native layout engine. Former engineering lead at Meta. Dedicated to building delightful developer tools, virtual canvas whiteboards, and frictionless user experiences for millions of engineers.",
    websiteUrl: "https://blog.vjeux.com",
    twitterHandle: "vjeux",
    githubHandle: "vjeux",
    image: "https://github.com/vjeux.png",
  },
  {
    username: "darioamodei",
    name: "Dario Amodei",
    title: "Co-Founder & CEO of Anthropic · AI Safety Scientist",
    email: "dario@anthropic.com",
    bio: "Co-founder and CEO of Anthropic. AI research scientist leading the development of Claude, Constitutional AI, and next-generation frontier reasoning systems. Formerly VP of Research at OpenAI leading GPT-2 and GPT-3 projects, and researcher at Google Brain and Stanford University. Focused on building safe, steerable, and reliable artificial intelligence.",
    websiteUrl: "https://anthropic.com",
    twitterHandle: "AnthropicAI",
    githubHandle: "anthropic",
    image: "https://unavatar.io/anthropic.com",
  },
  {
    username: "jameshawkins",
    name: "James Hawkins",
    title: "Co-Founder & CEO at PostHog",
    email: "james@posthog.com",
    bio: "Co-founder and CEO of PostHog, the open-source product OS combining product analytics, session replay, feature flags, A/B experiments, surveys, and data warehouse sync into a single developer platform. Passionate about transparent company building, fully remote engineering teams, and helping engineers build successful products.",
    websiteUrl: "https://posthog.com",
    twitterHandle: "james404",
    githubHandle: "jamesefhawkins",
    image: "https://github.com/jamesefhawkins.png",
  },
  {
    username: "willahmed",
    name: "Will Ahmed",
    title: "Founder & CEO of WHOOP",
    email: "will@whoop.com",
    bio: "Founder and CEO of WHOOP, unlocking human potential through 24/7 continuous biometric tracking of heart rate variability, cardiovascular strain, and sleep architecture. Harvard captain and sports biometrics pioneer. Dedicated to helping elite athletes, executives, and high performers optimize physiological recovery and daily stamina.",
    websiteUrl: "https://whoop.com",
    twitterHandle: "willahmed",
    githubHandle: "whoop",
    image: "https://unavatar.io/twitter/willahmed",
  },
  {
    username: "ryanflighty",
    name: "Ryan Jones",
    title: "Founder & CEO at Flighty · Apple Design Award Winner",
    email: "ryan@flightyapp.com",
    bio: "Founder and CEO of Flighty, the award-winning live flight tracking app with FAA disruption forecasting, pilot radar telemetry, and iOS Live Activities. Former weather radar engineer and Apple Design Award winner. Dedicated to bringing military-grade aviation intelligence and beautiful mobile design to modern air travelers.",
    websiteUrl: "https://flightyapp.com",
    twitterHandle: "ryanjones",
    githubHandle: "ryanjones",
    image: "https://unavatar.io/twitter/ryanjones",
  },
  {
    username: "emanuelestoppa",
    name: "Emanuele Stoppa",
    title: "Lead Maintainer & Creator of Biome (BiomeJS)",
    email: "emanuele@biomejs.dev",
    bio: "Lead maintainer and creator of Biome (BiomeJS), the high-performance Rust-powered toolchain for formatting and linting TypeScript, JavaScript, JSX, and CSS. Committed to building blazing-fast developer tooling that runs in milliseconds, reduces CI overhead, and simplifies web development stacks globally.",
    websiteUrl: "https://biomejs.dev",
    twitterHandle: "ematipico",
    githubHandle: "ematipico",
    image: "https://github.com/ematipico.png",
  },
  {
    username: "tonyholdstock",
    name: "Tony Holdstock-Brown",
    title: "Co-Founder & CEO at Inngest",
    email: "tony@inngest.com",
    bio: "Co-founder and CEO of Inngest, building durable execution, serverless background job queues, and event-driven step functions for modern engineering teams. Passionate about distributed systems resilience, removing queue operational overhead, and enabling developers to write resilient async workflows.",
    websiteUrl: "https://inngest.com",
    twitterHandle: "tonyhb",
    githubHandle: "tonyhb",
    image: "https://github.com/tonyhb.png",
  },
  {
    username: "betsegawtadele",
    name: "Betsegaw Tadele",
    title: "Creator of Better Auth · TypeScript Systems Architect",
    email: "betsegaw@better-auth.com",
    bio: "TypeScript systems architect and creator of Better Auth, the modular, type-safe authentication and session framework supporting Passkeys, Two-Factor Authentication, and Multi-Tenant Organizations. Focused on providing open-source, vendor-independent security primitives for modern web frameworks.",
    websiteUrl: "https://better-auth.com",
    twitterHandle: "better_auth",
    githubHandle: "betsegaw",
    image: "https://github.com/betsegaw.png",
  },
  {
    username: "jiholim",
    name: "Jiho Lim",
    title: "Co-Founder of Mobbin · Product Designer",
    email: "jiho@mobbin.com",
    bio: "Co-founder and Product Designer at Mobbin, the world's largest curated UI/UX design pattern archive. On a mission to help product designers, mobile engineers, and digital founders study real-world user flows, onboarding screens, and design patterns from top iOS, Android, and Web applications worldwide.",
    websiteUrl: "https://mobbin.com",
    twitterHandle: "mobbin",
    githubHandle: "mobbin",
    image: "https://unavatar.io/mobbin.com",
  },
];

/* ──────────────────────────────────────────────────────────────────────────────
   PRODUCT SEED DEFINITIONS WITH FULL 360° INTELLIGENCE SUITE DETAILS
────────────────────────────────────────────────────────────────────────────── */
interface ProductSeed {
  name: string;
  tagline: string;
  description: string;
  categorySlug: string;
  websiteUrl: string;
  logoUrl: string;
  founderUsername: string;
  tags: string[];
  launchHoursAgo: number;
  voteRange: [number, number];
  screenshots?: string[];
  videoUrl?: string;
  comments?: Array<{
    authorUsername: string;
    text: string;
  }>;
  details: {
    overviewPitch: string;
    features: string[];
    pricingTiers: Array<{ name: string; price: string; specs: string }>;
    techStack: string;
    infraHosting: string;
    apiUrl: string;
    securityStandards: string;
    targetAudience: string;
    originStory: string;
    makerThesis: string;
    latestVersion: string;
    latestChangelog: string;
    roadmapQ3: string;
    roadmapQ4: string;
    faqs: Array<{ q: string; a: string }>;
    supportEmail: string;
    githubUrl?: string;
  };
}

const PRODUCTS: ProductSeed[] = [
  // ── TODAY'S LAUNCHES (0.2 to 1.5 hours ago | 100-330 votes) ───────────────────
  {
    name: "Claude 3.5 Sonnet",
    tagline: "Frontier intelligence, unmatched coding capabilities & reasoning",
    description: "Claude 3.5 Sonnet raises the industry standard for intelligence and code generation. Powers complex multimodal analysis, artifact visualization, and sub-agent task orchestration.",
    categorySlug: "ai",
    websiteUrl: "https://claude.ai",
    logoUrl: "https://unavatar.io/anthropic.com",
    founderUsername: "darioamodei",
    tags: ["ai", "llm", "frontier", "developer-tools", "reasoning"],
    launchHoursAgo: 0.3,
    voteRange: [310, 335],
    screenshots: [
      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=1200&q=80",
    ],
    videoUrl: "https://www.youtube.com/watch?v=ugvHCXCOmm4",
    comments: [
      { authorUsername: "rauchg", text: "The reasoning benchmarks on coding and visual architecture breakdown are state of the art." },
      { authorUsername: "michaeltruell", text: "Claude 3.5 Sonnet is our primary model in Cursor Composer. The AST accuracy is remarkable." },
    ],
    details: {
      overviewPitch: "Software engineering and research teams need AI models that don't hallucinate during complex multi-step reasoning. Claude 3.5 Sonnet operates at twice the speed of Claude 3 Opus while outperforming competitive frontier models on graduate-level reasoning (GPQA), undergraduate knowledge (MMLU), and coding proficiency (HumanEval).\n\nBuilt with constitutional AI safety guardrails, Sonnet natively supports interactive Artifacts—allowing users to generate and render React UI components, vector SVGs, Mermaid architecture diagrams, and playable prototypes in real-time.",
      features: [
        "State-of-the-Art Coding Benchmarks: 92.0% on HumanEval with deep context awareness across large codebases",
        "Interactive Artifacts Workspace: Live sandbox execution for React components, SVGs, and interactive web tools",
        "200K Token Context Window: Ingest entire multi-package codebases, technical manuals, and financial reports in a single prompt",
        "Sub-Agent Tool Orchestration: Deterministic JSON schema calling for multi-step automated workflows",
        "Advanced Multimodal Computer Vision: Transcribes complex system flowcharts, wireframes, and UI mockups into clean code",
      ],
      pricingTiers: [
        { name: "Free Tier", price: "$0/mo", specs: "Standard Claude 3.5 Sonnet access, daily prompt limits, interactive web artifacts" },
        { name: "Claude Pro", price: "$20/mo", specs: "5x higher usage limits, priority capacity during peak hours, early access to new models" },
        { name: "Team & Enterprise", price: "$30/user/mo", specs: "Centralized billing, SSO/SAML, expanded 200K context, HIPAA compliance, no training guarantee" },
      ],
      techStack: "Python, PyTorch, JAX, Rust, WebAssembly, React 19, TypeScript, Ray Distributed Compute",
      infraHosting: "Anthropic Cloud Infrastructure + AWS Bedrock + Google Cloud Vertex AI",
      apiUrl: "https://api.anthropic.com/v1/messages",
      securityStandards: "SOC2 Type II Certified · HIPAA BAA Available · Zero Customer Data Training by Default · End-to-End TLS 1.3",
      targetAudience: "Full-Stack Software Engineers, ML Researchers, Product Architects, and Enterprise Engineering Organizations",
      originStory: "We founded Anthropic with a commitment to build reliable, steerable, and interpretable AI systems. Claude 3.5 Sonnet represents the culmination of our research into architectural efficiency—delivering unprecedented reasoning speed without compromising safety.",
      makerThesis: "AI should augment human agency, not replace critical thinking. Our focus is on predictable alignment, low latency, and deterministic tool execution.",
      latestVersion: "v3.5.2 (2026 Wave 2 Release)",
      latestChangelog: "• 2x inference throughput for code generation workloads\n• Artifacts live editing and direct GitHub export\n• Fine-grained token usage headers and structured output enforcement",
      roadmapQ3: "Custom tool chaining latency optimizations and local context caching",
      roadmapQ4: "Multi-modal audio reasoning and enterprise VPC zero-egress connectors",
      faqs: [
        { q: "How does Claude 3.5 Sonnet handle privacy for corporate codebases?", a: "Anthropic never trains commercial models on customer API inputs or Claude Team workspace data. All data is encrypted in transit and at rest." },
        { q: "Can I use Artifacts to prototype React applications?", a: "Yes. Artifacts creates a dedicated side-by-side execution window where Claude compiles and renders React, Tailwind CSS, and HTML5 applications live." },
      ],
      supportEmail: "support@anthropic.com",
    },
  },
  {
    name: "Cursor",
    tagline: "The AI-first code editor for hyper-productive engineers",
    description: "Cursor is a fork of VS Code built from the ground up for pair programming with powerful AI models. Features Composer multi-file editing, codebase indexing, instantaneous code edits, and context-aware diff review.",
    categorySlug: "ai",
    websiteUrl: "https://cursor.com",
    logoUrl: "https://unavatar.io/cursor.com",
    founderUsername: "michaeltruell",
    tags: ["ai", "developer-tools", "editor", "productivity", "typescript"],
    launchHoursAgo: 0.2,
    voteRange: [275, 298],
    screenshots: [
      "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1200&q=80",
    ],
    videoUrl: "https://www.youtube.com/watch?v=o7b_27c9Z74",
    comments: [
      { authorUsername: "zenorocha", text: "Cursor has completely altered our development cadence at Resend. Multi-file Composer feels like magic." },
      { authorUsername: "steventey", text: "The codebase-wide indexing and semantic refactoring saves hours every single sprint." },
    ],
    details: {
      overviewPitch: "Modern software engineering involves too much repetitive boilerplate, complex library migrations, and syntax lookup. Cursor is designed to feel like coding with a senior principal engineer who has read your entire repository.\n\nUnlike simple autocomplete plugins, Cursor indexes your entire workspace locally with vector embeddings, allowing you to ask semantic architectural questions, execute multi-file refactors in Composer, and auto-fix terminal compiler errors with one keystroke.",
      features: [
        "Composer Multi-File Generation: Scaffold entire features across backend, frontend, and database migrations in parallel",
        "Semantic Codebase Indexing: Local RAG architecture that indexes symbol graphs and commit histories",
        "Cursor Tab Next-Edit Prediction: Multi-line predictive edits that anticipate cursor movements and refactorings",
        "Terminal Auto-Debug: Instantly analyzes build failures and CLI errors with one-click patch application",
        "Full VS Code Compatibility: 1-click import for all VS Code extensions, keybindings, and theme settings",
      ],
      pricingTiers: [
        { name: "Hobby", price: "$0/mo", specs: "2,000 completions, 50 fast premium requests, full VS Code extension ecosystem" },
        { name: "Pro", price: "$20/mo", specs: "Unlimited completions, 500 fast premium requests/mo, unlimited slow requests, Composer mode" },
        { name: "Business", price: "$40/user/mo", specs: "Centralized billing, admin dashboard, privacy mode enforcement by default, SAML SSO" },
      ],
      techStack: "Electron, TypeScript, Rust, C++, Tree-sitter, SQLite, PyTorch, Anthropic Claude 3.5, OpenAI GPT-4o",
      infraHosting: "Fly.io + AWS us-east-1 + Cloudflare Edge Workers",
      apiUrl: "https://api.cursor.com/v1",
      securityStandards: "SOC2 Type II Certified · Privacy Mode (Zero Code Retention) · End-to-End Encrypted Sync",
      targetAudience: "Professional Software Engineers, Technical Founders, and Agile Engineering Teams",
      originStory: "We started Cursor because we realized that existing code editors were built for a world before LLMs. Bolting a chat window onto an editor isn't enough; the editor itself needs to be rewritten around AI-assisted AST manipulation.",
      makerThesis: "The future of programming is high-level orchestration paired with granular control. Engineers will specify architecture and intent while AI handles structural implementation.",
      latestVersion: "v0.45.8",
      latestChangelog: "• Composer Agent mode with autonomous lint check execution\n• 3x faster indexing for monorepos exceeding 500k LOC\n• Direct terminal diff approval with keyboard shortcuts",
      roadmapQ3: "Distributed cloud codebase indexing for 100M+ LOC enterprise repositories",
      roadmapQ4: "Autonomous pull-request generation and background test-suite fixer",
      faqs: [
        { q: "Does Cursor store my proprietary source code?", a: "When Privacy Mode is enabled (default for enterprise), your code is never saved on remote servers and is never used to train machine learning models." },
        { q: "Will my VS Code extensions and settings transfer over?", a: "Yes. On initial launch, Cursor imports all your installed extensions, keybindings, themes, and snippets with a single click." },
      ],
      supportEmail: "hi@cursor.com",
    },
  },
  {
    name: "Lovable",
    tagline: "The AI software engineer that builds full-stack apps in minutes",
    description: "Lovable turns natural language prompts and Figma sketches into live, production-grade web applications with database schema, auth, and automated deployments.",
    categorySlug: "ai",
    websiteUrl: "https://lovable.dev",
    logoUrl: "https://unavatar.io/lovable.dev",
    founderUsername: "antonosika",
    tags: ["ai", "low-code", "developer-tools", "full-stack", "react"],
    launchHoursAgo: 0.4,
    voteRange: [245, 268],
    screenshots: [
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
    ],
    comments: [
      { authorUsername: "amjadmasad", text: "Super impressed by how quickly non-technical makers are spinning up working SaaS MVPs." },
    ],
    details: {
      overviewPitch: "Building software from scratch takes weeks of setting up authentication, database migrations, styling tokens, and deployment pipelines. Lovable bridges the gap between vision and production by autonomously generating complete full-stack web applications from conversational prompts and design references.\n\nUnlike static website builders, Lovable writes clean, modular React and Tailwind code, configures backend database schemas on Supabase, and provisions GitHub repositories you 100% own.",
      features: [
        "Full-Stack Application Generation: Generates React frontend, Postgres schemas, auth flows, and CRUD operations",
        "Direct GitHub Bidirectional Sync: Full ownership of clean, readable TypeScript and Tailwind source code",
        "Integrated Supabase Database & Auth: Automatic backend provisioning with Row Level Security",
        "Instant Live Preview & Subdomain Hosting: Instant deployment with custom domain support and SSL",
        "Figma & Image-to-Code Converter: Transcribes wireframes and screenshot mockups into pixel-perfect layouts",
      ],
      pricingTiers: [
        { name: "Starter", price: "$0/mo", specs: "5 projects, daily AI generation credits, instant preview subdomains" },
        { name: "Pro Maker", price: "$29/mo", specs: "Unlimited projects, 500 generation credits/mo, custom domains, GitHub export" },
        { name: "Scale Agency", price: "$99/mo", specs: "Team collaboration, custom Supabase environments, priority AI model access" },
      ],
      techStack: "Next.js 16, React 19, TypeScript, Tailwind CSS, Supabase Postgres, OpenAI GPT-4o, Anthropic Claude 3.5",
      infraHosting: "Vercel + Supabase Cloud + AWS us-east-1",
      apiUrl: "https://api.lovable.dev/v1",
      securityStandards: "SOC2 Type II in Progress · Encrypted GitHub OAuth Token Storage · Supabase RLS Protected",
      targetAudience: "Indie Founders, Product Managers, Growth Hackers, and Digital Agencies shipping MVPs",
      originStory: "As engineers and researchers, we spent years writing the same authentication and CRUD boilerplate for new startup experiments. Lovable was born to automate the entire setup cycle so creators can focus on product-market fit.",
      makerThesis: "The future of software creation belongs to product thinkers who can orchestrate intelligent AI agents.",
      latestVersion: "v1.2.4",
      latestChangelog: "• Deep Supabase database schema visual editor\n• Component level prompt iteration and diff rollback\n• Automated SEO meta tags and sitemap generator",
      roadmapQ3: "Native Stripe checkout integrations and automated customer portal",
      roadmapQ4: "React Native mobile export and native iOS build generation",
      faqs: [
        { q: "Do I own the code generated by Lovable?", a: "Yes. Every line of code is pushed directly to your personal or organization GitHub repository under an MIT or proprietary license of your choice." },
        { q: "Can I edit the code manually in my own IDE?", a: "Yes. Because Lovable commits standard TypeScript and React code to GitHub, you can clone the repository and edit it in Cursor, VS Code, or WebStorm." },
      ],
      supportEmail: "team@lovable.dev",
    },
  },
  {
    name: "Resend",
    tagline: "Email for developers — built with React and modern APIs",
    description: "Resend is the email platform built for developers. Write transactional and marketing emails with React Email components, deliver with high deliverability, and monitor through real-time webhooks.",
    categorySlug: "dev-tools",
    websiteUrl: "https://resend.com",
    logoUrl: "https://unavatar.io/resend.com",
    founderUsername: "zenorocha",
    tags: ["email", "developer-tools", "react", "saas", "api"],
    launchHoursAgo: 0.5,
    voteRange: [225, 244],
    screenshots: [
      "https://images.unsplash.com/photo-1557200134-90327ee9fafa?auto=format&fit=crop&w=1200&q=80",
    ],
    videoUrl: "https://www.youtube.com/watch?v=R3fS6H9f9Zc",
    comments: [
      { authorUsername: "rauchg", text: "Resend is the new gold standard for transactional email developer experience." },
      { authorUsername: "steventey", text: "Migrated all Dub.co system emails in under 15 minutes. React Email is a joy to work with." },
    ],
    details: {
      overviewPitch: "Building and debugging transactional email has historically been one of the most painful parts of web development. Table-based HTML layouts, disparate deliverability dashboards, and brittle SMTP credentials slow engineering teams down.\n\nResend provides a modern developer-first email infrastructure. Write emails using standard React components with React Email, send via a lightning-fast REST API, verify custom domains in seconds with automatic DKIM/SPF DNS records, and track open/click telemetry through real-time webhooks.",
      features: [
        "React Email First-Class Integration: Build clean, responsive email templates using modern TypeScript and JSX",
        "Sub-100ms API Latency: Globally distributed SMTP relays and REST endpoints powered by edge routing",
        "Automated Domain Verification: 1-click DNS record provisioning with automatic DKIM, SPF, and DMARC checks",
        "Real-Time Event Webhooks: Webhook signatures for delivery, bounce, open, click, and complaint lifecycle events",
        "Audience & Broadcast Management: Send targeted product marketing emails with custom segmentation and unsubscribe groups",
      ],
      pricingTiers: [
        { name: "Free Starter", price: "$0/mo", specs: "3,000 emails/month, 100 emails/day limit, 1 verified domain, full API & React Email access" },
        { name: "Pro Plan", price: "$20/mo", specs: "50,000 emails/month, unlimited daily sends, dedicated IP add-on, unlimited custom domains" },
        { name: "Scale & Enterprise", price: "$100/mo+", specs: "Custom email volumes (10M+), dedicated IP pool, 99.99% SLA, custom SSO & priority support" },
      ],
      techStack: "Next.js 16, React 19, TypeScript, Rust, Go, PostgreSQL, Redis, Cloudflare Workers, Tailwind CSS",
      infraHosting: "AWS us-east-1 + Cloudflare Global Edge",
      apiUrl: "https://api.resend.com/v1",
      securityStandards: "SOC2 Type II · GDPR Compliant · HIPAA BAA Available · TLS 1.3 Strict Transport",
      targetAudience: "Full-Stack Web Developers, SaaS Founders, and Engineering Teams shipping customer notifications",
      originStory: "Having spent years wrestling with legacy email providers while building developer tools, I realized developers deserved the Stripe of email—a clean API, immaculate documentation, and React component primitives.",
      makerThesis: "Developer experience isn't just about good API docs; it's about removing cognitive load at every layer of the developer loop.",
      latestVersion: "v3.2.0",
      latestChangelog: "• Native batch email sending endpoint (up to 100 emails per API request)\n• Dynamic IP pool assignment for high-volume enterprise senders\n• Enhanced webhook replay and delivery simulation CLI",
      roadmapQ3: "Visual email editor syncing bidirectionally with React JSX code",
      roadmapQ4: "Automated bounce healing and reputation intelligence monitor",
      faqs: [
        { q: "Why should I use React Email instead of traditional HTML templates?", a: "React Email gives you full TypeScript type-checking, reusable design tokens, automatic HTML compilation compatible with 40+ email clients, and visual browser previews during development." },
        { q: "How fast is DNS domain verification on Resend?", a: "Most domains verify in under 60 seconds once DKIM and SPF records are added to your DNS provider (Cloudflare, Vercel, Route53, Namecheap)." },
      ],
      supportEmail: "support@resend.com",
    },
  },
  {
    name: "Dub.co",
    tagline: "The open-source link management platform for modern marketing",
    description: "Dub is the open-source link management tool that empowers modern marketing teams to create, share, and track branded short links with deep analytics, geo-targeting, and conversion insights.",
    categorySlug: "saas",
    websiteUrl: "https://dub.co",
    logoUrl: "https://unavatar.io/dub.co",
    founderUsername: "steventey",
    tags: ["analytics", "links", "marketing", "open-source", "edge"],
    launchHoursAgo: 0.6,
    voteRange: [205, 224],
    screenshots: [
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80",
    ],
    comments: [
      { authorUsername: "zenorocha", text: "We use Dub across all our product launch campaigns. The geo-analytics and API are incredible." },
      { authorUsername: "peer_rich", text: "Cleanest link infrastructure on the web. Proud to be early users." },
    ],
    details: {
      overviewPitch: "Short links are the most critical entry point for marketing campaigns, product launches, and social referral programs. Legacy shortening platforms charge exorbitant enterprise prices for basic click analytics while offering outdated interfaces and slow redirects.\n\nDub.co is the modern, open-source link infrastructure for the web. Featuring sub-50ms edge redirects via Cloudflare Workers, custom branded domains, deep geolocation and device analytics, QR code generation with custom logos, and a developer-first REST API.",
      features: [
        "Sub-50ms Global Edge Redirects: Distributed Cloudflare Workers and Upstash Redis for instant URL resolution",
        "Real-Time Geolocation & Device Analytics: 360° telemetry on referrers, cities, devices, browsers, and UTM campaign parameters",
        "Custom Branded Domains with Auto-SSL: Connect unlimited custom domains with automatic Let's Encrypt TLS provisioning",
        "Dynamic QR Code Studio: Generate vector SVG and PNG QR codes customized with brand colors and logos",
        "Programmatic Link API: Comprehensive TypeScript SDK and REST endpoints for programmatic link creation at scale",
      ],
      pricingTiers: [
        { name: "Free Tier", price: "$0/mo", specs: "25 links/month, 1,000 tracked clicks/mo, 1 custom domain, 30-day analytics retention" },
        { name: "Pro Plan", price: "$24/mo", specs: "1,000 links/month, 50,000 clicks/mo, 3 custom domains, 1-year analytics, custom QR logos" },
        { name: "Business", price: "$49/mo", specs: "5,000 links/month, 250,000 clicks/mo, 10 custom domains, unlimited retention, team collaboration" },
      ],
      techStack: "Next.js 16, TypeScript, Tailwind CSS, Tinybird, Upstash Redis, PostgreSQL, Prisma, Cloudflare Workers",
      infraHosting: "Vercel + Cloudflare Edge + Upstash Serverless",
      apiUrl: "https://api.dub.co/v1",
      securityStandards: "SOC2 Type II · GDPR Compliant · Cloudflare DDoS Protection · Strict CSP Headers",
      targetAudience: "Growth Marketers, Developer Advocates, Content Creators, and High-Traffic SaaS Platforms",
      originStory: "I built Dub because I was tired of paying $100s/mo for link shorteners that hadn't updated their UI in a decade. I wanted an open-source, high-performance solution that developers and marketers would genuinely love using.",
      makerThesis: "Every click contains valuable intent. Link infrastructure should be open, blindingly fast, and privacy-respecting.",
      latestVersion: "v2.8.0",
      latestChangelog: "• Conversion tracking webhooks via server-side pixel integrations\n• Password-protected and expiration-based temporary link vaults\n• Bulk CSV link import and automated UTM builder",
      roadmapQ3: "Smart device deep-linking (iOS Universal Links & Android App Links)",
      roadmapQ4: "Multi-variant A/B split testing redirects with automated conversion winner selection",
      faqs: [
        { q: "Can I self-host Dub on my own infrastructure?", a: "Yes. Dub is 100% open-source under AGPLv3. You can deploy it to Vercel, Supabase, and Upstash in under 10 minutes with our official guide." },
        { q: "How does Dub handle bot traffic and scrapers in analytics?", a: "Dub features intelligent user-agent filtering that automatically strips web crawlers, search bots, and scrapers so your click metrics reflect genuine human traffic." },
      ],
      supportEmail: "support@dub.co",
    },
  },
  {
    name: "Polar.sh",
    tagline: "Open source monetization platform for developers and creators",
    description: "Polar helps SaaS companies and open source maintainers monetize products, manage subscriptions, license software, handle VAT/sales tax worldwide, and reward contributors.",
    categorySlug: "fintech",
    websiteUrl: "https://polar.sh",
    logoUrl: "https://unavatar.io/polar.sh",
    founderUsername: "birkjernstrom",
    tags: ["monetization", "billing", "subscriptions", "fintech", "open-source"],
    launchHoursAgo: 0.7,
    voteRange: [190, 204],
    screenshots: [
      "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&q=80",
    ],
    comments: [
      { authorUsername: "vjeux", text: "The developer experience for funding open source projects and software subscriptions is stellar." },
    ],
    details: {
      overviewPitch: "Monetizing developer tools, digital downloads, and open source projects is bogged down by global sales tax compliance (Merchant of Record), recurring billing logic, and software license key management.\n\nPolar serves as your complete Merchant of Record and monetization engine. Collect payments globally, handle EU VAT and US state sales tax automatically, provision digital license keys and file downloads, and reward open-source contributors with automated bounty payouts.",
      features: [
        "Full Merchant of Record: Polar acts as the reseller, handling all global tax calculation, invoicing, and remittance",
        "Digital Product & SaaS Subscriptions: Sell one-off digital downloads, SaaS memberships, and Discord/GitHub sponsorships",
        "Automated Software License Keys: Built-in validation APIs for desktop apps, CLI tools, and private npm packages",
        "Open Source Issue Bounties: Fund GitHub issues and reward contributors seamlessly with automated split payouts",
        "Zero-Fee Open Source Tier: Lowest take-rate in the industry for open-source maintainers and indie creators",
      ],
      pricingTiers: [
        { name: "Open Source Tier", price: "4% + Stripe", specs: "Full Merchant of Record, automated VAT/tax, GitHub issue bounties, Discord/GitHub access" },
        { name: "Pro Plan", price: "4% + $0.40", specs: "Custom checkout domains, webhooks, license key validation APIs, priority payouts" },
        { name: "Enterprise Custom", price: "Volume Pricing", specs: "Dedicated account manager, custom invoicing, consolidated financial reporting, custom terms" },
      ],
      techStack: "FastAPI, Python, Next.js 16, TypeScript, Tailwind CSS, PostgreSQL, Redis, Stripe Connect",
      infraHosting: "Fly.io + AWS eu-central-1 + Cloudflare CDN",
      apiUrl: "https://api.polar.sh/v1",
      securityStandards: "PCI-DSS Level 1 Compliant · GDPR Compliant · Stripe Verified Partner · TLS 1.3",
      targetAudience: "Open Source Maintainers, Indie Hackers, CLI & Desktop App Creators, and Micro-SaaS Founders",
      originStory: "We founded Polar to create a sustainable financial ecosystem for open-source software. Maintainers shouldn't have to choose between writing great code and spending weeks configuring tax accounts across 40 countries.",
      makerThesis: "Software builders deserve frictionless commerce infrastructure tailored specifically to code, digital assets, and developer tools.",
      latestVersion: "v1.4.2",
      latestChangelog: "• Customer portal with self-serve subscription upgrading and invoice downloads\n• Webhook simulator and automated test checkout mode\n• Custom checkout page branding and dynamic discount codes",
      roadmapQ3: "Usage-based metered billing meters and tiered seat-based licenses",
      roadmapQ4: "Multi-currency localized pricing (EUR, GBP, JPY, CAD) with zero FX markup",
      faqs: [
        { q: "Do I have to file sales taxes and VAT returns myself?", a: "No. Because Polar operates as a Merchant of Record (MoR), Polar handles all international sales tax, VAT, and GST collection and filing on your behalf." },
        { q: "How quickly do funds hit my bank account?", a: "Payouts are transferred via Stripe Connect directly to your local bank account on a rolling 7-day or 14-day schedule depending on your country." },
      ],
      supportEmail: "support@polar.sh",
    },
  },
  {
    name: "v0 by Vercel",
    tagline: "Generative UI system — prompt to production React components",
    description: "v0 is a generative user interface system powered by AI. It generates copy-paste friendly React code using Tailwind CSS, shadcn/ui, and Radix primitives directly from natural language and design screenshots.",
    categorySlug: "ai",
    websiteUrl: "https://v0.dev",
    logoUrl: "https://unavatar.io/v0.dev",
    founderUsername: "rauchg",
    tags: ["ai", "react", "ui", "design-tools", "tailwind"],
    launchHoursAgo: 0.8,
    voteRange: [175, 189],
    screenshots: [
      "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=1200&q=80",
    ],
    comments: [
      { authorUsername: "shadcn", text: "The integration with shadcn/ui components and modern Tailwind styling makes prototyping lightning fast." },
    ],
    details: {
      overviewPitch: "Translating wireframes, product specs, and UI screenshots into clean, accessible React code is time-consuming. v0 creates full-stack React components using standard Tailwind CSS classes and shadcn/ui primitives directly from natural language prompts.\n\nDevelopers can iteratively refine individual elements, adjust layout hierarchies, inspect interactive live sandboxes, and copy clean JSX or install components directly via the shadcn CLI.",
      features: [
        "Prompt-to-React Generation: Produces clean, accessible JSX with Tailwind CSS and Radix UI primitives",
        "Direct shadcn CLI Integration: 1-click terminal installation into existing Next.js and Vite codebases",
        "Interactive Canvas & Visual Tweaker: Modify spacing, colors, and layout directly on live rendered components",
        "Image & Wireframe Uploads: Transcribes hand-drawn sketches and screenshot references into working code",
        "Figma Plugin Export: Seamless roundtrip syncing between Figma design files and React code sandboxes",
      ],
      pricingTiers: [
        { name: "Free Tier", price: "$0/mo", specs: "200 monthly generation credits, public generations, standard rendering queue" },
        { name: "Premium Plan", price: "$20/mo", specs: "5,000 monthly credits, private generations, priority model compute, team sharing" },
        { name: "Enterprise", price: "$50/user/mo", specs: "Custom company design tokens, SAML SSO, dedicated GPU capacity, team workspaces" },
      ],
      techStack: "Next.js 16, React 19, TypeScript, Tailwind CSS, WebAssembly, OpenAI GPT-4o, Anthropic Claude 3.5",
      infraHosting: "Vercel Edge Network + AWS us-east-1",
      apiUrl: "https://api.v0.dev/v1",
      securityStandards: "SOC2 Type II Certified · ISO 27001 · Enterprise SAML SSO · Strict Privacy Isolation",
      targetAudience: "Frontend Engineers, Product Designers, Design Engineers, and Full-Stack Founders",
      originStory: "At Vercel, we saw that the most tedious phase of development was translating Figma designs into code. v0 was created to make UI iteration as immediate and intuitive as conversation.",
      makerThesis: "Generative UI should never produce opaque black-box code; it should output copy-paste friendly code adhering to established design system tokens.",
      latestVersion: "v2.0.0",
      latestChangelog: "• Block-level editing with selective prompt repainting\n• Multi-page application routing prototypes\n• Dark/light mode automatic token generation",
      roadmapQ3: "Live database mock connector and state management hooks",
      roadmapQ4: "Native Figma token bidirectional synchronizer",
      faqs: [
        { q: "Can I use v0 components in commercial production apps?", a: "Yes. All code generated by v0 is completely owned by you and free to use in proprietary and commercial software." },
        { q: "How do I install a v0 component into my Next.js project?", a: "Run `npx shadcn@latest add <v0-url>` in your terminal to automatically import the component and dependencies into your project." },
      ],
      supportEmail: "support@v0.dev",
    },
  },
  {
    name: "Biome",
    tagline: "One toolchain for your web project — fast format & lint",
    description: "Biome is a performant toolchain for web projects aimed at providing formatting and linting for JavaScript, TypeScript, JSX, JSON, and CSS at Rust-native speed.",
    categorySlug: "dev-tools",
    websiteUrl: "https://biomejs.dev",
    logoUrl: "https://unavatar.io/biomejs.dev",
    founderUsername: "emanuelestoppa",
    tags: ["linter", "formatter", "rust", "developer-tools", "performance"],
    launchHoursAgo: 0.9,
    voteRange: [160, 174],
    comments: [
      { authorUsername: "shadcn", text: "Biome formatting is instantaneous. Replaced Prettier and ESLint across all our packages." },
    ],
    details: {
      overviewPitch: "Modern JavaScript and TypeScript tooling has grown bloated. Running separate tools for formatting (Prettier), linting (ESLint), and syntax transformation results in slow CI pipelines, configuration conflicts, and high memory usage.\n\nBiome is an all-in-one Rust-powered toolchain that formats and lints JavaScript, TypeScript, JSX, JSON, CSS, and GraphQL at 35x the speed of traditional tools. It features 97% compatibility with Prettier and zero-configuration setups.",
      features: [
        "35x Faster Than Prettier: Formats large enterprise codebases with hundreds of thousands of lines in milliseconds",
        "200+ Built-In Lint Rules: Catches syntax errors, performance bottlenecks, and security vulnerabilities out of the box",
        "First-Class TypeScript & JSX Support: Deep understanding of modern syntax including decorators and type imports",
        "Seamless Prettier Migration: 1-click CLI migration tool that imports existing prettier.json configurations",
        "Official IDE Extensions: Instant formatting and inline lint diagnostics for VS Code, Cursor, Neovim, and IntelliJ",
      ],
      pricingTiers: [
        { name: "Open Source Free", price: "$0 (MIT / Apache)", specs: "100% free and open-source for personal, commercial, and enterprise usage" },
        { name: "Biome Sponsor", price: "$10/mo", specs: "Support ongoing development on GitHub Sponsors / Open Collective" },
        { name: "Corporate Sponsor", price: "$250/mo+", specs: "Logo placement on biomejs.dev documentation, priority GitHub issue triaging" },
      ],
      techStack: "Rust, WebAssembly, Node.js, Tree-sitter, GitHub Actions",
      infraHosting: "Cloudflare Pages + GitHub Releases + crates.io",
      apiUrl: "https://biomejs.dev/internals/architecture/",
      securityStandards: "Memory-Safe Rust Engine · Zero External Network Telemetry · Cryptographically Signed Releases",
      targetAudience: "Full-Stack Developers, Monorepo Architects, DevOps Engineers, and Open Source Maintainers",
      originStory: "Following the discontinuation of Rome Tools, the community rallied to fork and create Biome as an independent, community-governed project dedicated to Rust-speed web tooling.",
      makerThesis: "Developer tooling should be fast enough to run synchronously on every keystroke and save action without lagging the editor.",
      latestVersion: "v1.9.4",
      latestChangelog: "• Enhanced CSS and SCSS formatting support\n• GraphQL linting and schema validation\n• 15% reduction in memory footprint on massive monorepos",
      roadmapQ3: "Integrated lightning-fast JavaScript/TypeScript bundler",
      roadmapQ4: "Type-aware linting rules powered by Rust-native type inference",
      faqs: [
        { q: "Is Biome a drop-in replacement for Prettier?", a: "Yes. Biome has over 97% compatibility with Prettier formatting output and runs significantly faster in editor and CI environments." },
        { q: "How do I add Biome to my project?", a: "Run `npm install --save-dev --save-exact @biomejs/biome` and initialize with `npx @biomejs/biome init`." },
      ],
      supportEmail: "contact@biomejs.dev",
      githubUrl: "https://github.com/biomejs/biome",
    },
  },
  {
    name: "Inngest",
    tagline: "Event-driven background queues and durable workflow engine",
    description: "Inngest provides reliable background job execution, step functions, cron scheduling, and rate limiting with zero infrastructure management for TypeScript and Python.",
    categorySlug: "dev-tools",
    websiteUrl: "https://inngest.com",
    logoUrl: "https://unavatar.io/inngest.com",
    founderUsername: "tonyholdstock",
    tags: ["background-jobs", "queues", "serverless", "developer-tools", "durable-execution"],
    launchHoursAgo: 1.0,
    voteRange: [148, 159],
    comments: [
      { authorUsername: "zenorocha", text: "Durable functions without configuring Redis queues is an absolute superpower." },
    ],
    details: {
      overviewPitch: "Setting up background workers typically requires provisioning Redis clusters, RabbitMQ instances, celery workers, and complex retry logic. When serverless functions time out after 60 seconds, multi-step AI workflows and batch processing fail unpredictably.\n\nInngest enables durable execution for modern applications. Write complex workflows with `step.run`, `step.sleep`, and `step.waitForEvent` directly inside standard Next.js, Remix, or Express API routes without managing queue servers.",
      features: [
        "Durable Multi-Step Execution: Functions automatically pause, resume, and retry individual steps upon failure",
        "Zero Infrastructure Setup: Connects via HTTP webhooks to your existing serverless functions (Vercel, AWS Lambda, Cloudflare)",
        "Flow Control & Concurrency: Built-in rate limiting, debouncing, batching, and per-user throttling",
        "Time-Travel Local Dev Server: Visual execution debugger with step replay, payload inspection, and mock events",
        "Event-Driven Architecture: Fan-out events to multiple background handlers with cryptographic signature validation",
      ],
      pricingTiers: [
        { name: "Free Tier", price: "$0/mo", specs: "25,000 step executions/mo, 10 concurrent runs, 7-day history retention, local dev server" },
        { name: "Growth Plan", price: "$75/mo", specs: "250,000 step executions/mo, 100 concurrent runs, 30-day retention, custom concurrency" },
        { name: "Enterprise", price: "$490/mo+", specs: "10M+ executions, 99.99% SLA, dedicated VPC connectors, custom SSO and audit logs" },
      ],
      techStack: "Go, TypeScript, Next.js, PostgreSQL, Redis, Apache Kafka, OpenTelemetry",
      infraHosting: "AWS us-east-1 + GCP us-central1 multi-region mesh",
      apiUrl: "https://api.inngest.com/v1",
      securityStandards: "SOC2 Type II Certified · HIPAA Compliant · HMAC-SHA256 Signed Payloads · TLS 1.3",
      targetAudience: "Backend Engineers, SaaS Founders building AI pipelines, and DevOps Architects",
      originStory: "We built Inngest after spending years repeatedly reinventing distributed background job infrastructure across multiple startups. We wanted durable execution to be as simple as writing standard async/await code.",
      makerThesis: "Background job execution should be decoupled from infrastructure management and handled via resilient event streams.",
      latestVersion: "v3.22.0",
      latestChangelog: "• Native AI streaming step functions with token-level pause/resume\n• Dynamic batch execution by event property\n• Enhanced OpenTelemetry tracing and Grafana dashboards",
      roadmapQ3: "Stateful human-in-the-loop approval workflows with interactive Slack webhooks",
      roadmapQ4: "Global edge dispatch routing with localized sub-second execution",
      faqs: [
        { q: "How does Inngest work on serverless platforms like Vercel?", a: "Inngest communicates with your API routes via HTTP webhooks. When a step completes or sleeps, Inngest saves state and re-invokes your endpoint when ready." },
        { q: "What happens if an individual step in my workflow fails?", a: "Inngest automatically retries only the failed step with exponential backoff, rather than restarting the entire multi-step workflow from the beginning." },
      ],
      supportEmail: "support@inngest.com",
      githubUrl: "https://github.com/inngest/inngest",
    },
  },
  {
    name: "Better Auth",
    tagline: "The most comprehensive authentication framework for TypeScript",
    description: "Better Auth is an open-source, framework-agnostic auth library supporting email/password, social OAuth, passkeys, 2FA, multi-session management, and organization plugins.",
    categorySlug: "open-source",
    websiteUrl: "https://better-auth.com",
    logoUrl: "https://unavatar.io/better-auth.com",
    founderUsername: "betsegawtadele",
    tags: ["auth", "typescript", "open-source", "security", "passkeys"],
    launchHoursAgo: 1.1,
    voteRange: [136, 147],
    comments: [
      { authorUsername: "steventey", text: "The cleanest plugin architecture for auth in the TypeScript ecosystem." },
    ],
    details: {
      overviewPitch: "Authentication in modern TypeScript applications is often divided between complex enterprise identity providers with steep monthly fees and outdated libraries that lack modern features like Passkeys, Two-Factor Authentication, and multi-tenant organization support.\n\nBetter Auth is a modular, type-safe authentication framework that puts you in complete control of your database and sessions. Built with native support for Prisma, Drizzle, and Kysely, it provides pre-built plugins for Passkeys, OAuth 2.0, Organization Workspaces, and Magic Links.",
      features: [
        "Complete Type-Safety: Auto-inferred TypeScript clients for React, Vue, Svelte, and vanilla JavaScript",
        "Extensive Plugin Ecosystem: 1-line integration for Passkeys, 2FA, Multi-Session, Organizations, and Rate Limiting",
        "Database Agnostic: Native adapters for Prisma ORM, Drizzle ORM, Kysely, and raw SQL databases",
        "Social OAuth & Enterprise SSO: Support for GitHub, Google, Apple, Discord, Twitter, and custom OIDC providers",
        "Self-Hosted Freedom: Zero third-party vendor lock-in, zero per-user active authentication pricing fees",
      ],
      pricingTiers: [
        { name: "Open Source Free", price: "$0 (MIT License)", specs: "Full access to core auth framework, all official plugins, self-hosted without limits" },
        { name: "Community Sponsor", price: "$15/mo", specs: "Support ongoing maintenance, access to sponsor Discord channel" },
        { name: "Enterprise Sponsor", price: "$200/mo+", specs: "Dedicated Slack channel, architectural reviews, priority bug fixes" },
      ],
      techStack: "TypeScript, Web Crypto API, Prisma, Drizzle, Next.js, React, Node.js",
      infraHosting: "Self-hosted on any Node.js, Bun, Cloudflare Workers, or Vercel environment",
      apiUrl: "https://better-auth.com/docs/api-reference",
      securityStandards: "OWASP Compliant · WebAuthn Level 3 · Constant-Time Password Hashing (Argon2 / Scrypt) · CSRF Protection",
      targetAudience: "TypeScript Developers, Indie Hackers, Full-Stack Architects, and Security Engineers",
      originStory: "We created Better Auth out of frustration with existing authentication libraries that felt brittle, lacked modern passkey support, or charged predatory active-user pricing.",
      makerThesis: "Authentication should be open-source, modular, type-safe, and run directly inside your application stack without external proxies.",
      latestVersion: "v1.3.30",
      latestChangelog: "• Native Passkey / WebAuthn biometric login support\n• Multi-organization role-based access control (RBAC) plugin\n• Session hijacking detection with IP/user-agent fingerprinting",
      roadmapQ3: "SAML SSO and enterprise directory sync (SCIM) plugin",
      roadmapQ4: "Zero-knowledge encryption for user metadata storage",
      faqs: [
        { q: "Can I use Better Auth with Next.js App Router?", a: "Yes. Better Auth has first-class support for Next.js App Router server actions, route handlers, and middleware." },
        { q: "How are passwords hashed and secured?", a: "Better Auth uses modern memory-hard hashing algorithms (Argon2id and Scrypt) with cryptographic salts and constant-time string comparisons." },
      ],
      supportEmail: "support@better-auth.com",
      githubUrl: "https://github.com/better-auth/better-auth",
    },
  },
  {
    name: "Perplexity",
    tagline: "Where knowledge begins — AI conversational answer engine",
    description: "Perplexity replaces traditional search with interactive conversational summaries backed by real-time citations, Pro Search reasoning, and structured multi-source research dossiers.",
    categorySlug: "ai",
    websiteUrl: "https://perplexity.ai",
    logoUrl: "https://unavatar.io/perplexity.ai?fallback=https://cdn.simpleicons.org/perplexity/20808D",
    founderUsername: "aravindsrinivas",
    tags: ["ai", "search", "research", "productivity", "knowledge"],
    launchHoursAgo: 1.2,
    voteRange: [125, 135],
    screenshots: [
      "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80",
    ],
    // Prior demo id (F0Gq2X8yU1Q) was removed from YouTube. Aravind Srinivas on
    // the Lex Fridman podcast (ep #434) is an evergreen Perplexity deep-dive.
    videoUrl: "https://www.youtube.com/watch?v=e-gwvmhyU7A",
    comments: [
      { authorUsername: "ivanzhao", text: "Perplexity Pro has replaced 90% of my default web queries. The citation accuracy is unbeatable." },
    ],
    details: {
      overviewPitch: "Traditional search engines are cluttered with sponsored links, SEO spam, and multi-page ad trackers. Finding a direct, accurate answer to a complex technical or academic question often requires opening dozens of browser tabs.\n\nPerplexity is an AI conversational answer engine that synthesizes live web knowledge into structured, clear answers with inline citations. Features Pro Search for iterative multi-step reasoning, file analysis, and deep research dossiers.",
      features: [
        "Live Web Grounding with Inline Citations: Every claim is supported by direct links to authoritative sources",
        "Pro Search Multi-Step Reasoning: Executes clarifying sub-queries and aggregates data across specialized domains",
        "File & Document Upload Analysis: Upload PDFs, CSVs, and code files for conversational synthesis and data extraction",
        "Collections & Shared Workspaces: Organize research threads into searchable folders with team collaboration",
        "Model Selector: Seamlessly switch between Claude 3.5 Sonnet, GPT-4o, and Sonar frontier models",
      ],
      pricingTiers: [
        { name: "Free Standard", price: "$0/mo", specs: "Unlimited standard quick search, 5 Pro searches per day, web & mobile app" },
        { name: "Perplexity Pro", price: "$20/mo", specs: "300+ Pro searches/day, Claude 3.5 Sonnet & GPT-4o selection, $5 monthly API credits" },
        { name: "Enterprise Pro", price: "$40/user/mo", specs: "SOC2 compliance, dedicated data privacy, admin console, SAML SSO, team collections" },
      ],
      techStack: "Python, PyTorch, C++, TensorRT-LLM, React 19, TypeScript, Tailwind CSS, Redis, Kubernetes",
      infraHosting: "CoreWeave Cloud + AWS us-east-1 + Cloudflare Edge",
      apiUrl: "https://api.perplexity.ai",
      securityStandards: "SOC2 Type II Certified · Zero Enterprise Data Training · End-to-End Encryption · HIPAA Available",
      targetAudience: "Researchers, Developers, Executives, Knowledge Workers, and Students",
      originStory: "We started Perplexity with the vision of making search interactive and truthful. By combining large language models with real-time web retrieval, we turn the internet into an interactive oracle.",
      makerThesis: "The future of search is conversational synthesis backed by transparent, verifiable citations.",
      latestVersion: "v4.1.0",
      latestChangelog: "• Deep Research mode: generates 10+ page comprehensive dossiers in minutes\n• Enhanced financial market data charts and real-time stock quotes\n• Voice search and conversational iOS widgets",
      roadmapQ3: "Local file system indexing and enterprise knowledge base connectors",
      roadmapQ4: "Autonomous task execution and browser agent orchestration",
      faqs: [
        { q: "How accurate are Perplexity answers?", a: "Perplexity answers are grounded directly in live web citations. Every factual assertion links to its source url for instant verification." },
        { q: "Can I upload private internal PDFs and documents?", a: "Yes. In Perplexity Pro and Enterprise, uploaded documents are parsed in memory and never used to train public models." },
      ],
      supportEmail: "support@perplexity.ai",
    },
  },
  {
    name: "Raycast",
    tagline: "Supercharged productivity launcher for macOS and Windows",
    description: "Raycast is an extendable launcher that lets you control your tools, manage clipboard history, run AI commands, query databases, and automate workflows in a keystroke.",
    categorySlug: "design",
    websiteUrl: "https://raycast.com",
    logoUrl: "https://unavatar.io/raycast.com",
    founderUsername: "thomaspaulmann",
    tags: ["macos", "launcher", "productivity", "ai", "developer-tools"],
    launchHoursAgo: 1.3,
    voteRange: [115, 124],
    comments: [
      { authorUsername: "rauchg", text: "Cannot use my Mac without Raycast. The extension ecosystem is incredible." },
    ],
    details: {
      overviewPitch: "Context switching between browser tabs, terminals, and desktop applications drains cognitive energy. Basic operating system launchers only search file names, forcing developers to click through menus to perform routine tasks.\n\nRaycast is a blazingly fast, extendable launcher that puts your entire software toolkit at your fingertips. Manage clipboard history, generate window management layouts, query GitHub PRs, run AI commands, and trigger custom scripts in milliseconds.",
      features: [
        "Blazing-Fast Native Performance: Built with Swift and Rust for sub-10ms instantaneous keystroke response",
        "Rich Extension Store: 1,500+ community extensions for GitHub, Linear, Jira, Spotify, Notion, and Vercel",
        "Raycast AI Built-In: Inline code generation, translation, text rewriting, and conversational chat",
        "Clipboard History & Snippet Expander: Encrypted searchable clipboard cache with dynamic keyword snippets",
        "Developer API (Node.js & React): Build custom extensions using React components and modern TypeScript APIs",
      ],
      pricingTiers: [
        { name: "Free Individual", price: "$0/mo", specs: "Unlimited core launcher, clipboard history, snippet expander, 1,500+ free extensions" },
        { name: "Raycast Pro", price: "$8/mo", specs: "Raycast AI (Claude 3.5 & GPT-4o), Cloud sync for settings/snippets, custom window themes" },
        { name: "Team Organization", price: "$12/user/mo", specs: "Shared team snippets, shared custom extensions, centralized billing, admin audit logs" },
      ],
      techStack: "Swift, Rust, TypeScript, React (Raycast API), Node.js, SQLite, Metal",
      infraHosting: "AWS us-east-1 + Cloudflare Workers",
      apiUrl: "https://developers.raycast.com",
      securityStandards: "Local-First Encryption (AES-256) · Apple Sandboxed · Zero Telemetry Keystroke Logging",
      targetAudience: "macOS & Windows Power Users, Software Engineers, Product Designers, and Remote Workers",
      originStory: "We built Raycast after feeling frustrated by how slow and fragmented desktop workflows had become. We wanted a tool that respected user attention and made developers 10x faster.",
      makerThesis: "Your keyboard is the fastest input mechanism ever created. Software should maximize keyboard navigation and eliminate context switching.",
      latestVersion: "v1.89.0",
      latestChangelog: "• Raycast for Windows public preview release\n• AI Chat with multi-model switching and image attachments\n• Floating action bar and quick terminal script launcher",
      roadmapQ3: "Universal extension marketplace syncing between macOS and Windows",
      roadmapQ4: "Local offline LLM execution via Apple Neural Engine",
      faqs: [
        { q: "Is Raycast free for personal use?", a: "Yes. All core launcher features, clipboard history, window management, and community extensions are completely free forever." },
        { q: "How difficult is it to build a custom Raycast extension?", a: "If you know React and TypeScript, you can build and publish a full extension in less than 30 minutes using our official CLI and UI components." },
      ],
      supportEmail: "feedback@raycast.com",
      githubUrl: "https://github.com/raycast/extensions",
    },
  },
  {
    name: "Cal.com",
    tagline: "The open source scheduling infrastructure for everyone",
    description: "Cal.com is the customizable scheduling platform. Connect calendars, automate bookings, embed scheduling widgets, and build custom workflows via open APIs and webhooks.",
    categorySlug: "saas",
    websiteUrl: "https://cal.com",
    logoUrl: "https://unavatar.io/cal.com",
    founderUsername: "peer_rich",
    tags: ["scheduling", "productivity", "open-source", "calendar", "saas"],
    launchHoursAgo: 1.4,
    voteRange: [105, 114],
    comments: [
      { authorUsername: "steventey", text: "Replaced Calendly enterprise with Cal.com self-hosted two years ago and never looked back." },
    ],
    details: {
      overviewPitch: "Commercial scheduling tools lock user data behind proprietary walled gardens, offer limited white-label branding, and restrict developer customization. Enterprise teams need scheduling that integrates deeply with internal CRM, telephony, and billing systems.\n\nCal.com is the open-source scheduling infrastructure. Featuring multi-calendar synchronization, round-robin team scheduling, automated routing forms, integrated Stripe payments, and modular App Store integrations with Zoom, Google Meet, and Salesforce.",
      features: [
        "Universal Multi-Calendar Sync: Sync Google Calendar, Apple iCloud, Outlook 365, and CalDAV simultaneously",
        "White-Label Embed & Custom Domains: Seamless React embed widgets with complete custom CSS theming",
        "Dynamic Routing Forms: Route qualified leads to specific account executives based on custom qualifying questions",
        "Paid Booking & Stripe Integration: Charge clients directly for consulting sessions and appointments",
        "100% Self-Hostable & Open Source: Deploy on your own servers with complete database ownership under AGPLv3",
      ],
      pricingTiers: [
        { name: "Free Individual", price: "$0/mo", specs: "Unlimited event types, unlimited bookings, Google/Outlook sync, video integrations" },
        { name: "Teams Plan", price: "$12/user/mo", specs: "Round-robin scheduling, team routing forms, collective booking, custom domain" },
        { name: "Enterprise & Platform", price: "$37/user/mo", specs: "SAML SSO, SCIM, HIPAA compliance, dedicated instance, custom API rate limits" },
      ],
      techStack: "Next.js 16, React 19, TypeScript, Tailwind CSS, Prisma ORM, PostgreSQL, Redis, Docker",
      infraHosting: "Vercel + AWS us-east-1 + Cloudflare CDN",
      apiUrl: "https://api.cal.com/v2",
      securityStandards: "SOC2 Type II Certified · HIPAA Compliant · GDPR Compliant · ISO 27001",
      targetAudience: "Sales Teams, Medical Practices, Recruiters, Consultants, and Enterprise Organizations",
      originStory: "We launched Cal.com (originally Calendso) because we believed scheduling is core internet infrastructure that deserves to be open-source and customizable for every platform.",
      makerThesis: "Time is the most valuable non-renewable asset. Scheduling software should be open, private, and frictionless.",
      latestVersion: "v4.6.0",
      latestChangelog: "• Cal AI: automated voice and email scheduling assistant\n• Multi-seat round-robin booking with CRM lead reassignment\n• Granular timezone auto-detection and buffer time controls",
      roadmapQ3: "Instant SMS booking confirmations and WhatsApp reminder bot",
      roadmapQ4: "Native mobile apps for iOS and Android with calendar widgets",
      faqs: [
        { q: "Can I self-host Cal.com for free?", a: "Yes. Cal.com is open-source and can be deployed with Docker, Railway, or on bare-metal servers for free." },
        { q: "Does Cal.com prevent double bookings across multiple calendars?", a: "Yes. Cal.com checks busy time across all connected work and personal calendars simultaneously in real-time." },
      ],
      supportEmail: "support@cal.com",
      githubUrl: "https://github.com/calcom/cal.com",
    },
  },
  {
    name: "Mobbin",
    tagline: "Discover real-world design inspiration from top web & mobile apps",
    description: "Mobbin is the world's largest UX & UI design library. Browse 300,000+ searchable screenshots, user flows, and interaction patterns from the best digital products.",
    categorySlug: "design",
    websiteUrl: "https://mobbin.com",
    logoUrl: "https://unavatar.io/mobbin.com",
    founderUsername: "jiholim",
    tags: ["design", "ui-ux", "inspiration", "mobile", "web"],
    launchHoursAgo: 1.5,
    voteRange: [95, 104],
    comments: [
      { authorUsername: "dylanfield", text: "The primary research destination for product designers before designing any flow." },
    ],
    details: {
      overviewPitch: "Product designers and product managers waste hours creating dummy accounts, taking manual screenshots, and piecing together user flows just to study how top apps design onboarding, paywalls, or settings screens.\n\nMobbin is the world's premier digital product design archive. With over 300,000 high-resolution, pixel-perfect screenshots and end-to-end user flows from iOS, Android, and Web apps, Mobbin lets teams filter by UI patterns, screen types, design elements, and industry sectors.",
      features: [
        "300,000+ Verified Screenshots: High-res recordings of real app states updated weekly across 1,000+ top apps",
        "End-to-End User Flow Mapping: Inspect entire user journeys (Onboarding, Checkout, Paywalls, Account Deletion)",
        "Granular UI Filter Taxonomy: Search by specific UI components (bottom sheets, carousels, date pickers, segmented controls)",
        "Figma Direct Copy-Paste: Copy screenshots and flow diagrams directly into Figma canvas with one click",
        "Team Design Boards: Create shared inspiration moodboards and design benchmark folders for project sprints",
      ],
      pricingTiers: [
        { name: "Free Explorer", price: "$0/mo", specs: "Browse latest 8 app screens, basic search filters, 1 custom collection board" },
        { name: "Pro Designer", price: "$10/mo", specs: "Unlimited access to all 300K+ screens, full user flow views, advanced UI filters, Figma export" },
        { name: "Team Organization", price: "$18/user/mo", specs: "Shared team boards, centralized billing, admin user management, priority request queue" },
      ],
      techStack: "Next.js, React, TypeScript, Tailwind CSS, PostgreSQL, AWS S3, CloudFront CDN, MeiliSearch",
      infraHosting: "Vercel + AWS us-east-1 + Cloudflare CDN",
      apiUrl: "https://mobbin.com",
      securityStandards: "SOC2 Compliant Cloud Architecture · Encrypted S3 Storage · Strict Copyright Fair-Use Compliance",
      targetAudience: "UI/UX Designers, Product Managers, Frontend Engineers, and Startup Founders",
      originStory: "We started Mobbin as a side project to save ourselves time during client design projects. Today, it has grown into the essential reference library for over 500,000 designers globally.",
      makerThesis: "Great design is iterative. Studying real-world interaction patterns leads to better user experiences and faster product cycles.",
      latestVersion: "v3.8.0",
      latestChangelog: "• Dedicated Web App design library with responsive desktop screens\n• Interactive video recording previews for complex micro-animations\n• Dark mode UI screen filter toggle",
      roadmapQ3: "Design token inspector and typography extraction tool",
      roadmapQ4: "AI semantic design search (e.g., 'find paywalls offering yearly discounts with trial toggles')",
      faqs: [
        { q: "How often is the Mobbin library updated?", a: "Our curation team captures and categorizes new app releases and redesigns every single week." },
        { q: "Can I export screens directly into Figma?", a: "Yes. With the Mobbin Figma plugin or web copy button, you can paste vector-accurate screenshot assets directly onto your Figma canvas." },
      ],
      supportEmail: "support@mobbin.com",
    },
  },

  // ── THIS WEEK'S LAUNCHES (2-6 days ago | 450-720 votes) ───────────────────
  {
    name: "shadcn/ui",
    tagline: "Beautifully designed components you can copy and paste into your apps",
    description: "shadcn/ui is not a component library. It's a collection of re-usable components that you can copy and paste into your apps. Built with Radix UI and Tailwind CSS for accessible customization.",
    categorySlug: "open-source",
    websiteUrl: "https://ui.shadcn.com",
    logoUrl: "https://unavatar.io/ui.shadcn.com",
    founderUsername: "shadcn",
    tags: ["react", "tailwind", "components", "open-source", "radix"],
    launchHoursAgo: 96,
    voteRange: [685, 725],
    screenshots: [
      "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=1200&q=80",
    ],
    comments: [
      { authorUsername: "rauchg", text: "shadcn completely redefined how developers think about component libraries and code ownership." },
      { authorUsername: "zenorocha", text: "Used shadcn/ui to build Resend's entire web interface. Flawless accessibility." },
    ],
    details: {
      overviewPitch: "Traditional npm component libraries lock you into restrictive styling abstractions, break when underlying dependencies upgrade, and make custom design modifications difficult.\n\nshadcn/ui changed the paradigm by giving you full ownership of your code. You copy and paste accessible, unstyled Radix primitives styled with Tailwind CSS directly into your own codebase using a CLI. Modify styles, tweak animations, and build your own custom design system without upstream constraints.",
      features: [
        "Direct Code Ownership: Components live in your project directory (`components/ui`), not in node_modules",
        "Radix UI Accessibility: Fully compliant with WAI-ARIA standards for keyboard navigation and screen readers",
        "Tailwind CSS Theming: Seamless CSS variable tokens for Dark, Light, High-Contrast, and custom color themes",
        "CLI Automated Installation: Install components with `npx shadcn@latest add <component-name>` in seconds",
        "Zero Framework Lock-In: Works across Next.js, Vite, Remix, Astro, Laravel, and TanStack Start",
      ],
      pricingTiers: [
        { name: "Open Source Free", price: "$0 (MIT License)", specs: "100% free and open-source for personal, commercial, and enterprise software" },
        { name: "GitHub Sponsor", price: "$10/mo", specs: "Support ongoing development of new components and blocks" },
        { name: "Corporate Sponsor", price: "$500/mo+", specs: "Featured sponsor placement on ui.shadcn.com, priority feedback" },
      ],
      techStack: "React 19, TypeScript, Tailwind CSS, Radix UI, Lucide Icons, Node.js CLI",
      infraHosting: "Vercel Edge Network + GitHub",
      apiUrl: "https://ui.shadcn.com/docs",
      securityStandards: "WAI-ARIA Level AAA Accessible · Zero Runtime Dependencies · MIT Licensed",
      targetAudience: "Frontend Engineers, Design Engineers, Full-Stack Developers, and Web Agencies",
      originStory: "I built shadcn/ui because I was tired of battling npm component library overrides on every client project. I wanted copy-pasteable building blocks where the developer owns every line of code.",
      makerThesis: "Component libraries should be open references, not black-box dependencies.",
      latestVersion: "v2.3.0",
      latestChangelog: "• Added Sidebar, Chart, and Command Palette 2.0 primitives\n• Full React 19 and Tailwind CSS v4 support\n• Dark/Light color palette visual theme generator",
      roadmapQ3: "Extended dashboard blocks and marketing hero templates",
      roadmapQ4: "Native React Native & Expo component primitives",
      faqs: [
        { q: "Is shadcn/ui an npm package?", a: "No. It is a collection of components that you copy into your project using the CLI or manual copy-paste." },
        { q: "Can I customize the styling of components?", a: "Yes. Because the component code lives in your repo, you can edit the Tailwind classes, JSX structure, and variants freely." },
      ],
      supportEmail: "shadcn@ui.shadcn.com",
      githubUrl: "https://github.com/shadcn-ui/ui",
    },
  },
  {
    name: "Supabase",
    tagline: "The open source Firebase alternative built on Postgres",
    description: "Supabase gives developers a dedicated Postgres database with authentication, instant REST/GraphQL APIs, real-time subscriptions, storage, and serverless edge functions.",
    categorySlug: "dev-tools",
    websiteUrl: "https://supabase.com",
    logoUrl: "https://unavatar.io/supabase.com",
    founderUsername: "kiwicopple",
    tags: ["open-source", "postgres", "auth", "backend", "database"],
    launchHoursAgo: 72,
    voteRange: [620, 660],
    screenshots: [
      "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80",
    ],
    comments: [
      { authorUsername: "shadcn", text: "Supabase + Next.js has become the default starter stack for every modern web project." },
    ],
    details: {
      overviewPitch: "Building a scalable backend requires stitching together separate database servers, authentication providers, storage buckets, and real-time WebSocket infrastructure. Proprietary NoSQL platforms like Firebase create vendor lock-in and complex query limitations.\n\nSupabase provides a complete open-source backend built on enterprise-grade PostgreSQL. Every project gets a full Postgres database with Row Level Security, instant auto-generated REST and GraphQL APIs, real-time subscriptions, file storage, and serverless Deno Edge Functions.",
      features: [
        "Full Dedicated PostgreSQL: Full SQL power, pgvector AI embeddings, PostGIS extensions, and custom triggers",
        "Row Level Security (RLS): Fine-grained database access rules executed directly at the Postgres engine level",
        "Instant Auto-Generated APIs: Fast RESTful endpoints generated automatically from your table schema",
        "Real-Time Database Listeners: Subscribe to database INSERT, UPDATE, and DELETE events via WebSockets",
        "Vector Embeddings with pgvector: Store, index, and query high-dimensional AI vector embeddings natively",
      ],
      pricingTiers: [
        { name: "Free Tier", price: "$0/mo", specs: "2 active projects, 500MB database, 1GB storage, 50,000 monthly active users" },
        { name: "Pro Plan", price: "$25/mo", specs: "8GB database, 100GB storage, 100,000 MAU, daily backups, 7-day log retention" },
        { name: "Team & Enterprise", price: "$599/mo+", specs: "SOC2 compliance, HIPAA BAA, custom compute instances, point-in-time recovery" },
      ],
      techStack: "PostgreSQL, Elixir, Go, TypeScript, Rust, Deno, Docker, Kong API Gateway",
      infraHosting: "AWS multi-region + Fly.io + Cloudflare CDN",
      apiUrl: "https://supabase.com/docs/reference/javascript/introduction",
      securityStandards: "SOC2 Type II Certified · HIPAA Compliant · ISO 27001 · AES-256 Storage Encryption",
      targetAudience: "Full-Stack Developers, AI Startup Founders, Enterprise Architects, and Mobile App Engineers",
      originStory: "We started Supabase to give developers the productivity of Firebase with the scalability, durability, and open-source freedom of PostgreSQL.",
      makerThesis: "Postgres is the ultimate foundation for all computing. Build on open standards, not proprietary clouds.",
      latestVersion: "v2.48.0",
      latestChangelog: "• Native pgvector 0.7 support with HNSW indexing\n• Automatic SSL certificate rotation and custom domains\n• Branching databases for GitHub Pull Request previews",
      roadmapQ3: "Distributed multi-region active-active read replicas",
      roadmapQ4: "Zero-egress local AI inference edge functions",
      faqs: [
        { q: "Is Supabase truly open-source?", a: "Yes. Every component of Supabase—from the dashboard to the auth engine—is 100% open source under Apache 2.0 and MIT licenses." },
        { q: "Can I run vector search queries for AI apps on Supabase?", a: "Yes. With the native `pgvector` extension enabled, you can execute cosine similarity and semantic search queries directly in SQL." },
      ],
      supportEmail: "support@supabase.io",
      githubUrl: "https://github.com/supabase/supabase",
    },
  },
  {
    name: "Linear",
    tagline: "The issue tracking tool built for high-performance software teams",
    description: "Linear helps streamline software projects, sprints, tasks, and roadmaps. Built with keyboard-first navigation, offline sync, real-time updates, and minimalist aesthetic design.",
    categorySlug: "design",
    websiteUrl: "https://linear.app",
    logoUrl: "https://unavatar.io/linear.app",
    founderUsername: "karrisaarinen",
    tags: ["project-management", "design", "productivity", "developer-tools", "linear"],
    launchHoursAgo: 120,
    voteRange: [565, 595],
    screenshots: [
      "https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=1200&q=80",
    ],
    comments: [
      { authorUsername: "zenorocha", text: "Linear's performance and design precision set the standard every SaaS tool should strive for." },
    ],
    details: {
      overviewPitch: "Legacy project management software (like Jira) is bogged down by complex configuration forms, sluggish page reloads, and clunky interfaces that software engineers resent using.\n\nLinear is purpose-built for modern product teams. Featuring sub-50ms sync, keyboard-first navigation, offline-first client architecture, automated Git PR links, and streamlined Cycles and Roadmaps that keep high-velocity engineering teams aligned.",
      features: [
        "Sub-50ms Real-Time Sync: Changes sync instantly across all clients with zero page refreshes",
        "Offline-First Architecture: Create, edit, and triage issues offline with automatic background reconciliation",
        "Keyboard-First Command Palette: Execute every action, assign issues, and switch views via keyboard shortcuts",
        "Deep GitHub & GitLab Automation: Auto-close issues on branch merge, sync PR review statuses, and link commits",
        "Linear Asks & Customer Support: Turn customer requests from Slack and Zendesk into actionable engineering tickets",
      ],
      pricingTiers: [
        { name: "Free Tier", price: "$0/mo", specs: "Unlimited members, up to 250 active issues, core cycles, GitHub integration" },
        { name: "Standard Plan", price: "$8/user/mo", specs: "Unlimited issues, unlimited file uploads, roadmaps, private teams, API access" },
        { name: "Plus & Enterprise", price: "$14/user/mo", specs: "SAML SSO, advanced audit logs, SLA guarantee, customer support integrations" },
      ],
      techStack: "TypeScript, React, Node.js, GraphQL, SQLite (IndexedDB Client), PostgreSQL, Redis",
      infraHosting: "AWS us-east-1 + Google Cloud + Cloudflare Global Edge",
      apiUrl: "https://developers.linear.app/docs/graphql/working-with-the-graphql-api",
      securityStandards: "SOC2 Type II Certified · GDPR Compliant · Single Sign-On (SAML/Okta) · TLS 1.3",
      targetAudience: "Engineering Teams, Product Managers, Fast-Growing Startups, and Tech Scaleups",
      originStory: "We built Linear because we believed that software tools should be as refined, fast, and delightful as the best consumer applications.",
      makerThesis: "Speed and craftsmanship are features. Tools that respect engineering time create better software outcomes.",
      latestVersion: "v2026.2",
      latestChangelog: "• Linear Insights: real-time engineering velocity and cycle analytics\n• Customer Request Tracker syncing directly with Slack Connect\n• Multi-initiative portfolio roadmap views",
      roadmapQ3: "Autonomous triage AI assistant with duplicate ticket detection",
      roadmapQ4: "Native tablet and desktop widget controls",
      faqs: [
        { q: "How does Linear sync data so quickly?", a: "Linear uses a local-first SQLite database running in the browser and native client, syncing mutations via a lightweight WebSocket protocol." },
        { q: "Can I migrate issues from Jira to Linear?", a: "Yes. Linear provides a 1-click Jira and GitHub Issues importer that preserves issue history, attachments, and labels." },
      ],
      supportEmail: "support@linear.app",
    },
  },

  // ── THIS MONTH & ALL-TIME CHAMPIONS ───────────────────────────────────────
  {
    name: "Figma",
    tagline: "Where teams design, prototype, and build software together",
    description: "Figma connects everyone in the software development process so teams can deliver products faster. From FigJam whiteboards to Dev Mode inspections and interactive vector prototypes.",
    categorySlug: "design",
    websiteUrl: "https://figma.com",
    logoUrl: "https://unavatar.io/figma.com",
    founderUsername: "dylanfield",
    tags: ["design", "collaboration", "ui-ux", "prototyping", "webassembly"],
    launchHoursAgo: 190,
    voteRange: [990, 1060],
    screenshots: [
      "https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?auto=format&fit=crop&w=1200&q=80",
    ],
    comments: [
      { authorUsername: "karrisaarinen", text: "The tool that transformed modern interface design and web collaboration." },
    ],
    details: {
      overviewPitch: "Before Figma, design files lived on local hard drives, creating painful versioning conflicts ('mockup_final_v2_FINAL.psd') and clunky developer handoffs.\n\nFigma brought design into the browser with multiplayer collaboration, WebAssembly-powered vector rendering, and Dev Mode. Today, millions of designers and engineers collaborate on a single shared canvas.",
      features: [
        "Multiplayer Real-Time Canvas: Collaborate with dozens of designers, PMs, and engineers in real-time",
        "WebAssembly Vector Rendering Engine: 60fps buttery-smooth canvas rendering for files with thousands of frames",
        "Dev Mode & Code Inspection: Inspect CSS, iOS SwiftUI, and Android Compose code tokens directly from designs",
        "Design Systems & Auto-Layout: Build flexible, responsive components with token variables and component properties",
        "FigJam Whiteboarding: Brainstorm, map user journeys, and host sprint retrospectives on an infinite canvas",
      ],
      pricingTiers: [
        { name: "Starter Free", price: "$0/mo", specs: "3 Figma and 3 FigJam files, unlimited personal drafts, full vector editing" },
        { name: "Figma Professional", price: "$12/editor/mo", specs: "Unlimited files, team libraries, advanced prototyping, audio conversations" },
        { name: "Organization & Enterprise", price: "$45/editor/mo", specs: "Design system analytics, branching & merging, SAML SSO, centralized workspace management" },
      ],
      techStack: "C++, WebAssembly, WebGL, TypeScript, React, Rust, PostgreSQL, Redis",
      infraHosting: "AWS us-east-1 + Cloudflare CDN",
      apiUrl: "https://www.figma.com/developers/api",
      securityStandards: "SOC2 Type II · ISO 27001 · SAML 2.0 SSO · Strict Role-Based Access Control",
      targetAudience: "Product Designers, Design Engineers, Product Managers, and Frontend Developers",
      originStory: "We believed that the web browser was powerful enough to run professional graphics software. By building our rendering engine in C++ and compiling to WebAssembly, we made real-time collaboration possible.",
      makerThesis: "Design is inherently collaborative. Unifying design and code on the web speeds up human progress.",
      latestVersion: "v124.0",
      latestChangelog: "• Figma AI: prompt-to-layout generator and automatic layer renaming\n• Dev Mode visual diff inspector and direct VS Code extension sync\n• Multi-variant variable binding for light/dark themes",
      roadmapQ3: "Interactive vector animation timeline editor",
      roadmapQ4: "Native code-to-design bidirectional syncing framework",
      faqs: [
        { q: "Can non-designers view and comment on Figma files for free?", a: "Yes. Viewers and commenters can inspect files, leave feedback, and export assets without paying for an editor license." },
        { q: "How does Dev Mode assist frontend engineers?", a: "Dev Mode translates design tokens into clean CSS, React Tailwind classes, SwiftUI, and Compose snippets with visual box model inspection." },
      ],
      supportEmail: "support@figma.com",
    },
  },
  {
    name: "Notion",
    tagline: "The connected workspace for notes, docs, wikis, and AI",
    description: "Notion combines notes, project management, document collaboration, and customized databases with built-in Notion AI to organize your personal and team knowledge.",
    categorySlug: "productivity",
    websiteUrl: "https://notion.so",
    logoUrl: "https://unavatar.io/notion.so",
    founderUsername: "ivanzhao",
    tags: ["workspace", "notes", "collaboration", "ai", "productivity"],
    launchHoursAgo: 1440,
    voteRange: [1480, 1620],
    screenshots: [
      "https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1200&q=80",
    ],
    comments: [
      { authorUsername: "dylanfield", text: "Every team wiki, roadmap, and design review at Figma lives inside Notion." },
    ],
    details: {
      overviewPitch: "Company knowledge is frequently scattered across disparate Google Docs, Confluence wikis, Trello boards, and Slack threads. Information goes stale quickly and onboarding new team members becomes chaotic.\n\nNotion is the all-in-one connected workspace. Combining flexible documents, relational databases, company wikis, and project boards with integrated Notion AI, Notion allows individuals and enterprises to build customized operational workflows.",
      features: [
        "Modular Block-Based Editor: Combine text, code blocks, tables, math equations, and video embeds seamlessly",
        "Relational Databases & Views: Visualize data as Kanban boards, calendars, Gantt timelines, galleries, and tables",
        "Integrated Notion AI: Summarize meeting notes, write initial drafts, search across company wikis, and autofill database properties",
        "Notion Sites & Instant Publishing: Publish web pages, blogs, and documentation directly to custom domains",
        "Extensive API & Template Gallery: Integrate with GitHub, Slack, Jira, and 10,000+ community templates",
      ],
      pricingTiers: [
        { name: "Free Tier", price: "$0/mo", specs: "Unlimited pages & blocks for individuals, 5MB file uploads, 7-day page history" },
        { name: "Plus Plan", price: "$10/user/mo", specs: "Unlimited blocks for teams, unlimited file uploads, 30-day page history, custom domains" },
        { name: "Business & Enterprise", price: "$15/user/mo+", specs: "SAML SSO, private teamspaces, advanced permission controls, 90-day history, audit logs" },
      ],
      techStack: "React, TypeScript, Kotlin, Swift, Rust, PostgreSQL, Redis, Elasticsearch",
      infraHosting: "AWS us-east-1 + Cloudflare Edge",
      apiUrl: "https://developers.notion.com",
      securityStandards: "SOC2 Type II Certified · HIPAA Available · GDPR Compliant · End-to-End Encryption at Rest",
      targetAudience: "Founders, Engineering Organizations, Product Teams, Writers, and Students",
      originStory: "We were inspired by computing pioneers like Douglas Engelbart and Alan Kay, who envisioned computers as bicycles for the mind. We built Notion to give non-programmers the power to shape their own software tools.",
      makerThesis: "Software should be malleable and adaptable to human thought, not rigid templates.",
      latestVersion: "v2.45.0",
      latestChangelog: "• Notion Calendar deep two-way Google Calendar integration\n• Notion AI Q&A across entire workspace databases\n• Custom database formula editor with full JavaScript syntax support",
      roadmapQ3: "Offline-first sync engine with conflict-free resolution",
      roadmapQ4: "Native automations with multi-step webhook triggers",
      faqs: [
        { q: "Can I use Notion for personal task management?", a: "Yes. Notion is completely free for individual note-taking, project tracking, and database creation." },
        { q: "How secure is company data inside Notion?", a: "Notion is SOC2 Type II certified, encrypts data in transit and at rest with TLS 1.3 and AES-256, and supports SAML SSO." },
      ],
      supportEmail: "team@makenotion.com",
    },
  },
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/* ──────────────────────────────────────────────────────────────────────────────
   MAIN SEED MIGRATION
────────────────────────────────────────────────────────────────────────────── */
async function main() {
  console.log("Starting database refresh with ultra-rich founder profiles and 360° product details...");

  // 1. Clean existing demo data (preserving admin users)
  console.log("Cleaning up previous products, submissions, votes, comments, and fake users...");
  
  await prisma.commentFlag.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.vote.deleteMany({});
  await prisma.rankSnapshot.deleteMany({});
  await prisma.revenueSnapshot.deleteMany({});
  await prisma.productRevenue.deleteMany({});
  await prisma.revenueConnection.deleteMany({});
  await prisma.featuredSlot.deleteMany({});
  await prisma.featuredPurchase.deleteMany({});
  await prisma.productMaker.deleteMany({});
  await prisma.submission.deleteMany({});
  await prisma.product.deleteMany({});
  
  // Delete non-admin fake users
  await prisma.session.deleteMany({
    where: {
      user: {
        email: { notIn: ["minhaj99mhq@gmail.com", "menajulhoque99@gmail.com"] },
      },
    },
  });
  await prisma.account.deleteMany({
    where: {
      user: {
        email: { notIn: ["minhaj99mhq@gmail.com", "menajulhoque99@gmail.com"] },
      },
    },
  });
  await prisma.user.deleteMany({
    where: {
      email: { notIn: ["minhaj99mhq@gmail.com", "menajulhoque99@gmail.com"] },
    },
  });

  // 2. Ensure Categories
  console.log("Seeding categories...");
  const categoryMap = new Map<string, string>();
  for (const cat of CATEGORIES) {
    const record = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name },
      create: { slug: cat.slug, name: cat.name },
    });
    categoryMap.set(cat.slug, record.id);
  }

  // 3. Create Real Founders
  console.log("Creating genuine founder profiles with real socials, bios, and titles...");
  const founderMap = new Map<string, string>(); // username -> userId

  for (const f of FOUNDERS) {
    const user = await prisma.user.upsert({
      where: { username: f.username },
      update: {
        name: f.name,
        title: f.title,
        email: f.email,
        bio: f.bio,
        websiteUrl: f.websiteUrl,
        twitterHandle: f.twitterHandle,
        githubHandle: f.githubHandle,
        image: f.image,
        isProfilePublic: true,
        showRevenuePublic: false,
        isSeed: true,
      },
      create: {
        username: f.username,
        name: f.name,
        title: f.title,
        email: f.email,
        bio: f.bio,
        websiteUrl: f.websiteUrl,
        twitterHandle: f.twitterHandle,
        githubHandle: f.githubHandle,
        image: f.image,
        isProfilePublic: true,
        showRevenuePublic: false,
        isSeed: true,
      },
    });
    founderMap.set(f.username, user.id);
  }

  // 4. Create Real Products with Full 360° Intelligence Suite details
  console.log("Creating real products with comprehensive human-written details and realistic votes...");
  const createdProducts: Array<{ id: string; slug: string; name: string; votes: number; launchedAt: Date }> = [];

  for (const p of PRODUCTS) {
    const categoryId = categoryMap.get(p.categorySlug) || null;
    const ownerId = founderMap.get(p.founderUsername) || founderMap.get("zenorocha")!;
    const slug = slugify(p.name);
    const voteCount = randomInt(p.voteRange[0], p.voteRange[1]);
    const launchedAt = new Date(Date.now() - p.launchHoursAgo * 3600 * 1000);

    const product = await prisma.product.create({
      data: {
        slug,
        name: p.name,
        tagline: p.tagline,
        description: p.description,
        websiteUrl: p.websiteUrl,
        logoUrl: p.logoUrl,
        categoryId,
        ownerId,
        status: ProductStatus.LIVE,
        launchedAt,
        voteCount,
        tags: p.tags,
        screenshots: p.screenshots ?? [],
        videoUrl: p.videoUrl ?? null,
        details: p.details as any,
      },
    });

    // Add Founder as Maker
    await prisma.productMaker.create({
      data: {
        productId: product.id,
        userId: ownerId,
        role: "founder",
      },
    });

    // Owner auto-vote
    await prisma.vote.create({
      data: {
        productId: product.id,
        userId: ownerId,
        weight: 1.0,
      },
    });

    // Add Comments
    if (p.comments && p.comments.length > 0) {
      for (const c of p.comments) {
        const commenterId = founderMap.get(c.authorUsername) || ownerId;
        await prisma.comment.create({
          data: {
            body: c.text,
            productId: product.id,
            userId: commenterId,
          },
        });
      }
      await prisma.product.update({
        where: { id: product.id },
        data: { commentCount: p.comments.length },
      });
    }

    createdProducts.push({
      id: product.id,
      slug: product.slug,
      name: product.name,
      votes: voteCount,
      launchedAt,
    });

    console.log(`✓ Created product "${p.name}" with full 360° details (${voteCount} votes)`);
  }

  // 5. Generate Initial Rank Snapshots
  console.log("Generating rank snapshots...");
  const sorted = [...createdProducts].sort((a, b) => b.votes - a.votes);
  for (let i = 0; i < sorted.length; i++) {
    const prod = sorted[i];
    await prisma.rankSnapshot.create({
      data: {
        productId: prod.id,
        period: RankPeriod.DAILY,
        periodKey: new Date().toISOString().slice(0, 10),
        rank: i + 1,
        score: prod.votes,
        voteCount: prod.votes,
      },
    });
  }

  console.log("Database successfully seeded with comprehensive founder profiles and product details!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
