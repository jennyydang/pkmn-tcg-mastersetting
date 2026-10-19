// Re-mounts on every navigation, so each page animates in (.page-enter in globals.css).
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
