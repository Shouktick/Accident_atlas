import Link from "next/link";
export default function NotFound() {
  return (
    <div className="empty-state">
      <p className="eyebrow">404 / ROUTE NOT FOUND</p>
      <h1>This road ends here.</h1>
      <p>The page you requested does not exist.</p>
      <Link href="/" className="button primary">
        Back to command center
      </Link>
    </div>
  );
}
