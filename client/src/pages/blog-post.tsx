import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Calendar, Eye, ArrowLeft, Tag } from "lucide-react";
import { motion } from "framer-motion";
import type { BlogPost } from "@shared/schema";

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function BlogPostPage() {
  const [, params] = useRoute("/blog/:slug");
  const slug = params?.slug;

  const { data: post, isLoading } = useQuery<BlogPost>({
    queryKey: [`/api/blog/${slug}`],
    enabled: !!slug,
  });

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "";
    try {
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) return "";
      return parsedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) {
      return "";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background py-12">
        <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/3 mb-4" />
            <div className="h-64 bg-muted rounded mb-8" />
            <div className="space-y-3">
              <div className="h-4 bg-muted rounded" />
              <div className="h-4 bg-muted rounded w-5/6" />
              <div className="h-4 bg-muted rounded w-4/6" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-background py-12">
        <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-2xl font-semibold mb-4">Article not found</h1>
          <p className="text-muted-foreground mb-6">The article you're looking for doesn't exist or has been removed.</p>
          <Link href="/blog">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Blog
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <motion.section
        initial="hidden"
        animate="visible"
        variants={fadeInUp}
        className="border-b bg-muted/30 py-12 md:py-16"
      >
        <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/blog">
            <Button variant="ghost" className="mb-6" data-testid="button-back-to-blog">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Blog
            </Button>
          </Link>
          
          <div className="flex flex-wrap gap-2 mb-4">
            {post.tags?.map((tag: string) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
            {post.stateIds && post.stateIds.length > 0 && (
              <Badge variant="outline">
                {post.stateIds.join(', ')}
              </Badge>
            )}
          </div>

          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-semibold text-foreground mb-4" data-testid="text-post-title">
            {post.title}
          </h1>

          <p className="text-lg text-muted-foreground mb-6">
            {post.excerpt}
          </p>

          <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(post.publishedAt)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>By {post.author}</span>
            </div>
            {post.viewCount > 0 && (
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                <span>{post.viewCount} views</span>
              </div>
            )}
          </div>
        </div>
      </motion.section>

      {/* Featured Image */}
      {post.featuredImageUrl && (
        <motion.section
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          className="py-8 bg-background"
        >
          <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <img
              src={post.featuredImageUrl}
              alt={post.title}
              className="w-full rounded-lg shadow-lg"
            />
          </div>
        </motion.section>
      )}

      {/* Content */}
      <motion.section
        initial="hidden"
        animate="visible"
        variants={fadeInUp}
        className="py-12"
      >
        <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="p-8">
            <div 
              className="prose prose-slate dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: post.content }}
              data-testid="text-post-content"
            />
          </Card>
        </div>
      </motion.section>

      {/* Footer CTA */}
      <section className="py-12 border-t bg-muted/30">
        <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-2xl font-semibold mb-4">
            Protect Your Rental Business
          </h2>
          <p className="text-muted-foreground mb-6">
            Get instant access to state-specific legal templates, compliance updates, and expert guidance.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => window.location.href = "/api/login"}
              data-testid="button-start-trial"
            >
              Start 7-Day Free Trial
            </Button>
            <Link href="/blog">
              <Button size="lg" variant="outline">
                Read More Articles
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
