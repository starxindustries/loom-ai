import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { fetchAllSlugs, fetchPostBySlug } from "@/lib/blog"
import { markdownToHtml } from "@/lib/markdown"
import type { BlogPost } from "@/types/blog"

export const revalidate = 60

type PageProps = { params: { slug: string } }

export async function generateStaticParams() {
  // Build-time slug pre-rendering; if table is empty, it returns []
  const slugs = await fetchAllSlugs()
  return slugs.map((slug) => ({ slug }))
}

function toAbsolute(path: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  try {
    return new URL(path, base).toString()
  } catch {
    return `${base}${path.startsWith("/") ? "" : "/"}${path}`
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = await fetchPostBySlug(slug)
  if (!post) return { title: "Post not found", robots: { index: false } }

  const title = post.meta_title || post.title
  const description = post.meta_description ?? post.excerpt ?? undefined
  const url = `/blogs/${post.slug}`
  const imageUrl = post.og_image || post.cover_image || undefined
  const image = imageUrl
    ? [{ url: toAbsolute(imageUrl), width: 1200, height: 630, alt: post.title }]
    : undefined

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title,
      description,
      images: image,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image?.[0]?.url,
    },
  }
}

function ArticleJsonLd(post: BlogPost) {
  const jsonLd = post.json_ld || {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.meta_description ?? post.excerpt ?? undefined,
    datePublished: post.published_at ?? undefined,
    dateModified: post.updated_at ?? post.published_at ?? undefined,
    image: post.og_image ? toAbsolute(post.og_image) : post.cover_image ? toAbsolute(post.cover_image) : undefined,
    mainEntityOfPage: toAbsolute(`/blogs/${post.slug}`),
  }
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params
  const post = await fetchPostBySlug(slug)
  if (!post) return notFound()

  const html = post.content_html ?? (await markdownToHtml(post.content_mdx))

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 md:py-16">
      {ArticleJsonLd(post)}
      <article>
        <header className="mb-6">
          <p className="text-muted-foreground mb-2 text-xs">
            <Link href="/blogs" className="underline underline-offset-4">
              Blog
            </Link>
          </p>
          <h1 className="text-pretty text-2xl font-semibold leading-tight md:text-3xl">{post.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {post.published_at ? (
              <time dateTime={post.published_at}>
                {new Date(post.published_at).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </time>
            ) : null}
          </div>
        </header>

        {post.cover_image ? (
          <figure className="my-6 overflow-hidden rounded-lg bg-muted">
            <div className="relative aspect-[16/9] w-full">
              <Image
                src={post.cover_image || "/placeholder.svg"}
                alt={post.title}
                fill
                sizes="(max-width: 768px) 100vw, 768px"
                priority={false}
                className="object-cover"
              />
            </div>
            {post.excerpt ? <figcaption className="sr-only">{post.excerpt}</figcaption> : null}
          </figure>
        ) : null}

        <section
          className="prose prose-neutral max-w-none prose-headings:scroll-mt-24 prose-a:text-primary prose-img:rounded-lg"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </article>
    </main>
  )
}
