
export function App() {
  return (
    <div className="app-container">
      <header style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <span className="badge">MVP Monorepo</span>
        <h1 style={{ fontSize: '2rem', marginTop: '0.5rem' }}>WherezIt Storage Memory</h1>
        <p style={{ color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
          Catalog, locate, and remember your physical belongings.
        </p>
      </header>
      <main>
        <section className="card">
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>System Status</h2>
          <p style={{ color: 'var(--color-text-muted)' }}>
            Frontend app shell bootstrapped cleanly with React, TypeScript, and Vite.
          </p>
        </section>
      </main>
    </div>
  );
}

export default App;
