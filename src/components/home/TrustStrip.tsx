import { Container } from "@/components/ui/Container";
import { NAV_ICONS } from "@/components/layout/NavIcons";
import { HOME_TRUST } from "@/lib/constants";

/**
 * The three-up band directly under the hero: what a clinic actually wants confirmed before it
 * browses — that the stock is genuine, that it ships to them, and that equipment doesn't arrive as
 * a box on the floor.
 */
export function TrustStrip() {
  return (
    <section className="border-b border-line bg-surface">
      <Container className="grid gap-8 py-8 md:grid-cols-3 lg:py-10">
        {HOME_TRUST.map((point) => {
          const Icon = NAV_ICONS[point.icon];
          return (
            <div key={point.title} className="flex gap-3.5">
              <Icon className="mt-0.5 h-6 w-6 shrink-0 text-brand-600" />
              <div>
                <h3 className="font-bold text-fg">{point.title}</h3>
                <p className="mt-1 text-sm text-muted">{point.body}</p>
              </div>
            </div>
          );
        })}
      </Container>
    </section>
  );
}
