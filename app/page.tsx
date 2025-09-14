import Link from "next/link";

export default function Home() {
  return (
    <div>
      <Link href="/protected">Protected</Link>
    </div>
  );
}
