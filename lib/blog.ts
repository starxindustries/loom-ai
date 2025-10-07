import { createServiceClient } from "@/lib/supabase/service"
import type { BlogPost, BlogPostListItem } from "@/types/blog"

const TABLE = "blogs" // expected table name

export async function fetchBlogList(limit = 20, offset = 0): Promise<BlogPostListItem[]> {
  try {
    const supabase = createServiceClient()
    // Select minimal fields for listing; ignore rows without slug/title
    const { data, error } = await supabase
      .from(TABLE)
      .select("id, slug, title, excerpt, cover_image, published_at, tags")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error("[v0] fetchBlogList error:", error.message)
      return []
    }
    return (data ?? []).filter((p) => Boolean(p.slug && p.title)) as BlogPostListItem[]
  } catch (e: any) {
    console.error("[v0] fetchBlogList caught error:", e?.message || e)
    return []
  }
}

export async function fetchAllSlugs(): Promise<string[]> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase.from(TABLE).select("slug")
    if (error) {
      console.error("[v0] fetchAllSlugs error:", error.message)
      return []
    }
    return (data ?? []).map((r: any) => r.slug as string).filter((s) => typeof s === "string" && s.length > 0)
  } catch (e: any) {
    console.error("[v0] fetchAllSlugs caught error:", e?.message || e)
    return []
  }
}

export async function fetchPostBySlug(slug: string): Promise<BlogPost | null> {
  if (!slug) return null
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from(TABLE)
      .select(
        "id, slug, title, excerpt, cover_image, tags, published_at, updated_at, created_at, scheduled_at, views_count, likes_count, author_id, content_html, content_mdx, meta_title, meta_description, og_image, canonical_url, json_ld, is_published, is_featured",
      )
      .eq("slug", slug)
      .eq("is_published", true)
      .limit(1)
      .single()

    if (error) {
      console.error("[v0] fetchPostBySlug error:", error.message)
      return null
    }
    if (!data?.slug || !data?.title) return null
    return data as BlogPost
  } catch (e: any) {
    console.error("[v0] fetchPostBySlug caught error:", e?.message || e)
    return null
  }
}
