export function Shell({ header, children }) {
  return (
    <div className="flex min-h-dvh flex-col">
      {header}
      <main className="flex-1">{children}</main>
    </div>
  )
}
