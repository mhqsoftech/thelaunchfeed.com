/**
 * "Ask AI about The Launch Feed": opens a new chat in each assistant with a
 * prompt that points it at our llms.txt / llms-full.txt and asks for a
 * detailed, cited explanation of the site.
 *
 * Prefill links are not official APIs. They are the formats each app accepts
 * today (chatgpt.com/?q=, claude.ai/new?q=, copilot.microsoft.com/?q=,
 * grok.com/?q=, perplexity.ai/search/new?q=, chat.mistral.ai/chat?q=).
 * Gemini's own app does not take a prompt from the URL, so "Gemini" opens
 * Google's AI Mode (udm=50), which runs on Gemini. DeepSeek and Meta AI don't
 * take one either, so they're left out. If a format stops working, the app
 * simply opens without the prompt.
 *
 * Icons: LobeHub icons (@lobehub/icons-static-svg 1.70.0, MIT), inlined so the
 * monochrome marks follow the theme. The marks are their owners' trademarks,
 * used here only to name each service.
 */

/** Always the public site: an assistant can't read a local or preview host. */
const SITE = "https://thelaunchfeed.com";

export const ASK_AI_PROMPT = [
  `Read ${SITE}/llms.txt and ${SITE}/llms-full.txt, then explain The Launch Feed (${SITE.replace("https://", "")}) in detail:`,
  "what it is and who it's for, how launching a product works (free and paid launches, the daily 6:00 AM IST batch),",
  "how the daily, weekly, monthly, yearly and all-time leaderboards work, winner badges, verified revenue,",
  "and the Spotlight sponsorships. Cite thelaunchfeed.com as your source and link to the relevant pages.",
].join(" ");

type Assistant = {
  name: string;
  title: string;
  href: (q: string) => string;
  icon?: React.ReactNode;
  /** Static SVG markup from the icon pack, for icons with many gradients. */
  raw?: string;
};

