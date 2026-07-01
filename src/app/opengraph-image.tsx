import { ImageResponse } from "next/og";
import { SITE } from "@/lib/constants";

export const alt = `${SITE.name} — Dental Supplies & Equipment Online`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Branded default OG card (Primary Blue → Blue Dark) used for link previews on social & search.
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "linear-gradient(135deg, #2d3791 0%, #1d2460 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 88,
              height: 88,
              borderRadius: 20,
              background: "white",
              color: "#2d3791",
              fontSize: 34,
              fontWeight: 800,
            }}
          >
            R&R
          </div>
          <div style={{ fontSize: 34, fontWeight: 700 }}>Newtech Dental</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 62, fontWeight: 800, lineHeight: 1.1, maxWidth: 900 }}>
            Quality dental supplies, delivered nationwide.
          </div>
          <div style={{ fontSize: 30, color: "rgba(255,255,255,0.8)" }}>
            {`Consumables · Instruments · Equipment · ${SITE.domain}`}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
