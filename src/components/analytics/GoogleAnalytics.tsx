import Script from "next/script";
import { GA_ID } from "@/lib/analytics";

/**
 * Google Analytics 4 loader. Renders nothing when NEXT_PUBLIC_GA_ID is absent, so the
 * keyless build and local dev stay clean. Ecommerce events are fired from src/lib/analytics.ts.
 */
export function GoogleAnalytics() {
  if (!GA_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${GA_ID}');`}
      </Script>
    </>
  );
}