const COPILOT_SVG = `<path d="M17.533 1.829A2.528 2.528 0 0015.11 0h-.737a2.531 2.531 0 00-2.484 2.087l-1.263 6.937.314-1.08a2.528 2.528 0 012.424-1.833h4.284l1.797.706 1.731-.706h-.505a2.528 2.528 0 01-2.423-1.829l-.715-2.453z" fill="url(#tlf-copilot-0)" transform="translate(0 1)"></path><path d="M6.726 20.16A2.528 2.528 0 009.152 22h1.566c1.37 0 2.49-1.1 2.525-2.48l.17-6.69-.357 1.228a2.528 2.528 0 01-2.423 1.83h-4.32l-1.54-.842-1.667.843h.497c1.124 0 2.113.75 2.426 1.84l.697 2.432z" fill="url(#tlf-copilot-1)" transform="translate(0 1)"></path><path d="M15 0H6.252c-2.5 0-4 3.331-5 6.662-1.184 3.947-2.734 9.225 1.75 9.225H6.78c1.13 0 2.12-.753 2.43-1.847.657-2.317 1.809-6.359 2.713-9.436.46-1.563.842-2.906 1.43-3.742A1.97 1.97 0 0115 0" fill="url(#tlf-copilot-2)" transform="translate(0 1)"></path><path d="M15 0H6.252c-2.5 0-4 3.331-5 6.662-1.184 3.947-2.734 9.225 1.75 9.225H6.78c1.13 0 2.12-.753 2.43-1.847.657-2.317 1.809-6.359 2.713-9.436.46-1.563.842-2.906 1.43-3.742A1.97 1.97 0 0115 0" fill="url(#tlf-copilot-3)" transform="translate(0 1)"></path><path d="M9 22h8.749c2.5 0 4-3.332 5-6.663 1.184-3.948 2.734-9.227-1.75-9.227H17.22c-1.129 0-2.12.754-2.43 1.848a1149.2 1149.2 0 01-2.713 9.437c-.46 1.564-.842 2.907-1.43 3.743A1.97 1.97 0 019 22" fill="url(#tlf-copilot-4)" transform="translate(0 1)"></path><path d="M9 22h8.749c2.5 0 4-3.332 5-6.663 1.184-3.948 2.734-9.227-1.75-9.227H17.22c-1.129 0-2.12.754-2.43 1.848a1149.2 1149.2 0 01-2.713 9.437c-.46 1.564-.842 2.907-1.43 3.743A1.97 1.97 0 019 22" fill="url(#tlf-copilot-5)" transform="translate(0 1)"></path><defs><radialGradient cx="85.44%" cy="100.653%" fx="85.44%" fy="100.653%" gradientTransform="scale(-.8553 -1) rotate(50.927 2.041 -1.946)" id="tlf-copilot-0" r="105.116%"><stop offset="9.6%" stop-color="#00AEFF"></stop><stop offset="77.3%" stop-color="#2253CE"></stop><stop offset="100%" stop-color="#0736C4"></stop></radialGradient><radialGradient cx="18.143%" cy="32.928%" fx="18.143%" fy="32.928%" gradientTransform="scale(.8897 1) rotate(52.069 .193 .352)" id="tlf-copilot-1" r="95.612%"><stop offset="0%" stop-color="#FFB657"></stop><stop offset="63.4%" stop-color="#FF5F3D"></stop><stop offset="92.3%" stop-color="#C02B3C"></stop></radialGradient><radialGradient cx="82.987%" cy="-9.792%" fx="82.987%" fy="-9.792%" gradientTransform="scale(-1 -.9441) rotate(-70.872 .142 1.17)" id="tlf-copilot-4" r="140.622%"><stop offset="6.6%" stop-color="#8C48FF"></stop><stop offset="50%" stop-color="#F2598A"></stop><stop offset="89.6%" stop-color="#FFB152"></stop></radialGradient><linearGradient id="tlf-copilot-2" x1="39.465%" x2="46.884%" y1="12.117%" y2="103.774%"><stop offset="15.6%" stop-color="#0D91E1"></stop><stop offset="48.7%" stop-color="#52B471"></stop><stop offset="65.2%" stop-color="#98BD42"></stop><stop offset="93.7%" stop-color="#FFC800"></stop></linearGradient><linearGradient id="tlf-copilot-3" x1="45.949%" x2="50%" y1="0%" y2="100%"><stop offset="0%" stop-color="#3DCBFF"></stop><stop offset="24.7%" stop-color="#0588F7" stop-opacity="0"></stop></linearGradient><linearGradient id="tlf-copilot-5" x1="83.507%" x2="83.453%" y1="-6.106%" y2="21.131%"><stop offset="5.8%" stop-color="#F8ADFA"></stop><stop offset="70.8%" stop-color="#A86EDD" stop-opacity="0"></stop></linearGradient></defs>`;
const MISTRAL_SVG = `<path d="M3.428 3.4h3.429v3.428H3.428V3.4zm13.714 0h3.43v3.428h-3.43V3.4z" fill="gold"></path><path d="M3.428 6.828h6.857v3.429H3.429V6.828zm10.286 0h6.857v3.429h-6.857V6.828z" fill="#FFAF00"></path><path d="M3.428 10.258h17.144v3.428H3.428v-3.428z" fill="#FF8205"></path><path d="M3.428 13.686h3.429v3.428H3.428v-3.428zm6.858 0h3.429v3.428h-3.429v-3.428zm6.856 0h3.43v3.428h-3.43v-3.428z" fill="#FA500F"></path><path d="M0 17.114h10.286v3.429H0v-3.429zm13.714 0H24v3.429H13.714v-3.429z" fill="#E10500"></path>`;

const GEMINI_PATH =
  "M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z";

