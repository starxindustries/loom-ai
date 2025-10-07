import type { Metadata } from "next"
import Link from "next/link"
import { fetchBlogList } from "@/lib/blog"
import { BlogCard } from "@/components/blogs/blog-card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Button } from "@/components/ui/button"

export const revalidate = 60

export const metadata: Metadata = {
  title: "Blog",
  description: "Latest articles, guides, and updates.",
  alternates: {
    canonical: "/blogs",
  },
  openGraph: {
    title: "Blog",
    description: "Latest articles, guides, and updates.",
    type: "website",
    url: "/blogs",
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog",
    description: "Latest articles, guides, and updates.",
  },
}

export default async function BlogPage() {
  const posts = await fetchBlogList(24, 0)

  if (!posts.length) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-10 md:py-16">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              {/* Simple placeholder icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="size-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h9l7 7v7a2 2 0 01-2 2z"
                />
              </svg>
            </EmptyMedia>
            <EmptyTitle>No posts yet</EmptyTitle>
            <EmptyDescription>
              We couldn’t find any blog posts. Connect your Supabase table named <code>blogs</code> and insert some
              rows, or set up your content pipeline.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link href="/" className="text-sm underline underline-offset-4">
              Go back home
            </Link>
          </EmptyContent>
        </Empty>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 md:py-16">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-pretty text-2xl font-semibold leading-tight md:text-3xl">Blog</h1>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">Latest articles, guides, and updates.</p>
        </div>
        <Link href="/" className="text-sm underline underline-offset-4">
          Home
        </Link>
      </header>

      <section aria-label="Articles">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <BlogCard key={p.id} post={p} />
          ))}
        </div>
      </section>

      {/* Optional load more in future; using ISR/SSG for now */}
      <div className="mt-10 flex justify-center">
        <Button asChild variant="secondary">
          <a href="/blogs">More soon</a>
        </Button>
      </div>
    </main>
  )
}
