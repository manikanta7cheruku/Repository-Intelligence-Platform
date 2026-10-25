import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page narrow">
      <h1 className="h1">Page not found</h1>
      <p className="lede">
        That address does not exist. Reports are kept in the browser that created them, so a shared
        link to a report will not open elsewhere.
      </p>
      <Link className="btn btn-primary" href="/">
        Back to start
      </Link>
    </div>
  );
}
