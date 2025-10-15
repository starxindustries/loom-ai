import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { fetchAllSlugs, fetchPostBySlug } from "@/lib/blog"
import { markdownToHtml } from "@/lib/markdown"
import type { BlogPost } from "@/types/blog"
import { Breadcrumb } from "@/components/common/breadcrumb"

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
  // console.log("post", post)
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
    keywords: post.tags || [],
    authors: [{ name: "Loom AI Team" }],
    alternates: { canonical: toAbsolute(url) },
    openGraph: {
      type: "article",
      url: toAbsolute(url),
      title,
      description,
      images: image,
      publishedTime: post.published_at,
      modifiedTime: post.updated_at || post.published_at,
      authors: ["Loom AI Team"],
      tags: post.tags || [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image?.[0]?.url,
      creator: "@loomai",
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
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
    author: {
      "@type": "Organization",
      name: "Loom AI Team",
      url: toAbsolute("/")
    },
    publisher: {
      "@type": "Organization",
      name: "Loom AI",
      url: toAbsolute("/"),
      logo: {
        "@type": "ImageObject",
        url: toAbsolute("/logo.png")
      }
    },
    keywords: post.tags?.join(", ") || "",
    articleSection: "Technology",
    wordCount: post.content_mdx?.length || 0,
    inLanguage: "en-US",
    isPartOf: {
      "@type": "WebSite",
      name: "Loom AI Memory",
      url: toAbsolute("/")
    }
  }
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params
  const post = await fetchPostBySlug(slug)
  if (!post) return notFound()

  const html = post.content_html ?? (await markdownToHtml(post.content_mdx))

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 md:py-16">
      {ArticleJsonLd(post)}
      <article className="relative">
        {/* Decorative background elements */}
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-primary/5 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-20 -right-20 w-32 h-32 bg-secondary/5 rounded-full blur-2xl"></div>
        
        <header className="relative mb-8">
          <Breadcrumb 
            items={[
              { name: "Home", href: "/" },
              { name: "Blog", href: "/blogs" },
              { name: post.title, href: `/blogs/${post.slug}` }
            ]} 
          />
          
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight text-foreground mb-6">
            {post.title}
          </h1>
          
          {post.excerpt && (
            <p className="text-lg text-muted-foreground leading-relaxed mb-6 max-w-3xl">
              {post.excerpt}
            </p>
          )}
          
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground border-t border-b border-border py-4">
            {post.published_at && (
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <time dateTime={post.published_at}>
                  {new Date(post.published_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
              </div>
            )}
            
            {post.tags && post.tags.length > 0 && (
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <div className="flex flex-wrap gap-1">
                  {post.tags.slice(0, 3).map((tag) => (
                    <span 
                      key={tag}
                      className="px-2 py-1 bg-muted text-muted-foreground rounded-full text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </header>

        {post.cover_image && (
          <figure className="my-8 overflow-hidden rounded-2xl bg-muted shadow-2xl">
            <div className="relative aspect-[16/9] w-full">
              <Image
                src={post.cover_image || "/placeholder.svg"}
                alt={post.title}
                fill
                sizes="(max-width: 768px) 100vw, 768px"
                priority={false}
                className="object-cover transition-transform duration-300 hover:scale-105"
              />
            </div>
            {post.excerpt && (
              <figcaption className="p-4 text-sm text-muted-foreground bg-muted/50">
                {post.excerpt}
              </figcaption>
            )}
          </figure>
        )}

        <section
          className="blog-content prose prose-lg prose-neutral max-w-none prose-a:text-primary prose-img:rounded-lg prose-img:shadow-lg prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:bg-muted/50 prose-blockquote:pl-6 prose-blockquote:py-4 prose-blockquote:rounded-r-lg prose-pre:bg-muted prose-pre:border prose-pre:shadow-sm prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono prose-ul:space-y-2 prose-ol:space-y-2 prose-li:marker:text-primary prose-table:border-collapse prose-table:border prose-table:border-border prose-th:bg-muted prose-th:border prose-th:border-border prose-th:px-4 prose-th:py-2 prose-th:text-left prose-th:font-semibold prose-td:border prose-td:border-border prose-td:px-4 prose-td:py-2"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        
        {/* Article footer */}
        <footer className="mt-12 pt-8 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                href="/blogs" 
                className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Blog
              </Link>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Published on</span>
              {post.published_at && (
                <time dateTime={post.published_at}>
                  {new Date(post.published_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
              )}
            </div>
          </div>
        </footer>
      </article>
    </main>
  )
}
