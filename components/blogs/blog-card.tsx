import Link from "next/link"
import Image from "next/image"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { BlogPostListItem } from "@/types/blog"

function formatDate(iso?: string | null) {
  if (!iso) return ""
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

export function BlogCard({ post, className }: { post: BlogPostListItem; className?: string }) {
  return (
    <Card className={cn("bg-card text-card-foreground overflow-hidden", className)}>
      {post.cover_image ? (
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
          <Image
            src={post.cover_image || "/placeholder.svg"}
            alt={post.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            priority={false}
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}
      <CardHeader className="pb-2">
        <h3 className="text-pretty text-base font-semibold leading-tight">
          <Link className="hover:underline underline-offset-4" href={`/blogs/${post.slug}`}>
            {post.title}
          </Link>
        </h3>
        {post.excerpt ? (
          <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3">{post.excerpt}</p>
        ) : null}
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-2 pt-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {post.published_at ? <time dateTime={post.published_at}>{formatDate(post.published_at)}</time> : null}
        </div>
        <div className="flex flex-wrap gap-1">
          {(post.tags ?? []).slice(0, 3).map((tag) => (
            <Badge key={tag} variant="outline" className="text-foreground">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
