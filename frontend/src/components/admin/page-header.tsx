// The admin console's shared furniture moved to `console.tsx`, next to the other
// pieces every page composes. This re-export stays so an import of the header
// alone keeps working.
export { AdminHeader } from "./console";
