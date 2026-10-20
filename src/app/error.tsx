"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="loading-page">
      <h2>We couldn’t load this view.</h2>
      <p>Check the database connection and try again.</p>
      <button className="btn btn-primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