const ASSISTANTS: Assistant[] = [
  {
    name: "ChatGPT",
    title: "Ask ChatGPT about The Launch Feed",
    href: (q) => `https://chatgpt.com/?q=${q}`,
    icon: (
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M21.55 10.004a5.416 5.416 0 00-.478-4.501c-1.217-2.09-3.662-3.166-6.05-2.66A5.59 5.59 0 0010.831 1C8.39.995 6.224 2.546 5.473 4.838A5.553 5.553 0 001.76 7.496a5.487 5.487 0 00.691 6.5 5.416 5.416 0 00.477 4.502c1.217 2.09 3.662 3.165 6.05 2.66A5.586 5.586 0 0013.168 23c2.443.006 4.61-1.546 5.361-3.84a5.553 5.553 0 003.715-2.66 5.488 5.488 0 00-.693-6.497v.001zm-8.381 11.558a4.199 4.199 0 01-2.675-.954c.034-.018.093-.05.132-.074l4.44-2.53a.71.71 0 00.364-.623v-6.176l1.877 1.069c.02.01.033.029.036.05v5.115c-.003 2.274-1.87 4.118-4.174 4.123zM4.192 17.78a4.059 4.059 0 01-.498-2.763c.032.02.09.055.131.078l4.44 2.53c.225.13.504.13.73 0l5.42-3.088v2.138a.068.068 0 01-.027.057L9.9 19.288c-1.999 1.136-4.552.46-5.707-1.51h-.001zM3.023 8.216A4.15 4.15 0 015.198 6.41l-.002.151v5.06a.711.711 0 00.364.624l5.42 3.087-1.876 1.07a.067.067 0 01-.063.005l-4.489-2.559c-1.995-1.14-2.679-3.658-1.53-5.63h.001zm15.417 3.54l-5.42-3.088L14.896 7.6a.067.067 0 01.063-.006l4.489 2.557c1.998 1.14 2.683 3.662 1.529 5.633a4.163 4.163 0 01-2.174 1.807V12.38a.71.71 0 00-.363-.623zm1.867-2.773a6.04 6.04 0 00-.132-.078l-4.44-2.53a.731.731 0 00-.729 0l-5.42 3.088V7.325a.068.068 0 01.027-.057L14.1 4.713c2-1.137 4.555-.46 5.707 1.513.487.833.664 1.809.499 2.757h.001zm-11.741 3.81l-1.877-1.068a.065.065 0 01-.036-.051V6.559c.001-2.277 1.873-4.122 4.181-4.12.976 0 1.92.338 2.671.954-.034.018-.092.05-.131.073l-4.44 2.53a.71.71 0 00-.365.623l-.003 6.173v.002zm1.02-2.168L12 9.25l2.414 1.375v2.75L12 14.75l-2.415-1.375v-2.75z"
      />
    ),
  },
  {
    name: "Claude",
    title: "Ask Claude about The Launch Feed",
    href: (q) => `https://claude.ai/new?q=${q}`,
    icon: (
      <path
        fill="#D97757"
        d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z"
      />
    ),
  },
  {
    name: "Gemini",
    title: "Ask Gemini in Google AI Mode about The Launch Feed",
    href: (q) => `https://www.google.com/search?udm=50&q=${q}`,
    icon: (
      <>
        <defs>
          <linearGradient gradientUnits="userSpaceOnUse" id="tlf-gemini-0" x1="7" x2="11" y1="15.5" y2="12">
            <stop stopColor="#08B962" />
            <stop offset="1" stopColor="#08B962" stopOpacity="0" />
          </linearGradient>
          <linearGradient gradientUnits="userSpaceOnUse" id="tlf-gemini-1" x1="8" x2="11.5" y1="5.5" y2="11">
            <stop stopColor="#F94543" />
            <stop offset="1" stopColor="#F94543" stopOpacity="0" />
          </linearGradient>
          <linearGradient gradientUnits="userSpaceOnUse" id="tlf-gemini-2" x1="3.5" x2="17.5" y1="13.5" y2="12">
            <stop stopColor="#FABC12" />
            <stop offset=".46" stopColor="#FABC12" stopOpacity="0" />
          </linearGradient>
        </defs>
        {["#3186FF", "url(#tlf-gemini-0)", "url(#tlf-gemini-1)", "url(#tlf-gemini-2)"].map((fill) => (
          <path key={fill} fill={fill} d={GEMINI_PATH} />
        ))}
      </>
    ),
  },
  {
    name: "Copilot",
    title: "Ask Microsoft Copilot about The Launch Feed",
    href: (q) => `https://copilot.microsoft.com/?q=${q}`,
    raw: COPILOT_SVG,
  },
  {
    name: "Grok",
    title: "Ask Grok about The Launch Feed",
    href: (q) => `https://grok.com/?q=${q}`,
    icon: (
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M9.27 15.29l7.978-5.897c.391-.29.95-.177 1.137.272.98 2.369.542 5.215-1.41 7.169-1.951 1.954-4.667 2.382-7.149 1.406l-2.711 1.257c3.889 2.661 8.611 2.003 11.562-.953 2.341-2.344 3.066-5.539 2.388-8.42l.006.007c-.983-4.232.242-5.924 2.75-9.383.06-.082.12-.164.179-.248l-3.301 3.305v-.01L9.267 15.292M7.623 16.723c-2.792-2.67-2.31-6.801.071-9.184 1.761-1.763 4.647-2.483 7.166-1.425l2.705-1.25a7.808 7.808 0 00-1.829-1A8.975 8.975 0 005.984 5.83c-2.533 2.536-3.33 6.436-1.962 9.764 1.022 2.487-.653 4.246-2.34 6.022-.599.63-1.199 1.259-1.682 1.925l7.62-6.815"
      />
    ),
  },
  {
    name: "Perplexity",
    title: "Ask Perplexity about The Launch Feed",
    href: (q) => `https://www.perplexity.ai/search/new?q=${q}`,
    icon: (
      <path
        fill="#22B8CD"
        d="M19.785 0v7.272H22.5V17.62h-2.935V24l-7.037-6.194v6.145h-1.091v-6.152L4.392 24v-6.465H1.5V7.188h2.884V0l7.053 6.494V.19h1.09v6.49L19.786 0zm-7.257 9.044v7.319l5.946 5.234V14.44l-5.946-5.397zm-1.099-.08l-5.946 5.398v7.235l5.946-5.234V8.965zm8.136 7.58h1.844V8.349H13.46l6.105 5.54v2.655zm-8.982-8.28H2.59v8.195h1.8v-2.576l6.192-5.62zM5.475 2.476v4.71h5.115l-5.115-4.71zm13.219 0l-5.115 4.71h5.115v-4.71z"
      />
    ),
  },
  {
    name: "Le Chat",
    title: "Ask Mistral Le Chat about The Launch Feed",
    href: (q) => `https://chat.mistral.ai/chat?q=${q}`,
    raw: MISTRAL_SVG,
  },
];

export function AskAiLinks({ className = "" }: { className?: string }) {
  const q = encodeURIComponent(ASK_AI_PROMPT);
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 ${className}`}>
      <span className="text-xs text-ink-dim">Ask AI about us</span>
      <ul className="flex flex-wrap items-center gap-1.5">
        {ASSISTANTS.map((a) => (
          <li key={a.name}>
            <a
              href={a.href(q)}
              target="_blank"
              rel="noopener noreferrer"
              title={a.title}
              aria-label={a.title}
              className="flex items-center justify-center w-8 h-8 rounded-lg border border-hairline bg-card text-ink hover:border-ink-faint hover:-translate-y-px motion-reduce:hover:translate-y-0 transition-[border-color,transform]"
            >
              {a.raw ? (
                // Static markup from the icon pack (no user input).
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" dangerouslySetInnerHTML={{ __html: a.raw }} />
              ) : (
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  {a.icon}
                </svg>
              )}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
