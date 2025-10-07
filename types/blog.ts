export type BlogPost = {
  id: string
  slug: string
  title: string
  excerpt?: string | null
  cover_image?: string | null
  tags?: string[] | null
  is_published?: boolean | null
  is_featured?: boolean | null
  published_at?: string | null // ISO date
  updated_at?: string | null
  created_at?: string | null
  scheduled_at?: string | null
  views_count?: number | null
  likes_count?: number | null
  author_id?: string | null
  // Content can be stored as pre-rendered HTML or MDX-like text.
  content_html?: string | null
  content_mdx?: string | null
  // Meta fields
  meta_title?: string | null
  meta_description?: string | null
  og_image?: string | null
  canonical_url?: string | null
  json_ld?: unknown | null
}

export type BlogPostListItem = Pick<
  BlogPost,
  "id" | "slug" | "title" | "excerpt" | "cover_image" | "published_at" | "tags"
>