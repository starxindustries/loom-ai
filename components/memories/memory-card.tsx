'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  Trash2, 
  Brain, 
  Lock, 
  Calendar, 
  FileText,
  Clock,
  Zap
} from 'lucide-react';
import { Memory } from '@/types/memory';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';

interface MemoryCardProps {
  memory: Memory;
  onDelete: (id: string) => void;
}

export function MemoryCard({ memory, onDelete }: MemoryCardProps) {
  const formatKeywords = (keywords: string[] | undefined | null) => {
    if (!keywords || keywords.length === 0) return [];
    return keywords;
  };

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'Unknown';
    }
  };

  const keywords = formatKeywords(memory.keyword_hints);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        staggerChildren: 0.1
      }
    }
  };

  const keywordVariants = {
    hidden: { opacity: 0, scale: 0.8, x: -20 },
    visible: {
      opacity: 1,
      scale: 1,
      x: 0
    },
    hover: {
      scale: 1.05
    }
  };

  const connectionVariants = {
    hidden: { pathLength: 0, opacity: 0 },
    visible: {
      pathLength: 1,
      opacity: 0.6
    }
  };

  const brainVariants = {
    hidden: { scale: 0, rotate: -180 },
    visible: {
      scale: 1,
      rotate: 0
    },
    pulse: {
      scale: [1, 1.1, 1]
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="group"
    >
      <Card className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-primary/20 hover:border-l-primary/40 overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {/* Memory Formation Visualization */}
              <div className="relative mb-6">
                {/* Brain Icon - Center of Memory */}
                <motion.div
                  variants={brainVariants}
                  animate="visible"
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10"
                >
                  <motion.div
                    animate="pulse"
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="p-3 rounded-full bg-primary/10 border-2 border-primary/20"
                  >
                    <Brain className="h-6 w-6 text-primary" />
                  </motion.div>
                </motion.div>

                {/* Keywords arranged in a circle around the brain */}
                <div className="relative h-32 flex items-center justify-center">
                  {keywords.length > 0 ? (
                    keywords.map((keyword, index) => {
                      const angle = (index * 360) / keywords.length;
                      const radius = 50;
                      const x = Math.cos((angle * Math.PI) / 180) * radius;
                      const y = Math.sin((angle * Math.PI) / 180) * radius;

                      return (
                        <motion.div
                          key={index}
                          variants={keywordVariants}
                          whileHover="hover"
                          transition={{ duration: 0.4, ease: "easeOut" }}
                          className="absolute"
                          style={{
                            left: `calc(50% + ${x}px)`,
                            top: `calc(50% + ${y}px)`,
                            transform: 'translate(-50%, -50%)'
                          }}
                        >
                          <Badge 
                            variant="default" 
                            className="text-xs font-semibold px-3 py-1.5 bg-primary text-primary-foreground shadow-lg"
                          >
                            {keyword}
                          </Badge>
                        </motion.div>
                      );
                    })
                  ) : (
                    <div className="text-center text-muted-foreground italic">
                      No keywords available
                    </div>
                  )}

                  {/* Connection lines */}
                  {keywords.length > 1 && (
                    <svg
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      viewBox="0 0 200 128"
                    >
                      {keywords.map((_, index) => {
                        const angle = (index * 360) / keywords.length;
                        const radius = 50;
                        const x1 = 100 + Math.cos((angle * Math.PI) / 180) * radius;
                        const y1 = 64 + Math.sin((angle * Math.PI) / 180) * radius;
                        const x2 = 100;
                        const y2 = 64;

                        return (
                          <motion.line
                            key={index}
                            variants={connectionVariants}
                            transition={{ duration: 0.8, ease: "easeInOut" }}
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke="currentColor"
                            strokeWidth="1"
                            className="text-primary/30"
                          />
                        );
                      })}
                    </svg>
                  )}
                </div>

                {/* Memory Formation Indicator */}
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5, duration: 0.3 }}
                  className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-2"
                >
                  <Zap className="h-4 w-4 text-primary" />
                  <span>Memory Formation</span>
                </motion.div>
              </div>

              {/* Secondary Info */}
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{formatDate(memory.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    <span>{memory.content_length || 0} chars</span>
                  </div>
                </div>
                <div className="text-xs">
                  #{memory.id.slice(-6)}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 ml-4">
              {memory.is_encrypted && (
                <Badge variant="outline" className="text-xs border-amber-200 text-amber-700 bg-amber-50">
                  <Lock className="h-3 w-3 mr-1" />
                  Encrypted
                </Badge>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Memory</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this memory? This action cannot
                      be undone and will permanently remove the memory from your collection.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onDelete(memory.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
