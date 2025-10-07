'use client';

import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  ConnectionLineType,
  useNodesState,
  useEdgesState,
  Background,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Memory } from '@/types/memory';
import { Brain, Zap, Clock, FileText, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface MemoryFlowCardsProps {
  memories: Memory[];
  onDelete: (id: string) => void;
}

// Mini Flow Component for individual memory cards
function MemoryMiniFlow({ memory }: { memory: Memory }) {
  const { nodes, edges } = useMemo(() => {
    const keywords = memory.keyword_hints || [];
    if (keywords.length === 0) {
      return { nodes: [], edges: [] };
    }

    // Central memory node
    const centralNode: Node = {
      id: 'central',
      type: 'default',
      position: { x: 100, y: 50 },
      data: { 
        label: (
          <div className="flex items-center gap-2">
            <Brain className="h-3 w-3" />
            <span className="text-xs font-medium">Memory</span>
          </div>
        )
      },
      style: {
        background: 'hsl(var(--primary))',
        color: 'hsl(var(--primary-foreground))',
        border: 'none',
        borderRadius: '8px',
        fontSize: '10px',
        width: 80,
        height: 30,
      },
    };

    // Keyword nodes
    const keywordNodes: Node[] = keywords.slice(0, 4).map((keyword, index) => {
      const angle = (index * 2 * Math.PI) / Math.min(keywords.length, 4);
      const radius = 40;
      const x = 100 + radius * Math.cos(angle);
      const y = 50 + radius * Math.sin(angle);

      return {
        id: `keyword-${index}`,
        type: 'default',
        position: { x: x - 30, y: y - 10 },
        data: { 
          label: (
            <span className="text-xs">{keyword.length > 8 ? keyword.slice(0, 8) + '...' : keyword}</span>
          )
        },
        style: {
          background: 'hsl(var(--muted))',
          color: 'hsl(var(--muted-foreground))',
          border: '1px solid hsl(var(--border))',
          borderRadius: '6px',
          fontSize: '9px',
          width: 60,
          height: 20,
        },
      };
    });

    const allNodes = [centralNode, ...keywordNodes];

    // Edges connecting keywords to central memory
    const allEdges: Edge[] = keywordNodes.map((node, index) => ({
      id: `edge-${index}`,
      source: 'central',
      target: node.id,
      type: 'smoothstep',
      style: { 
        stroke: 'hsl(var(--primary))', 
        strokeWidth: 1,
        opacity: 0.6
      },
      animated: true,
    }));

    return { nodes: allNodes, edges: allEdges };
  }, [memory]);

  const [flowNodes, , onNodesChange] = useNodesState(nodes);
  const [flowEdges, , onEdgesChange] = useEdgesState(edges);

  if (nodes.length === 0) {
    return (
      <div className="h-24 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Brain className="h-4 w-4 mx-auto mb-1 opacity-50" />
          <p className="text-xs">No keywords</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-24 w-full">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        attributionPosition="bottom-left"
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={10} size={0.5} />
      </ReactFlow>
    </div>
  );
}

// Individual Memory Card with Mini Flow
function MemoryFlowCard({ memory, onDelete }: { memory: Memory; onDelete: (id: string) => void }) {
  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'Unknown';
    }
  };

  const extractCategory = (memory: Memory): string => {
    const keywords = memory.keyword_hints || [];
    const categoryKeywords = ['personal', 'work', 'family', 'preference'];
    const foundCategory = keywords.find(k => 
      categoryKeywords.some(cat => k.toLowerCase().includes(cat))
    );
    return foundCategory || 'general';
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      personal: 'bg-blue-500',
      work: 'bg-green-500',
      family: 'bg-purple-500',
      preference: 'bg-orange-500',
      default: 'bg-primary'
    };
    return colors[category as keyof typeof colors] || colors.default;
  };

  const category = extractCategory(memory);

  return (
    <Card className="group hover:shadow-lg transition-all duration-200 border-l-4 border-l-primary/20 hover:border-l-primary/40 overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge 
              variant="secondary" 
              className={`text-xs ${getCategoryColor(category)} text-white`}
            >
              {category}
            </Badge>
            {memory.is_encrypted && (
              <Badge variant="outline" className="text-xs border-amber-200 text-amber-700 bg-amber-50">
                <Lock className="h-3 w-3 mr-1" />
                Encrypted
              </Badge>
            )}
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="h-3 w-3" />
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

        {/* Mini Flow Diagram */}
        <div className="mb-3 border rounded-md bg-muted/20">
          <MemoryMiniFlow memory={memory} />
        </div>

        {/* Keywords */}
        <div className="flex flex-wrap gap-1 mb-3">
          {memory.keyword_hints?.slice(0, 3).map((keyword, index) => (
            <Badge key={index} variant="outline" className="text-xs">
              {keyword}
            </Badge>
          ))}
          {memory.keyword_hints && memory.keyword_hints.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{memory.keyword_hints.length - 3}
            </Badge>
          )}
        </div>

        {/* Meta info */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span className="text-xs">{formatDate(memory.created_at)}</span>
            </div>
            <div className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              <span className="text-xs">{memory.content_length || 0} chars</span>
            </div>
          </div>
          <div className="text-xs">
            #{memory.id.slice(-6)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function MemoryFlowCards({ memories, onDelete }: MemoryFlowCardsProps) {
  if (memories.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
          <Brain className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No memories yet</h3>
        <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
          Start creating memories by having conversations with your AI assistant.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {memories.map((memory) => (
        <MemoryFlowCard
          key={memory.id}
          memory={memory}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
