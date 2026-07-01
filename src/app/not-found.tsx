import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <Container className="flex flex-col items-center gap-5 py-24 text-center">
      <p className="text-sm font-semibold text-brand-600">404</p>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-fg">
        Page not found
      </h1>
      <p className="max-w-md text-muted">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <div className="flex gap-3">
        <LinkButton href="/">Go home</LinkButton>
        <LinkButton href="/" variant="secondary">Browse the shop</LinkButton>
      </div>
    </Container>
  );
}
