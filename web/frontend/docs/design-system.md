# BrowserBase UI Design System

This is the source of truth for BrowserBase frontend primitives.

## Brand Direction

- Tone: operational, precise, minimal visual noise.
- Surface model: light-first neutral surfaces with red accent actions.
- Density: compact controls and data-heavy layouts.

## Tokens

Use Tailwind tokens defined in `tailwind.config.js`.

### Colors

- Surfaces: `surface.primary`, `surface.secondary`, `surface.tertiary`, `surface.elevated`
- Text: `content.primary`, `content.secondary`, `content.tertiary`
- Borders: `border`, `border.secondary`
- Accent: `accent`, `accent.hover`, `accent.active`, `accent.muted`
- Status: `success`, `warning`, `error`

### Typography

- Sans: system UI stack (`font-sans`)
- Mono: `SF Mono`, `Fira Code`, `Consolas` (`font-mono`)
- Body: `text-sm`/`text-[15px]`
- Labels and metadata: `text-xs`

### Spacing and shape

- Inputs/buttons: 40px default height
- Card radius: `rounded-xl`
- Dense chip/badge radius: `rounded` or `rounded-full`

## Component Inventory

All components are in `src/components/ui` and exported from `src/components/ui/index.ts`.

- Layout: `AppShell`, `SidebarNav`, `PageHeader`
- Inputs: `Input`, `SearchInput`, `Select`, `Tabs`
- Actions: `Button`
- Data display: `Card`, `DataTable`, `StatTile`, `Badge`
- States: `EmptyState`, `LoadingState`, `ErrorState`
- Overlays: `Drawer`, `Modal`
- AI + governance: `AIAnswerBlock`, `DocCompletenessMeter`, `OwnershipPill`
- Lineage map: `LineageNodeCard`, `LineageEdgeLegend`

## Usage Rules

- Build pages from primitives first; avoid ad-hoc styling in routes.
- Do not hardcode hex/rgb values in JSX/TSX/CSS.
- Every object-level page should include owner and freshness context.
- AI-generated answers must include citations.

## Example

```tsx
import { AppShell, PageHeader, Card, Button, DataTable } from '@/components/ui';

export default function ExamplePage() {
  return (
    <AppShell>
      <PageHeader title="Object Explorer" subtitle="Trusted data objects" actions={<Button>New Object</Button>} />
      <Card className="mt-4 p-4">
        <DataTable columns={[{ key: 'name', header: 'Name' }]} rows={[{ name: 'dim_users' }]} />
      </Card>
    </AppShell>
  );
}
```
