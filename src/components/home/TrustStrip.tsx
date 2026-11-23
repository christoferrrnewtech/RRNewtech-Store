import { Container } from "@/components/ui/Container";
import { NAV_ICONS } from "@/components/layout/NavIcons";
import { HOME_TRUST } from "@/lib/constants";

/**
 * The three-up band directly under the hero: what a clinic actually wants confirmed before it
 * browses — that the stock is genuine, that it ships to them, and that equipment doesn't arrive as
 * a box on the floor.
 *
 * Phones only (below md): the points become cards in a horizontal scroller sized so two sit fully
 * in view and the third peeks in at the edge — the cut-off card is what tells the user the row
 * scrolls. The track bleeds to the screen edges (`-mx-4 px-4`) so cards slide out from under the
 * gutter rather than clipping at it. From md up every card style is reset and it's the original
 * three-column band on a white strip.
 */
export function TrustStrip() {
  return (
    <section className="md:border-b md:border-line md:bg-surface">
      <Container className="py-6 md:py-8 lg:py-10">
        <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 [-ms-overflow-style:none] [scrollbar-width:none] sm:-mx-6 sm:scroll-px-6 sm:px-6 md:mx-0 md:grid md:grid-cols-3 md:gap-8 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
          {HOME_TRUST.map((point) => {
            const Icon = NAV_ICONS[point.icon];
            return (
              <div
                key={point.title}
                className="flex w-[42%] shrink-0 snap-start flex-col gap-3 rounded-2xl border border-line bg-surface p-4 md:w-auto md:flex-row md:gap-3.5 md:rounded-none md:border-0 md:bg-transparent md:p-0"
              >
                <Icon className="h-6 w-6 shrink-0 text-brand-600 md:mt-0.5" />
                <div>
                  <h3 className="font-bold text-fg">{point.title}</h3>
                  <p className="mt-1 text-sm text-muted">{point.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
