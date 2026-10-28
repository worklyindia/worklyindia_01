import PlatformCard from '@/components/social/PlatformCard';
import { toast } from 'sonner';
import {
  useGoogleUserConnections,
  type GoogleProduct,
} from '@/hooks/useGoogleUserConnections';

function GoogleGlyph({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ color }}>
      {children}
    </svg>
  );
}

const AdSenseLogo = (
  <GoogleGlyph color="#4285F4">
    <path d="M12 2.5 22 20H2L12 2.5Z" fill="currentColor" opacity="0.15" />
    <path d="M12 2.5 22 20H2L12 2.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M12 9.5 16.5 17.5h-9L12 9.5Z" fill="currentColor" />
  </GoogleGlyph>
);

const SearchConsoleLogo = (
  <GoogleGlyph color="#34A853">
    <circle cx="11" cy="11" r="6.2" stroke="currentColor" strokeWidth="1.8" />
    <path d="M15.6 15.6 21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M8.5 12.5v2m2.5-4.5v4.5m2.5-3v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </GoogleGlyph>
);

const AnalyticsLogo = (
  <GoogleGlyph color="#E37400">
    <rect x="3.5" y="13" width="4" height="7.5" rx="1.6" fill="currentColor" opacity="0.55" />
    <rect x="10" y="8.5" width="4" height="12" rx="1.6" fill="currentColor" opacity="0.75" />
    <rect x="16.5" y="3.5" width="4" height="17" rx="1.6" fill="currentColor" />
  </GoogleGlyph>
);

const DriveLogo = (
  <GoogleGlyph color="#1FA463">
    <path d="M9 3h6l6 10.5h-6L9 3Z" fill="#FFCF63" />
    <path d="M3 20.5 6 15h12l-3 5.5H3Z" fill="#4285F4" />
    <path d="M9 3 3 13.5 6 19l6-10.5L9 3Z" fill="#1FA463" />
  </GoogleGlyph>
);

interface ProductMeta {
  product: GoogleProduct;
  name: string;
  description: string;
  logo: React.ReactNode;
  brandColor: string;
}

const PRODUCTS: ProductMeta[] = [
  {
    product: 'adsense',
    name: 'Google AdSense',
    description: 'Connect AdSense so AI can track your earnings, RPM and top performing pages.',
    logo: AdSenseLogo,
    brandColor: '#4285F4',
  },
  {
    product: 'search_console',
    name: 'Google Search Console',
    description: 'Connect Search Console for AI insights on clicks, impressions, keywords and indexing.',
    logo: SearchConsoleLogo,
    brandColor: '#34A853',
  },
  {
    product: 'analytics',
    name: 'Google Analytics',
    description: 'Connect GA4 so AI can read users, sessions, events and revenue for your properties.',
    logo: AnalyticsLogo,
    brandColor: '#E37400',
  },
  {
    product: 'drive',
    name: 'Google Drive',
    description: 'Connect Drive so AI can read and save your resumes, documents and reports.',
    logo: DriveLogo,
    brandColor: '#1FA463',
  },
];

/** The four per-user Google integrations shown on the AI Connect page. */
export default function GoogleProductCards({ enabled }: { enabled: boolean }) {
  const { get, loading, busy, connect, disconnect, configured } = useGoogleUserConnections(enabled);

  const handleConnect = async (product: GoogleProduct, name: string) => {
    if (!enabled) {
      toast.error('Please log in first to connect ' + name);
      return;
    }
    try {
      await connect(product);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Could not connect ${name}`);
    }
  };

  const handleDisconnect = async (product: GoogleProduct, name: string) => {
    try {
      await disconnect(product);
      toast.success(`${name} disconnected`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Could not disconnect ${name}`);
    }
  };

  return (
    <>
      {PRODUCTS.map((meta) => {
        const conn = get(meta.product);
        const connected = !!conn && conn.status !== 'needs_reconnect';
        return (
          <PlatformCard
            key={meta.product}
            name={meta.name}
            description={meta.description}
            logo={meta.logo}
            connected={connected}
            connectedLabel="Connected"
            subLabel={connected ? conn?.google_email ?? null : null}
            onConnect={() => handleConnect(meta.product, meta.name)}
            onDisconnect={conn ? () => handleDisconnect(meta.product, meta.name) : undefined}
            loading={loading || busy === meta.product}
            brandColor={meta.brandColor}
          >
            {conn?.status === 'needs_reconnect' && (
              <p className="text-[11px] text-destructive">
                Your {meta.name} authorization expired. Please reconnect.
              </p>
            )}
            {!configured && (
              <p className="text-[11px] text-muted-foreground">
                Google sign-in is not configured yet for this app.
              </p>
            )}
          </PlatformCard>
        );
      })}
    </>
  );
}
